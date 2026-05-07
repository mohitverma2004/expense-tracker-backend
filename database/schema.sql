-- ========================================
-- Expense Tracker Database Schema
-- Run this file in your PostgreSQL database
-- ========================================

-- First, connect to the expense_tracker database:
-- \c expense_tracker;

-- ========================================
-- 1. USERS TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  monthly_budget DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 2. EXPENSES TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  category VARCHAR(50) NOT NULL,
  note TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 3. CREATE INDEXES FOR BETTER PERFORMANCE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ========================================
-- 4. SAMPLE DATA (Optional - for testing)
-- Uncomment to add sample expenses after you create a user
-- ========================================

-- First create a test user (password is "test123" hashed)
-- INSERT INTO users (name, email, password) 
-- VALUES ('Test User', 'test@example.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqUvQ6ZQqZqZqZqZqZqZqZqZqZqZq');

-- Then add sample expenses (replace user_id=1 with your actual user_id)
-- INSERT INTO expenses (user_id, title, amount, category, date) VALUES
-- (1, 'Grocery Shopping', 85.50, 'Food', '2024-01-15'),
-- (1, 'Uber Ride', 25.00, 'Transport', '2024-01-16'),
-- (1, 'Electric Bill', 120.00, 'Bills', '2024-01-20'),
-- (1, 'Netflix Subscription', 15.99, 'Entertainment', '2024-01-25'),
-- (1, 'Doctor Visit', 200.00, 'Health', '2024-01-28');

-- ========================================
-- 5. ALLOWED CATEGORIES (For reference)
-- ========================================
-- Food, Transport, Bills, Shopping, Health, Entertainment, Other

-- ========================================
-- 6. USEFUL QUERIES FOR TESTING
-- ========================================

-- Get total expenses for current month:
-- SELECT SUM(amount) FROM expenses 
-- WHERE user_id = 1 AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE);

-- Get category breakdown for current month:
-- SELECT category, SUM(amount) as total FROM expenses 
-- WHERE user_id = 1 AND EXTRACT(MONTH FROM date) = EXTRACT(MONTH FROM CURRENT_DATE)
-- GROUP BY category ORDER BY total DESC;

-- Check if user is within monthly budget:
-- SELECT 
--   u.monthly_budget as budget,
--   COALESCE(SUM(e.amount), 0) as spent,
--   u.monthly_budget - COALESCE(SUM(e.amount), 0) as remaining
-- FROM users u
-- LEFT JOIN expenses e ON u.id = e.user_id 
--   AND EXTRACT(MONTH FROM e.date) = EXTRACT(MONTH FROM CURRENT_DATE)
-- WHERE u.id = 1
-- GROUP BY u.id;

-- ========================================
-- DONE!
-- ========================================