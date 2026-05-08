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

// ===== CORS CONFIGURATION - FIXED =====
// Define allowed origins (NO TRAILING SLASHES)
const allowedOrigins = [
  'http://localhost:3000',           // Local development
  'http://localhost:3001',           // Alternative local port
  'https://financepro-tracker.netlify.app',  // Your live frontend
  'https://calm-valkyrie-150d5d.netlify.app', // Your old Netlify URL
  process.env.CORS_ORIGIN            // Environment variable (if set)
].filter(Boolean); // Remove any undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`Blocked CORS request from: ${origin}`);
      callback(new Error(`CORS policy does not allow access from ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests explicitly
app.options('*', cors());

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

// Root route - simple message
app.get("/", (req, res) => {
  res.json({ 
    message: "Expense Tracker API is running",
    endpoints: {
      health: "/api/health",
      register: "/api/auth/register",
      login: "/api/auth/login",
      expenses: "/api/expenses"
    }
  });
});

// Global error handler for uncaught exceptions
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit immediately - let the server try to recover
  console.error("Unhandled Rejection - continuing...");
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed origins:`, allowedOrigins);
}).on("error", (err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
<<<<<<< HEAD
});
=======
});
>>>>>>> 40110c555fa2405a9b03af0b01585cf5ac38bf6d
