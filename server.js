const express = require("express");
const cors = require("cors");
const sql = require("mssql");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: "master",
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    connectionTimeout: 30000,
    requestTimeout: 30000
};

// Helper to get a connected pool
let poolPromise;
async function getPool() {
    if (!poolPromise) {
        poolPromise = await sql.connect(config);
    }
    return poolPromise;
}

app.get("/", (req, res) => res.send("API running"));

// --- AUTHENTICATION ROUTES (Stubs for now) ---
app.post("/auth/check-phone", (req, res) => res.json({ exists: false }));
app.post("/auth/verify-phone/send", (req, res) => res.json({ sent: true, cooldownSeconds: 60 }));
app.post("/auth/verify-phone/confirm", (req, res) => res.json({ verified: true, proofToken: "fake-proof-token-123" }));
app.post("/auth/account", (req, res) => res.json({ account: { id: "test-account-1", phone: req.body.phone, roles: ["farmer"] } }));

// --- SYNC ROUTE ---
app.post("/sync/operation", async (req, res) => {
    const { id, db, op, table, recordId, baseVersion, payload } = req.body;

    if (!id || !table || !op) {
        return res.status(400).json({ status: 'rejected', reason: 'MISSING_FIELDS' });
    }

    try {
        const pool = await getPool();
        
        // 1. Create a generic sync table to log operations if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SyncOperations' and xtype='U') 
            CREATE TABLE SyncOperations (
                OperationId NVARCHAR(50) PRIMARY KEY, 
                RecordId NVARCHAR(50),
                TableName NVARCHAR(50),
                OpType NVARCHAR(20),
                Payload NVARCHAR(MAX),
                CreatedAt DATETIME2 DEFAULT GETDATE()
            )
        `);

        // 2. Check for duplicate operation (Idempotency)
        const checkReq = pool.request();
        checkReq.input("id", sql.NVarChar, id);
        const checkResult = await checkReq.query("SELECT OperationId FROM SyncOperations WHERE OperationId = @id");
        
        if (checkResult.recordset.length > 0) {
            return res.json({ status: 'duplicate_operation' });
        }

        // 3. Insert the operation into the log
        const reqObj = pool.request();
        reqObj.input("id", sql.NVarChar, id);
        reqObj.input("recordId", sql.NVarChar, recordId || "unknown");
        reqObj.input("table", sql.NVarChar, table);
        reqObj.input("op", sql.NVarChar, op);
        reqObj.input("payload", sql.NVarChar, JSON.stringify(payload));
        
        await reqObj.query(`
            INSERT INTO SyncOperations (OperationId, RecordId, TableName, OpType, Payload) 
            VALUES (@id, @recordId, @table, @op, @payload)
        `);

        // 4. Respond with the exact status the app expects
        res.json({ 
            status: 'applied',
            remoteVersion: (baseVersion || 0) + 1 // Simulating a version bump
        });

    } catch (err) {
        console.error("Sync error:", err);
        res.status(500).json({ status: 'rejected', reason: 'DATABASE_ERROR' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));