import { useState, useEffect, useRef } from 'react'
import styles from './Dashboard.module.css'

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

function pctNum(part, whole) {
  if (!whole) return 0
  return Math.round((part / whole) * 100)
}

// Donut chart using SVG
function DonutChart({ segments, size = 160 }) {
  const r = 54
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  let offset = 0
  const slices = segments.map(seg => {
    const pct = total > 0 ? seg.value / total : 0
    const dash = pct * circumference
    const gap  = circumference - dash
    const slice = { ...seg, dash, gap, offset }
    offset += dash
    return slice
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={22}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset}
          opacity={0.9}
        />
      ))}
    </svg>
  )
}

// Horizontal bar / waterfall step
function WaterfallBar({ label, value, max, color, isBold }) {
  const pct = max > 0 ? Math.min(100, Math.abs(value) / max * 100) : 0
  return (
    <div className={styles.wfRow}>
      <span className={styles.wfLabel} style={{ fontWeight: isBold ? 500 : 400 }}>{label}</span>
      <div className={styles.wfTrack}>
        <div className={styles.wfBar} style={{ width: pct + '%', background: color }} />
      </div>
      <span className={styles.wfVal} style={{ color, fontWeight: isBold ? 500 : 400 }}>{fmt(value)}</span>
    </div>
  )
}

