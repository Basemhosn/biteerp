import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { useTranslation, fmtCurrency } from './i18n.js'

const n = v => parseFloat(v) || 0

export default function AccountingDashboard({ restaurantId, onNavigate }) {
  const { lang, t } = useTranslation()
  const fmt = v => fmtCurrency(v, lang)

  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    load()
  }, [restaurantId])

  async function load() {
    setLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const [invRes, billRes, jeRes, bankRes] = await Promise.all([
        supabase.from('invoices').select('id,number,partner_name,total,status,due_date,invoice_date,type')
          .eq('restaurant_id', restaurantId).eq('type', 'invoice').in('status', ['posted','draft']).order('invoice_date', { ascending: false }),
        supabase.from('invoices').select('id,number,partner_name,total,status,due_date,invoice_date,type')
          .eq('restaurant_id', restaurantId).eq('type', 'bill').in('status', ['posted','draft']).order('invoice_date', { ascending: false }),
        supabase.from('journal_entries').select('id,entry_number,entry_date,description,posted')
          .eq('restaurant_id', restaurantId).eq('posted', false).order('entry_date', { ascending: false }).limit(10),
        supabase.from('journal_entries').select('id,entry_date,source')
          .eq('restaurant_id', restaurantId).eq('source', 'bank_import').order('entry_date', { ascending: false }).limit(5),
      ])

      const invoices = invRes.data ?? []
      const bills    = billRes.data ?? []

      const totalReceivable  = invoices.filter(i => i.status === 'posted').reduce((s,i) => s + n(i.total), 0)
      const totalPayable     = bills.filter(b => b.status === 'posted').reduce((s,b) => s + n(b.total), 0)
      const overdueInvoices  = invoices.filter(i => i.status === 'posted' && i.due_date && new Date(i.due_date) < new Date())
      const overdueBills     = bills.filter(b => b.status === 'posted' && b.due_date && new Date(b.due_date) < new Date())
      const dueSoonInvoices  = invoices.filter(i => i.status === 'posted' && i.due_date && new Date(i.due_date) <= new Date(Date.now() + 7*86400000) && new Date(i.due_date) >= new Date())
      const dueSoonBills     = bills.filter(b => b.status === 'posted' && b.due_date && new Date(b.due_date) <= new Date(Date.now() + 7*86400000) && new Date(b.due_date) >= new Date())
      const draftInvoices    = invoices.filter(i => i.status === 'draft')
      const draftBills       = bills.filter(b => b.status === 'draft')

      setData({
        totalReceivable, totalPayable,
        overdueInvoices, overdueBills,
        dueSoonInvoices, dueSoonBills,
        draftInvoices, draftBills,
        unpostedEntries: jeRes.data ?? [],
        recentInvoices: invoices.slice(0, 5),
        recentBills: bills.slice(0, 5),
      })
    } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
  if (!data)   return null

  const SI = { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }
  const ST = { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }
  const fmtDate = d => d ? new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-AE', { day: 'numeric', month: 'short' }) : '—'

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>{t('accounting')}</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date().toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: '1.25rem' }}>
        {[
          { label: t('outstanding_receivable'), val: fmt(data.totalReceivable), color: '#2980b9', icon: '🧾', tab: 'acc_invoices',
            sub: data.overdueInvoices.length > 0 ? `⚠ ${data.overdueInvoices.length} overdue` : `${data.dueSoonInvoices.length} due this week` },
          { label: t('outstanding_payable'),    val: fmt(data.totalPayable),    color: '#8e44ad', icon: '📄', tab: 'acc_bills',
            sub: data.overdueBills.length > 0 ? `⚠ ${data.overdueBills.length} overdue` : `${data.dueSoonBills.length} due this week` },
          { label: t('draft') + ' ' + t('invoices'),   val: data.draftInvoices.length,  color: 'var(--text-muted)', icon: '✏️', tab: 'acc_invoices',
            sub: 'awaiting posting' },
          { label: t('draft') + ' ' + t('bills'),       val: data.draftBills.length,     color: 'var(--text-muted)', icon: '✏️', tab: 'acc_bills',
            sub: 'awaiting posting' },
        ].map(k => (
          <div key={k.label} onClick={() => onNavigate?.(k.tab)}
            style={{ ...SI, cursor: 'pointer', transition: 'border-color 0.13s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = k.color}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{k.label}</span>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: k.color, marginBottom: 4 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: k.sub?.includes('⚠') ? '#c0392b' : 'var(--text-muted)' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {(data.overdueInvoices.length > 0 || data.overdueBills.length > 0 || data.unpostedEntries.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.25rem' }}>
          {data.overdueInvoices.length > 0 && (
            <div onClick={() => onNavigate?.('acc_invoices')} style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '0.5px solid rgba(192,57,43,0.25)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: '#c0392b' }}>⚠ {data.overdueInvoices.length} overdue {data.overdueInvoices.length === 1 ? 'invoice' : 'invoices'} — {fmt(data.overdueInvoices.reduce((s,i) => s+n(i.total), 0))} outstanding</span>
              <span style={{ color: '#c0392b', fontSize: 11 }}>View →</span>
            </div>
          )}
          {data.overdueBills.length > 0 && (
            <div onClick={() => onNavigate?.('acc_bills')} style={{ padding: '10px 14px', background: 'rgba(142,68,173,0.06)', border: '0.5px solid rgba(142,68,173,0.25)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: '#8e44ad' }}>⚠ {data.overdueBills.length} overdue {data.overdueBills.length === 1 ? 'bill' : 'bills'} — {fmt(data.overdueBills.reduce((s,b) => s+n(b.total), 0))} payable</span>
              <span style={{ color: '#8e44ad', fontSize: 11 }}>View →</span>
            </div>
          )}
          {data.unpostedEntries.length > 0 && (
            <div onClick={() => onNavigate?.('acc_journal')} style={{ padding: '10px 14px', background: 'rgba(41,128,185,0.06)', border: '0.5px solid rgba(41,128,185,0.2)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: '#2980b9' }}>📋 {data.unpostedEntries.length} draft journal {data.unpostedEntries.length === 1 ? 'entry' : 'entries'} need review</span>
              <span style={{ color: '#2980b9', fontSize: 11 }}>Review →</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Recent invoices */}
        <div style={{ ...SI, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={ST}>{t('invoices')}</span>
            <button onClick={() => onNavigate?.('acc_invoices')} style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
          </div>
          {data.recentInvoices.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No invoices yet</div>
          ) : data.recentInvoices.map(inv => {
            const isOverdue = inv.status === 'posted' && inv.due_date && new Date(inv.due_date) < new Date()
            return (
              <div key={inv.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{inv.partner_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{inv.number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{fmt(inv.total)}</div>
                  <div style={{ fontSize: 10, color: isOverdue ? '#c0392b' : 'var(--text-muted)' }}>
                    {inv.status === 'draft' ? '● Draft' : isOverdue ? '⚠ Overdue' : fmtDate(inv.due_date)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Recent bills */}
        <div style={{ ...SI, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={ST}>{t('bills')}</span>
            <button onClick={() => onNavigate?.('acc_bills')} style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
          </div>
          {data.recentBills.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No bills yet</div>
          ) : data.recentBills.map(bill => {
            const isOverdue = bill.status === 'posted' && bill.due_date && new Date(bill.due_date) < new Date()
            return (
              <div key={bill.id} style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{bill.partner_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{bill.number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#8e44ad' }}>{fmt(bill.total)}</div>
                  <div style={{ fontSize: 10, color: isOverdue ? '#c0392b' : 'var(--text-muted)' }}>
                    {bill.status === 'draft' ? '● Draft' : isOverdue ? '⚠ Overdue' : fmtDate(bill.due_date)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
