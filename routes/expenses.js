const express = require("express");
const router = express.Router();
const pool = require("../models/db");
const auth = require("../middleware/auth");

// All routes below require login
router.use(auth);

// GET /api/expenses — get all expenses for logged in user
router.get("/", async (req, res) => {
  const { month, year, category, limit } = req.query;

  let query = "SELECT * FROM expenses WHERE user_id = $1 AND (delete_flag IS NULL OR delete_flag = 0)";
  const params = [req.user.id];

  if (month && year) {
    params.push(month, year);
    query += ` AND EXTRACT(MONTH FROM date) = $${params.length - 1} AND EXTRACT(YEAR FROM date) = $${params.length}`;
  }

  if (category) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }

  query += " ORDER BY date DESC";

  if (limit) {
    params.push(limit);
    query += ` LIMIT $${params.length}`;
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("GET expenses error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/expenses — add new expense
router.post("/", async (req, res) => {
  const { title, amount, category, note, date } = req.body;

  if (!title || !amount || !category || !date) {
    return res.status(400).json({ error: "Title, amount, category, and date are required." });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than 0." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO expenses (user_id, title, amount, category, note, date, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [req.user.id, title, amount, category, note || "", date]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST expense error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/:id — edit an expense
router.put("/:id", async (req, res) => {
  const { title, amount, category, note, date } = req.body;
  const { id } = req.params;

  if (!title || !amount || !category || !date) {
    return res.status(400).json({ error: "Title, amount, category, and date are required." });
  }

  try {
    const check = await pool.query(
      "SELECT id FROM expenses WHERE id = $1 AND user_id = $2 AND (delete_flag IS NULL OR delete_flag = 0)",
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found." });
    }

    const result = await pool.query(
      `UPDATE expenses SET title=$1, amount=$2, category=$3, note=$4, date=$5 
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [title, amount, category, note || "", date, id, req.user.id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT expense error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/expenses/:id — soft delete an expense
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const check = await pool.query(
      "SELECT id FROM expenses WHERE id = $1 AND user_id = $2 AND (delete_flag IS NULL OR delete_flag = 0)",
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found." });
    }

    await pool.query(
      "UPDATE expenses SET delete_flag = 1 WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    
    res.json({ message: "Expense deleted successfully." });
  } catch (err) {
    console.error("DELETE expense error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/summary — category totals for any month
router.get("/summary", async (req, res) => {
  const { month, year } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  try {
    const result = await pool.query(
      `SELECT category, SUM(amount) as total
       FROM expenses
       WHERE user_id = $1
         AND (delete_flag IS NULL OR delete_flag = 0)
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR FROM date) = $3
       GROUP BY category
       ORDER BY total DESC`,
      [req.user.id, m, y]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET summary error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/monthly-total — total spend for a month
router.get("/monthly-total", async (req, res) => {
  const { month, year } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE user_id = $1
         AND (delete_flag IS NULL OR delete_flag = 0)
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR FROM date) = $3`,
      [req.user.id, m, y]
    );
    res.json({ total: parseFloat(result.rows[0].total), month: m, year: y });
  } catch (err) {
    console.error("GET monthly-total error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/budget-status - Check budget vs spending
router.get("/budget-status", async (req, res) => {
  const { month, year } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  try {
    // Get user's monthly budget
    const userResult = await pool.query(
      "SELECT monthly_budget FROM users WHERE id = $1",
      [req.user.id]
    );
    const budget = userResult.rows[0]?.monthly_budget ? parseFloat(userResult.rows[0].monthly_budget) : 0;

    // Get total spent for the month
    const spentResult = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE user_id = $1
         AND (delete_flag IS NULL OR delete_flag = 0)
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR FROM date) = $3`,
      [req.user.id, m, y]
    );
    const spent = parseFloat(spentResult.rows[0]?.total) || 0;

    res.json({
      budget: budget,
      spent: spent,
      remaining: budget - spent,
      percentage: budget > 0 ? (spent / budget) * 100 : 0
    });
  } catch (err) {
    console.error("GET budget-status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/expenses/budget - Update monthly budget
router.put("/budget", async (req, res) => {
  const { monthly_budget } = req.body;

  console.log("=== BUDGET UPDATE REQUEST ===");
  console.log("Request body:", req.body);
  console.log("monthly_budget value:", monthly_budget);
  console.log("User ID:", req.user.id);
  console.log("Type of monthly_budget:", typeof monthly_budget);

  // Validate budget amount
  if (monthly_budget === undefined || monthly_budget === null) {
    console.log("ERROR: Budget amount is missing");
    return res.status(400).json({ error: "Budget amount is required" });
  }
  
  let budgetAmount;
  
  // Handle both string and number input
  if (typeof monthly_budget === 'string') {
    budgetAmount = parseFloat(monthly_budget);
  } else {
    budgetAmount = monthly_budget;
  }
  
  console.log("Parsed budget amount:", budgetAmount);
  
  if (isNaN(budgetAmount)) {
    console.log("ERROR: Budget amount is not a number");
    return res.status(400).json({ error: "Budget amount must be a valid number" });
  }
  
  if (budgetAmount < 0) {
    console.log("ERROR: Budget amount is negative");
    return res.status(400).json({ error: "Budget amount cannot be negative" });
  }

  try {
    // First check if user exists
    const userCheck = await pool.query(
      "SELECT id, monthly_budget FROM users WHERE id = $1",
      [req.user.id]
    );
    
    console.log("User found:", userCheck.rows[0]);
    
    if (userCheck.rows.length === 0) {
      console.log("ERROR: User not found");
      return res.status(404).json({ error: "User not found" });
    }
    
    // Update the budget
    const result = await pool.query(
      "UPDATE users SET monthly_budget = $1 WHERE id = $2 RETURNING monthly_budget",
      [budgetAmount, req.user.id]
    );
    
    console.log("Update result:", result.rows[0]);
    console.log("Budget updated successfully to:", budgetAmount);
    
    res.json({ 
      monthly_budget: parseFloat(result.rows[0].monthly_budget),
      message: "Budget updated successfully"
    });
  } catch (err) {
    console.error("Budget update database error:", err);
    res.status(500).json({ error: "Database error: " + err.message });
  }
});

// GET /api/expenses/trends - Get last 6 months trends
router.get("/trends", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        EXTRACT(MONTH FROM date) as month,
        EXTRACT(YEAR FROM date) as year,
        SUM(amount) as total
       FROM expenses
       WHERE user_id = $1
         AND (delete_flag IS NULL OR delete_flag = 0)
         AND date >= NOW() - INTERVAL '6 months'
       GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
       ORDER BY year DESC, month DESC`,
      [req.user.id]
    );
    
    // Format month numbers to names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedResults = result.rows.map(row => ({
      ...row,
      month: monthNames[parseInt(row.month) - 1]
    }));
    
    res.json(formattedResults);
  } catch (err) {
    console.error("GET trends error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/expenses/export — download CSV
router.get("/export", async (req, res) => {
  const { month, year } = req.query;
  const m = month || new Date().getMonth() + 1;
  const y = year || new Date().getFullYear();

  try {
    const result = await pool.query(
      `SELECT title, amount, category, note, date
       FROM expenses
       WHERE user_id = $1
         AND (delete_flag IS NULL OR delete_flag = 0)
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR FROM date) = $3
       ORDER BY date DESC`,
      [req.user.id, m, y]
    );

    const rows = result.rows;
    
    // Create CSV header and rows
    const header = "Title,Amount (₹),Category,Note,Date\n";
    const csv = rows.map((r) => {
      const title = `"${(r.title || "").replace(/"/g, '""')}"`;
      const category = `"${(r.category || "").replace(/"/g, '""')}"`;
      const note = `"${(r.note || "").replace(/"/g, '""')}"`;
      const date = new Date(r.date).toLocaleDateString('en-IN');
      return `${title},${r.amount},${category},${note},${date}`;
    }).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=expenses_${m}_${y}.csv`);
    res.send(header + csv);
  } catch (err) {
    console.error("GET export error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;