// Animated counter
function AnimatedNumber({ value, prefix = 'AED ' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const prevValueRef = useRef(0)
  useEffect(() => {
    const start = prevValueRef.current
    const end = value
    prevValueRef.current = value
    const dur = 600
    const startTime = performance.now()
    const step = (now) => {
      const p = Math.min((now - startTime) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(start + (end - start) * ease))
      if (p < 1) ref.current = requestAnimationFrame(step)
    }
    ref.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(ref.current)
  }, [value])
  const abs = Math.abs(display)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = abs.toLocaleString()
  return <span>{display < 0 ? '-' : ''}{prefix}{s}</span>
}

export default function Dashboard({
  period, setPeriod, periodLabel,
  revenue, gross, netBeforeTax, netAfterTax, totalTax,
  foodCOGS, totalOpex, oneTimeCost,
  deliRevWk, alcRevWk, bevRevWk, snackRevWk, grocRevWk,
  weeklyRev, weeklyCOGS,
  rentVal, salaryVal, techVal, insVal, elecVal, gasVal, dblVal,
  keyfoodRevFee, keyfoodMktFee,
  taxBase, totalTax: _totalTax,
  mult,
  PERIODS,
}) {
  const [targetNet, setTargetNet] = useState('')
  const [catTargets, setCatTargets] = useState({})

  const periodName = PERIODS.find(p => p.key === period)?.label ?? 'Weekly'

  // Revenue mix segments
  const revSegments = [
    { label: 'Deli',     value: deliRevWk  * mult, color: '#0D7377' },
    { label: 'Fresh Juices',  value: alcRevWk   * mult, color: '#6a9fcb' },
    { label: 'Bev',      value: bevRevWk   * mult, color: '#5db88a' },
    { label: 'Snacks',   value: snackRevWk * mult, color: '#d47060' },
    { label: 'Grocery',  value: grocRevWk  * mult, color: '#9b85c4' },
  ]

  // Cost breakdown segments
  const costSegments = [
    { label: 'COGS',      value: foodCOGS,                            color: '#0D7377' },
    { label: 'Salary',    value: salaryVal,                           color: '#6a9fcb' },
    { label: 'Rent',      value: rentVal,                             color: '#5db88a' },
    { label: 'Utilities', value: elecVal + gasVal,                    color: '#d47060' },
    { label: 'Keyfood',   value: keyfoodRevFee + keyfoodMktFee,       color: '#9b85c4' },
    { label: 'Other',     value: techVal + insVal + dblVal,           color: '#888780' },
    { label: 'One-time',  value: oneTimeCost,                         color: '#ef9f27' },
  ]

  // Revenue target logic
  const targetNetVal = n(targetNet)
  // net = revenue * (1 - cogsRatio) - fixedOpex - oneTime - tax
  // Simplified: solve for revenue given target net after tax
  const cogsRatio    = weeklyRev > 0 ? weeklyCOGS / weeklyRev : 0.4
  const keyfoodRatio = revenue > 0 ? (keyfoodRevFee + keyfoodMktFee) / revenue : 0.0385
  const netRatio     = 1 - cogsRatio - keyfoodRatio
  const fixedWkOpex  = (rentVal + salaryVal + techVal + insVal + elecVal + gasVal + dblVal) / mult
  const effectiveTaxRate = taxBase > 0 ? totalTax / taxBase : 0.45
  // netAfterTax = (rev * netRatio - fixedWkOpex - oneTime) * (1 - taxRate)
  // => rev = (targetNet / (1-taxRate) + fixedWkOpex + oneTime) / netRatio
  const reqWeeklyRev = targetNetVal > 0 && netRatio > 0
    ? ((targetNetVal / mult) / (1 - effectiveTaxRate) + fixedWkOpex + oneTimeCost / mult) / netRatio
    : 0

  const currentWeeklyRev = weeklyRev
  const targetProgress   = reqWeeklyRev > 0 ? Math.min(100, (currentWeeklyRev / reqWeeklyRev) * 100) : 0
  const revGap           = reqWeeklyRev - currentWeeklyRev

  // Waterfall max
  const wfMax = revenue

  // KPIs
  const grossMargin   = pctNum(gross, revenue)
  const netMargin     = pctNum(netAfterTax, revenue)
  const opexRatio     = pctNum(totalOpex, revenue)
  const weeksToBreak  = netAfterTax > 0 ? Math.ceil(oneTimeCost / (netAfterTax / mult)) : null

  return (
    <div className={styles.dash}>

      {/* Period selector */}
      <div className={styles.periodRow}>
        {PERIODS.map(p => (
          <button key={p.key} className={styles.periodBtn} data-active={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Hero metrics */}
      <div className={styles.heroGrid}>
        <div className={styles.heroCard} data-color="blue">
          <span className={styles.heroLabel}>Revenue</span>
          <span className={styles.heroVal} data-color="blue"><AnimatedNumber value={revenue} /></span>
          <span className={styles.heroSub}>{periodName} · COGS {pctNum(foodCOGS, revenue)}% of rev</span>
        </div>
        <div className={styles.heroCard} data-color={gross >= 0 ? 'green' : 'red'}>
          <span className={styles.heroLabel}>Gross profit</span>
          <span className={styles.heroVal} data-color={gross >= 0 ? 'green' : 'red'}><AnimatedNumber value={gross} /></span>
          <span className={styles.heroSub}>{grossMargin}% gross margin</span>
        </div>
        <div className={styles.heroCard} data-color={netAfterTax >= 0 ? 'green' : 'red'}>
          <span className={styles.heroLabel}>Net after tax</span>
          <span className={styles.heroVal} data-color={netAfterTax >= 0 ? 'green' : 'red'}><AnimatedNumber value={netAfterTax} /></span>
          <span className={styles.heroSub}>{netMargin}% net margin</span>
        </div>
        <div className={styles.heroCard} data-color="amber">
          <span className={styles.heroLabel}>Total tax</span>
          <span className={styles.heroVal} data-color="amber"><AnimatedNumber value={totalTax} /></span>
          <span className={styles.heroSub}>{taxBase > 0 ? (totalTax / taxBase * 100).toFixed(1) + '% effective rate' : 'No taxable income'}</span>
        </div>
        <div className={styles.heroCard} data-color="purple">
          <span className={styles.heroLabel}>Break-even</span>
          <span className={styles.heroVal} data-color="purple">{weeksToBreak ? weeksToBreak + ' wks' : '—'}</span>
          <span className={styles.heroSub}>to recover {fmt(oneTimeCost)} one-time costs</span>
        </div>
        <div className={styles.heroCard} data-color={opexRatio < 60 ? 'green' : 'red'}>
          <span className={styles.heroLabel}>Opex ratio</span>
          <span className={styles.heroVal} data-color={opexRatio < 60 ? 'green' : 'red'}>{opexRatio}%</span>
          <span className={styles.heroSub}>of revenue spent on operating costs</span>
        </div>
      </div>

      {/* Revenue target */}
      <div className={styles.targetCard}>
        <div className={styles.targetHeader}>
          <div>
            <span className={styles.targetTitle}>Profit target</span>
            <span className={styles.targetSub}>Set a {periodName.toLowerCase()} net profit goal — we'll calculate the revenue needed</span>
          </div>
          <div className={styles.targetInputWrap}>
            <span className={styles.targetPre}>AED</span>
            <input
              type="number"
              min="0"
              value={targetNet}
              onChange={e => setTargetNet(e.target.value)}
              placeholder="e.g. 10000"
              className={styles.targetInput}
            />
            <span className={styles.targetSuffix}>{periodLabel} profit target</span>
          </div>
        </div>
        {targetNetVal > 0 && (
          <div className={styles.targetBody}>
            <div className={styles.targetStats}>
              <div className={styles.targetStat}>
                <span className={styles.targetStatLabel}>Required weekly revenue</span>
                <span className={styles.targetStatVal}>{fmt(reqWeeklyRev)}</span>
              </div>
              <div className={styles.targetStat}>
                <span className={styles.targetStatLabel}>Current weekly revenue</span>
                <span className={styles.targetStatVal}>{fmt(currentWeeklyRev)}</span>
              </div>
              <div className={styles.targetStat}>
                <span className={styles.targetStatLabel}>Weekly gap</span>
                <span className={styles.targetStatVal} style={{ color: revGap > 0 ? '#d47060' : '#5db88a' }}>
                  {revGap > 0 ? '+' + fmt(revGap) + ' needed' : 'Target met!'}
                </span>
              </div>
            </div>
            <div className={styles.progressWrap}>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: targetProgress + '%', background: revGap <= 0 ? '#5db88a' : '#0D7377' }} />
              </div>
              <span className={styles.progressLabel}>{Math.round(targetProgress)}% of target revenue</span>
            </div>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className={styles.chartsRow}>

        {/* Revenue mix donut */}
        <div className={styles.chartCard}>
          <span className={styles.chartTitle}>Revenue mix {periodName.toLowerCase()}</span>
          <div className={styles.donutWrap}>
            <DonutChart segments={revSegments} size={160} />
            <div className={styles.donutCenter}>
              <span className={styles.donutCenterVal}>{fmt(revenue)}</span>
              <span className={styles.donutCenterLabel}>total</span>
            </div>
          </div>
          <div className={styles.legend}>
            {revSegments.map(s => (
              <div key={s.label} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: s.color }} />
                <span className={styles.legendLabel}>{s.label}</span>
                <span className={styles.legendVal}>{pctNum(s.value, revenue)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cost mix donut */}
        <div className={styles.chartCard}>
          <span className={styles.chartTitle}>Cost mix {periodName.toLowerCase()}</span>
          <div className={styles.donutWrap}>
            <DonutChart segments={costSegments} size={160} />
            <div className={styles.donutCenter}>
              <span className={styles.donutCenterVal}>{fmt(foodCOGS + totalOpex + oneTimeCost)}</span>
              <span className={styles.donutCenterLabel}>total costs</span>
            </div>
          </div>
          <div className={styles.legend}>
            {costSegments.map(s => (
              <div key={s.label} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: s.color }} />
                <span className={styles.legendLabel}>{s.label}</span>
                <span className={styles.legendVal}>{fmt(s.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Waterfall P&L */}
        <div className={styles.chartCard} style={{ flex: 1.4 }}>
          <span className={styles.chartTitle}>P&amp;L waterfall {periodName.toLowerCase()}</span>
          <div className={styles.waterfall}>
            <WaterfallBar label="Revenue"        value={revenue}       max={wfMax} color="#6a9fcb" isBold />
            <WaterfallBar label="− COGS"         value={-foodCOGS}     max={wfMax} color="#ef9f27" />
            <WaterfallBar label="Gross profit"   value={gross}         max={wfMax} color={gross >= 0 ? '#5db88a' : '#d47060'} isBold />
            <WaterfallBar label="− Keyfood fees" value={-(keyfoodRevFee + keyfoodMktFee)} max={wfMax} color="#9b85c4" />
            <WaterfallBar label="− Rent"         value={-rentVal}      max={wfMax} color="#0D7377" />
            <WaterfallBar label="− Salary"       value={-salaryVal}    max={wfMax} color="#0D7377" />
            <WaterfallBar label="− Utilities"    value={-(elecVal + gasVal)} max={wfMax} color="#0D7377" />
            <WaterfallBar label="− Other opex"   value={-(techVal + insVal + dblVal)} max={wfMax} color="#0D7377" />
            <WaterfallBar label="− One-time"     value={-oneTimeCost}  max={wfMax} color="#888780" />
            <WaterfallBar label="Net before tax" value={netBeforeTax}  max={wfMax} color={netBeforeTax >= 0 ? '#5db88a' : '#d47060'} isBold />
            <WaterfallBar label="− Tax"          value={-totalTax}     max={wfMax} color="#d47060" />
            <WaterfallBar label="Net after tax"  value={netAfterTax}   max={wfMax} color={netAfterTax >= 0 ? '#5db88a' : '#d47060'} isBold />
          </div>
        </div>

      </div>

      {/* Category revenue targets */}
      <div className={styles.catTargetsCard}>
        <div className={styles.catTargetsHeader}>
          <span className={styles.catTargetsTitle}>Revenue targets by category</span>
          <span className={styles.catTargetsSub}>Set weekly targets per category to track performance</span>
        </div>
        <div className={styles.catTargetsGrid}>
          {[
            { label: 'Deli / Grab n Go', actual: deliRevWk  * mult, color: '#0D7377' },
            { label: 'Fresh Juices',          actual: alcRevWk   * mult, color: '#6a9fcb' },
            { label: 'Bev',              actual: bevRevWk   * mult, color: '#5db88a' },
            { label: 'Snacks',           actual: snackRevWk * mult, color: '#d47060' },
            { label: 'Grocery',          actual: grocRevWk  * mult, color: '#9b85c4' },
          ].map(({ label, actual, color }) => {
            const target = catTargets[label] ?? ''
            const setTarget = (val) => setCatTargets(prev => ({ ...prev, [label]: val }))
            const tVal  = n(target)
            const pct   = tVal > 0 ? Math.min(100, Math.round((actual / tVal) * 100)) : 0
            const gap   = tVal > 0 ? actual - tVal : 0
            return (
              <div key={label} className={styles.catTargetItem} style={{ '--ctc': color }}>
                <div className={styles.catTargetTop}>
                  <span className={styles.catTargetLabel}>{label}</span>
                  <span className={styles.catTargetActual} style={{ color }}>{fmt(actual)}</span>
                </div>
                <div className={styles.catTargetInputRow}>
                  <span className={styles.catTargetInputPre}>AED</span>
                  <input
                    type="number" min="0" value={target}
                    onChange={e => setTarget(e.target.value)}
                    placeholder="Set target"
                    className={styles.catTargetInput}
                  />
                </div>
                {tVal > 0 && (
                  <>
                    <div className={styles.catProgressTrack}>
                      <div className={styles.catProgressBar} style={{ width: pct + '%', background: color }} />
                    </div>
                    <div className={styles.catTargetStatus}>
                      <span style={{ color: gap >= 0 ? '#5db88a' : '#d47060', fontSize: 11 }}>
                        {gap >= 0 ? `+${fmt(gap)} above target` : `${fmt(Math.abs(gap))} below target`}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* KPI strip */}
      <div className={styles.kpiStrip}>
        {[
          { label: 'Gross margin',      val: grossMargin + '%',                           good: grossMargin > 30  },
          { label: 'Net margin',        val: netMargin + '%',                             good: netMargin > 10    },
          { label: 'Opex / revenue',    val: opexRatio + '%',                             good: opexRatio < 50    },
          { label: 'Tax burden',        val: taxBase > 0 ? (totalTax/taxBase*100).toFixed(1) + '%' : '—', good: true },
          { label: 'Weekly rev/employee', val: fmt(weeklyRev / Math.max(1, n(8))),        good: true              },
          { label: 'One-time invested', val: fmtFull(oneTimeCost),                        good: true              },
        ].map(({ label, val, good }) => (
          <div key={label} className={styles.kpiItem}>
            <span className={styles.kpiLabel}>{label}</span>
            <span className={styles.kpiVal} style={{ color: good ? '#5db88a' : '#d47060' }}>{val}</span>
          </div>
        ))}
      </div>

    </div>
  )
}
