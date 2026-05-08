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

// Trust proxy - Required for rate limiting on Render
app.set('trust proxy', 1);

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

// ===== CORS CONFIGURATION =====
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://financepro-tracker.netlify.app',
  'https://calm-valkyrie-150d5d.netlify.app',
  process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`Blocked CORS request from: ${origin}`);
      callback(null, true); // Allow anyway for testing
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());
app.use(express.json());

// ===== ROUTES =====
const authRoutes = require("./routes/auth");
const expenseRoutes = require("./routes/expenses");

// All API routes under /api
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);

// Health check - MUST be before any auth middleware
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "OK", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "ERROR", database: err.message });
  }
});

// Root route
app.get("/", (req, res) => {
  res.json({ 
    message: "Expense Tracker API is running",
    endpoints: {
      health: "/api/health",
      register: "/api/auth/register",
      login: "/api/auth/login",
      expenses: "/api/expenses",
      budget: "/api/expenses/budget",
      budgetStatus: "/api/expenses/budget-status",
      trends: "/api/expenses/trends",
      summary: "/api/expenses/summary"
    }
  });
});

// Global error handler
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed origins:`, allowedOrigins);
}).on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});