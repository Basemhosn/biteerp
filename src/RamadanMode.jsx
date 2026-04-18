import { useState, useMemo } from 'react'
import styles from './RamadanMode.module.css'

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

// Typical Dubai Ramadan revenue pattern by hour block vs normal
// Source: Dubai F&B industry knowledge
const HOUR_BLOCKS = [
  { key: 'suhoor',    label: 'Suhoor rush',      hours: '1am – 4am',   mult: 1.8,  note: 'Pre-dawn meal surge' },
  { key: 'morning',   label: 'Morning (slow)',    hours: '9am – 12pm',  mult: 0.3,  note: 'Most people fasting, very quiet' },
  { key: 'afternoon', label: 'Afternoon (dead)',  hours: '12pm – 4pm',  mult: 0.1,  note: 'Slowest period of the day' },
  { key: 'preiftar',  label: 'Pre-Iftar prep',    hours: '4pm – 6pm',   mult: 0.6,  note: 'Customers buying for home Iftar' },
  { key: 'iftar',     label: 'Iftar rush',        hours: '6pm – 8pm',   mult: 3.2,  note: '🔥 Biggest peak of the day' },
  { key: 'evening',   label: 'Post-Iftar',        hours: '8pm – 12am',  mult: 1.4,  note: 'Steady social traffic' },
]

const RAMADAN_WEEKS = 4

// Category-specific Ramadan impact
const CAT_MULTS = {
  deli:  1.6,  // Hot food huge during Ramadan
  juice: 2.1,  // Fresh juices massive at Iftar
  bev:   1.8,  // Beverages spike at Iftar
  snack: 0.9,  // Snacks slightly lower
  groc:  1.3,  // Grocery higher for home cooking
}

