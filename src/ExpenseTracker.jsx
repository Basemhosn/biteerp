import { useState, useMemo } from 'react'
import styles from './ExpenseTracker.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

function fmtFull(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const EXPENSE_CATEGORIES = [
  'Equipment repair',
  'Emergency stock',
  'Extra staff (casual)',
  'Marketing / promotions',
  'Cleaning supplies',
  'Packaging / bags',
  'Delivery / transport',
  'Maintenance',
  'Licensing / permits',
  'Other',
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

let nextExpenseId = 1

export default function ExpenseTracker({ totalOpex, mult }) {
  const monthlyBudget = (totalOpex / Math.max(mult, 1)) * 4.33

  const [expenses, setExpenses] = useState([])
  const [filterCat,   setFilterCat]   = useState('All')
  const [filterMonth, setFilterMonth] = useState('All')
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: '',
    category: 'Equipment repair',
    amount: '',
    receipt: false,
    notes: '',
  })
  const [showForm, setShowForm] = useState(false)

  const addExpense = () => {
    if (!form.description.trim() || !n(form.amount)) return
    setExpenses(prev => [{
      ...form, id: nextExpenseId++,
      amount: n(form.amount),
      month: new Date(form.date).getMonth(),
      year:  new Date(form.date).getFullYear(),
    }, ...prev])
    setForm({ date: new Date().toISOString().slice(0, 10), description: '', category: 'Equipment repair', amount: '', receipt: false, notes: '' })
    setShowForm(false)
  }

  const deleteExpense = (id) => setExpenses(prev => prev.filter(e => e.id !== id))

  const filtered = useMemo(() => expenses.filter(e => {
    if (filterCat !== 'All' && e.category !== filterCat) return false
    if (filterMonth !== 'All' && e.month !== Number(filterMonth)) return false
    return true
  }), [expenses, filterCat, filterMonth])

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0)
  const totalAll      = expenses.reduce((s, e) => s + e.amount, 0)
  const thisMonth     = new Date().getMonth()
  const thisMonthTotal = expenses.filter(e => e.month === thisMonth).reduce((s, e) => s + e.amount, 0)
  const vsMonthlyBudget = thisMonthTotal - monthlyBudget * 0.1 // 10% buffer for unplanned expenses

  const byCategory = useMemo(() => {
    const cats = {}
    expenses.forEach(e => { cats[e.category] = (cats[e.category] ?? 0) + e.amount })
    return Object.entries(cats).sort((a, b) => b[1] - a[1])
  }, [expenses])

  const months = [...new Set(expenses.map(e => e.month))].sort((a, b) => b - a)

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Expense tracker</h2>
          <p className={styles.pageSub}>Log unplanned one-off expenses against your opex budget. Keeps surprises visible before they become a problem.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(v => !v)}>+ Log expense</button>
      </div>

      <div className={styles.summaryRow}>
        {[
          { label: 'Monthly opex budget',   val: fmt(monthlyBudget),     color: '#6a9fcb', sub: 'from calculator'             },
          { label: 'This month expenses',   val: fmt(thisMonthTotal),    color: thisMonthTotal > monthlyBudget * 0.1 ? '#d47060' : '#5db88a', sub: MONTHS[thisMonth] },
          { label: 'Total logged',          val: fmt(totalAll),          color: '#0D7377', sub: expenses.length + ' expenses' },
          { label: 'Showing',               val: fmt(totalFiltered),     color: 'var(--text-primary)', sub: filtered.length + ' entries' },
        ].map(({ label, val, color, sub }) => (
          <div key={label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryVal} style={{ color }}>{val}</span>
            <span className={styles.summarySub}>{sub}</span>
          </div>
        ))}
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <div className={styles.formTitle}>Log expense</div>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={styles.formInput} />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={styles.formInput}>
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.formField} style={{ gridColumn: '1 / -1' }}>
              <label className={styles.formLabel}>Description *</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Replaced display fridge compressor" className={styles.formInput} />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Amount (AED) *</label>
              <div className={styles.amtWrap}>
                <span className={styles.amtPre}>AED</span>
                <input type="number" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className={styles.formInput} style={{ paddingLeft: 4 }} />
              </div>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Notes</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional details" className={styles.formInput} />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Receipt</label>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={form.receipt} onChange={e => setForm(p => ({ ...p, receipt: e.target.checked }))} />
                <span>Receipt obtained</span>
              </label>
            </div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={addExpense}>Save expense</button>
            <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={styles.mainRow}>
        {/* Table */}
        <div className={styles.tableSection}>
          <div className={styles.toolbar}>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={styles.filterSelect}>
              <option value="All">All categories</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className={styles.filterSelect}>
              <option value="All">All months</option>
              {months.map(m => <option key={m} value={m}>{MONTHS[m]}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              {expenses.length === 0 ? 'No expenses logged yet — click "+ Log expense" to start' : 'No expenses match this filter'}
            </div>
          ) : (
            <div className={styles.tableCard}>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Receipt</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id}>
                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11 }}>{e.date}</td>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{e.description}</div>
                          {e.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.notes}</div>}
                        </td>
                        <td><span className={styles.catBadge}>{e.category}</span></td>
                        <td style={{ color: '#d47060', fontWeight: 500 }}>{fmtFull(e.amount)}</td>
                        <td style={{ textAlign: 'center', fontSize: 13 }}>{e.receipt ? '✓' : '—'}</td>
                        <td><button className={styles.deleteBtn} onClick={() => deleteExpense(e.id)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                  {filtered.length > 1 && (
                    <tfoot>
                      <tr className={styles.totalRow}>
                        <td colSpan={3} style={{ fontWeight: 500 }}>Total</td>
                        <td style={{ color: '#d47060', fontWeight: 600 }}>{fmtFull(totalFiltered)}</td>
                        <td /><td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <div className={styles.breakdownCard}>
            <div className={styles.breakdownTitle}>By category</div>
            {byCategory.map(([cat, amount]) => {
              const pct = totalAll > 0 ? (amount / totalAll) * 100 : 0
              return (
                <div key={cat} className={styles.breakdownRow}>
                  <span className={styles.breakdownCat}>{cat}</span>
                  <div className={styles.breakdownBarWrap}>
                    <div className={styles.breakdownBar} style={{ width: pct + '%' }} />
                  </div>
                  <span className={styles.breakdownAmt}>{fmt(amount)}</span>
                </div>
              )
            })}
            <div className={styles.breakdownTotal}>
              <span>Total all time</span>
              <span style={{ color: '#d47060', fontWeight: 600 }}>{fmt(totalAll)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
