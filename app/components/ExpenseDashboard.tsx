'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';

type ExpenseCategory =
  | 'Housing'
  | 'Food'
  | 'Transportation'
  | 'Utilities'
  | 'Health'
  | 'Entertainment'
  | 'Shopping'
  | 'Travel'
  | 'Miscellaneous';

type PaymentMethod = 'Card' | 'Cash' | 'Transfer' | 'Other';

type Expense = {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  paymentMethod: PaymentMethod;
  note?: string;
};

type TimeRange = '7' | '30' | '90' | '365' | 'all';

const STORAGE_KEY = 'expense-dashboard-data-v1';

const CATEGORY_OPTIONS: ExpenseCategory[] = [
  'Housing',
  'Food',
  'Transportation',
  'Utilities',
  'Health',
  'Entertainment',
  'Shopping',
  'Travel',
  'Miscellaneous'
];

const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ['Card', 'Cash', 'Transfer', 'Other'];

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'This year' },
  { value: 'all', label: 'All time' }
];

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
});

const defaultExpenses: Expense[] = [
  {
    id: 'seed-1',
    description: 'Groceries',
    amount: 86.42,
    category: 'Food',
    date: new Date().toISOString(),
    paymentMethod: 'Card'
  },
  {
    id: 'seed-2',
    description: 'Gym membership',
    amount: 45.0,
    category: 'Health',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    paymentMethod: 'Transfer'
  },
  {
    id: 'seed-3',
    description: 'Ride share',
    amount: 18.75,
    category: 'Transportation',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    paymentMethod: 'Card'
  },
  {
    id: 'seed-4',
    description: 'Streaming subscription',
    amount: 13.99,
    category: 'Entertainment',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    paymentMethod: 'Card'
  },
  {
    id: 'seed-5',
    description: 'Electric bill',
    amount: 97.28,
    category: 'Utilities',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 32).toISOString(),
    paymentMethod: 'Transfer'
  }
];

const getId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const asDateOnly = (value: string) => value.split('T')[0];

const toMonthKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export default function ExpenseDashboard() {
  const [expenses, setExpenses] = useState<Expense[]>(defaultExpenses);
  const [timeRange, setTimeRange] = useState<TimeRange>('30');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [formState, setFormState] = useState({
    description: '',
    amount: '',
    date: asDateOnly(new Date().toISOString()),
    category: CATEGORY_OPTIONS[1],
    paymentMethod: PAYMENT_METHOD_OPTIONS[0],
    note: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const isHydrated = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      let nextExpenses: Expense[] = defaultExpenses;
      if (stored) {
        nextExpenses = JSON.parse(stored) as Expense[];
      } else {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultExpenses));
      }
      startTransition(() => {
        setExpenses(nextExpenses);
        isHydrated.current = true;
      });
    } catch (error) {
      console.error('Failed to read stored expenses', error);
      isHydrated.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isHydrated.current || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const from = new Date();

    if (timeRange !== 'all') {
      const days = Number(timeRange);
      from.setDate(now.getDate() - (days - 1));
    } else {
      from.setTime(0);
    }

    return expenses
      .filter(expense => {
        const matchesCategory = categoryFilter === 'all' || expense.category === categoryFilter;
        const matchesText = search.trim().length === 0 || expense.description.toLowerCase().includes(search.toLowerCase());
        const expenseDate = new Date(expense.date);
        const matchesTime = expenseDate >= from && expenseDate <= now;
        return matchesCategory && matchesText && matchesTime;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, categoryFilter, search, timeRange]);

  const totalSpend = useMemo(() => filteredExpenses.reduce((sum, item) => sum + item.amount, 0), [filteredExpenses]);

  const dailyAverage = useMemo(() => {
    if (filteredExpenses.length === 0) {
      return 0;
    }
    const rangeDays = (() => {
      if (timeRange === 'all') {
        const sorted = [...filteredExpenses].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const start = new Date(sorted[0]?.date ?? new Date());
        const end = new Date(sorted[sorted.length - 1]?.date ?? new Date());
        const diff = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        return diff;
      }
      return Number(timeRange);
    })();
    return totalSpend / rangeDays;
  }, [filteredExpenses, timeRange, totalSpend]);

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<ExpenseCategory, number>();
    filteredExpenses.forEach(expense => {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    });
    const entries = CATEGORY_OPTIONS.map(category => ({
      category,
      value: totals.get(category) ?? 0
    })).filter(item => item.value > 0);
    const grandTotal = entries.reduce((sum, item) => sum + item.value, 0) || 1;
    return entries.map(entry => ({
      ...entry,
      percentage: Math.round((entry.value / grandTotal) * 100)
    }));
  }, [filteredExpenses]);

  const topCategory = useMemo(() => {
    if (categoryBreakdown.length === 0) {
      return null;
    }
    return categoryBreakdown.reduce((top, entry) => (entry.value > (top?.value ?? 0) ? entry : top));
  }, [categoryBreakdown]);

  const monthlySeries = useMemo(() => {
    const aggregates = new Map<string, number>();
    expenses.forEach(expense => {
      const key = toMonthKey(expense.date);
      aggregates.set(key, (aggregates.get(key) ?? 0) + expense.amount);
    });
    const result = Array.from(aggregates.entries())
      .map(([month, value]) => {
        const [year, monthIndex] = month.split('-').map(Number);
        const formatted = new Date(year, (monthIndex ?? 1) - 1).toLocaleString('en-US', {
          month: 'short',
          year: '2-digit'
        });
        return { month, value, label: formatted };
      })
      .sort((a, b) => (a.month > b.month ? 1 : -1))
      .slice(-6);
    return result;
  }, [expenses]);

  const monthlyPeak = useMemo(() => {
    if (monthlySeries.length === 0) {
      return 0;
    }
    return monthlySeries.reduce((peak, entry) => Math.max(peak, entry.value), 0);
  }, [monthlySeries]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountValue = Number(formState.amount);
    if (!formState.description.trim()) {
      setFormError('Please add a short description.');
      return;
    }
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setFormError('Amount must be greater than 0.');
      return;
    }

    const newExpense: Expense = {
      id: getId(),
      description: formState.description.trim(),
      amount: Math.round(amountValue * 100) / 100,
      category: formState.category,
      date: new Date(formState.date).toISOString(),
      paymentMethod: formState.paymentMethod,
      note: formState.note.trim() || undefined
    };

    setExpenses(current => [newExpense, ...current]);
    setFormState(state => ({
      ...state,
      description: '',
      amount: '',
      note: ''
    }));
    setFormError(null);
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(current => current.filter(expense => expense.id !== id));
  };

  const recentExpenses = filteredExpenses.slice(0, 10);

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1>Personal Expense Dashboard</h1>
          <p>Log purchases, understand spending patterns, and stay intentional with money.</p>
        </div>
      </header>

      <section className="controls">
        <div className="control-group">
          <label htmlFor="time-range">Time range</label>
          <select
            id="time-range"
            value={timeRange}
            onChange={event => setTimeRange(event.target.value as TimeRange)}
          >
            {TIME_RANGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={event =>
              setCategoryFilter(event.target.value === 'all' ? 'all' : (event.target.value as ExpenseCategory))
            }
          >
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map(category => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group control-group--search">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            placeholder="Find grocery, rent, coffee..."
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
      </section>

      <section className="metrics">
        <article className="metric-card">
          <span className="metric-label">Total spent</span>
          <strong className="metric-value">{formatter.format(totalSpend)}</strong>
          <p className="metric-helper">Across {filteredExpenses.length} tracked purchases</p>
        </article>
        <article className="metric-card">
          <span className="metric-label">Daily average</span>
          <strong className="metric-value">{formatter.format(dailyAverage)}</strong>
          <p className="metric-helper">Based on selected timeframe</p>
        </article>
        <article className="metric-card">
          <span className="metric-label">Top category</span>
          <strong className="metric-value">{topCategory ? topCategory.category : 'Add entries'}</strong>
          <p className="metric-helper">
            {topCategory ? `${formatter.format(topCategory.value)} spent` : 'Keep logging to see insights'}
          </p>
        </article>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel__header">
            <h2>Add expense</h2>
            <span>Capture spending in seconds.</span>
          </div>
          <form onSubmit={handleSubmit} className="expense-form">
            <div className="field">
              <label htmlFor="description">Description</label>
              <input
                id="description"
                type="text"
                placeholder="Coffee with friends"
                value={formState.description}
                onChange={event => setFormState(state => ({ ...state, description: event.target.value }))}
                required
              />
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="amount">Amount</label>
                <input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={formState.amount}
                  onChange={event => setFormState(state => ({ ...state, amount: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="date">Date</label>
                <input
                  id="date"
                  type="date"
                  value={formState.date}
                  max={asDateOnly(new Date().toISOString())}
                  onChange={event => setFormState(state => ({ ...state, date: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={formState.category}
                  onChange={event => setFormState(state => ({ ...state, category: event.target.value as ExpenseCategory }))}
                >
                  {CATEGORY_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="payment-method">Payment method</label>
                <select
                  id="payment-method"
                  value={formState.paymentMethod}
                  onChange={event =>
                    setFormState(state => ({ ...state, paymentMethod: event.target.value as PaymentMethod }))
                  }
                >
                  {PAYMENT_METHOD_OPTIONS.map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="note">Optional note</label>
              <textarea
                id="note"
                rows={2}
                placeholder="Add context like who you were with or why it was higher than usual"
                value={formState.note}
                onChange={event => setFormState(state => ({ ...state, note: event.target.value }))}
              />
            </div>
            {formError && <p className="form-error">{formError}</p>}
            <button type="submit" className="submit-button">
              Log expense
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel__header">
            <h2>Category mix</h2>
            <span>See where money goes first.</span>
          </div>
          <div className="category-list">
            {categoryBreakdown.length === 0 && <p className="empty">Add expenses to populate category insights.</p>}
            {categoryBreakdown.map(entry => (
              <div key={entry.category} className="category-item">
                <div className="category-row">
                  <span>{entry.category}</span>
                  <strong>{formatter.format(entry.value)}</strong>
                </div>
                <div className="progress">
                  <div className="progress__fill" style={{ width: `${entry.percentage}%` }} />
                </div>
                <span className="category-percentage">{entry.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel panel--wide">
          <div className="panel__header">
            <h2>Recent activity</h2>
            <span>Up to 10 most recent expenses.</span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th aria-label="delete column" />
                </tr>
              </thead>
              <tbody>
                {recentExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty">
                      Nothing logged in this window just yet.
                    </td>
                  </tr>
                )}
                {recentExpenses.map(expense => (
                  <tr key={expense.id}>
                    <td>
                      <div>
                        <strong>{expense.description}</strong>
                        {expense.note ? <p className="muted">{expense.note}</p> : null}
                      </div>
                    </td>
                    <td>{expense.category}</td>
                    <td>{new Date(expense.date).toLocaleDateString()}</td>
                    <td>{expense.paymentMethod}</td>
                    <td>{formatter.format(expense.amount)}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => handleDeleteExpense(expense.id)}
                        aria-label={`Delete ${expense.description}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel panel--wide">
          <div className="panel__header">
            <h2>Monthly snapshot</h2>
            <span>Last 6 months trend.</span>
          </div>
          {monthlySeries.length === 0 ? (
            <p className="empty">Log more data to see monthly trends.</p>
          ) : (
            <div className="monthly-chart">
              {monthlySeries.map(entry => {
                const height = monthlyPeak === 0 ? 0 : Math.max(6, Math.round((entry.value / monthlyPeak) * 100));
                return (
                  <div key={entry.month} className="monthly-column">
                    <div className="monthly-bar" style={{ height: `${height}%` }}>
                      <span>{formatter.format(entry.value)}</span>
                    </div>
                  <span className="monthly-label">{entry.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
