import { useState, useMemo } from 'react'
import styles from './Loan.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (!val && val !== 0) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(val) {
  if (!val && val !== 0) return '—'
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

export default function Loan({ oneTimeCost = 145000 }) {
  const [principal,    setPrincipal]    = useState(String(Math.round(oneTimeCost)))
  const [annualRate,   setAnnualRate]   = useState('8.5') // UAE bank rate
  const [termMonths,   setTermMonths]   = useState('60')
  const [downPayment,  setDownPayment]  = useState('0')
  const [extraMonthly, setExtraMonthly] = useState('0')

  const P       = n(principal) - n(downPayment)
  const r       = n(annualRate) / 100 / 12
  const T       = Math.round(n(termMonths))
  const extra   = n(extraMonthly)

  const basePayment = r > 0 && T > 0
    ? P * (r * Math.pow(1 + r, T)) / (Math.pow(1 + r, T) - 1)
    : P / T

  const schedule = useMemo(() => {
    const rows = []
    let balance = P
    let month = 0
    while (balance > 0.01 && month < T * 2) {
      month++
      const interest    = balance * r
      const baseP       = basePayment - interest
      const extraP      = Math.min(extra, balance - baseP)
      const totalP      = baseP + (extraP > 0 ? extraP : 0)
      const payment     = interest + totalP
      balance           = Math.max(0, balance - totalP)
      rows.push({ month, payment, principal: totalP, interest, balance, cumInterest: (rows[rows.length - 1]?.cumInterest ?? 0) + interest })
    }
    return rows
  }, [P, r, T, basePayment, extra])

  const totalPaid     = schedule.reduce((s, r) => s + r.payment, 0)
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0)
  const actualMonths  = schedule.length
  const savedMonths   = extra > 0 ? T - actualMonths : 0
  const savedInterest = extra > 0 ? (totalInterest - schedule.reduce((s, r) => s + r.interest, 0)) : 0

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Loan & financing calculator</h2>
          <p className={styles.pageSub}>Model your startup loan, see monthly payments, total interest, and full amortization schedule. Principal pre-filled from your one-time costs.</p>
        </div>
      </div>

      <div className={styles.mainGrid}>
        {/* Inputs */}
        <div className={styles.inputCard}>
          <div className={styles.inputTitle}>Loan parameters</div>
          {[
            { label: 'Loan principal (AED)',    val: principal,    set: setPrincipal,    suffix: '',    pre: 'AED' },
            { label: 'Down payment (AED)',      val: downPayment,  set: setDownPayment,  suffix: '',    pre: 'AED' },
            { label: 'Annual interest rate',  val: annualRate,   set: setAnnualRate,   suffix: '%',   pre: ''  },
            { label: 'Term (months)',         val: termMonths,   set: setTermMonths,   suffix: ' mo', pre: ''  },
            { label: 'Extra monthly payment', val: extraMonthly, set: setExtraMonthly, suffix: '',    pre: 'AED' },
          ].map(({ label, val, set, suffix, pre }) => (
            <div key={label} className={styles.field}>
              <label className={styles.fieldLabel}>{label}</label>
              <div className={styles.inputWrap}>
                {pre && <span className={styles.inputPre}>{pre}</span>}
                <input type="number" min="0" value={val} onChange={e => set(e.target.value)}
                  className={pre ? styles.inputWithPre : styles.inputWithSuf} />
                {suffix && <span className={styles.inputSuf}>{suffix}</span>}
              </div>
            </div>
          ))}

          <div className={styles.resultBox}>
            <div className={styles.resultRow}>
              <span>Amount financed</span>
              <span style={{ color: '#0D7377' }}>{fmt(P)}</span>
            </div>
            <div className={styles.resultRow}>
              <span>Monthly payment</span>
              <span style={{ color: '#6a9fcb', fontWeight: 500 }}>{fmt(basePayment + extra)}</span>
            </div>
            <div className={styles.resultRow}>
              <span>Total paid</span>
              <span>{fmt(totalPaid + n(downPayment))}</span>
            </div>
            <div className={styles.resultRow}>
              <span>Total interest</span>
              <span style={{ color: '#d47060' }}>{fmt(totalInterest)}</span>
            </div>
            <div className={styles.resultRow}>
              <span>Payoff time</span>
              <span style={{ color: '#5db88a' }}>{actualMonths} months{extra > 0 && savedMonths > 0 ? ` (${savedMonths} saved)` : ''}</span>
            </div>
          </div>
        </div>

        {/* Amortization visual */}
        <div className={styles.vizCard}>
          <div className={styles.vizTitle}>Principal vs interest over time</div>
          <div className={styles.vizChart}>
            {schedule.slice(0, Math.min(schedule.length, 60)).map((row, i) => {
              const total = row.principal + row.interest
              const pPct  = total > 0 ? (row.principal / total) * 100 : 0
              const iPct  = 100 - pPct
              return (
                <div key={i} className={styles.vizBar} title={`Month ${row.month}: P ${fmt(row.principal)} I ${fmt(row.interest)}`}>
                  <div style={{ height: iPct + '%', background: '#d47060', opacity: 0.7 }} />
                  <div style={{ height: pPct + '%', background: '#5db88a', opacity: 0.7 }} />
                </div>
              )
            })}
          </div>
          <div className={styles.vizLegend}>
            <span><span className={styles.dot} style={{ background: '#5db88a' }} />Principal</span>
            <span><span className={styles.dot} style={{ background: '#d47060' }} />Interest</span>
          </div>

          {/* Summary donut-style stat */}
          <div className={styles.statRow}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Interest as % of total</span>
              <span className={styles.statVal} style={{ color: '#d47060' }}>
                {totalPaid > 0 ? Math.round((totalInterest / totalPaid) * 100) : 0}%
              </span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Monthly vs weekly net</span>
              <span className={styles.statVal} style={{ color: '#6a9fcb' }}>
                {fmt(basePayment + extra)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Amortization table */}
      <div className={styles.tableCard}>
        <div className={styles.tableTitle}>Amortization schedule (first 24 months)</div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Month</th>
                <th>Payment</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Balance</th>
                <th>Cum. interest</th>
              </tr>
            </thead>
            <tbody>
              {schedule.slice(0, 24).map(row => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td style={{ color: '#0D7377', fontWeight: 500 }}>{fmt(row.payment)}</td>
                  <td style={{ color: '#5db88a' }}>{fmt(row.principal)}</td>
                  <td style={{ color: '#d47060' }}>{fmt(row.interest)}</td>
                  <td>{fmt(row.balance)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{fmt(row.cumInterest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
