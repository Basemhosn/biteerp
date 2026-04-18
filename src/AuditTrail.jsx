import { useState, useEffect } from 'react'
import { loadAuditLogFull } from './supabase.js'

const ACTION_STYLES = {
  order_closed:      { color: '#27ae60', bg: 'rgba(39,174,96,0.1)',   label: 'Order closed'     },
  order_voided:      { color: '#c0392b', bg: 'rgba(192,57,43,0.1)',   label: 'Order voided'     },
  refund_issued:     { color: '#c0392b', bg: 'rgba(192,57,43,0.1)',   label: 'Refund issued'    },
  discount_applied:  { color: '#e67e22', bg: 'rgba(230,126,34,0.1)',  label: 'Discount applied' },
  stock_adjusted:    { color: '#2980b9', bg: 'rgba(41,128,185,0.1)',  label: 'Stock adjusted'   },
  journal_posted:    { color: '#8e44ad', bg: 'rgba(142,68,173,0.1)',  label: 'Journal posted'   },
  session_opened:    { color: '#27ae60', bg: 'rgba(39,174,96,0.1)',   label: 'Session opened'   },
  session_closed:    { color: '#7f8c8d', bg: 'rgba(127,140,141,0.1)', label: 'Session closed'   },
  shift_opened:      { color: '#27ae60', bg: 'rgba(39,174,96,0.1)',   label: 'Shift opened'     },
  shift_closed:      { color: '#7f8c8d', bg: 'rgba(127,140,141,0.1)', label: 'Shift closed'     },
  receipt_validated: { color: '#2980b9', bg: 'rgba(41,128,185,0.1)',  label: 'Receipt validated'},
}

export default function AuditTrail({ restaurantId, session }) {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ action: '', from: '', to: '' })
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    load()
  }, [restaurantId])

  async function load() {
    setLoading(true)
    try {
      setLogs(await loadAuditLogFull(restaurantId, {
        action: filters.action || undefined,
        from:   filters.from   || undefined,
        to:     filters.to     || undefined,
      }))
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const isManager = session?.role === 'owner' || session?.role === 'manager'

  if (!isManager) return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
      🔒 Audit trail is only accessible to managers and owners.
    </div>
  )

  const actionCounts = logs.reduce((acc, l) => { acc[l.action] = (acc[l.action] ?? 0) + 1; return acc }, {})

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Audit Trail</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Complete log of every action — who did what, when, and on which record.</p>
        </div>
        <button onClick={load} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 16px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {Object.entries(actionCounts).map(([action, count]) => {
          const s = ACTION_STYLES[action] ?? { color: 'var(--text-muted)', bg: 'var(--bg-input)', label: action }
          return (
            <div key={action} style={{ background: s.bg, border: `0.5px solid ${s.color}30`, borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: 12, color: s.color, cursor: 'pointer', fontWeight: filters.action === action ? 600 : 400 }}
              onClick={() => setFilters(p => ({ ...p, action: p.action === action ? '' : action }))}>
              {s.label} · {count}
            </div>
          )
        })}
        {filters.action && (
          <button onClick={() => setFilters(p => ({ ...p, action: '' }))} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '6px 12px', background: 'transparent', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>✕ Clear filter</button>
        )}
      </div>

      {/* Date filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>From</span>
          <input type="date" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))}
            style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 12, padding: '5px 8px', outline: 'none', fontFamily: 'var(--font-body)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          <span>To</span>
          <input type="date" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))}
            style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 12, padding: '5px 8px', outline: 'none', fontFamily: 'var(--font-body)' }} />
        </div>
        <button onClick={load} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '6px 14px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer' }}>Apply</button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading audit log…</div>
      ) : (
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Timestamp','User','Action','Entity','Details','Override'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(filters.action ? logs.filter(l => l.action === filters.action) : logs).map(log => {
                const s = ACTION_STYLES[log.action] ?? { color: 'var(--text-muted)', bg: 'var(--bg-input)', label: log.action }
                const details = log.details ?? {}
                const isExp = expanded === log.id
                return (
                  <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(isExp ? null : log.id)}>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {log.user_name ?? log.user_id?.slice(0,8) ?? '—'}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{log.entity_type?.replace('_',' ')}</span>
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)', maxWidth: 280 }}>
                      {isExp ? (
                        <pre style={{ fontSize: 10, background: 'var(--bg-input)', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: 280 }}>
                          {JSON.stringify(details, null, 2)}
                        </pre>
                      ) : (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 240, whiteSpace: 'nowrap' }}>
                          {details.order_number ? `Order #${details.order_number}` : ''}
                          {details.total ? ` · AED ${parseFloat(details.total).toFixed(2)}` : ''}
                          {details.invoice_number ? ` · ${details.invoice_number}` : ''}
                          {details.amount ? ` · AED ${parseFloat(details.amount).toFixed(2)}` : ''}
                          {details.reason ? ` · ${details.reason}` : ''}
                          {details.payment_method ? ` · ${details.payment_method}` : ''}
                          {!details.order_number && !details.amount && JSON.stringify(details).slice(0, 60)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>
                      {log.override_name ? (
                        <span style={{ color: '#e67e22', fontWeight: 500 }}>👤 {log.override_name}</span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
              {logs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>
                  No audit log entries yet
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
