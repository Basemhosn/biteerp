import { useMemo } from 'react'
import styles from './CategoryBreakeven.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000)  s = (abs / 1_000).toFixed(1) + 'K'
  else                    s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

const COLORS = {
  deli:  '#0D7377',
  juice: '#6a9fcb',
  bev:   '#5db88a',
  snack: '#d47060',
  groc:  '#9b85c4',
}

// Shared opex is allocated proportionally by revenue share
function allocateOpex(categories, totalOpex) {
  const totalRev = categories.reduce((s, c) => s + c.revenue, 0)
  return categories.map(c => ({
    ...c,
    allocatedOpex: totalRev > 0 ? (c.revenue / totalRev) * totalOpex : totalOpex / categories.length,
  }))
}

export default function CategoryBreakeven({
  deliCost, deliMarkup, juiceCost, juiceMarkup,
  bevCost, bevMarkup, snackCost, snackMarkup,
  grocCost, grocMarkup, totalOpex, mult, oneTimeCost,
}) {
  const weeklyOpex = totalOpex / Math.max(mult, 1)

  const categories = useMemo(() => {
    const raw = [
      { key: 'deli',  label: 'Hot Food / Deli',        cost: n(deliCost),  markup: n(deliMarkup)  },
      { key: 'juice', label: 'Juices & Smoothies',     cost: n(juiceCost), markup: n(juiceMarkup) },
      { key: 'bev',   label: 'Beverages',              cost: n(bevCost),   markup: n(bevMarkup)   },
      { key: 'snack', label: 'Snacks & Confectionery', cost: n(snackCost), markup: n(snackMarkup) },
      { key: 'groc',  label: 'Grocery & Household',    cost: n(grocCost),  markup: n(grocMarkup)  },
    ].map(c => ({
      ...c,
      revenue:     c.cost * (1 + c.markup / 100),
      grossProfit: c.cost * (c.markup / 100),
      grossMargin: c.markup > 0 ? Math.round((c.markup / (100 + c.markup)) * 100) : 0,
    }))

    return allocateOpex(raw, weeklyOpex)
  }, [deliCost, deliMarkup, juiceCost, juiceMarkup, bevCost, bevMarkup, snackCost, snackMarkup, grocCost, grocMarkup, weeklyOpex])

  const withPL = categories.map(c => {
    const netBeforeTax = c.grossProfit - c.allocatedOpex
    const tax          = Math.max(0, netBeforeTax) * 0.19
    const netAfterTax  = netBeforeTax - tax
    const netMargin    = c.revenue > 0 ? Math.round((netAfterTax / c.revenue) * 100) : 0
    // Break-even: revenue needed so gross profit covers allocated opex
    const breakeven    = c.grossMargin > 0 ? c.allocatedOpex / (c.grossMargin / 100) : null
    const revenueGap   = breakeven !== null ? c.revenue - breakeven : null
    return { ...c, netBeforeTax, netAfterTax, netMargin, breakeven, revenueGap }
  })

  const totalRev     = withPL.reduce((s, c) => s + c.revenue, 0)
  const totalGross   = withPL.reduce((s, c) => s + c.grossProfit, 0)
  const profitCats   = withPL.filter(c => c.netAfterTax > 0)
  const lossCats     = withPL.filter(c => c.netAfterTax <= 0)
  const maxRev       = Math.max(...withPL.map(c => c.revenue), 1)

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Break-even by category</h2>
          <p className={styles.pageSub}>Which product lines are profitable on their own? Operating expenses are allocated proportionally by each category's revenue share.</p>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryRow}>
        {[
          { label: 'Profitable categories',  val: profitCats.length + ' / ' + withPL.length, color: '#5db88a',  sub: profitCats.map(c => c.label.split(' ')[0]).join(', ') || '—' },
          { label: 'Loss-making categories', val: lossCats.length,  color: lossCats.length > 0 ? '#d47060' : '#5db88a', sub: lossCats.map(c => c.label.split(' ')[0]).join(', ') || 'None' },
          { label: 'Highest margin',         val: [...withPL].sort((a,b) => b.grossMargin - a.grossMargin)[0]?.label.split('/')[0].trim() ?? '—', color: '#0D7377', sub: [...withPL].sort((a,b) => b.grossMargin - a.grossMargin)[0]?.grossMargin + '% gross margin' },
          { label: 'Biggest loss-maker',     val: [...withPL].sort((a,b) => a.netAfterTax - b.netAfterTax)[0]?.label.split('/')[0].trim() ?? '—', color: '#d47060', sub: 'most opex relative to gross' },
        ].map(({ label, val, color, sub }) => (
          <div key={label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryVal} style={{ color, fontSize: typeof val === 'string' && val.length > 6 ? 14 : 20 }}>{val}</span>
            <span className={styles.summarySub}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Category cards */}
      <div className={styles.catGrid}>
        {withPL.map(c => {
          const color    = COLORS[c.key]
          const revPct   = (c.revenue / maxRev) * 100
          const bePct    = c.breakeven ? Math.min(100, (c.breakeven / maxRev) * 100) : 0
          const isProfit = c.netAfterTax > 0
          return (
            <div key={c.key} className={styles.catCard} style={{ '--cc': color }}>
              <div className={styles.catHeader}>
                <div className={styles.catDot} style={{ background: color }} />
                <span className={styles.catLabel}>{c.label}</span>
                <span className={styles.catStatus} data-profit={isProfit}>
                  {isProfit ? '✓ Profitable' : '✗ Loss-making'}
                </span>
              </div>

              <div className={styles.catStats}>
                <div className={styles.catStat}>
                  <span className={styles.catStatLabel}>Weekly revenue</span>
                  <span className={styles.catStatVal} style={{ color }}>{fmt(c.revenue)}</span>
                </div>
                <div className={styles.catStat}>
                  <span className={styles.catStatLabel}>Gross profit</span>
                  <span className={styles.catStatVal} style={{ color: '#5db88a' }}>{fmt(c.grossProfit)}</span>
                </div>
                <div className={styles.catStat}>
                  <span className={styles.catStatLabel}>Gross margin</span>
                  <span className={styles.catStatVal}>{c.grossMargin}%</span>
                </div>
                <div className={styles.catStat}>
                  <span className={styles.catStatLabel}>Allocated opex</span>
                  <span className={styles.catStatVal} style={{ color: '#d47060' }}>{fmt(c.allocatedOpex)}</span>
                </div>
                <div className={styles.catStat}>
                  <span className={styles.catStatLabel}>Net after tax</span>
                  <span className={styles.catStatVal} style={{ color: isProfit ? '#5db88a' : '#d47060', fontWeight: 600 }}>{fmt(c.netAfterTax)}</span>
                </div>
                <div className={styles.catStat}>
                  <span className={styles.catStatLabel}>Net margin</span>
                  <span className={styles.catStatVal} style={{ color: isProfit ? '#5db88a' : '#d47060' }}>{c.netMargin}%</span>
                </div>
              </div>

              {/* Revenue vs break-even bar */}
              <div className={styles.catBar}>
                <div className={styles.catBarTrack}>
                  <div className={styles.catBarFill} style={{ width: revPct + '%', background: color }} />
                  {c.breakeven && <div className={styles.catBarBE} style={{ left: bePct + '%' }} />}
                </div>
                <div className={styles.catBarLabels}>
                  <span style={{ color }}>Rev: {fmt(c.revenue)}</span>
                  {c.breakeven && <span style={{ color: 'var(--accent)' }}>BE: {fmt(c.breakeven)}</span>}
                </div>
              </div>

              {c.revenueGap !== null && (
                <div className={styles.catGap} data-profit={c.revenueGap >= 0}>
                  {c.revenueGap >= 0
                    ? `${fmt(c.revenueGap)} above break-even`
                    : `Need ${fmt(Math.abs(c.revenueGap))} more revenue/wk to break even`
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Waterfall comparison */}
      <div className={styles.waterfallCard}>
        <div className={styles.waterfallTitle}>Net profit contribution by category (weekly)</div>
        <div className={styles.waterfall}>
          {withPL.map(c => {
            const maxAbs = Math.max(...withPL.map(cc => Math.abs(cc.netAfterTax)), 1)
            const barPct = (Math.abs(c.netAfterTax) / maxAbs) * 100
            const color  = COLORS[c.key]
            return (
              <div key={c.key} className={styles.wfRow}>
                <span className={styles.wfLabel}>{c.label}</span>
                <div className={styles.wfBarWrap}>
                  <div className={styles.wfBar} style={{ width: barPct + '%', background: c.netAfterTax >= 0 ? color : '#d47060' }} />
                </div>
                <span className={styles.wfVal} style={{ color: c.netAfterTax >= 0 ? color : '#d47060', fontWeight: 500 }}>
                  {fmt(c.netAfterTax)}
                </span>
                <span className={styles.wfPct} style={{ color: 'var(--text-muted)' }}>
                  {c.netMargin}% margin
                </span>
              </div>
            )
          })}
        </div>
        <div className={styles.waterfallNote}>
          Opex allocated proportionally by revenue share. Adjust markups in the Calculator to improve category profitability.
        </div>
      </div>
    </div>
  )
}
