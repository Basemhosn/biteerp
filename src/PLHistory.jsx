import { useState, useEffect } from 'react'
import { loadPLHistory, savePLSnapshot, deletePLSnapshot } from './supabase.js'
import styles from './PLHistory.module.css'

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
  if (val === null || val === undefined || isNaN(val)) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function PLHistory({ revenue, gross, netAfterTax, totalTax, foodCOGS, totalOpex, period, restaurantId, userId }) {
  const [history, setHistory]   = useState([])
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [snapMonth, setSnapMonth] = useState(new Date().getMonth())
  const [snapYear, setSnapYear]   = useState(new Date().getFullYear())
  const [note, setNote]           = useState('')

  useEffect(() => {
    if (!restaurantId) return
    loadPLHistory(restaurantId)
      .then(rows => setHistory(rows))
      .catch(() => {})
  }, [restaurantId])

  const saveSnapshot = async () => {
    if (!restaurantId) return
    setSaving(true)
    const snapshot = {
      month:        snapMonth,
      year:         snapYear,
      label:        MONTHS[snapMonth] + ' ' + snapYear,
      note,
      revenue,
      gross,
      net_after_tax: netAfterTax,
      total_tax:     totalTax,
      food_cogs:     foodCOGS,
      total_opex:    totalOpex,
      gross_margin:  revenue > 0 ? Math.round((gross / revenue) * 100) : 0,
      net_margin:    revenue > 0 ? Math.round((netAfterTax / revenue) * 100) : 0,
    }
    try {
      await savePLSnapshot(restaurantId, snapshot, userId)
      const rows = await loadPLHistory(restaurantId)
      setHistory(rows)
      setSaved(true)
      setNote('')
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const deleteEntry = async (id) => {
    try {
      await deletePLSnapshot(id)
      setHistory(prev => prev.filter(h => h.id !== id))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const maxRev = Math.max(...history.map(h => h.revenue), 1)
  const maxNet = Math.max(...history.map(h => Math.abs(h.net_after_tax)), 1)

  const years = [...new Set(history.map(h => h.year))].sort((a, b) => b - a)

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Monthly P&L history</h2>
          <p className={styles.pageSub}>Save a snapshot of your current Calculator figures each month to track performance over time.</p>
        </div>
      </div>

      {/* Save snapshot */}
      <div className={styles.saveCard}>
        <div className={styles.saveTitle}>Save this month's snapshot</div>
        <div className={styles.saveRow}>
          <div className={styles.saveField}>
            <label className={styles.saveLabel}>Month</label>
            <select value={snapMonth} onChange={e => setSnapMonth(Number(e.target.value))} className={styles.saveSelect}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <div className={styles.saveField}>
            <label className={styles.saveLabel}>Year</label>
            <select value={snapYear} onChange={e => setSnapYear(Number(e.target.value))} className={styles.saveSelect}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>
          <div className={styles.saveField} style={{ flex: 2 }}>
            <label className={styles.saveLabel}>Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Ramadan month, new supplier..." className={styles.saveInput} />
          </div>
          <button className={styles.saveBtn} onClick={saveSnapshot} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save snapshot'}
          </button>
        </div>
        <div className={styles.previewRow}>
          {[
            { label: 'Revenue',     val: fmt(revenue),     color: '#6a9fcb' },
            { label: 'Gross',       val: fmt(gross),       color: gross >= 0 ? '#5db88a' : '#d47060' },
            { label: 'Net after tax', val: fmt(netAfterTax), color: netAfterTax >= 0 ? '#5db88a' : '#d47060' },
            { label: 'Net margin',  val: revenue > 0 ? Math.round(netAfterTax / revenue * 100) + '%' : '—', color: 'var(--accent)' },
          ].map(({ label, val, color }) => (
            <div key={label} className={styles.previewItem}>
              <span className={styles.previewLabel}>{label}</span>
              <span className={styles.previewVal} style={{ color }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {history.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📊</div>
          <div className={styles.emptyText}>No history yet — save your first snapshot above</div>
        </div>
      )}

      {years.map(year => (
        <div key={year}>
          <div className={styles.yearLabel}>{year}</div>
          <div className={styles.tableCard}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Revenue</th>
                    <th>Gross profit</th>
                    <th>Gross margin</th>
                    <th>COGS</th>
                    <th>Opex</th>
                    <th>Net after tax</th>
                    <th>Net margin</th>
                    <th>Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.filter(h => h.year === year).map((h, idx, arr) => {
                    const prev = arr[idx + 1]
                    const revChange = prev ? ((h.revenue - prev.revenue) / Math.max(prev.revenue, 1) * 100).toFixed(1) : null
                    return (
                      <tr key={h.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{h.label}</td>
                        <td>
                          <div>{fmt(h.revenue)}</div>
                          {revChange !== null && (
                            <div className={styles.changeTag} data-positive={Number(revChange) >= 0}>
                              {Number(revChange) >= 0 ? '▲' : '▼'} {Math.abs(revChange)}%
                            </div>
                          )}
                          <div className={styles.miniBar}>
                            <div className={styles.miniBarFill} style={{ width: (h.revenue / maxRev * 100) + '%', background: '#6a9fcb' }} />
                          </div>
                        </td>
                        <td style={{ color: h.gross >= 0 ? '#5db88a' : '#d47060' }}>{fmt(h.gross)}</td>
                        <td><span className={styles.marginBadge} data-ok={h.gross_margin >= 40}>{h.gross_margin}%</span></td>
                        <td style={{ color: 'var(--text-muted)' }}>{fmt(h.food_cogs)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{fmt(h.total_opex)}</td>
                        <td style={{ color: h.net_after_tax >= 0 ? '#5db88a' : '#d47060', fontWeight: 500 }}>
                          {fmt(h.net_after_tax)}
                          <div className={styles.miniBar}>
                            <div className={styles.miniBarFill} style={{ width: (Math.abs(h.net_after_tax) / maxNet * 100) + '%', background: h.net_after_tax >= 0 ? '#5db88a' : '#d47060' }} />
                          </div>
                        </td>
                        <td><span className={styles.marginBadge} data-ok={h.net_margin >= 10}>{h.net_margin}%</span></td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 140 }}>{h.note}</td>
                        <td><button className={styles.deleteBtn} onClick={() => deleteEntry(h.id)}>✕</button></td>
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
