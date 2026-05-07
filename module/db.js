const { Pool } = require("pg");
require("dotenv").config();

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Add these for better connection handling
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on module load
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection error:", err.message);
  } else {
    console.log("✅ Connected to PostgreSQL database");
    release();
  }
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});

module.exports = pool;