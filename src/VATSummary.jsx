import { useState } from 'react'
import styles from './VATSummary.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtS(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

// UAE VAT rules:
// Standard rated (5%): prepared food, hot food, beverages, snacks
// Zero rated (0%): basic unprocessed food items — fresh veg, fruit, bread, eggs, meat
// Input VAT: VAT paid on purchases — recoverable against output VAT
const CATEGORIES = [
  { key: 'deli',  label: 'Hot Food / Shawarma / Deli', outputRate: 0.05, inputRate: 0.05, note: 'Standard rated — 5%' },
  { key: 'juice', label: 'Fresh Juices & Smoothies',   outputRate: 0.05, inputRate: 0.05, note: 'Standard rated — 5%' },
  { key: 'bev',   label: 'Beverages (non-alcoholic)',  outputRate: 0.05, inputRate: 0.05, note: 'Standard rated — 5%' },
  { key: 'snack', label: 'Snacks & Confectionery',     outputRate: 0.05, inputRate: 0.05, note: 'Standard rated — 5%' },
  { key: 'groc',  label: 'Grocery & Household',        outputRate: 0.00, inputRate: 0.00, note: 'Zero rated — basic food' },
]

const QUARTERS = [
  { key: 'q1', label: 'Q1 — Jan to Mar' },
  { key: 'q2', label: 'Q2 — Apr to Jun' },
  { key: 'q3', label: 'Q3 — Jul to Sep' },
  { key: 'q4', label: 'Q4 — Oct to Dec' },
]

