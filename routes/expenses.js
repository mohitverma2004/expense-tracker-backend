const express = require("express");
const router = express.Router();
const { body, query, validationResult } = require("express-validator");
const pool = require("../models/db");
const auth = require("../middleware/auth");

const CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Health", "Entertainment", "Other"];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });
  next();
};

router.use(auth);

// ── GET /api/expenses ──────────────────────────────────────
router.get("/", async (req, res) => {
  const { month, year, category, search } = req.query;

  let query = "SELECT * FROM expenses WHERE user_id = $1";
  const params = [req.user.id];

  if (month && year) {
    params.push(month, year);
    query += ` AND EXTRACT(MONTH FROM date) = $${params.length - 1} AND EXTRACT(YEAR FROM date) = $${params.length}`;
  }
  if (category && CATEGORIES.includes(category)) {
    params.push(category);
    query += ` AND category = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    query += ` AND LOWER(title) LIKE LOWER($${params.length})`;
  }

  query += " ORDER BY date DESC";

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/expenses/summary ──────────────────────────────
// IMPORTANT: /summary and /export must come BEFORE /:id
router.get("/summary", async (req, res) => {
  const m = req.query.month || new Date().getMonth() + 1;
  const y = req.query.year  || new Date().getFullYear();

  try {
    // Category totals
    const catResult = await pool.query(
      `SELECT category, SUM(amount)::numeric(10,2) as total
       FROM expenses
       WHERE user_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3
       GROUP BY category ORDER BY total DESC`,
      [req.user.id, m, y]
    );

    // Monthly total
    const totalResult = await pool.query(
      `SELECT COALESCE(SUM(amount),0)::numeric(10,2) as total
       FROM expenses
       WHERE user_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3`,
      [req.user.id, m, y]
    );

    // Last 6 months trend
    const trendResult = await pool.query(
      `SELECT TO_CHAR(date, 'Mon YYYY') as month,
              EXTRACT(MONTH FROM date) as month_num,
              EXTRACT(YEAR FROM date) as year_num,
              SUM(amount)::numeric(10,2) as total
       FROM expenses
       WHERE user_id=$1 AND date >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(date, 'Mon YYYY'), EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date)
       ORDER BY year_num, month_num`,
      [req.user.id]
    );

    // User budget
    const budgetResult = await pool.query(
      "SELECT monthly_budget FROM users WHERE id=$1",
      [req.user.id]
    );

    res.json({
      categories: catResult.rows,
      total_this_month: totalResult.rows[0].total,
      monthly_budget: budgetResult.rows[0].monthly_budget,
      trend: trendResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/expenses/export ───────────────────────────────
router.get("/export", async (req, res) => {
  const m = req.query.month || new Date().getMonth() + 1;
  const y = req.query.year  || new Date().getFullYear();

  try {
    const result = await pool.query(
      `SELECT title, amount, category, note, TO_CHAR(date,'YYYY-MM-DD') as date
       FROM expenses
       WHERE user_id=$1 AND EXTRACT(MONTH FROM date)=$2 AND EXTRACT(YEAR FROM date)=$3
       ORDER BY date DESC`,
      [req.user.id, m, y]
    );

    const header = "Title,Amount (₹),Category,Note,Date\n";
    const csv = result.rows
      .map(r => `"${r.title}",${r.amount},"${r.category}","${r.note || ""}","${r.date}"`)
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=expenses_${m}_${y}.csv`);
    res.send(header + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/expenses ─────────────────────────────────────
router.post("/",
  [
    body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 150 }),
    body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be a positive number"),
    body("category").isIn(CATEGORIES).withMessage("Invalid category"),
    body("date").isDate().withMessage("Invalid date format"),
    body("note").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    const { title, amount, category, note, date } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO expenses (user_id,title,amount,category,note,date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        [req.user.id, title, amount, category, note || "", date]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── PUT /api/expenses/:id ──────────────────────────────────
router.put("/:id",
  [
    body("title").trim().notEmpty().isLength({ max: 150 }),
    body("amount").isFloat({ min: 0.01 }),
    body("category").isIn(CATEGORIES),
    body("date").isDate(),
    body("note").optional().trim().isLength({ max: 500 }),
  ],
  validate,
  async (req, res) => {
    const { title, amount, category, note, date } = req.body;
    const { id } = req.params;
    try {
      const check = await pool.query(
        "SELECT id FROM expenses WHERE id=$1 AND user_id=$2",
        [id, req.user.id]
      );
      if (check.rows.length === 0)
        return res.status(404).json({ error: "Expense not found." });

      const result = await pool.query(
        "UPDATE expenses SET title=$1,amount=$2,category=$3,note=$4,date=$5 WHERE id=$6 RETURNING *",
        [title, amount, category, note, date, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── DELETE /api/expenses/:id ───────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const check = await pool.query(
      "SELECT id FROM expenses WHERE id=$1 AND user_id=$2",
      [id, req.user.id]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ error: "Expense not found." });

    await pool.query("DELETE FROM expenses WHERE id=$1", [req.params.id]);
    res.json({ message: "Expense deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
