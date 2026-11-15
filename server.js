const express = require("express");
const cors = require("cors");
const sql = require("mssql");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// DEBUG LINE ADDED HERE
console.log("DEBUG - DB_SERVER:", process.env.DB_SERVER, "DB_USER:", process.env.DB_USER, "DB_PASSWORD:", process.env.DB_PASSWORD);

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

app.post("/api/sync/outbox", async (req, res) => {
    try {
        const pool = await sql.connect(config);
        const request = pool.request();
        
        request.input("id", sql.NVarChar, req.body.id);
        request.input("payload", sql.NVarChar, JSON.stringify(req.body));

        await request.query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TestSync' and xtype='U') 
            CREATE TABLE TestSync (id NVARCHAR(50), payload NVARCHAR(MAX))
        `);
        
        await request.query("INSERT INTO TestSync (id, payload) VALUES (@id, @payload)");
        
        res.json({ success: true });
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server started on port " + PORT));