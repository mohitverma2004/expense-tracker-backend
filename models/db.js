const { Pool } = require("pg"); 
require("dotenv").config(); 
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  max: 20, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000, 
}); 
pool.connect((err, client, release) => { 
  if (err) { 
    console.error("? Database connection error:", err.message); 
  } else { 
    console.log("? Connected to PostgreSQL database"); 
    release(); 
  } 
}); 
pool.on("error", (err) => { 
  console.error("Unexpected database error:", err.message); 
}); 
module.exports = pool; 
