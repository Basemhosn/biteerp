import { useState, useMemo } from 'react'
import styles from './Cashflow.module.css'

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
  if (!val && val !== 0) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const TAX_RATE = 0.19 // UAE effective tax rate

export default function Cashflow({
  weeklyRev, weeklyCOGS, totalOpex, mult,
  oneTimeCost, weeklyNet,
}) {
  const [openingCash,  setOpeningCash]  = useState('50000')
  const [revenueRamp,  setRevenueRamp]  = useState('70')   // % of full revenue in week 1, ramping to 100%
  const [rampWeeks,    setRampWeeks]    = useState('8')    // weeks to reach full revenue
  const [extraBuffer,  setExtraBuffer]  = useState('0')    // additional weekly cash out (contingency)
  const VIEW = 52

  const weeklyOpex = totalOpex / Math.max(mult, 1)

  const cashData = useMemo(() => {
    const startPct   = n(revenueRamp) / 100
    const ramp       = Math.max(1, n(rampWeeks))
    const opening    = n(openingCash)
    const extra      = n(extraBuffer)
    const rows = []
    let balance = opening - oneTimeCost  // one-time costs paid upfront

    for (let w = 1; w <= VIEW; w++) {
      // Ramp: linear increase from startPct to 100% over rampWeeks
      const rampPct  = Math.min(1, startPct + (1 - startPct) * ((w - 1) / ramp))
      const rev      = weeklyRev  * rampPct
      const cogs     = weeklyCOGS * rampPct
      const opex     = weeklyOpex
      const gross    = rev - cogs
      const netBefore = gross - opex - extra
      const tax      = Math.max(0, netBefore) * TAX_RATE
      const netAfter = netBefore - tax
      balance        = balance + netAfter
      rows.push({ week: w, rev, cogs, opex, gross, netAfter, balance, rampPct })
    }
    return rows
  }, [openingCash, revenueRamp, rampWeeks, extraBuffer, weeklyRev, weeklyCOGS, weeklyOpex, oneTimeCost])

  const posWeek     = cashData.find(r => r.balance >= 0)?.week ?? null
  const minBalance  = Math.min(...cashData.map(r => r.balance))
  const maxBalance  = Math.max(...cashData.map(r => r.balance))
  const finalBalance = cashData[cashData.length - 1]?.balance ?? 0
  const runoutWeek  = cashData.find(r => r.balance < -n(openingCash) * 2)?.week ?? null

  // SVG chart
  const W = 680, H = 280
  const PAD = { top: 20, right: 20, bottom: 36, left: 72 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top  - PAD.bottom

  const allVals = cashData.map(r => r.balance)
  allVals.push(n(openingCash) - oneTimeCost)
  const minY = Math.min(...allVals, 0)
  const maxY = Math.max(...allVals, 1)
  const rangeY = maxY - minY

  const xScale = w  => PAD.left + ((w - 1) / (VIEW - 1)) * cw
  const yScale = v  => PAD.top  + ch - ((v - minY) / rangeY) * ch
  const zeroY  = yScale(0)

  const pathD = cashData.map((r, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(r.week).toFixed(1)} ${yScale(r.balance).toFixed(1)}`
  ).join(' ')

  const areaD = `${pathD} L ${xScale(VIEW).toFixed(1)} ${zeroY.toFixed(1)} L ${xScale(1).toFixed(1)} ${zeroY.toFixed(1)} Z`

  const yTicks = Array.from({ length: 6 }, (_, i) => minY + (rangeY / 5) * i)
  const xTicks = [1, 8, 13, 17, 22, 26, 30, 35, 39, 44, 48, 52]

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Cash flow timeline</h2>
          <p className={styles.pageSub}>Week-by-week cash position over 52 weeks including revenue ramp-up, one-time startup costs, and a contingency buffer.</p>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controlsCard}>
        <div className={styles.controlsTitle}>Assumptions</div>
        <div className={styles.controlsGrid}>
          {[
            { label: 'Opening cash balance', val: openingCash, set: setOpeningCash, pre: 'AED', suf: '' },
            { label: 'Week 1 revenue (% of full)', val: revenueRamp, set: setRevenueRamp, pre: '', suf: '%' },
            { label: 'Weeks to reach full revenue', val: rampWeeks, set: setRampWeeks, pre: '', suf: ' wks' },
            { label: 'Extra weekly contingency', val: extraBuffer, set: setExtraBuffer, pre: 'AED', suf: '' },
          ].map(({ label, val, set, pre, suf }) => (
            <div key={label} className={styles.ctrlField}>
              <label className={styles.ctrlLabel}>{label}</label>
              <div className={styles.ctrlInputWrap}>
                {pre && <span className={styles.ctrlPre}>{pre}</span>}
                <input type="number" min="0" value={val} onChange={e => set(e.target.value)} className={styles.ctrlInput} />
                {suf && <span className={styles.ctrlSuf}>{suf}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiCard} data-color="amber">
          <span className={styles.kpiLabel}>Opening cash</span>
          <span className={styles.kpiVal} style={{ color: '#0D7377' }}>{fmt(n(openingCash))}</span>
          <span className={styles.kpiSub}>after one-time costs: {fmt(n(openingCash) - oneTimeCost)}</span>
        </div>
        <div className={styles.kpiCard} data-color={posWeek ? 'green' : 'red'}>
          <span className={styles.kpiLabel}>Cash positive</span>
          <span className={styles.kpiVal} style={{ color: posWeek ? '#5db88a' : '#d47060' }}>
            {posWeek ? `Week ${posWeek}` : 'Not in 52 wks'}
          </span>
          <span className={styles.kpiSub}>{posWeek ? `${posWeek} weeks from open` : 'Increase revenue or cash'}</span>
        </div>
        <div className={styles.kpiCard} data-color={minBalance >= 0 ? 'green' : 'red'}>
          <span className={styles.kpiLabel}>Lowest balance</span>
          <span className={styles.kpiVal} style={{ color: minBalance >= 0 ? '#5db88a' : '#d47060' }}>{fmt(minBalance)}</span>
          <span className={styles.kpiSub}>worst cash position in year 1</span>
        </div>
        <div className={styles.kpiCard} data-color={finalBalance >= 0 ? 'green' : 'red'}>
          <span className={styles.kpiLabel}>End of year 1</span>
          <span className={styles.kpiVal} style={{ color: finalBalance >= 0 ? '#5db88a' : '#d47060' }}>{fmt(finalBalance)}</span>
          <span className={styles.kpiSub}>cash balance at week 52</span>
        </div>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Full weekly net</span>
          <span className={styles.kpiVal} style={{ color: '#6a9fcb' }}>{fmt((weeklyRev - weeklyCOGS - weeklyOpex) * (1 - TAX_RATE))}</span>
          <span className={styles.kpiSub}>at 100% revenue capacity</span>
        </div>
      </div>

      {/* Chart */}
      <div className={styles.chartCard}>
        <div className={styles.chartLabel}>Weekly cash balance</div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
          {/* Grid */}
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={yScale(v)} x2={PAD.left + cw} y2={yScale(v)}
                stroke="rgba(128,128,128,0.1)" strokeWidth="1" />
              <text x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill="rgba(128,128,128,0.4)">{fmt(v)}</text>
            </g>
          ))}
          {xTicks.map(w => (
            <g key={w}>
              <text x={xScale(w)} y={PAD.top + ch + 16} textAnchor="middle" fontSize="10" fill="rgba(128,128,128,0.4)">W{w}</text>
            </g>
          ))}

          {/* Zero line */}
          <line x1={PAD.left} y1={zeroY} x2={PAD.left + cw} y2={zeroY}
            stroke="rgba(128,128,128,0.3)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Ramp end marker */}
          {n(rampWeeks) < VIEW && (
            <g>
              <line x1={xScale(n(rampWeeks))} y1={PAD.top} x2={xScale(n(rampWeeks))} y2={PAD.top + ch}
                stroke="#0D7377" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
              <text x={xScale(n(rampWeeks))} y={PAD.top - 6} textAnchor="middle" fontSize="9" fill="#0D7377">Full rev</text>
            </g>
          )}

          {/* Cash-positive marker */}
          {posWeek && (
            <g>
              <line x1={xScale(posWeek)} y1={PAD.top} x2={xScale(posWeek)} y2={PAD.top + ch}
                stroke="#5db88a" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
              <text x={xScale(posWeek)} y={PAD.top - 6} textAnchor="middle" fontSize="9" fill="#5db88a">Cash +</text>
            </g>
          )}

          {/* Area fill */}
          <path d={areaD} fill={finalBalance >= 0 ? 'rgba(93,184,138,0.08)' : 'rgba(212,112,96,0.08)'} />

          {/* Line */}
          <path d={pathD} fill="none"
            stroke={finalBalance >= 0 ? '#5db88a' : '#d47060'}
            strokeWidth="2.5" strokeLinejoin="round" />

          {/* Start dot */}
          <circle cx={xScale(1)} cy={yScale(cashData[0]?.balance ?? 0)} r="4"
            fill={cashData[0]?.balance >= 0 ? '#5db88a' : '#d47060'} stroke="var(--bg)" strokeWidth="2" />

          {/* End dot */}
          <circle cx={xScale(VIEW)} cy={yScale(finalBalance)} r="4"
            fill={finalBalance >= 0 ? '#5db88a' : '#d47060'} stroke="var(--bg)" strokeWidth="2" />
        </svg>
      </div>

      {/* Week-by-week table — first 26 weeks */}
      <div className={styles.tableCard}>
        <div className={styles.tableTitle}>Week-by-week cash flow — first 26 weeks</div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Week</th>
                <th>Rev ramp</th>
                <th>Revenue</th>
                <th>COGS</th>
                <th>Opex</th>
                <th>Net (after tax)</th>
                <th>Cash balance</th>
              </tr>
            </thead>
            <tbody>
              {cashData.slice(0, 26).map(r => (
                <tr key={r.week}>
                  <td>W{r.week}</td>
                  <td style={{ color: '#0D7377' }}>{Math.round(r.rampPct * 100)}%</td>
                  <td style={{ color: '#6a9fcb' }}>{fmt(r.rev)}</td>
                  <td style={{ color: '#d47060' }}>{fmt(r.cogs)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{fmt(r.opex)}</td>
                  <td style={{ color: r.netAfter >= 0 ? '#5db88a' : '#d47060', fontWeight: 500 }}>{fmt(r.netAfter)}</td>
                  <td>
                    <span className={styles.balanceBadge} data-positive={r.balance >= 0}>
                      {fmt(r.balance)}
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
