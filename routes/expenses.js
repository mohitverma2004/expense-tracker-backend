import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { FiEdit2, FiTrash2, FiPlus, FiX, FiCalendar, FiTag, FiDollarSign } from 'react-icons/fi';

const API_URL = 'https://expense-tracker-api-wrxh.onrender.com/api';

const CATEGORIES = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Other'];
const CATEGORY_ICONS = {
  Food: '🍔', Transport: '🚗', Bills: '💡', 
  Shopping: '🛍️', Health: '💊', Entertainment: '🎬', Other: '📌'
};

function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Food',
    note: '',
    date: new Date().toISOString().split('T')[0]
  });

  const token = localStorage.getItem('token');

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/expenses`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { month: selectedMonth, year: selectedYear }
      });
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        toast.error('Failed to load expenses');
      }
    } finally {
      setLoading(false);
    }
  }, [token, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!formData.date) {
      toast.error('Please select a date');
      return;
    }
    
    try {
      const expenseData = {
        title: formData.title.trim(),
        amount: parseFloat(formData.amount),
        category: formData.category,
        note: formData.note || '',
        date: formData.date
      };
      
      if (editingExpense) {
        await axios.put(`${API_URL}/expenses/${editingExpense.id}`, expenseData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Expense updated successfully!');
      } else {
        await axios.post(`${API_URL}/expenses`, expenseData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Expense added successfully!');
      }
      
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else {
        toast.error(error.response?.data?.error || 'Failed to save expense');
      }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await axios.delete(`${API_URL}/expenses/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Expense deleted successfully!');
        fetchExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
        if (error.response?.status === 401) {
          toast.error('Session expired. Please login again.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        } else {
          toast.error('Failed to delete expense');
        }
      }
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      note: expense.note || '',
      date: expense.date.split('T')[0]
    });
    setShowForm(true);
    // Scroll to form
    setTimeout(() => {
      document.getElementById('expense-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormData({
      title: '',
      amount: '',
      category: 'Food',
      note: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowForm(false);
  };

  const formatINR = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const totalAmount = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <Toaster position="top-right" />
      
      {/* Page Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Expenses</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Manage all your transactions
            </p>
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all touch-manipulation"
          >
            {showForm ? <FiX size={18} /> : <FiPlus size={18} />}
            {showForm ? 'Cancel' : 'Add Expense'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <FiCalendar className="text-gray-400" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            >
              {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-500">Total:</span>
            <span className="text-xl font-bold text-indigo-600">{formatINR(totalAmount)}</span>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div id="expense-form" className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6 border border-indigo-100 dark:border-indigo-900">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
              {editingExpense ? 'Edit Expense' : 'Add New Expense'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Title *"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <input
                type="number"
                placeholder="Amount (₹) *"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                step="1"
              />
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>
                ))}
              </select>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <textarea
                placeholder="Note (optional)"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="md:col-span-2 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows="2"
              />
              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors touch-manipulation"
                >
                  {editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors touch-manipulation"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Expenses List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-500 dark:text-gray-400">No expenses found for this period</p>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              + Add your first expense
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => (
              <div
                key={expense.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex flex-wrap md:flex-nowrap justify-between items-center gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-gray-100 dark:bg-gray-700">
                    {CATEGORY_ICONS[expense.category] || '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-white truncate">{expense.title}</p>
                    <div className="flex flex-wrap gap-2 items-center mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <FiTag size={10} /> {expense.category}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <FiCalendar size={10} /> {formatDate(expense.date)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-bold text-red-500">{formatINR(expense.amount)}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors touch-manipulation"
                    >
                      <FiEdit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors touch-manipulation"
                    >
                      <FiTrash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExpensesPage;