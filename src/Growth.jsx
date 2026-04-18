import { useState, useMemo } from 'react'
import styles from './Growth.module.css'

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

const TAX_RATE = 0.19 // UAE effective tax rate
const YEARS = 5

export default function Growth({ weeklyRev, weeklyCOGS, totalOpex, mult, oneTimeCost }) {
  const [revGrowth,    setRevGrowth]    = useState('15')   // % revenue growth YoY
  const [cogsGrowth,   setCogsGrowth]   = useState('8')    // % COGS growth YoY (inflation etc)
  const [opexGrowth,   setOpexGrowth]   = useState('5')    // % opex growth YoY
  const [extraYear2,   setExtraYear2]   = useState('0')    // extra investment yr 2
  const [extraYear3,   setExtraYear3]   = useState('0')    // extra investment yr 3

  const weeklyOpex = totalOpex / Math.max(mult, 1)

  const projections = useMemo(() => {
    const rows = []
    let annualRev  = weeklyRev  * 52
    let annualCOGS = weeklyCOGS * 52
    let annualOpex = weeklyOpex * 52

    for (let yr = 1; yr <= YEARS; yr++) {
      if (yr > 1) {
        annualRev  *= (1 + n(revGrowth)  / 100)
        annualCOGS *= (1 + n(cogsGrowth) / 100)
        annualOpex *= (1 + n(opexGrowth) / 100)
      }
      const oneTime    = yr === 1 ? oneTimeCost : (yr === 2 ? n(extraYear2) : yr === 3 ? n(extraYear3) : 0)
      const gross      = annualRev - annualCOGS
      const netBefore  = gross - annualOpex - oneTime
      const tax        = Math.max(0, netBefore) * TAX_RATE
      const netAfter   = netBefore - tax
      const grossMargin = annualRev > 0 ? Math.round((gross / annualRev) * 100) : 0
      const netMargin  = annualRev > 0 ? Math.round((netAfter / annualRev) * 100) : 0
      rows.push({ yr, annualRev, annualCOGS, annualOpex, oneTime, gross, netBefore, tax, netAfter, grossMargin, netMargin })
    }
    return rows
  }, [weeklyRev, weeklyCOGS, weeklyOpex, oneTimeCost, revGrowth, cogsGrowth, opexGrowth, extraYear2, extraYear3])

  // Chart values
  const maxRev = Math.max(...projections.map(p => p.annualRev), 1)
  const minNet = Math.min(...projections.map(p => p.netAfter), 0)
  const maxNet = Math.max(...projections.map(p => p.netAfter), 1)

  const COLORS = ['#6a9fcb', '#5db88a', '#0D7377', '#9b85c4', '#d47060']

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Year-over-year growth projection</h2>
          <p className={styles.pageSub}>5-year P&L forecast with compounding growth. Adjust revenue, COGS, and opex growth rates to model different trajectories.</p>
        </div>
      </div>

      {/* Growth rate controls */}
      <div className={styles.controlsCard}>
        <div className={styles.controlsTitle}>Annual growth assumptions</div>
        <div className={styles.controlsGrid}>
          {[
            { label: 'Revenue growth / yr',   val: revGrowth,  set: setRevGrowth  },
            { label: 'COGS growth / yr',       val: cogsGrowth, set: setCogsGrowth },
            { label: 'Opex growth / yr',       val: opexGrowth, set: setOpexGrowth },
            { label: 'Extra invest. — Year 2', val: extraYear2, set: setExtraYear2, pre: 'AED', suf: '' },
            { label: 'Extra invest. — Year 3', val: extraYear3, set: setExtraYear3, pre: 'AED', suf: '' },
          ].map(({ label, val, set, pre, suf }) => (
            <div key={label} className={styles.ctrlField}>
              <label className={styles.ctrlLabel}>{label}</label>
              <div className={styles.ctrlInputWrap}>
                {pre  && <span className={styles.ctrlPre}>{pre}</span>}
                <input type="number" value={val} onChange={e => set(e.target.value)} className={styles.ctrlInput} />
                {!pre && <span className={styles.ctrlSuf}>%</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Year cards */}
      <div className={styles.yearCards}>
        {projections.map((p, i) => (
          <div key={p.yr} className={styles.yearCard} style={{ '--yc': COLORS[i] }}>
            <div className={styles.yearLabel}>Year {p.yr}</div>
            <div className={styles.yearRev}>{fmt(p.annualRev)}</div>
            <div className={styles.yearRevLabel}>annual revenue</div>
            <div className={styles.yearDivider} />
            <div className={styles.yearRow}>
              <span>Gross profit</span>
              <span style={{ color: p.gross >= 0 ? '#5db88a' : '#d47060' }}>{fmt(p.gross)}</span>
            </div>
            <div className={styles.yearRow}>
              <span>Net after tax</span>
              <span style={{ color: p.netAfter >= 0 ? '#5db88a' : '#d47060', fontWeight: 500 }}>{fmt(p.netAfter)}</span>
            </div>
            <div className={styles.yearRow}>
              <span>Net margin</span>
              <span style={{ color: p.netMargin >= 0 ? '#5db88a' : '#d47060' }}>{p.netMargin}%</span>
            </div>
            {p.oneTime > 0 && (
              <div className={styles.yearNote}>Incl. {fmt(p.oneTime)} investment</div>
            )}
          </div>
        ))}
      </div>

      {/* Revenue & net chart */}
      <div className={styles.chartCard}>
        <div className={styles.chartTitle}>Revenue vs net profit — 5 year</div>
        <div className={styles.barChart}>
          {projections.map((p, i) => {
            const revPct    = (p.annualRev / maxRev) * 100
            const netPct    = maxNet > 0 ? Math.abs(p.netAfter) / maxRev * 100 : 0
            const isNegNet  = p.netAfter < 0
            return (
              <div key={p.yr} className={styles.barGroup}>
                <div className={styles.barGroupBars}>
                  {/* Revenue bar */}
                  <div className={styles.barWrap}>
                    <div className={styles.barFill} style={{ height: revPct + '%', background: COLORS[i], opacity: 0.35 }} />
                  </div>
                  {/* Net bar */}
                  <div className={styles.barWrap}>
                    <div className={styles.barFill} style={{ height: netPct + '%', background: isNegNet ? '#d47060' : COLORS[i] }} />
                  </div>
                </div>
                <div className={styles.barLabel}>Y{p.yr}</div>
              </div>
            )
          })}
        </div>
        <div className={styles.chartLegend}>
          <span><span className={styles.ldot} style={{ background: '#6a9fcb', opacity: 0.4 }} />Revenue</span>
          <span><span className={styles.ldot} style={{ background: '#5db88a' }} />Net after tax</span>
        </div>
      </div>

      {/* Full table */}
      <div className={styles.tableCard}>
        <div className={styles.tableTitle}>Full 5-year P&L projection</div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Metric</th>
                {projections.map(p => <th key={p.yr}>Year {p.yr}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Annual Revenue',    key: 'annualRev',  color: '#6a9fcb' },
                { label: 'Annual COGS',       key: 'annualCOGS', color: '#d47060', neg: true },
                { label: 'Gross Profit',      key: 'gross',      color: null,      bold: true },
                { label: 'Gross Margin',      key: 'grossMargin',color: null,      pct: true },
                { label: 'Annual Opex',       key: 'annualOpex', color: '#d47060', neg: true },
                { label: 'One-time / Extra',  key: 'oneTime',    color: '#888',    neg: true },
                { label: 'Net Before Tax',    key: 'netBefore',  color: null,      bold: true },
                { label: 'Total Tax (45%)',   key: 'tax',        color: '#d47060', neg: true },
                { label: 'Net After Tax',     key: 'netAfter',   color: null,      bold: true },
                { label: 'Net Margin',        key: 'netMargin',  color: null,      pct: true },
              ].map(({ label, key, color, neg, pct, bold }) => (
                <tr key={label}>
                  <td style={{ fontWeight: bold ? 500 : 400, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</td>
                  {projections.map(p => {
                    const val = p[key]
                    const c   = color ?? (val >= 0 ? '#5db88a' : '#d47060')
                    const display = pct ? val + '%' : fmt(neg ? -val : val)
                    return (
                      <td key={p.yr} style={{ color: c, fontWeight: bold ? 500 : 400 }}>
                        {display}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
