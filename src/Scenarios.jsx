import { useState } from 'react'
import styles from './Scenarios.module.css'

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

// UAE effective tax rate
const TAXES_RATE = 0.09 + 0.05 + 0.05 + 0.0375

// Optimistic: higher revenue + better COGS % (bulk buying power) = clearly better margins
// Conservative: lower revenue + worse COGS % (lower volume, less leverage) = worse margins
const DEFAULT_SCENARIOS = [
  {
    name: 'Base Case',
    color: '#6a9fcb',
    weeklyRev:  120000,
    weeklyCOGS:  58000,  // 48.3% COGS
    weeklyOpex:  38000,
    oneTime:    185000,
  },
  {
    name: 'Optimistic',
    color: '#5db88a',
    weeklyRev:  165000,
    weeklyCOGS:  75000,  // 45.5% COGS — better supplier terms at scale
    weeklyOpex:  40000,
    oneTime:    185000,
  },
  {
    name: 'Conservative',
    color: '#d47060',
    weeklyRev:   80000,
    weeklyCOGS:  41000,  // 51.3% COGS — worse buying power at low volume
    weeklyOpex:  36000,
    oneTime:    185000,
  },
]

function calcScenario(s) {
  const gross       = s.weeklyRev - s.weeklyCOGS
  // One-time cost excluded from weekly margin — shown separately for break-even only
  const netBefore   = gross - s.weeklyOpex
  const tax         = Math.max(0, netBefore) * TAXES_RATE
  const netAfter    = netBefore - tax
  const grossMargin = s.weeklyRev > 0 ? Math.round((gross    / s.weeklyRev) * 100) : 0
  const netMargin   = s.weeklyRev > 0 ? Math.round((netAfter / s.weeklyRev) * 100) : 0
  // Break-even: how many weeks of profit to recover one-time cost
  const breakeven   = netAfter > 0 ? Math.ceil(s.oneTime / netAfter) : null
  return { ...s, gross, netBefore, tax, netAfter, grossMargin, netMargin, breakeven }
}

function ScenarioCard({ scenario, index, onChange }) {
  const calc = calcScenario(scenario)
  return (
    <div className={styles.scenarioCard} style={{ '--sc': scenario.color }}>
      <div className={styles.scHeader}>
        <input
          className={styles.scName}
          value={scenario.name}
          onChange={e => onChange(index, 'name', e.target.value)}
        />
        <div className={styles.scDot} style={{ background: scenario.color }} />
      </div>

      <div className={styles.scInputs}>
        {[
          { label: 'Weekly revenue',  key: 'weeklyRev'  },
          { label: 'Weekly COGS',     key: 'weeklyCOGS' },
          { label: 'Weekly opex',     key: 'weeklyOpex' },
          { label: 'One-time costs',  key: 'oneTime'    },
        ].map(({ label, key }) => (
          <div key={key} className={styles.scField}>
            <span className={styles.scFieldLabel}>{label}</span>
            <div className={styles.scInputWrap}>
              <span className={styles.scPre}>AED</span>
              <input
                type="number"
                min="0"
                value={scenario[key]}
                onChange={e => onChange(index, key, parseFloat(e.target.value) || 0)}
                className={styles.scInput}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.scResults}>
        <div className={styles.scResultRow}>
          <span>Gross profit/wk</span>
          <span style={{ color: calc.gross >= 0 ? '#5db88a' : '#d47060' }}>{fmt(calc.gross)}</span>
        </div>
        <div className={styles.scResultRow}>
          <span>Net after tax/wk</span>
          <span style={{ color: calc.netAfter >= 0 ? '#5db88a' : '#d47060' }}>{fmt(calc.netAfter)}</span>
        </div>
        <div className={styles.scResultRow}>
          <span>Net margin</span>
          <span style={{ color: calc.netMargin >= 10 ? '#5db88a' : calc.netMargin >= 0 ? '#0D7377' : '#d47060' }}>{calc.netMargin}%</span>
        </div>
        <div className={styles.scResultRow}>
          <span>Setup recovery</span>
          <span style={{ color: '#0D7377' }}>{calc.breakeven ? calc.breakeven + ' wks' : 'n/a'}</span>
        </div>
      </div>
    </div>
  )
}

export default function Scenarios({ currentScenario }) {
  const [scenarios, setScenarios] = useState(
    currentScenario
      ? [{ ...DEFAULT_SCENARIOS[0], ...currentScenario, name: 'Current' }, DEFAULT_SCENARIOS[1], DEFAULT_SCENARIOS[2]]
      : DEFAULT_SCENARIOS
  )

  const handleChange = (index, key, value) => {
    setScenarios(prev => prev.map((s, i) => i === index ? { ...s, [key]: value } : s))
  }

  const calcs = scenarios.map(calcScenario)
  const metrics = ['weeklyRev', 'gross', 'netAfter', 'grossMargin', 'netMargin', 'breakeven']
  const metricLabels = {
    weeklyRev:   'Weekly revenue',
    gross:       'Gross profit/wk',
    netAfter:    'Net after tax/wk',
    grossMargin: 'Gross margin %',
    netMargin:   'Net margin %',
    breakeven:   'Setup recovery (weeks)',
  }

  const maxVal = (key) => Math.max(...calcs.map(c => Math.abs(c[key] || 0)), 1)

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Scenario comparison</h2>
          <p className={styles.pageSub}>Weekly recurring P&L compared across scenarios. One-time costs are excluded from margin calculations and used only for setup recovery timing.</p>
        </div>
        <button className={styles.resetBtn} onClick={() => setScenarios(DEFAULT_SCENARIOS)}>Reset to defaults</button>
      </div>

      <div className={styles.cardsRow}>
        {scenarios.map((s, i) => (
          <ScenarioCard key={i} scenario={s} index={i} onChange={handleChange} />
        ))}
      </div>

      <div className={styles.compareTable}>
        <div className={styles.compareTitle}>Side-by-side comparison (weekly recurring)</div>
        <div className={styles.compareGrid}>
          <div className={styles.compareHeader}>
            <span className={styles.compareMetricCol}>Metric</span>
            {scenarios.map((s, i) => (
              <span key={i} className={styles.compareScenarioCol} style={{ color: s.color }}>{s.name}</span>
            ))}
          </div>
          {metrics.map(metric => {
            const mx       = maxVal(metric)
            const isMargin = metric.includes('Margin')
            const isBreak  = metric === 'breakeven'
            return (
              <div key={metric} className={styles.compareRow}>
                <span className={styles.compareMetricCol}>{metricLabels[metric]}</span>
                {calcs.map((c, i) => {
                  const val        = c[metric]
                  const barPct     = mx > 0 ? Math.min(100, Math.abs(val || 0) / mx * 100) : 0
                  const color      = scenarios[i].color
                  const displayVal = isMargin ? (val + '%') : isBreak ? (val ? val + ' wks' : '—') : fmt(val)
                  return (
                    <div key={i} className={styles.compareScenarioCol}>
                      <div className={styles.compareBarTrack}>
                        <div className={styles.compareBar} style={{ width: barPct + '%', background: color }} />
                      </div>
                      <span className={styles.compareVal} style={{ color: (val < 0 && !isBreak) ? '#d47060' : color }}>{displayVal}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