export default function VATSummary({ weeklyRev, weeklyCOGS, deliRevWk, juiceRevWk, bevRevWk, snackRevWk, grocRevWk, deliCost, juiceCost, bevCost, snackCost, grocCost }) {
  const [quarter, setQuarter] = useState('q1')
  const [extraInputVAT, setExtraInputVAT] = useState('0')

  const weeks = 13 // one quarter

  const revenueByCategory = [
    { key: 'deli',  rev: n(deliRevWk)  * weeks, cogs: n(deliCost)  * weeks },
    { key: 'juice', rev: n(juiceRevWk) * weeks, cogs: n(juiceCost) * weeks },
    { key: 'bev',   rev: n(bevRevWk)   * weeks, cogs: n(bevCost)   * weeks },
    { key: 'snack', rev: n(snackRevWk) * weeks, cogs: n(snackCost) * weeks },
    { key: 'groc',  rev: n(grocRevWk)  * weeks, cogs: n(grocCost)  * weeks },
  ]

  const lines = CATEGORIES.map((cat, i) => {
    const { rev, cogs } = revenueByCategory[i]
    const outputVAT = rev  * cat.outputRate
    const inputVAT  = cogs * cat.inputRate
    return { ...cat, rev, cogs, outputVAT, inputVAT }
  })

  const totalOutputVAT = lines.reduce((s, l) => s + l.outputVAT, 0)
  const totalInputVAT  = lines.reduce((s, l) => s + l.inputVAT, 0) + n(extraInputVAT)
  const netVATPayable  = totalOutputVAT - totalInputVAT
  const totalTaxableRev = lines.filter(l => l.outputRate > 0).reduce((s, l) => s + l.rev, 0)
  const totalZeroRev    = lines.filter(l => l.outputRate === 0).reduce((s, l) => s + l.rev, 0)
  const totalRev        = lines.reduce((s, l) => s + l.rev, 0)

  const dueDate = { q1: '28 April', q2: '28 July', q3: '28 October', q4: '28 January' }[quarter]

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>VAT filing summary</h2>
          <p className={styles.pageSub}>Quarterly UAE VAT return estimate based on your Calculator figures. File with the Federal Tax Authority (FTA) via tax.gov.ae.</p>
        </div>
        <div className={styles.quarterPicker}>
          {QUARTERS.map(q => (
            <button key={q.key} className={styles.quarterBtn} data-active={quarter === q.key} onClick={() => setQuarter(q.key)}>
              {q.key.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.dueBanner}>
        <span className={styles.dueIcon}>📅</span>
        <span>Filing deadline for {QUARTERS.find(q => q.key === quarter)?.label}: <strong>{dueDate}</strong> — submit via <strong>tax.gov.ae</strong></span>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryRow}>
        {[
          { label: 'Taxable revenue',   val: totalTaxableRev, color: '#6a9fcb', sub: '5% standard rated' },
          { label: 'Zero-rated revenue',val: totalZeroRev,     color: '#9b85c4', sub: '0% VAT — basic food' },
          { label: 'Output VAT (owed)', val: totalOutputVAT,   color: '#d47060', sub: 'Collected from customers' },
          { label: 'Input VAT (credit)',val: totalInputVAT,    color: '#5db88a', sub: 'Paid on purchases' },
          { label: 'Net VAT payable',   val: netVATPayable,    color: netVATPayable >= 0 ? '#d47060' : '#5db88a', sub: netVATPayable >= 0 ? 'You owe FTA' : 'FTA owes you' },
        ].map(({ label, val, color, sub }) => (
          <div key={label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryVal} style={{ color }}>{fmtS(val)}</span>
            <span className={styles.summarySub}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div className={styles.tableCard}>
        <div className={styles.tableTitle}>Output VAT by category — {QUARTERS.find(q => q.key === quarter)?.label}</div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Category</th>
                <th>VAT treatment</th>
                <th>Quarterly revenue</th>
                <th>Output VAT rate</th>
                <th>Output VAT</th>
                <th>Input VAT (COGS)</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.key}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{l.label}</td>
                  <td><span className={styles.rateBadge} data-zero={l.outputRate === 0}>{l.note}</span></td>
                  <td>{fmt(l.rev)}</td>
                  <td style={{ color: l.outputRate > 0 ? '#d47060' : '#5db88a' }}>{(l.outputRate * 100).toFixed(0)}%</td>
                  <td style={{ color: '#d47060' }}>{fmt(l.outputVAT)}</td>
                  <td style={{ color: '#5db88a' }}>{fmt(l.inputVAT)}</td>
                  <td style={{ color: l.outputVAT - l.inputVAT >= 0 ? '#d47060' : '#5db88a', fontWeight: 500 }}>{fmt(l.outputVAT - l.inputVAT)}</td>
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td colSpan={2}>Total</td>
                <td>{fmt(totalRev)}</td>
                <td>—</td>
                <td style={{ color: '#d47060' }}>{fmt(totalOutputVAT)}</td>
                <td style={{ color: '#5db88a' }}>{fmt(totalInputVAT - n(extraInputVAT))}</td>
                <td style={{ color: netVATPayable >= 0 ? '#d47060' : '#5db88a', fontWeight: 600 }}>{fmt(netVATPayable)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Extra input VAT + FTA boxes */}
      <div className={styles.bottomRow}>
        <div className={styles.extraCard}>
          <div className={styles.extraTitle}>Additional input VAT credits</div>
          <p className={styles.extraSub}>Add VAT paid on rent, utilities, equipment, and other business expenses not captured above.</p>
          <div className={styles.extraInput}>
            <span className={styles.extraPre}>AED</span>
            <input type="number" min="0" value={extraInputVAT} onChange={e => setExtraInputVAT(e.target.value)} className={styles.extraField} placeholder="0.00" />
          </div>
        </div>

        <div className={styles.ftaCard}>
          <div className={styles.ftaTitle}>FTA return boxes (Box 1–8 estimate)</div>
          {[
            { box: '1', label: 'Standard rated sales',    val: fmt(totalTaxableRev) },
            { box: '2', label: 'Zero-rated sales',        val: fmt(totalZeroRev)    },
            { box: '3', label: 'Exempt supplies',         val: 'AED 0.00'           },
            { box: '4', label: 'Total output VAT',        val: fmt(totalOutputVAT)  },
            { box: '5', label: 'Total input VAT',         val: fmt(totalInputVAT)   },
            { box: '8', label: 'Net VAT payable / (refundable)', val: fmt(netVATPayable) },
          ].map(({ box, label, val }) => (
            <div key={box} className={styles.ftaRow}>
              <span className={styles.ftaBox}>Box {box}</span>
              <span className={styles.ftaLabel}>{label}</span>
              <span className={styles.ftaVal}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
