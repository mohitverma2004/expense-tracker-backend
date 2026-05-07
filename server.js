const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./models/db");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// ===== SECURITY MIDDLEWARE =====
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts, please try again later." },
});
app.use("/api/auth/", authLimiter);

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());

// ===== ROUTES =====
const authRoutes = require("./routes/auth");
const expenseRoutes = require("./routes/expenses");

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "OK", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "ERROR", database: err.message });
  }
});

// Global error handler for uncaught exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
