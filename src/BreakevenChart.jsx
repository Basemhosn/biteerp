import { useMemo } from 'react'
import styles from './BreakevenChart.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (!val && val !== 0) return '—'
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

export default function BreakevenChart({
  weeklyRev, weeklyCOGS, totalOpex, mult, oneTimeCost,
  netAfterTax, TAXES_RATE = 0.45,
}) {
  const WEEKS = 52

  // Fixed weekly opex (totalOpex is already scaled to period, convert back to weekly)
  const weeklyOpex = totalOpex / mult
  const weeklyNet  = weeklyRev - weeklyCOGS - weeklyOpex

  // Cumulative data over 52 weeks
  const data = useMemo(() => {
    const rows = []
    for (let w = 0; w <= WEEKS; w++) {
      const cumRev   = weeklyRev  * w
      const cumCosts = weeklyCOGS * w + weeklyOpex * w + oneTimeCost
      const cumNet   = cumRev - cumCosts
      rows.push({ week: w, cumRev, cumCosts, cumNet })
    }
    return rows
  }, [weeklyRev, weeklyCOGS, weeklyOpex, oneTimeCost])

  // Find break-even week
  const breakevenWeek = data.find(d => d.cumNet >= 0)?.week ?? null

  // Chart dimensions
  const W = 680, H = 320
  const PAD = { top: 20, right: 20, bottom: 40, left: 70 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top  - PAD.bottom

  const maxY = Math.max(...data.map(d => Math.max(d.cumRev, d.cumCosts)), 1)
  const minY = Math.min(...data.map(d => d.cumNet), 0)
  const rangeY = maxY - minY

  const xScale = w  => PAD.left + (w / WEEKS) * cw
  const yScale = v  => PAD.top  + ch - ((v - minY) / rangeY) * ch

  const pathD = (key) => data.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(d.week).toFixed(1)} ${yScale(d[key]).toFixed(1)}`
  ).join(' ')

  const yTicks = 5
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => minY + (rangeY / yTicks) * i)
  const xTicks = [0, 4, 8, 13, 17, 22, 26, 30, 35, 39, 44, 48, 52]

  const zeroY = yScale(0)

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Break-even chart</h2>
          <p className={styles.pageSub}>Cumulative revenue vs cumulative costs over 52 weeks, including one-time startup costs.</p>
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Weekly revenue</span>
          <span className={styles.kpiVal} style={{ color: '#6a9fcb' }}>{fmt(weeklyRev)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Weekly total costs</span>
          <span className={styles.kpiVal} style={{ color: '#d47060' }}>{fmt(weeklyCOGS + weeklyOpex)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Weekly net</span>
          <span className={styles.kpiVal} style={{ color: weeklyNet >= 0 ? '#5db88a' : '#d47060' }}>{fmt(weeklyNet)}</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>One-time investment</span>
          <span className={styles.kpiVal} style={{ color: '#0D7377' }}>{fmt(oneTimeCost)}</span>
        </div>
        <div className={styles.kpiCard} data-highlight="true">
          <span className={styles.kpiLabel}>Break-even point</span>
          <span className={styles.kpiVal} style={{ color: breakevenWeek ? '#5db88a' : '#d47060' }}>
            {breakevenWeek !== null ? `Week ${breakevenWeek}` : 'Not within 52 wks'}
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <div className={styles.chartWrap}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
          {/* Grid lines */}
          {yTickVals.map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.left} y1={yScale(v)}
                x2={PAD.left + cw} y2={yScale(v)}
                stroke="rgba(255,255,255,0.06)" strokeWidth="1"
              />
              <text
                x={PAD.left - 8} y={yScale(v) + 4}
                textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.3)"
              >{fmt(v)}</text>
            </g>
          ))}

          {/* X ticks */}
          {xTicks.map(w => (
            <g key={w}>
              <line x1={xScale(w)} y1={PAD.top + ch} x2={xScale(w)} y2={PAD.top + ch + 4} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
              <text x={xScale(w)} y={PAD.top + ch + 16} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.3)">W{w}</text>
            </g>
          ))}

          {/* Zero line */}
          {minY < 0 && (
            <line x1={PAD.left} y1={zeroY} x2={PAD.left + cw} y2={zeroY}
              stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4 4" />
          )}

          {/* Break-even vertical line */}
          {breakevenWeek !== null && (
            <g>
              <line
                x1={xScale(breakevenWeek)} y1={PAD.top}
                x2={xScale(breakevenWeek)} y2={PAD.top + ch}
                stroke="#5db88a" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7"
              />
              <rect x={xScale(breakevenWeek) - 28} y={PAD.top - 18} width={56} height={16} rx="4" fill="#5db88a" opacity="0.2" />
              <text x={xScale(breakevenWeek)} y={PAD.top - 6} textAnchor="middle" fontSize="10" fill="#5db88a" fontWeight="500">
                Break-even
              </text>
            </g>
          )}

          {/* Shaded loss area */}
          {minY < 0 && (
            <path
              d={`M ${xScale(0)} ${zeroY} ${data.filter(d => d.cumNet < 0).map(d =>
                `L ${xScale(d.week)} ${yScale(d.cumNet)}`
              ).join(' ')} L ${xScale(breakevenWeek ?? WEEKS)} ${zeroY} Z`}
              fill="#d47060" opacity="0.08"
            />
          )}

          {/* Revenue line */}
          <path d={pathD('cumRev')} fill="none" stroke="#6a9fcb" strokeWidth="2.5" strokeLinejoin="round" />

          {/* Costs line */}
          <path d={pathD('cumCosts')} fill="none" stroke="#d47060" strokeWidth="2.5" strokeLinejoin="round" />

          {/* Net line */}
          <path d={pathD('cumNet')} fill="none" stroke="#5db88a" strokeWidth="2" strokeLinejoin="round" strokeDasharray="6 3" />

          {/* Break-even dot */}
          {breakevenWeek !== null && (
            <circle
              cx={xScale(breakevenWeek)}
              cy={yScale(data[breakevenWeek]?.cumNet ?? 0)}
              r="5" fill="#5db88a" stroke="#0f0e0d" strokeWidth="2"
            />
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {[
          { label: 'Cumulative revenue', color: '#6a9fcb', dash: false },
          { label: 'Cumulative costs (incl. one-time)', color: '#d47060', dash: false },
          { label: 'Cumulative net profit', color: '#5db88a', dash: true },
        ].map(({ label, color, dash }) => (
          <div key={label} className={styles.legendItem}>
            <svg width="24" height="12">
              <line x1="0" y1="6" x2="24" y2="6" stroke={color} strokeWidth="2.5"
                strokeDasharray={dash ? '5 3' : undefined} />
            </svg>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Week-by-week table (first 26 weeks) */}
      <div className={styles.tableWrap}>
        <div className={styles.tableTitle}>Weekly projection — first 26 weeks</div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Week</th>
                <th>Cum. Revenue</th>
                <th>Cum. Costs</th>
                <th>Cum. Net</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(1, 27).map(d => (
                <tr key={d.week} data-positive={d.cumNet >= 0}>
                  <td>W{d.week}</td>
                  <td style={{ color: '#6a9fcb' }}>{fmt(d.cumRev)}</td>
                  <td style={{ color: '#d47060' }}>{fmt(d.cumCosts)}</td>
                  <td style={{ color: d.cumNet >= 0 ? '#5db88a' : '#d47060', fontWeight: 500 }}>{fmt(d.cumNet)}</td>
                  <td>
                    <span className={styles.statusBadge} data-positive={d.cumNet >= 0}>
                      {d.cumNet >= 0 ? 'Profitable' : 'In deficit'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
