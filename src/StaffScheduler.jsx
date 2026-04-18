import { useState, useMemo } from 'react'
import styles from './StaffScheduler.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

function parseTime(str) {
  // Parse "HH:MM" → minutes from midnight
  const [h, m] = (str ?? '09:00').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function hoursFromTimes(start, end) {
  const s = parseTime(start), e = parseTime(end)
  if (e > s) return (e - s) / 60
  if (e < s) return (24 * 60 - s + e) / 60 // overnight
  return 0
}

function fmtTime(mins) {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${h12}${m ? ':' + String(m).padStart(2,'0') : ''}${ampm}`
}

// Mon–Fri = weekdays, Sat–Sun = weekend
const DAYS = [
  { key: 'mon', label: 'Monday',    short: 'Mon', weekend: false },
  { key: 'tue', label: 'Tuesday',   short: 'Tue', weekend: false },
  { key: 'wed', label: 'Wednesday', short: 'Wed', weekend: false },
  { key: 'thu', label: 'Thursday',  short: 'Thu', weekend: false },
  { key: 'fri', label: 'Friday',    short: 'Fri', weekend: false },
  { key: 'sat', label: 'Saturday',  short: 'Sat', weekend: true  },
  { key: 'sun', label: 'Sunday',    short: 'Sun', weekend: true  },
]

const PRESET_SHIFTS = [
  { key: 'morning',   label: 'Morning',   start: '07:00', end: '15:00', color: '#6a9fcb' },
  { key: 'afternoon', label: 'Afternoon', start: '15:00', end: '23:00', color: '#0D7377' },
  { key: 'split',     label: 'Split',     start: '10:00', end: '19:00', color: '#9b85c4' },
  { key: 'double',    label: 'Double',    start: '07:00', end: '23:00', color: '#d47060' },
  { key: 'custom',    label: 'Custom',    start: null,     end: null,   color: '#5db88a' },
  { key: 'off',       label: 'Day off',   start: null,     end: null,   color: 'transparent' },
]

const ROLE_COLORS = { Cashier: '#6a9fcb', 'Cook/Deli': '#0D7377', Stock: '#9b85c4', Other: '#5db88a' }

const DEFAULT_STAFF = [
  { id: 1, name: 'Cashier 1',   role: 'Cashier',   rate: 18 },
  { id: 2, name: 'Cashier 2',   role: 'Cashier',   rate: 18 },
  { id: 3, name: 'Cashier 3',   role: 'Cashier',   rate: 18 },
  { id: 4, name: 'Cook 1',      role: 'Cook/Deli', rate: 25 },
  { id: 5, name: 'Cook 2',      role: 'Cook/Deli', rate: 25 },
  { id: 6, name: 'Cook 3',      role: 'Cook/Deli', rate: 25 },
  { id: 7, name: 'Cook 4',      role: 'Cook/Deli', rate: 25 },
  { id: 8, name: 'Stock Boy 1', role: 'Stock',     rate: 15 },
  { id: 9, name: 'Stock Boy 2', role: 'Stock',     rate: 15 },
]

// Default shift per day: Mon–Fri morning, Sat–Sun off
function defaultSchedule(staffList) {
  const s = {}
  staffList.forEach(m => {
    s[m.id] = Object.fromEntries(DAYS.map(d => [
      d.key,
      { preset: d.weekend ? 'off' : 'morning', start: '07:00', end: '15:00' }
    ]))
  })
  return s
}

let nextId = 10

export default function StaffScheduler({ salaryVal, mult }) {
  const weeklyBudget = salaryVal / Math.max(mult, 1)

  const [staff,    setStaff]    = useState(DEFAULT_STAFF)
  const [schedule, setSchedule] = useState(() => defaultSchedule(DEFAULT_STAFF))
  const [view,     setView]     = useState('calendar')
  const [showAdd,  setShowAdd]  = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newRole,  setNewRole]  = useState('Cashier')
  const [newRate,  setNewRate]  = useState('18')
  const [selected, setSelected] = useState(null) // { staffId, dayKey }
  const [weekOffset, setWeekOffset] = useState(0)

  // Week dates — aligned to Monday
  const weekDates = useMemo(() => {
    const now = new Date()
    const dow = now.getDay() // 0=Sun
    const monOffset = dow === 0 ? -6 : 1 - dow
    const mon = new Date(now)
    mon.setDate(now.getDate() + monOffset + weekOffset * 7)
    return DAYS.map((_, i) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      return d
    })
  }, [weekOffset])

  const weekLabel = `${weekDates[0]?.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })} – ${weekDates[6]?.toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const getCell = (staffId, dayKey) => schedule[staffId]?.[dayKey] ?? { preset: 'off', start: '07:00', end: '15:00' }

  const setCell = (staffId, dayKey, updates) => {
    setSchedule(prev => ({
      ...prev,
      [staffId]: { ...prev[staffId], [dayKey]: { ...prev[staffId][dayKey], ...updates } }
    }))
  }

  const applyPreset = (staffId, dayKey, preset) => {
    const p = PRESET_SHIFTS.find(s => s.key === preset)
    if (preset === 'custom') {
      setCell(staffId, dayKey, { preset: 'custom', start: '09:00', end: '17:00' })
    } else if (p?.start) {
      setCell(staffId, dayKey, { preset, start: p.start, end: p.end })
    } else {
      setCell(staffId, dayKey, { preset, start: '07:00', end: '15:00' })
    }
    setSelected(null)
  }

  const cellHours = (cell) => {
    if (cell.preset === 'off') return 0
    return hoursFromTimes(cell.start, cell.end)
  }

  const stats = useMemo(() => staff.map(s => {
    const days    = schedule[s.id] ?? {}
    const totalHrs   = DAYS.reduce((sum, d) => sum + cellHours(days[d.key] ?? { preset: 'off' }), 0)
    const weeklyCost = totalHrs * n(s.rate)
    return { ...s, days, totalHrs, weeklyCost, color: ROLE_COLORS[s.role] ?? '#5db88a' }
  }), [staff, schedule])

  const totalWeeklyCost = stats.reduce((s, st) => s + st.weeklyCost, 0)
  const totalHrs        = stats.reduce((s, st) => s + st.totalHrs, 0)
  const overBudget      = totalWeeklyCost - weeklyBudget
  const dayCoverage     = DAYS.map(d => stats.filter(s => getCell(s.id, d.key).preset !== 'off').length)

  const addStaff = () => {
    if (!newName.trim()) return
    const member = { id: nextId++, name: newName.trim(), role: newRole, rate: n(newRate) }
    setStaff(prev => [...prev, member])
    setSchedule(prev => ({
      ...prev,
      [member.id]: Object.fromEntries(DAYS.map(d => [d.key, { preset: d.weekend ? 'off' : 'morning', start: '07:00', end: '15:00' }]))
    }))
    setNewName(''); setShowAdd(false)
  }

  const removeStaff = id => {
    setStaff(prev => prev.filter(s => s.id !== id))
    setSchedule(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const getShiftDisplay = (cell) => {
    if (cell.preset === 'off') return { label: '—', color: 'transparent', hours: '' }
    if (cell.preset === 'custom') return { label: `${fmtTime(parseTime(cell.start))}–${fmtTime(parseTime(cell.end))}`, color: '#5db88a', hours: cellHours(cell).toFixed(1) + 'h' }
    const p = PRESET_SHIFTS.find(s => s.key === cell.preset)
    return { label: p?.label ?? cell.preset, color: p?.color ?? '#888', hours: cellHours(cell) + 'h' }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Staff scheduling</h2>
          <p className={styles.pageSub}>Weekly rota — Mon–Fri workweek, Sat–Sun weekend. Click any cell to assign shifts or enter custom times.</p>
        </div>
        <div className={styles.topActions}>
          <button className={styles.addBtn} onClick={() => setShowAdd(v => !v)}>+ Add staff</button>
          <div className={styles.viewToggle}>
            <button className={styles.viewBtn} data-active={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button>
            <button className={styles.viewBtn} data-active={view === 'table'}    onClick={() => setView('table')}>Table</button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryRow}>
        {[
          { label: 'Weekly budget',   val: fmt(weeklyBudget),   color: '#6a9fcb', sub: 'from payroll inputs' },
          { label: 'Scheduled cost',  val: fmt(totalWeeklyCost),color: totalWeeklyCost <= weeklyBudget ? '#5db88a' : '#d47060', sub: 'this rota' },
          { label: 'vs Budget',       val: (overBudget >= 0 ? '+' : '') + fmt(overBudget), color: overBudget <= 0 ? '#5db88a' : '#d47060', sub: overBudget <= 0 ? 'within budget' : 'over budget' },
          { label: 'Total hours',     val: totalHrs.toFixed(0) + ' hrs', color: '#0D7377', sub: 'across all staff' },
          { label: 'Staff',           val: staff.length,        color: 'var(--text-primary)', sub: 'on rota' },
        ].map(({ label, val, color, sub }) => (
          <div key={label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryVal} style={{ color }}>{val}</span>
            <span className={styles.summarySub}>{sub}</span>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className={styles.addCard}>
          <div className={styles.addRow}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name" className={styles.addInput} onKeyDown={e => e.key === 'Enter' && addStaff()} />
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className={styles.addInput}>
              {Object.keys(ROLE_COLORS).map(r => <option key={r}>{r}</option>)}
            </select>
            <div className={styles.rateWrap}>
              <span className={styles.ratePre}>AED</span>
              <input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} placeholder="Rate/hr" className={styles.addInput} />
              <span className={styles.rateSuf}>/hr</span>
            </div>
            <button className={styles.saveBtn} onClick={addStaff}>Add</button>
            <button className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === 'calendar' && (
        <div className={styles.calendarWrap}>
          <div className={styles.weekNav}>
            <button className={styles.weekNavBtn} onClick={() => setWeekOffset(v => v - 1)}>‹</button>
            <span className={styles.weekNavLabel}>{weekLabel}</span>
            <button className={styles.weekNavBtn} onClick={() => setWeekOffset(v => v + 1)}>›</button>
            <button className={styles.weekNavBtn} style={{ fontSize: 11 }} onClick={() => setWeekOffset(0)}>Today</button>
          </div>

          <div className={styles.calGrid} style={{ gridTemplateColumns: `180px repeat(7, 1fr)` }}>
            {/* Header */}
            <div className={styles.calStaffCol} />
            {DAYS.map((day, di) => (
              <div key={day.key} className={styles.calDayHeader}
                data-today={weekDates[di]?.toDateString() === new Date().toDateString()}
                data-weekend={day.weekend}>
                <span className={styles.calDayName}>{day.short}</span>
                <span className={styles.calDayDate}>{weekDates[di]?.getDate()}</span>
                <span className={styles.calCoverage}>{dayCoverage[di]} staff</span>
                {day.weekend && <span className={styles.weekendTag}>Weekend</span>}
              </div>
            ))}

            {/* Staff rows */}
            {stats.map(s => (
              <div key={s.id} style={{ display: 'contents' }}>
                <div className={styles.calStaffLabel}>
                  <div className={styles.calStaffDot} style={{ background: s.color }} />
                  <div>
                    <div className={styles.calStaffName}>{s.name}</div>
                    <div className={styles.calStaffRole}>{s.role} · AED {s.rate}/hr · {s.totalHrs.toFixed(0)}h · {fmt(s.weeklyCost)}</div>
                  </div>
                  <button className={styles.calRemoveBtn} onClick={() => removeStaff(s.id)}>✕</button>
                </div>

                {DAYS.map((day, di) => {
                  const cell  = getCell(s.id, day.key)
                  const disp  = getShiftDisplay(cell)
                  const isOff = cell.preset === 'off'
                  const isSel = selected?.staffId === s.id && selected?.dayKey === day.key

                  return (
                    <div
                      key={day.key}
                      className={styles.calCell}
                      data-selected={isSel}
                      data-off={isOff}
                      data-weekend={day.weekend}
                      onClick={() => setSelected(isSel ? null : { staffId: s.id, dayKey: day.key })}
                    >
                      {!isOff && (
                        <div className={styles.calShiftChip}
                          style={{ background: disp.color + '22', borderColor: disp.color + '66' }}>
                          <span className={styles.calShiftLabel} style={{ color: disp.color }}>{disp.label}</span>
                          <span className={styles.calShiftHrs}>{disp.hours}</span>
                        </div>
                      )}
                      {isOff && <span className={styles.calOffDot}>—</span>}

                      {isSel && (
                        <div className={styles.calPicker} onClick={e => e.stopPropagation()}>
                          <div className={styles.calPickerTitle}>{s.name} · {day.short}</div>

                          {PRESET_SHIFTS.map(ps => (
                            <button
                              key={ps.key}
                              className={styles.calPickerOption}
                              data-active={cell.preset === ps.key && ps.key !== 'custom'}
                              onClick={() => applyPreset(s.id, day.key, ps.key)}
                            >
                              <span className={styles.calPickerDot} style={{ background: ps.color === 'transparent' ? 'var(--border)' : ps.color }} />
                              <span className={styles.calPickerLabel}>{ps.label}</span>
                              {ps.start && <span className={styles.calPickerHours}>{fmtTime(parseTime(ps.start))}–{fmtTime(parseTime(ps.end))}</span>}
                            </button>
                          ))}

                          {/* Custom time inputs */}
                          {cell.preset === 'custom' && (
                            <div className={styles.customTimeRow} onClick={e => e.stopPropagation()}>
                              <div className={styles.customTimeField}>
                                <label className={styles.customTimeLabel}>Start</label>
                                <input
                                  type="time"
                                  value={cell.start}
                                  onChange={e => setCell(s.id, day.key, { start: e.target.value })}
                                  className={styles.timeInput}
                                />
                              </div>
                              <span className={styles.customTimeSep}>–</span>
                              <div className={styles.customTimeField}>
                                <label className={styles.customTimeLabel}>End</label>
                                <input
                                  type="time"
                                  value={cell.end}
                                  onChange={e => setCell(s.id, day.key, { end: e.target.value })}
                                  className={styles.timeInput}
                                />
                              </div>
                              <span className={styles.customTimeHrs}>
                                {hoursFromTimes(cell.start, cell.end).toFixed(1)}h
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Cost row */}
          <div className={styles.calCostRow} style={{ gridTemplateColumns: `180px repeat(7, 1fr)` }}>
            <div className={styles.calCostLabel}>Daily cost</div>
            {DAYS.map(day => {
              const dayCost = stats.reduce((sum, s) => {
                const cell = getCell(s.id, day.key)
                return sum + cellHours(cell) * n(s.rate)
              }, 0)
              return (
                <div key={day.key} className={styles.calCostCell}>
                  <span style={{ color: '#0D7377', fontSize: 11, fontWeight: 500 }}>{fmt(dayCost)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {view === 'table' && (
        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <table className={styles.rotaTable}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  {DAYS.map(d => (
                    <th key={d.key} style={{ color: d.weekend ? 'var(--accent)' : undefined }}>
                      {d.short}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Hrs</th>
                  <th style={{ textAlign: 'right' }}>Cost/wk</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.map(s => (
                  <tr key={s.id}>
                    <td><span className={styles.staffName} style={{ borderLeft: `3px solid ${s.color}`, paddingLeft: 8 }}>{s.name}</span></td>
                    <td><span className={styles.roleBadge}>{s.role} · AED {s.rate}/hr</span></td>
                    {DAYS.map(day => {
                      const cell = getCell(s.id, day.key)
                      const disp = getShiftDisplay(cell)
                      return (
                        <td key={day.key} style={{ background: day.weekend ? 'rgba(13,115,119,0.04)' : undefined }}>
                          <select
                            value={cell.preset}
                            onChange={e => applyPreset(s.id, day.key, e.target.value)}
                            className={styles.shiftSelect}
                            style={{ background: disp.color !== 'transparent' ? disp.color + '22' : 'var(--bg-input)', borderColor: disp.color !== 'transparent' ? disp.color + '55' : 'var(--border)' }}
                          >
                            {PRESET_SHIFTS.map(ps => <option key={ps.key} value={ps.key}>{ps.label}</option>)}
                          </select>
                        </td>
                      )
                    })}
                    <td style={{ color: '#0D7377', fontWeight: 500, textAlign: 'right' }}>{s.totalHrs.toFixed(0)}h</td>
                    <td style={{ color: '#d47060', fontWeight: 500, textAlign: 'right' }}>{fmt(s.weeklyCost)}</td>
                    <td><button className={styles.deleteBtn} onClick={() => removeStaff(s.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.totalRow}>
                  <td colSpan={2}>Total</td>
                  {DAYS.map(d => <td key={d.key} style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>{dayCoverage[DAYS.indexOf(d)]}</td>)}
                  <td style={{ fontWeight: 600, color: '#0D7377', textAlign: 'right' }}>{totalHrs.toFixed(0)}h</td>
                  <td style={{ fontWeight: 600, color: overBudget > 0 ? '#d47060' : '#5db88a', textAlign: 'right' }}>{fmt(totalWeeklyCost)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        {PRESET_SHIFTS.filter(s => s.key !== 'off').map(sh => (
          <div key={sh.key} className={styles.legendItem}>
            <span className={styles.legendChip} style={{ background: sh.color + '22', color: sh.color, borderColor: sh.color + '55' }}>
              {sh.key === 'custom' ? 'Custom' : sh.label}
            </span>
            {sh.start && <span className={styles.legendHours}>{fmtTime(parseTime(sh.start))}–{fmtTime(parseTime(sh.end))}</span>}
            {sh.key === 'custom' && <span className={styles.legendHours}>enter start & end time</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
