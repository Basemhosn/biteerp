import { useState, useMemo } from 'react'
import styles from './DailySalesLog.module.css'

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
// Dubai week: Sat–Thu work week, Fri is weekend (busiest for F&B)
const DAY_NOTES = {
  Monday:    'Start of work week',
  Tuesday:   '',
  Wednesday: 'Mid-week',
  Thursday:  'Pre-weekend',
  Friday:    'End of work week',
  Saturday:  '🔥 Weekend — busiest day',
  Sunday:    '🔥 Weekend',
}

const CATEGORIES = ['Deli / Hot Food', 'Juices', 'Beverages', 'Snacks', 'Grocery']

export default function DailySalesLog({ weeklyRev }) {
  const targetPerDay = weeklyRev / 7

  const [week, setWeek] = useState(() => {
    const init = {}
    DAYS.forEach(d => { init[d] = { total: '', cats: CATEGORIES.map(() => '') } })
    return init
  })

  const [selectedDay, setSelectedDay] = useState(null)
  const [weekLabel, setWeekLabel] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10)
  })

  const setDayTotal = (day, val) =>
    setWeek(prev => ({ ...prev, [day]: { ...prev[day], total: val } }))

  const setCatVal = (day, i, val) =>
    setWeek(prev => ({
      ...prev,
      [day]: { ...prev[day], cats: prev[day].cats.map((v, ci) => ci === i ? val : v) }
    }))

  const stats = useMemo(() => DAYS.map(day => {
    const actual  = n(week[day].total) || week[day].cats.reduce((s, v) => s + n(v), 0)
    const vs      = actual - targetPerDay
    const vsPct   = targetPerDay > 0 ? ((actual - targetPerDay) / targetPerDay * 100) : 0
    return { day, actual, vs, vsPct, hasData: actual > 0 }
  }), [week, targetPerDay])

  const weekTotal   = stats.reduce((s, d) => s + d.actual, 0)
  const daysEntered = stats.filter(d => d.hasData).length
  const weekTarget  = weeklyRev
  const weekVs      = weekTotal - (weekTarget * daysEntered / 7)
  const bestDay     = stats.filter(d => d.hasData).sort((a, b) => b.actual - a.actual)[0]
  const runRate     = daysEntered > 0 ? (weekTotal / daysEntered) * 7 : 0

  const maxActual = Math.max(...stats.map(s => s.actual), targetPerDay, 1)

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Daily sales log</h2>
          <p className={styles.pageSub}>Enter actual daily revenue to track performance vs your weekly forecast. Dubai week runs Saturday to Friday.</p>
        </div>
        <div className={styles.weekPicker}>
          <span className={styles.weekLabel}>Week of</span>
          <input type="date" value={weekLabel} onChange={e => setWeekLabel(e.target.value)} className={styles.dateInput} />
        </div>
      </div>

      {/* Summary row */}
      <div className={styles.summaryRow}>
        {[
          { label: 'Weekly target',   val: fmt(weekTarget),                                     color: '#6a9fcb',  sub: 'from calculator'                       },
          { label: 'Logged so far',   val: fmt(weekTotal),                                      color: '#0D7377',  sub: daysEntered + ' of 7 days entered'       },
          { label: 'Run rate',        val: fmt(runRate),                                        color: runRate >= weekTarget ? '#5db88a' : '#d47060', sub: 'projected weekly total' },
          { label: 'vs Target',       val: (weekVs >= 0 ? '+' : '') + fmt(weekVs),              color: weekVs >= 0 ? '#5db88a' : '#d47060', sub: 'on days entered'  },
          { label: 'Best day',        val: bestDay?.day?.slice(0,3) ?? '—',                     color: '#0D7377',  sub: bestDay ? fmt(bestDay.actual) : '—'        },
        ].map(({ label, val, color, sub }) => (
          <div key={label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryVal} style={{ color }}>{val}</span>
            <span className={styles.summarySub}>{sub}</span>
          </div>
        ))}
      </div>

      {/* Day cards */}
      <div className={styles.dayGrid}>
        {stats.map(s => {
          const barPct    = (s.actual / maxActual) * 100
          const targetPct = (targetPerDay / maxActual) * 100
          const isSelected = selectedDay === s.day
          return (
            <div key={s.day} className={styles.dayCard} data-selected={isSelected} onClick={() => setSelectedDay(isSelected ? null : s.day)}>
              <div className={styles.dayHeader}>
                <span className={styles.dayName}>{s.day}</span>
                {DAY_NOTES[s.day] && <span className={styles.dayNote}>{DAY_NOTES[s.day]}</span>}
              </div>
              <div className={styles.dayInputWrap}>
                <span className={styles.dayPre}>AED</span>
                <input
                  type="number" min="0"
                  value={week[s.day].total}
                  onChange={e => { setDayTotal(s.day, e.target.value); setSelectedDay(null) }}
                  onClick={e => e.stopPropagation()}
                  placeholder="0"
                  className={styles.dayInput}
                />
              </div>
              <div className={styles.dayBarWrap}>
                <div className={styles.dayBarTrack}>
                  {/* Target line */}
                  <div className={styles.targetLine} style={{ left: targetPct + '%' }} />
                  {/* Actual bar */}
                  <div className={styles.dayBar} style={{
                    width: barPct + '%',
                    background: s.actual >= targetPerDay ? '#5db88a' : s.actual > 0 ? '#0D7377' : 'var(--border)'
                  }} />
                </div>
              </div>
              {s.hasData && (
                <div className={styles.dayVs} data-positive={s.vs >= 0}>
                  {s.vs >= 0 ? '▲' : '▼'} {Math.abs(s.vsPct).toFixed(0)}% vs target
                </div>
              )}

              {/* Expandable category breakdown */}
              {isSelected && (
                <div className={styles.catBreakdown} onClick={e => e.stopPropagation()}>
                  <div className={styles.catTitle}>Category breakdown</div>
                  {CATEGORIES.map((cat, i) => (
                    <div key={cat} className={styles.catRow}>
                      <span className={styles.catName}>{cat}</span>
                      <div className={styles.catInputWrap}>
                        <span className={styles.catPre}>AED</span>
                        <input
                          type="number" min="0"
                          value={week[s.day].cats[i]}
                          onChange={e => setCatVal(s.day, i, e.target.value)}
                          placeholder="0"
                          className={styles.catInput}
                        />
                      </div>
                    </div>
                  ))}
                  {week[s.day].cats.some(v => n(v) > 0) && (
                    <div className={styles.catTotal}>
                      Cat. total: {fmt(week[s.day].cats.reduce((s, v) => s + n(v), 0))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Week chart */}
      <div className={styles.chartCard}>
        <div className={styles.chartTitle}>Daily revenue vs daily target (AED {Math.round(targetPerDay).toLocaleString('en-AE')})</div>
        <div className={styles.chart}>
          {stats.map(s => {
            const barH     = s.actual > 0 ? Math.max(4, (s.actual / maxActual) * 180) : 0
            const targetH  = (targetPerDay / maxActual) * 180
            return (
              <div key={s.day} className={styles.chartCol}>
                <span className={styles.chartVal} style={{ color: s.actual >= targetPerDay ? '#5db88a' : s.actual > 0 ? '#0D7377' : 'var(--text-muted)' }}>
                  {s.actual > 0 ? fmt(s.actual) : ''}
                </span>
                <div className={styles.chartBarWrap}>
                  <div className={styles.chartTarget} style={{ bottom: targetH + 'px' }} />
                  <div className={styles.chartBar} style={{
                    height: barH + 'px',
                    background: s.actual >= targetPerDay ? '#5db88a' : s.actual > 0 ? '#0D7377' : 'var(--border)'
                  }} />
                </div>
                <span className={styles.chartDay}>{s.day.slice(0, 3)}</span>
              </div>
            )
          })}
        </div>
        <div className={styles.chartLegend}>
          <span><span className={styles.ldot} style={{ background: '#5db88a' }} /> Above target</span>
          <span><span className={styles.ldot} style={{ background: '#0D7377' }} /> Below target</span>
          <span>— Target line</span>
        </div>
      </div>
    </div>
  )
}
