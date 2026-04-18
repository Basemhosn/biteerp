import styles from './CompetitorBenchmarks.module.css'

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

const BENCHMARKS = [
  {
    category: 'Revenue & Margins',
    icon: '📈',
    metrics: [
      { label: 'Avg weekly revenue — small Dubai F&B',          low: 80000,  mid: 130000, high: 220000, unit: 'AED/wk',  note: 'Convenience stores & small grocers in Dubai' },
      { label: 'Gross margin — prepared food / deli',           low: 40,     mid: 55,     high: 70,     unit: '%',       note: 'Higher margin for hot/prepared items' },
      { label: 'Gross margin — beverages',                      low: 50,     mid: 70,     high: 85,     unit: '%',       note: 'Juice bars can achieve 80%+' },
      { label: 'Gross margin — packaged grocery',               low: 18,     mid: 28,     high: 38,     unit: '%',       note: 'Competitive with supermarkets' },
      { label: 'Net profit margin — small F&B Dubai',           low: 5,      mid: 12,     high: 22,     unit: '%',       note: 'After all taxes and UAE levies' },
    ],
  },
  {
    category: 'Costs & Expenses',
    icon: '💰',
    metrics: [
      { label: 'Retail rent — Dubai Mall / DIFC',               low: 180,    mid: 350,    high: 600,    unit: 'AED/sqft/yr', note: 'Prime locations' },
      { label: 'Retail rent — JBR / Business Bay',              low: 120,    mid: 200,    high: 320,    unit: 'AED/sqft/yr', note: 'Secondary prime' },
      { label: 'Retail rent — neighbourhood / community',       low: 60,     mid: 110,    high: 180,    unit: 'AED/sqft/yr', note: 'JVC, Al Barsha, Discovery Gardens' },
      { label: 'Staff cost as % of revenue',                    low: 18,     mid: 26,     high: 35,     unit: '%',           note: 'Higher for labour-intensive F&B' },
      { label: 'DEWA electricity — retail unit 500sqft',        low: 3500,   mid: 6000,   high: 10000,  unit: 'AED/mo',      note: 'With refrigeration and cooking' },
      { label: 'District cooling — mall unit',                  low: 3000,   mid: 5500,   high: 9000,   unit: 'AED/mo',      note: 'Varies by Emicool/Empower zone' },
    ],
  },
  {
    category: 'Operations',
    icon: '⚙️',
    metrics: [
      { label: 'Average basket size — convenience store',       low: 35,     mid: 75,     high: 150,    unit: 'AED',         note: 'Per transaction' },
      { label: 'Daily footfall — 500sqft neighbourhood store',  low: 80,     mid: 160,    high: 300,    unit: 'customers',   note: 'Weekdays; Fri/Sat can double' },
      { label: 'Food waste as % of COGS',                       low: 3,      mid: 7,      high: 14,     unit: '%',           note: 'Higher for fresh/perishable items' },
      { label: 'Staff hours per week — small store',            low: 280,    mid: 420,    high: 560,    unit: 'hrs/wk',      note: 'Including all shifts' },
      { label: 'Trade licence renewal — food retail',           low: 12000,  mid: 22000,  high: 40000,  unit: 'AED/yr',      note: 'DED + DHA food safety permits' },
    ],
  },
  {
    category: 'UAE Regulatory',
    icon: '📋',
    metrics: [
      { label: 'VAT — standard rated F&B',                      low: 5,      mid: 5,      high: 5,      unit: '%',           note: 'Fixed rate — hot food, beverages, snacks' },
      { label: 'VAT — zero rated (basic food)',                  low: 0,      mid: 0,      high: 0,      unit: '%',           note: 'Fresh produce, bread, eggs, meat' },
      { label: 'Corporate tax threshold',                        low: 375000, mid: 375000, high: 375000, unit: 'AED/yr',      note: '9% applies above this annual profit' },
      { label: 'End-of-service gratuity — 1st 5 years',         low: 21,     mid: 21,     high: 21,     unit: 'days/yr',     note: 'UAE Labour Law — per year of service' },
      { label: 'Municipality fee — food outlets',                low: 5,      mid: 5,      high: 5,      unit: '%',           note: 'Applied on revenues' },
    ],
  },
]

