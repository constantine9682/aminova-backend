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
    database: "master", // We connect to the default master database
    options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    connectionTimeout: 30000, // Give it 30 seconds to connect
    requestTimeout: 30000
};

app.get("/", (req, res) => res.send("API running"));

app.post("/api/sync/outbox", async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const request = pool.request();
        
        request.input("id", sql.NVarChar, req.body.id);
        request.input("payload", sql.NVarChar, JSON.stringify(req.body));

        // Create table if it doesn't exist
        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TestSync' and xtype='U') 
            CREATE TABLE TestSync (id NVARCHAR(50), payload NVARCHAR(MAX))
        `);
        
        // Insert the data
        await request.query("INSERT INTO TestSync (id, payload) VALUES (@id, @payload)");
        
        res.json({ success: true });
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));