import { useState, useEffect } from 'react'
import { loadCashSessions, loadShifts, loadRefunds, getOpenCashSession, closeCashSession, addCashMovement } from './supabase.js'
import styles from './EODReport.module.css'

const n = v => parseFloat(v) || 0
const fmt  = v => 'AED ' + n(v).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtT = d => new Date(d).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })
const fmtD = d => new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })

export default function EODReport({ restaurantId, session }) {
  const [sessions,   setSessions]   = useState([])
  const [shifts,     setShifts]     = useState([])
  const [refunds,    setRefunds]    = useState([])
  const [openSess,   setOpenSess]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState('today') // today | history
  const [closeModal, setCloseModal] = useState(false)
  const [cashModal,  setCashModal]  = useState(null)   // 'in' | 'out'
  const [closingCash, setClosingCash] = useState('')
  const [closeNotes,  setCloseNotes]  = useState('')
  const [cashAmt,    setCashAmt]    = useState('')
  const [cashReason, setCashReason] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [selSession, setSelSession] = useState(null)

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
  }, [restaurantId])

  async function reload() {
    setLoading(true)
    try {
      const [sess, shfts, refs, open] = await Promise.all([
        loadCashSessions(restaurantId, 30),
        loadShifts(restaurantId, 20),
        loadRefunds(restaurantId, 50),
        getOpenCashSession(restaurantId),
      ])
      setSessions(sess)
      setShifts(shfts)
      setRefunds(refs)
      setOpenSess(open)
      if (!selSession && sess.length > 0) setSelSession(sess[0])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleClose = async () => {
    if (!openSess) return
    setSaving(true)
    try {
      await closeCashSession(openSess.id, n(closingCash), closeNotes, session?.userId)
      setCloseModal(false); setClosingCash(''); setCloseNotes('')
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleCashMovement = async () => {
    if (!openSess || !n(cashAmt)) return
    setSaving(true)
    try {
      await addCashMovement(openSess.id, restaurantId, cashModal === 'in' ? 'cash_in' : 'cash_out', n(cashAmt), cashReason, session?.userId)
      setCashModal(null); setCashAmt(''); setCashReason('')
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const todaySessions = sessions.filter(s => {
    const d = new Date(s.opened_at)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  })

  const displaySess = view === 'today' ? (openSess ? [openSess, ...todaySessions.filter(s => s.id !== openSess?.id)] : todaySessions) : sessions
  const active = selSession ?? openSess

  // Compute totals for selected session
  const movements = active?.cash_movements ?? []
  const cashIn  = movements.filter(m => m.movement_type === 'cash_in').reduce((s, m) => s + n(m.amount), 0)
  const cashOut = movements.filter(m => m.movement_type === 'cash_out').reduce((s, m) => s + n(m.amount), 0)
  const expectedCash = n(active?.opening_float) + n(active?.total_cash_sales) + cashIn - cashOut
  const difference   = active?.status === 'closed' ? n(active?.cash_difference) : (n(active?.closing_cash || 0) - expectedCash)
  const totalSales   = n(active?.total_cash_sales) + n(active?.total_card_sales) + n(active?.total_online_sales)

  const sessionRefunds = refunds.filter(r => {
    if (!active) return false
    const rd = new Date(r.created_at)
    const od = new Date(active.opened_at)
    const cd = active.closed_at ? new Date(active.closed_at) : new Date()
    return rd >= od && rd <= cd
  })

  const todayShifts = shifts.filter(s => {
    if (!active) return false
    const sd = new Date(s.opened_at)
    const od = new Date(active.opened_at)
    const cd = active.closed_at ? new Date(active.closed_at) : new Date()
    return sd >= od && sd <= cd
  })

  if (loading) return <div className={styles.loading}>Loading end-of-day data…</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.pageTitle}>End of Day</h2>
          <p className={styles.pageSub}>Cash session management, daily reconciliation & shift reports</p>
        </div>
        <div className={styles.headerActions}>
          {openSess && (
            <>
              <button className={styles.cashBtn} onClick={() => setCashModal('in')}>+ Cash In</button>
              <button className={styles.cashBtn} data-out="true" onClick={() => setCashModal('out')}>− Cash Out</button>
              <button className={styles.closeBtn} onClick={() => setCloseModal(true)}>Close Session</button>
            </>
          )}
          {!openSess && (
            <div className={styles.noSession}>No open session — start one from the POS terminal</div>
          )}
        </div>
      </div>

      {/* Live session banner */}
      {openSess && (
        <div className={styles.liveBanner}>
          <span className={styles.liveDot} />
          <span>Session open since {fmtT(openSess.opened_at)} · Float: {fmt(openSess.opening_float)}</span>
          <span className={styles.liveTotal}>Running total: {fmt(n(openSess.total_cash_sales) + n(openSess.total_card_sales) + n(openSess.total_online_sales))}</span>
        </div>
      )}

      <div className={styles.body}>
        {/* Session list sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.viewToggle}>
            <button className={styles.viewBtn} data-active={view === 'today'} onClick={() => setView('today')}>Today</button>
            <button className={styles.viewBtn} data-active={view === 'history'} onClick={() => setView('history')}>History</button>
          </div>
          <div className={styles.sessionList}>
            {displaySess.length === 0 && (
              <div className={styles.emptyList}>No sessions found</div>
            )}
            {displaySess.map(s => {
              const tot = n(s.total_cash_sales) + n(s.total_card_sales) + n(s.total_online_sales)
              const isOpen = s.status === 'open'
              return (
                <button key={s.id} className={styles.sessionItem} data-active={active?.id === s.id} onClick={() => setSelSession(s)}>
                  <div className={styles.sessItemTop}>
                    <span className={styles.sessDate}>{fmtD(s.opened_at)}</span>
                    <span className={styles.sessBadge} data-open={isOpen}>{isOpen ? 'Open' : 'Closed'}</span>
                  </div>
                  <div className={styles.sessTotal}>{fmt(tot)}</div>
                  <div className={styles.sessTime}>{fmtT(s.opened_at)}{s.closed_at ? ` → ${fmtT(s.closed_at)}` : ' → now'}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Session detail */}
        {active ? (
          <div className={styles.detail}>
            {/* KPI row */}
            <div className={styles.kpiRow}>
              {[
                { label: 'Cash sales',   val: fmt(active.total_cash_sales),   color: '#5db88a' },
                { label: 'Card sales',   val: fmt(active.total_card_sales),   color: '#6a9fcb' },
                { label: 'Online sales', val: fmt(active.total_online_sales), color: '#9b85c4' },
                { label: 'Total sales',  val: fmt(totalSales),                color: 'var(--accent)', bold: true },
                { label: 'Refunds',      val: fmt(sessionRefunds.reduce((s, r) => s + n(r.amount), 0)), color: '#d47060' },
                { label: 'Net sales',    val: fmt(totalSales - sessionRefunds.reduce((s, r) => s + n(r.amount), 0)), color: 'var(--text-primary)', bold: true },
              ].map(k => (
                <div key={k.label} className={styles.kpi}>
                  <span className={styles.kpiLabel}>{k.label}</span>
                  <span className={styles.kpiVal} style={{ color: k.color, fontWeight: k.bold ? 600 : 400 }}>{k.val}</span>
                </div>
              ))}
            </div>

            {/* Cash reconciliation */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Cash reconciliation</div>
              <div className={styles.reconcileGrid}>
                <div className={styles.reconcileRow}>
                  <span>Opening float</span><span>{fmt(active.opening_float)}</span>
                </div>
                <div className={styles.reconcileRow}>
                  <span>Cash sales</span><span style={{ color: '#5db88a' }}>+ {fmt(active.total_cash_sales)}</span>
                </div>
                {cashIn > 0 && <div className={styles.reconcileRow}>
                  <span>Cash in</span><span style={{ color: '#5db88a' }}>+ {fmt(cashIn)}</span>
                </div>}
                {cashOut > 0 && <div className={styles.reconcileRow}>
                  <span>Cash out</span><span style={{ color: '#d47060' }}>− {fmt(cashOut)}</span>
                </div>}
                <div className={styles.reconcileRow} data-total="true">
                  <span>Expected cash in drawer</span><span>{fmt(expectedCash)}</span>
                </div>
                {active.status === 'closed' && (
                  <>
                    <div className={styles.reconcileRow}>
                      <span>Actual closing cash</span><span>{fmt(active.closing_cash)}</span>
                    </div>
                    <div className={styles.reconcileRow} data-diff="true">
                      <span>Difference</span>
                      <span style={{ color: n(active.cash_difference) === 0 ? '#5db88a' : '#d47060', fontWeight: 600 }}>
                        {n(active.cash_difference) >= 0 ? '+' : ''}{fmt(active.cash_difference)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Cash movements */}
            {movements.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Cash movements</div>
                <div className={styles.movementList}>
                  {movements.map((m, i) => (
                    <div key={i} className={styles.movementRow}>
                      <span className={styles.movBadge} data-type={m.movement_type}>{m.movement_type === 'cash_in' ? '↓ In' : '↑ Out'}</span>
                      <span className={styles.movReason}>{m.reason || '—'}</span>
                      <span className={styles.movTime}>{fmtT(m.created_at)}</span>
                      <span className={styles.movAmt} style={{ color: m.movement_type === 'cash_in' ? '#5db88a' : '#d47060' }}>
                        {m.movement_type === 'cash_in' ? '+' : '−'}{fmt(m.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cashier shifts */}
            {todayShifts.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Cashier shifts</div>
                <table className={styles.table}>
                  <thead><tr><th>Cashier</th><th>Opened</th><th>Closed</th><th>Float</th><th>Sales</th><th>Status</th></tr></thead>
                  <tbody>
                    {todayShifts.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500 }}>{s.cashier_name}</td>
                        <td>{fmtT(s.opened_at)}</td>
                        <td>{s.closed_at ? fmtT(s.closed_at) : '—'}</td>
                        <td>{fmt(s.opening_float)}</td>
                        <td style={{ color: 'var(--accent)' }}>{fmt(s.total_sales)}</td>
                        <td><span className={styles.shiftBadge} data-open={!s.closed_at}>{s.closed_at ? 'Closed' : 'Open'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Refunds */}
            {sessionRefunds.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Refunds this session</div>
                <table className={styles.table}>
                  <thead><tr><th>Ref #</th><th>Order</th><th>Reason</th><th>Method</th><th>Amount</th></tr></thead>
                  <tbody>
                    {sessionRefunds.map(r => (
                      <tr key={r.id}>
                        <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{r.refund_number}</td>
                        <td>#{r.orders?.order_number}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{r.reason}</td>
                        <td>{r.pay_method}</td>
                        <td style={{ color: '#d47060', fontWeight: 500 }}>− {fmt(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Print button */}
            <div className={styles.printRow}>
              <button className={styles.printBtn} onClick={() => window.print()}>🖨 Print EOD Report</button>
            </div>
          </div>
        ) : (
          <div className={styles.emptyDetail}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>Select a session to view details</div>
          </div>
        )}
      </div>

      {/* Close session modal */}
      {closeModal && (
        <div className={styles.overlay} onClick={() => setCloseModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Close cash session</span>
              <button className={styles.modalClose} onClick={() => setCloseModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalSummary}>
                <div>Expected cash in drawer</div>
                <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--accent)' }}>{fmt(expectedCash)}</div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Actual cash counted (AED)</label>
                <input type="number" min="0" step="0.01" value={closingCash}
                  onChange={e => setClosingCash(e.target.value)}
                  className={styles.input} placeholder="0.00" autoFocus />
              </div>
              {n(closingCash) > 0 && (
                <div className={styles.diffPreview} data-pos={n(closingCash) >= expectedCash}>
                  Difference: {n(closingCash) >= expectedCash ? '+' : ''}{fmt(n(closingCash) - expectedCash)}
                </div>
              )}
              <div className={styles.field}>
                <label className={styles.label}>Notes (optional)</label>
                <textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                  className={styles.input} rows={2} placeholder="Any discrepancies or notes…" />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.confirmBtn} onClick={handleClose} disabled={saving || !closingCash}>
                {saving ? 'Closing…' : 'Close & reconcile'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setCloseModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Cash in/out modal */}
      {cashModal && (
        <div className={styles.overlay} onClick={() => setCashModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{cashModal === 'in' ? 'Cash In' : 'Cash Out'}</span>
              <button className={styles.modalClose} onClick={() => setCashModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Amount (AED)</label>
                <input type="number" min="0" step="0.01" value={cashAmt}
                  onChange={e => setCashAmt(e.target.value)}
                  className={styles.input} placeholder="0.00" autoFocus />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Reason</label>
                <input value={cashReason} onChange={e => setCashReason(e.target.value)}
                  className={styles.input} placeholder={cashModal === 'in' ? 'e.g. Change replenishment' : 'e.g. Petty cash, bank deposit'} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.confirmBtn} onClick={handleCashMovement} disabled={saving || !cashAmt}>
                {saving ? 'Saving…' : `Record ${cashModal === 'in' ? 'cash in' : 'cash out'}`}
              </button>
              <button className={styles.cancelBtn} onClick={() => setCashModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