export default function CompetitorBenchmarks({ weeklyRev, weeklyCOGS, totalOpex, mult, salaryVal, rentVal, elecVal }) {
  const weeklyOpex    = totalOpex / Math.max(mult, 1)
  const grossMargin   = weeklyRev > 0 ? Math.round(((weeklyRev - weeklyCOGS) / weeklyRev) * 100) : null
  const netMargin     = weeklyRev > 0 ? Math.round(((weeklyRev - weeklyCOGS - weeklyOpex) / weeklyRev) * 100) : null
  const staffPct      = weeklyRev > 0 ? Math.round((salaryVal / Math.max(mult,1) / weeklyRev) * 100) : null

  const yourMetrics = {
    'Avg weekly revenue — small Dubai F&B':   { val: weeklyRev,   unit: 'AED/wk' },
    'Gross margin — prepared food / deli':    { val: grossMargin, unit: '%' },
    'Net profit margin — small F&B Dubai':    { val: netMargin,   unit: '%' },
    'Staff cost as % of revenue':             { val: staffPct,    unit: '%' },
    'DEWA electricity — retail unit 500sqft': { val: elecVal / Math.max(mult,1) * 4.33, unit: 'AED/mo' },
  }

  const getRating = (metric, yourVal) => {
    if (yourVal === null || yourVal === undefined) return null
    if (yourVal >= metric.high) return 'top'
    if (yourVal >= metric.mid)  return 'good'
    if (yourVal >= metric.low)  return 'ok'
    return 'low'
  }

  const RATING_LABELS = { top: '🔝 Top quartile', good: '✓ Above median', ok: '~ Below median', low: '↓ Bottom quartile' }
  const RATING_COLORS = { top: '#5db88a', good: '#6a9fcb', ok: '#0D7377', low: '#d47060' }

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Competitor benchmarks</h2>
          <p className={styles.pageSub}>Dubai retail & F&B industry benchmarks. Where applicable, your current figures are shown for comparison.</p>
        </div>
      </div>

      <div className={styles.disclaimer}>
        ℹ Benchmarks are estimates based on Dubai retail industry data and DED/DHA published figures. Your performance will vary based on location, format, and execution.
      </div>

      {BENCHMARKS.map(section => (
        <div key={section.category} className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>{section.icon}</span>
            <span className={styles.sectionTitle}>{section.category}</span>
          </div>
          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Low end</th>
                    <th>Median</th>
                    <th>High end</th>
                    <th>Your figure</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {section.metrics.map(m => {
                    const yours    = yourMetrics[m.label]
                    const yourVal  = yours?.val
                    const rating   = yours ? getRating(m, yourVal) : null
                    const isFixed  = m.low === m.mid && m.mid === m.high
                    const fmtV = (v) => m.unit === 'AED/wk' || m.unit === 'AED/mo' || m.unit === 'AED/yr' || m.unit === 'AED'
                      ? fmt(v) : m.unit === '%' ? v + '%' : v.toLocaleString('en-AE') + ' ' + m.unit
                    return (
                      <tr key={m.label}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)', maxWidth: 220 }}>{m.label}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{isFixed ? '—' : fmtV(m.low)}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{fmtV(m.mid)}</td>
                        <td style={{ color: '#5db88a' }}>{isFixed ? '—' : fmtV(m.high)}</td>
                        <td>
                          {yourVal !== null && yourVal !== undefined ? (
                            <div className={styles.yourCell}>
                              <span style={{ fontWeight: 600, color: rating ? RATING_COLORS[rating] : 'var(--text-primary)' }}>
                                {fmtV(yourVal)}
                              </span>
                              {rating && <span className={styles.ratingBadge} style={{ color: RATING_COLORS[rating] }}>{RATING_LABELS[rating]}</span>}
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180 }}>{m.note}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
