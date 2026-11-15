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

app.get("/", (req, res) => res.send("API running"));

// --- AUTHENTICATION ROUTES (Stubs for now) ---
app.post("/auth/check-phone", (req, res) => {
    // Later, we will check if the phone number exists in the DB
    res.json({ exists: false }); 
});

app.post("/auth/verify-phone/send", (req, res) => {
    // Later, we will integrate an SMS provider
    res.json({ sent: true, cooldownSeconds: 60 });
});

app.post("/auth/verify-phone/confirm", (req, res) => {
    // Later, we will verify the actual SMS code
    res.json({ verified: true, proofToken: "fake-proof-token-123" });
});

app.post("/auth/account", (req, res) => {
    // Later, we will fetch the real account from the DB
    res.json({ account: { id: "test-account-1", phone: req.body.phone, roles: ["farmer"] } });
});

// --- SYNC ROUTES ---
app.post("/sync/operation", async (req, res) => {
    // This is the route your app is actually calling!
    try {
        const pool = await sql.connect(config);
        const request = pool.request();
        
        request.input("id", sql.NVarChar, req.body.id || "op-123");
        request.input("payload", sql.NVarChar, JSON.stringify(req.body));

        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TestSync' and xtype='U') 
            CREATE TABLE TestSync (id NVARCHAR(50), payload NVARCHAR(MAX))
        `);
        
        await request.query("INSERT INTO TestSync (id, payload) VALUES (@id, @payload)");
        
        res.json({ status: 'applied' });
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Old test route
app.post("/api/sync/outbox", (req, res) => {
    res.json({ success: true, message: "Use /sync/operation instead" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));