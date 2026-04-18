import { useState, useMemo } from 'react'
import styles from './WastageTracker.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtS(val) {
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

const CATEGORIES = [
  { key: 'deli',  label: 'Hot Food / Deli',        color: '#0D7377', benchmark: 8  },
  { key: 'juice', label: 'Juices & Smoothies',     color: '#6a9fcb', benchmark: 12 },
  { key: 'bev',   label: 'Beverages',              color: '#5db88a', benchmark: 3  },
  { key: 'snack', label: 'Snacks & Confectionery', color: '#d47060', benchmark: 4  },
  { key: 'groc',  label: 'Grocery & Household',    color: '#9b85c4', benchmark: 6  },
]

const WEEKS = ['Week 1', 'Week 2', 'Week 3', 'Week 4']

const WASTAGE_REASONS = ['Expired', 'Overproduction', 'Damaged', 'Theft / shrinkage', 'Quality rejection', 'Other']

export default function WastageTracker({ deliCost, juiceCost, bevCost, snackCost, grocCost }) {
  const budgets = { deli: n(deliCost), juice: n(juiceCost), bev: n(bevCost), snack: n(snackCost), groc: n(grocCost) }

  const [wastage, setWastage] = useState(() => {
    const init = {}
    CATEGORIES.forEach(c => { init[c.key] = WEEKS.map(() => '') })
    return init
  })

  const [reasons, setReasons] = useState(() => {
    const init = {}
    CATEGORIES.forEach(c => { init[c.key] = WEEKS.map(() => 'Expired') })
    return init
  })

  const handleWastage = (catKey, wi, val) => setWastage(prev => ({ ...prev, [catKey]: prev[catKey].map((v, i) => i === wi ? val : v) }))
  const handleReason  = (catKey, wi, val) => setReasons(prev => ({ ...prev, [catKey]: prev[catKey].map((v, i) => i === wi ? val : v) }))

  const stats = useMemo(() => CATEGORIES.map(cat => {
    const budget      = budgets[cat.key]
    const weeklyW     = wastage[cat.key].map(v => n(v))
    const totalW      = weeklyW.reduce((s, v) => s + v, 0)
    const enteredWeeks = wastage[cat.key].filter(v => v !== '').length
    const avgW        = enteredWeeks > 0 ? totalW / enteredWeeks : 0
    const wastePct    = budget > 0 ? (avgW / budget) * 100 : 0
    const annualImpact = avgW * 52
    const overBenchmark = wastePct - cat.benchmark
    return { ...cat, budget, weeklyW, totalW, avgW, wastePct, annualImpact, overBenchmark, enteredWeeks }
  }), [wastage, budgets])

  const totalWeeklyWastage = stats.reduce((s, c) => s + c.avgW, 0)
  const totalWeeklyCOGS    = Object.values(budgets).reduce((s, v) => s + v, 0)
  const overallWastePct    = totalWeeklyCOGS > 0 ? (totalWeeklyWastage / totalWeeklyCOGS) * 100 : 0
  const annualWastageTotal = totalWeeklyWastage * 52

  const reasonSummary = useMemo(() => {
    const counts = {}
    WASTAGE_REASONS.forEach(r => { counts[r] = 0 })
    CATEGORIES.forEach(cat => {
      wastage[cat.key].forEach((w, wi) => {
        if (n(w) > 0) counts[reasons[cat.key][wi]] = (counts[reasons[cat.key][wi]] || 0) + n(w)
      })
    })
    return Object.entries(counts).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  }, [wastage, reasons])

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Wastage tracker</h2>
          <p className={styles.pageSub}>Log weekly food waste by category to see its impact on your effective COGS margin. Industry benchmarks shown for comparison.</p>
        </div>
      </div>

      <div className={styles.summaryRow}>
        {[
          { label: 'Avg weekly wastage',  val: fmtS(totalWeeklyWastage), color: totalWeeklyWastage > 0 ? '#d47060' : 'var(--text-muted)', sub: 'across all categories' },
          { label: 'Wastage % of COGS',   val: overallWastePct.toFixed(1) + '%', color: overallWastePct > 8 ? '#d47060' : overallWastePct > 4 ? '#0D7377' : '#5db88a', sub: 'target: below 5%' },
          { label: 'Projected annual',    val: fmtS(annualWastageTotal),  color: '#d47060', sub: 'at current rate' },
          { label: 'Worst category',      val: stats.sort((a, b) => b.wastePct - a.wastePct)[0]?.label ?? '—', color: '#0D7377', sub: 'highest waste %', isText: true },
        ].map(({ label, val, color, sub, isText }) => (
          <div key={label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryVal} style={{ color, fontSize: isText ? 14 : 20 }}>{val}</span>
            <span className={styles.summarySub}>{sub}</span>
          </div>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableTitle}>Weekly wastage entry (AED cost of wasted items)</div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Weekly budget</th>
                {WEEKS.map(w => <th key={w}>{w}</th>)}
                <th>Avg/wk</th>
                <th>Waste %</th>
                <th>vs benchmark</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(cat => {
                const s = stats.find(st => st.key === cat.key)
                return (
                  <tr key={cat.key}>
                    <td>
                      <div className={styles.catCell}>
                        <span className={styles.catDot} style={{ background: cat.color }} />
                        {cat.label}
                      </div>
                      <div className={styles.benchmarkNote}>Benchmark: {cat.benchmark}%</div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmt(s.budget)}</td>
                    {WEEKS.map((_, wi) => (
                      <td key={wi}>
                        <div className={styles.cellGroup}>
                          <div className={styles.inputWrap}>
                            <span className={styles.pre}>AED</span>
                            <input
                              type="number" min="0"
                              value={wastage[cat.key][wi]}
                              onChange={e => handleWastage(cat.key, wi, e.target.value)}
                              placeholder="0"
                              className={styles.cellInput}
                            />
                          </div>
                          {n(wastage[cat.key][wi]) > 0 && (
                            <select
                              value={reasons[cat.key][wi]}
                              onChange={e => handleReason(cat.key, wi, e.target.value)}
                              className={styles.reasonSelect}
                            >
                              {WASTAGE_REASONS.map(r => <option key={r}>{r}</option>)}
                            </select>
                          )}
                        </div>
                      </td>
                    ))}
                    <td style={{ fontWeight: 500, color: '#0D7377' }}>{s.enteredWeeks > 0 ? fmt(s.avgW) : '—'}</td>
                    <td>
                      {s.enteredWeeks > 0 && (
                        <span className={styles.pctBadge} data-high={s.wastePct > cat.benchmark}>
                          {s.wastePct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td>
                      {s.enteredWeeks > 0 && (
                        <span style={{ fontSize: 12, color: s.overBenchmark > 0 ? '#d47060' : '#5db88a', fontWeight: 500 }}>
                          {s.overBenchmark > 0 ? '+' : ''}{s.overBenchmark.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.bottomRow}>
        <div className={styles.impactCard}>
          <div className={styles.impactTitle}>Annual profit impact</div>
          {stats.filter(s => s.enteredWeeks > 0).map(s => (
            <div key={s.key} className={styles.impactRow}>
              <div className={styles.impactBar} style={{ background: s.color, width: Math.min(100, s.wastePct / 20 * 100) + '%' }} />
              <span className={styles.impactLabel}>{s.label}</span>
              <span className={styles.impactPct} style={{ color: s.wastePct > s.benchmark ? '#d47060' : '#5db88a' }}>{s.wastePct.toFixed(1)}%</span>
              <span className={styles.impactAmt}>{fmtS(s.annualImpact)}/yr</span>
            </div>
          ))}
          {stats.every(s => s.enteredWeeks === 0) && <p className={styles.emptyNote}>Enter wastage data above to see annual impact</p>}
        </div>

        {reasonSummary.length > 0 && (
          <div className={styles.reasonCard}>
            <div className={styles.reasonTitle}>Wastage by reason</div>
            {reasonSummary.map(([reason, amount]) => (
              <div key={reason} className={styles.reasonRow}>
                <span className={styles.reasonLabel}>{reason}</span>
                <span className={styles.reasonAmt}>{fmt(amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
