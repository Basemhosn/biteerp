import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { useTranslation, fmtCurrency, fmtDate } from './i18n.js'

const n = v => parseFloat(v) || 0

export default function BankReconciliation({ restaurantId, userId }) {
  const { lang, t } = useTranslation()
  const fmt = v => fmtCurrency(v, lang)

  const [bankLines, setBankLines]   = useState([])
  const [invoices,  setInvoices]    = useState([])
  const [bills,     setBills]       = useState([])
  const [matched,   setMatched]     = useState({}) // bankLineId → { invoiceId, type }
  const [loading,   setLoading]     = useState(true)
  const [saving,    setSaving]      = useState(false)
  const [selLine,   setSelLine]     = useState(null)
  const [filter,    setFilter]      = useState('unreconciled') // all | unreconciled | reconciled

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    load()
  }, [restaurantId])

  async function load() {
    setLoading(true)
    try {
      const [jRes, invRes, billRes] = await Promise.all([
        supabase.from('journal_entries').select('id, entry_date, description, source, reconciled, reconciled_ref')
          .eq('restaurant_id', restaurantId).eq('source', 'bank_import')
          .order('entry_date', { ascending: false }),
        supabase.from('invoices').select('id, number, partner_name, total, invoice_date, due_date, type')
          .eq('restaurant_id', restaurantId).eq('type', 'invoice').eq('status', 'posted'),
        supabase.from('invoices').select('id, number, partner_name, total, invoice_date, due_date, type')
          .eq('restaurant_id', restaurantId).eq('type', 'bill').eq('status', 'posted'),
      ])
      setBankLines(jRes.data ?? [])
      setInvoices(invRes.data ?? [])
      setBills(billRes.data ?? [])
    } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  const reconcile = async (lineId, matchId, matchType) => {
    setSaving(true)
    try {
      // Mark journal entry as reconciled
      await supabase.from('journal_entries').update({
        reconciled: true, reconciled_ref: matchId
      }).eq('id', lineId)

      // Mark invoice/bill as paid
      if (matchId) {
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', matchId)
      }

      setMatched(p => ({ ...p, [lineId]: { matchId, matchType } }))
      setSelLine(null)
      await load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const markUnmatched = async (lineId) => {
    setSaving(true)
    try {
      await supabase.from('journal_entries').update({ reconciled: true, reconciled_ref: 'UNMATCHED' }).eq('id', lineId)
      setSelLine(null)
      await load()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const filtered = bankLines.filter(l => {
    if (filter === 'unreconciled') return !l.reconciled
    if (filter === 'reconciled')   return l.reconciled
    return true
  })

  const unreconciledCount = bankLines.filter(l => !l.reconciled).length
  const reconciledCount   = bankLines.filter(l => l.reconciled).length

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>{t('bank_reconciliation')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Match imported bank statement lines to invoices and bills.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: '1.25rem' }}>
        {[
          { label: t('unreconciled'), val: unreconciledCount, color: '#c0392b' },
          { label: t('reconciled'),   val: reconciledCount,   color: '#27ae60' },
          { label: 'Total lines',     val: bankLines.length,  color: 'var(--text-muted)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
        {['unreconciled','reconciled','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 16px', border: 'none', borderBottom: filter === f ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: filter === f ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', textTransform: 'capitalize' }}>
            {t(f) || f}
          </button>
        ))}
      </div>

      {/* Bank lines */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {filter === 'unreconciled' ? '✓ All bank lines are reconciled' : 'No lines found'}
          </div>
        )}
        {filtered.map(line => {
          const isOpen = selLine === line.id
          return (
            <div key={line.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
              {/* Line row */}
              <div onClick={() => !line.reconciled && setSelLine(isOpen ? null : line.id)}
                style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: line.reconciled ? 'default' : 'pointer', background: isOpen ? 'var(--accent-dim)' : 'transparent' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: line.reconciled ? '#27ae60' : '#c0392b', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{line.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{line.entry_date ? new Date(line.entry_date).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-AE') : '—'}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {line.reconciled && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(39,174,96,0.1)', color: '#27ae60' }}>✓ Reconciled</span>
                  )}
                  {!line.reconciled && (
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(192,57,43,0.08)', color: '#c0392b' }}>Unreconciled</span>
                  )}
                </div>
              </div>

              {/* Matching panel */}
              {isOpen && (
                <div style={{ padding: '12px 14px', background: 'var(--bg-card)', borderTop: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Match to an open invoice or bill</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {/* Invoices */}
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Customer invoices</div>
                      {invoices.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No open invoices</div>}
                      {invoices.map(inv => (
                        <div key={inv.id} onClick={() => reconcile(line.id, inv.id, 'invoice')}
                          style={{ padding: '8px 10px', marginBottom: 4, background: 'var(--bg-input)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{inv.partner_name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{inv.number}</div>
                          </div>
                          <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{fmt(inv.total)}</div>
                        </div>
                      ))}
                    </div>
                    {/* Bills */}
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Supplier bills</div>
                      {bills.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No open bills</div>}
                      {bills.map(bill => (
                        <div key={bill.id} onClick={() => reconcile(line.id, bill.id, 'bill')}
                          style={{ padding: '8px 10px', marginBottom: 4, background: 'var(--bg-input)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-input)'}>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{bill.partner_name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{bill.number}</div>
                          </div>
                          <div style={{ fontWeight: 600, color: '#8e44ad' }}>{fmt(bill.total)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => markUnmatched(line.id)} disabled={saving}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 12px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    Mark as reconciled (no match)
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
