const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

dotenv.config();

const app = express();

// ── Security headers (prevents XSS, clickjacking etc.) ──
app.use(helmet());

// ── CORS ──
app.use(cors({
  origin: process.env.CLIENT_URL || "https://financepro-tracker.netlify.app",
  credentials: true,
}));

app.use(express.json());

// ── Rate limiting: max 20 requests per 15 min on auth routes ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── General API limiter: 100 requests per minute ──
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many requests. Please slow down." },
});

// ── Routes ──
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/expenses", apiLimiter, require("./routes/expenses"));

// ── Health check ──
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Root ──
app.get("/", (req, res) => {
  res.json({
    message: "Expense Tracker API is running",
    version: "2.0.0",
    endpoints: {
      health: "/api/health",
      register: "/api/auth/register",
      login: "/api/auth/login",
      expenses: "/api/expenses",
      export: "/api/expenses/export",
      summary: "/api/expenses/summary",
    },
  });
});

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