export default function RamadanMode({ weeklyRev, weeklyCOGS, totalOpex, mult, deliRevWk, juiceRevWk, bevRevWk, snackRevWk, grocRevWk }) {
  const [enabled, setEnabled]       = useState(false)
  const [ramadanYear, setRamadanYear] = useState('2026')
  const [overallMult, setOverallMult] = useState('1.35') // typical +35% overall for F&B
  const [extraStaff,  setExtraStaff]  = useState('2')
  const [extraStaffRate, setExtraStaffRate] = useState('20')
  const [extraDecor,  setExtraDecor]  = useState('5000')
  const [hourMults, setHourMults]     = useState(() => Object.fromEntries(HOUR_BLOCKS.map(b => [b.key, b.mult.toString()])))

  const weeklyOpex   = totalOpex / Math.max(mult, 1)

  // Ramadan-adjusted weekly revenue
  const ramadanWeeklyRev  = n(overallMult) * weeklyRev
  const ramadanWeeklyCOGS = n(overallMult) * weeklyCOGS // COGS scales with revenue

  // Extra Ramadan costs
  const extraLabourWeekly = n(extraStaff) * n(extraStaffRate) * 48
  const extraDecorTotal   = n(extraDecor) // one-time
  const ramadanOpexWeekly = weeklyOpex + extraLabourWeekly

  // 4-week Ramadan P&L
  const normalMonthRev   = weeklyRev  * RAMADAN_WEEKS
  const normalMonthCOGS  = weeklyCOGS * RAMADAN_WEEKS
  const normalMonthOpex  = weeklyOpex * RAMADAN_WEEKS
  const normalMonthGross = normalMonthRev - normalMonthCOGS
  const normalMonthNet   = normalMonthGross - normalMonthOpex

  const ramadanMonthRev   = ramadanWeeklyRev  * RAMADAN_WEEKS
  const ramadanMonthCOGS  = ramadanWeeklyCOGS * RAMADAN_WEEKS
  const ramadanMonthOpex  = ramadanOpexWeekly * RAMADAN_WEEKS + extraDecorTotal
  const ramadanMonthGross = ramadanMonthRev - ramadanMonthCOGS
  const ramadanMonthNet   = ramadanMonthGross - ramadanMonthOpex

  const uplift   = ramadanMonthNet - normalMonthNet
  const upliftPct = normalMonthNet !== 0 ? Math.round((uplift / Math.abs(normalMonthNet)) * 100) : 0

  // Category breakdown
  const catRevNormal  = { deli: deliRevWk,  juice: juiceRevWk, bev: bevRevWk, snack: snackRevWk, groc: grocRevWk }
  const catRevRamadan = Object.fromEntries(Object.entries(catRevNormal).map(([k, v]) => [k, v * CAT_MULTS[k]]))

  // Hour distribution (how today's estimated daily revenue is split)
  const dailyRev   = ramadanWeeklyRev / 7
  const totalHourMult = HOUR_BLOCKS.reduce((s, b) => s + n(hourMults[b.key]), 0)
  const hourRevs   = HOUR_BLOCKS.map(b => ({ ...b, rev: totalHourMult > 0 ? (n(hourMults[b.key]) / totalHourMult) * dailyRev : 0 }))

  // Ramadan 2026 dates (approximate)
  const RAMADAN_DATES = { '2025': 'Mar 1 – Mar 30', '2026': 'Feb 18 – Mar 19', '2027': 'Feb 7 – Mar 9' }

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Ramadan mode</h2>
          <p className={styles.pageSub}>Model how Ramadan changes your weekly revenue. Dubai F&B typically sees +20–50% overall uplift, with extreme swings by hour and category.</p>
        </div>
        <div className={styles.toggleWrap}>
          <span className={styles.toggleLabel}>{enabled ? '🌙 Ramadan mode ON' : 'Ramadan mode OFF'}</span>
          <button className={styles.toggleBtn} data-on={enabled} onClick={() => setEnabled(v => !v)}>
            <div className={styles.toggleThumb} />
          </button>
        </div>
      </div>

      {/* Year selector */}
      <div className={styles.yearCard}>
        <span className={styles.yearLabel}>Ramadan year</span>
        <div className={styles.yearBtns}>
          {Object.entries(RAMADAN_DATES).map(([yr, dates]) => (
            <button key={yr} className={styles.yearBtn} data-active={ramadanYear === yr} onClick={() => setRamadanYear(yr)}>
              <span className={styles.yearNum}>{yr}</span>
              <span className={styles.yearDates}>{dates}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Comparison cards */}
      <div className={styles.compRow}>
        <div className={styles.compCard} data-mode="normal">
          <div className={styles.compTitle}>Normal week</div>
          {[
            { label: 'Weekly revenue',  val: fmt(weeklyRev),      color: '#6a9fcb' },
            { label: 'Gross profit',    val: fmt(weeklyRev - weeklyCOGS), color: '#5db88a' },
            { label: 'Net (est.)',      val: fmt(weeklyRev - weeklyCOGS - weeklyOpex), color: '#5db88a' },
          ].map(({ label, val, color }) => (
            <div key={label} className={styles.compStat}>
              <span className={styles.compStatLabel}>{label}</span>
              <span className={styles.compStatVal} style={{ color }}>{val}</span>
            </div>
          ))}
        </div>

        <div className={styles.compArrow}>→</div>

        <div className={styles.compCard} data-mode="ramadan">
          <div className={styles.compTitle}>🌙 Ramadan week</div>
          {[
            { label: 'Weekly revenue',      val: fmt(ramadanWeeklyRev), color: '#0D7377' },
            { label: 'Gross profit',        val: fmt(ramadanWeeklyRev - ramadanWeeklyCOGS), color: '#5db88a' },
            { label: 'Net after extra costs', val: fmt(ramadanWeeklyRev - ramadanWeeklyCOGS - ramadanOpexWeekly), color: '#5db88a' },
          ].map(({ label, val, color }) => (
            <div key={label} className={styles.compStat}>
              <span className={styles.compStatLabel}>{label}</span>
              <span className={styles.compStatVal} style={{ color }}>{val}</span>
            </div>
          ))}
        </div>

        <div className={styles.upliftCard}>
          <div className={styles.upliftLabel}>4-week Ramadan uplift</div>
          <div className={styles.upliftVal} style={{ color: uplift >= 0 ? '#5db88a' : '#d47060' }}>
            {uplift >= 0 ? '+' : ''}{fmt(uplift)}
          </div>
          <div className={styles.upliftPct} style={{ color: upliftPct >= 0 ? '#5db88a' : '#d47060' }}>
            {upliftPct >= 0 ? '+' : ''}{upliftPct}% vs normal month
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controlsCard}>
        <div className={styles.controlsTitle}>Ramadan assumptions</div>
        <div className={styles.controlsGrid}>
          <div className={styles.ctrlField}>
            <label className={styles.ctrlLabel}>Overall revenue multiplier</label>
            <div className={styles.ctrlInputWrap}>
              <input type="number" step="0.05" min="0.5" max="3" value={overallMult} onChange={e => setOverallMult(e.target.value)} className={styles.ctrlInput} />
              <span className={styles.ctrlSuf}>× normal</span>
            </div>
            <span className={styles.ctrlNote}>{Math.round((n(overallMult) - 1) * 100)}% change vs normal week</span>
          </div>
          <div className={styles.ctrlField}>
            <label className={styles.ctrlLabel}>Extra casual staff</label>
            <div className={styles.ctrlInputWrap}>
              <input type="number" min="0" value={extraStaff} onChange={e => setExtraStaff(e.target.value)} className={styles.ctrlInput} />
              <span className={styles.ctrlSuf}>staff</span>
            </div>
          </div>
          <div className={styles.ctrlField}>
            <label className={styles.ctrlLabel}>Extra staff rate</label>
            <div className={styles.ctrlInputWrap}>
              <span className={styles.ctrlPre}>AED</span>
              <input type="number" min="0" value={extraStaffRate} onChange={e => setExtraStaffRate(e.target.value)} className={styles.ctrlInput} />
              <span className={styles.ctrlSuf}>/hr</span>
            </div>
          </div>
          <div className={styles.ctrlField}>
            <label className={styles.ctrlLabel}>Ramadan decor / setup</label>
            <div className={styles.ctrlInputWrap}>
              <span className={styles.ctrlPre}>AED</span>
              <input type="number" min="0" value={extraDecor} onChange={e => setExtraDecor(e.target.value)} className={styles.ctrlInput} />
              <span className={styles.ctrlSuf}>one-time</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.bottomRow}>
        {/* Hour distribution */}
        <div className={styles.hourCard}>
          <div className={styles.hourTitle}>Daily revenue by hour block (estimated)</div>
          <div className={styles.hourSubtitle}>Daily target: {fmt(dailyRev)}</div>
          {hourRevs.map(b => {
            const maxRev = Math.max(...hourRevs.map(x => x.rev), 1)
            const barPct = (b.rev / maxRev) * 100
            return (
              <div key={b.key} className={styles.hourRow}>
                <div className={styles.hourMeta}>
                  <span className={styles.hourLabel}>{b.label}</span>
                  <span className={styles.hourTime}>{b.hours}</span>
                </div>
                <div className={styles.hourBarWrap}>
                  <div className={styles.hourBar} style={{ width: barPct + '%', background: b.rev > dailyRev * 0.2 ? '#0D7377' : 'var(--border)' }} />
                </div>
                <div className={styles.hourRight}>
                  <span className={styles.hourRev}>{fmt(b.rev)}</span>
                  <div className={styles.hourMultInput}>
                    <input
                      type="number" step="0.1" min="0"
                      value={hourMults[b.key]}
                      onChange={e => setHourMults(prev => ({ ...prev, [b.key]: e.target.value }))}
                      className={styles.hourInput}
                    />
                    <span className={styles.hourMultLabel}>×</span>
                  </div>
                </div>
                <div className={styles.hourNote}>{b.note}</div>
              </div>
            )
          })}
        </div>

        {/* Category impact */}
        <div className={styles.catCard}>
          <div className={styles.catTitle}>Category impact during Ramadan</div>
          {[
            { key: 'deli',  label: 'Hot Food / Deli',    color: '#0D7377' },
            { key: 'juice', label: 'Juices & Smoothies', color: '#6a9fcb' },
            { key: 'bev',   label: 'Beverages',          color: '#5db88a' },
            { key: 'snack', label: 'Snacks',             color: '#d47060' },
            { key: 'groc',  label: 'Grocery',            color: '#9b85c4' },
          ].map(cat => {
            const normal  = catRevNormal[cat.key]
            const ramadan = catRevRamadan[cat.key]
            const change  = CAT_MULTS[cat.key] - 1
            return (
              <div key={cat.key} className={styles.catRow}>
                <span className={styles.catDot} style={{ background: cat.color }} />
                <span className={styles.catLabel}>{cat.label}</span>
                <span className={styles.catNormal}>{fmt(normal)}</span>
                <span className={styles.catArrow}>→</span>
                <span className={styles.catRamadan} style={{ color: change >= 0 ? '#5db88a' : '#d47060' }}>{fmt(ramadan)}</span>
                <span className={styles.catChange} style={{ color: change >= 0 ? '#5db88a' : '#d47060' }}>
                  {change >= 0 ? '+' : ''}{Math.round(change * 100)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
