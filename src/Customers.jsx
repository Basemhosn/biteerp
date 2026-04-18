import { useState, useEffect, useRef } from 'react'
import {
  loadCustomers, saveCustomer, loadCustomer, loadCustomerOrders,
  loadLoyaltySettings, saveLoyaltySettings, adjustPoints, calcTier, calcPointsValue
} from './supabase.js'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toFixed(2)

const TIER_STYLES = {
  bronze:   { bg: '#fef5e7', color: '#b7770d', icon: '🥉' },
  silver:   { bg: '#f2f3f4', color: '#707b7c', icon: '🥈' },
  gold:     { bg: '#fef9e7', color: '#b7950b', icon: '🥇' },
  platinum: { bg: '#eaf4fb', color: '#1a5276', icon: '💎' },
}

const TAGS = ['VIP', 'Regular', 'Corporate', 'Wholesale', 'Blacklisted']

export default function Customers({ restaurantId, userId, activeTab }) {
  const [view,      setView]      = useState(activeTab === 'loyalty' ? 'settings' : 'list') // list | detail | new | settings
  const [customers, setCustomers] = useState([])
  const [selCust,   setSelCust]   = useState(null)
  const [custOrders,setCustOrders]= useState([])
  const [settings,  setSettings]  = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [search,    setSearch]    = useState('')
  const [tierFilter,setTierFilter]= useState('all')

  // New / edit form
  const [form, setForm] = useState({ name: '', phone: '', email: '', birthday: '', gender: '', notes: '', tags: [] })

  // Adjust points modal
  const [adjModal,  setAdjModal]  = useState(null)
  const [adjPoints, setAdjPoints] = useState('')
  const [adjReason, setAdjReason] = useState('')

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
  }, [restaurantId])

  async function reload() {
    setLoading(true)
    try {
      const [custs, sett] = await Promise.all([
        loadCustomers(restaurantId),
        loadLoyaltySettings(restaurantId),
      ])
      setCustomers(custs); setSettings(sett)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const openDetail = async (c) => {
    setSelCust(c); setView('detail')
    const orders = await loadCustomerOrders(c.id)
    setCustOrders(orders)
  }

  const openNew = () => {
    setForm({ name: '', phone: '', email: '', birthday: '', gender: '', notes: '', tags: [] })
    setView('new')
  }

  const openEdit = (c) => {
    setForm({ ...c, tags: c.tags ?? [] })
    setView('new')
  }

  const submitForm = async () => {
    if (!form.name?.trim()) { alert('Name required'); return }
    setSaving(true)
    try {
      const tier = calcTier(n(form.lifetime_spend), settings ?? {})
      await saveCustomer(restaurantId, { ...form, tier })
      await reload()
      setView('list')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleAdjust = async () => {
    if (!n(adjPoints)) return
    setSaving(true)
    try {
      await adjustPoints(restaurantId, adjModal.id, parseInt(adjPoints), adjReason || 'Manual adjustment', userId)
      setAdjModal(null); setAdjPoints(''); setAdjReason('')
      // Refresh customer
      const updated = await loadCustomers(restaurantId)
      setCustomers(updated)
      if (selCust) setSelCust(updated.find(c => c.id === selCust.id))
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const toggleTag = (tag) => setForm(p => ({
    ...p, tags: (p.tags ?? []).includes(tag) ? p.tags.filter(t => t !== tag) : [...(p.tags ?? []), tag]
  }))

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
    const matchTier   = tierFilter === 'all' || c.tier === tierFilter
    return matchSearch && matchTier
  })

  const totalCustomers = customers.length
  const totalSpend     = customers.reduce((s, c) => s + n(c.lifetime_spend), 0)
  const avgSpend       = totalCustomers > 0 ? totalSpend / totalCustomers : 0
  const loyaltyTotal   = customers.reduce((s, c) => s + (c.loyalty_points ?? 0), 0)

  const S = {
    input: { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' },
    label: { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 },
    field: { display: 'flex', flexDirection: 'column', gap: 5 },
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading customers…</div>

  return (
    <div>
      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Customers</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer database, loyalty points, and tier management.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setView('settings')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '9px 16px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>⚙ Loyalty settings</button>
              <button onClick={openNew} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>+ New customer</button>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
            {[
              { label: 'Total customers',  val: totalCustomers,   color: 'var(--accent)'       },
              { label: 'Total spend',       val: fmt(totalSpend),  color: 'var(--accent)'       },
              { label: 'Avg spend',         val: fmt(avgSpend),    color: 'var(--text-primary)' },
              { label: 'Points in circulation', val: loyaltyTotal.toLocaleString(), color: '#e67e22' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: k.color, marginBottom: 3 }}>{k.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, email…"
              style={{ ...S.input, width: 240 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {['all','bronze','silver','gold','platinum'].map(t => (
                <button key={t} onClick={() => setTierFilter(t)}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '5px 10px', borderRadius: 999, border: '0.5px solid var(--border)', background: tierFilter === t ? 'var(--accent-dim)' : 'transparent', color: tierFilter === t ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}>
                  {t === 'all' ? 'All' : (TIER_STYLES[t]?.icon + ' ' + t.charAt(0).toUpperCase() + t.slice(1))}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Customer','Phone','Tier','Points','Lifetime spend','Visits','Last visit','Tags',''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const ts = TIER_STYLES[c.tier] ?? TIER_STYLES.bronze
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: ts.bg, color: ts.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                            {c.name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{c.phone ?? '—'}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: ts.bg, color: ts.color }}>
                          {ts.icon} {c.tier}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#e67e22', borderBottom: '0.5px solid var(--border)' }}>{(c.loyalty_points ?? 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 500, borderBottom: '0.5px solid var(--border)' }}>{fmt(c.lifetime_spend)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{c.visit_count ?? 0}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
                        {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('en-AE') : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {(c.tags ?? []).map(t => (
                            <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: t === 'VIP' ? 'rgba(13,115,119,0.12)' : t === 'Blacklisted' ? 'rgba(192,57,43,0.1)' : 'var(--bg-input)', color: t === 'VIP' ? 'var(--accent)' : t === 'Blacklisted' ? '#c0392b' : 'var(--text-muted)' }}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <button onClick={e => { e.stopPropagation(); openEdit(c) }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Edit</button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>
                    {search ? 'No customers match your search' : 'No customers yet — they appear here automatically when linked at POS checkout'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CUSTOMER DETAIL ── */}
      {view === 'detail' && selCust && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 2 }}>{selCust.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selCust.phone ?? ''}{selCust.email ? ' · ' + selCust.email : ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAdjModal(selCust)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>⊕ Adjust points</button>
              <button onClick={() => openEdit(selCust)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>Edit</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {/* Loyalty card */}
            {(() => {
              const ts = TIER_STYLES[selCust.tier] ?? TIER_STYLES.bronze
              const pointsVal = calcPointsValue(selCust.loyalty_points ?? 0, settings ?? { aed_per_point: 0.1 })
              return (
                <div style={{ background: ts.bg, border: `1.5px solid ${ts.color}`, borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ts.color }}>{ts.icon} {selCust.tier.toUpperCase()} MEMBER</span>
                    {(selCust.tags ?? []).map(t => <span key={t} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,0,0,0.08)', color: ts.color }}>{t}</span>)}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: ts.color, marginBottom: 4 }}>{(selCust.loyalty_points ?? 0).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: ts.color, opacity: 0.8 }}>points · worth {fmt(pointsVal)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                    {[
                      { label: 'Lifetime spend', val: fmt(selCust.lifetime_spend) },
                      { label: 'Total visits',   val: selCust.visit_count ?? 0 },
                    ].map(k => (
                      <div key={k.label}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: ts.color }}>{k.val}</div>
                        <div style={{ fontSize: 10, color: ts.color, opacity: 0.7 }}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Profile info */}
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Profile</div>
              {[
                { label: 'Phone',       val: selCust.phone    },
                { label: 'Email',       val: selCust.email    },
                { label: 'Birthday',    val: selCust.birthday ? new Date(selCust.birthday).toLocaleDateString('en-AE', { day: 'numeric', month: 'long' }) : null },
                { label: 'Last visit',  val: selCust.last_visit_at ? new Date(selCust.last_visit_at).toLocaleDateString('en-AE') : null },
                { label: 'Notes',       val: selCust.notes    },
              ].filter(r => r.val).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Order history */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Order history</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {['Invoice','Date','Total','Payment','Points earned','Points redeemed'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {custOrders.map((o, i) => (
                  <tr key={i}>
                    <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>{o.invoice_number ?? `#${o.order_number}`}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(o.closed_at).toLocaleDateString('en-AE')}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{fmt(o.total)}</td>
                    <td style={{ padding: '9px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{o.payment_method}</td>
                    <td style={{ padding: '9px 12px', color: '#27ae60', fontWeight: 500, borderBottom: '0.5px solid var(--border)' }}>{o.loyalty_earned > 0 ? '+' + o.loyalty_earned : '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#c0392b', fontWeight: 500, borderBottom: '0.5px solid var(--border)' }}>{o.loyalty_redeemed > 0 ? '-' + o.loyalty_redeemed : '—'}</td>
                  </tr>
                ))}
                {custOrders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: 13 }}>No orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── NEW / EDIT FORM ── */}
      {view === 'new' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)' }}>{form.id ? 'Edit customer' : 'New customer'}</h2>
            <button onClick={() => setView(form.id ? 'detail' : 'list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
              {[
                { label: 'Full name *', field: 'name',     placeholder: 'John Smith'            },
                { label: 'Phone',       field: 'phone',    placeholder: '+971 50 XXX XXXX'      },
                { label: 'Email',       field: 'email',    placeholder: 'john@example.com'      },
                { label: 'Birthday',    field: 'birthday', placeholder: '',  type: 'date'       },
              ].map(({ label, field, placeholder, type }) => (
                <div key={field} style={S.field}>
                  <label style={S.label}>{label}</label>
                  <input type={type ?? 'text'} value={form[field] ?? ''} placeholder={placeholder}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    style={S.input} />
                </div>
              ))}
              <div style={S.field}>
                <label style={S.label}>Gender</label>
                <select value={form.gender ?? ''} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))} style={S.input}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...S.label, display: 'block', marginBottom: 8 }}>Tags</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TAGS.map(t => (
                  <button key={t} onClick={() => toggleTag(t)}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 12px', borderRadius: 999, border: '0.5px solid var(--border)', background: (form.tags ?? []).includes(t) ? 'var(--accent-dim)' : 'transparent', color: (form.tags ?? []).includes(t) ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ ...S.field, marginBottom: 16 }}>
              <label style={S.label}>Notes</label>
              <textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Any notes about this customer…"
                style={{ ...S.input, resize: 'vertical', minHeight: 72 }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submitForm} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 24px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create customer'}
              </button>
              <button onClick={() => setView(form.id ? 'detail' : 'list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '10px 16px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOYALTY SETTINGS ── */}
      {view === 'settings' && settings && (
        <LoyaltySettings
          settings={settings}
          restaurantId={restaurantId}
          onBack={() => setView('list')}
          onSave={async (s) => { await saveLoyaltySettings(restaurantId, s); setSettings(s); setView('list') }}
        />
      )}

      {/* ── ADJUST POINTS MODAL ── */}
      {adjModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }} onClick={() => setAdjModal(null)}>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 380, padding: '1.25rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Adjust points — {adjModal.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius)' }}>
              Current balance: <strong style={{ color: '#e67e22' }}>{(adjModal.loyalty_points ?? 0).toLocaleString()} pts</strong>
            </div>
            <div style={{ ...S.field, marginBottom: 12 }}>
              <label style={S.label}>Points to add (positive) or deduct (negative)</label>
              <input type="number" value={adjPoints} onChange={e => setAdjPoints(e.target.value)}
                style={S.input} placeholder="e.g. 100 or -50" autoFocus />
            </div>
            <div style={{ ...S.field, marginBottom: 16 }}>
              <label style={S.label}>Reason</label>
              <input value={adjReason} onChange={e => setAdjReason(e.target.value)}
                style={S.input} placeholder="e.g. Goodwill gesture, correction…" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAdjust} disabled={saving || !n(adjPoints)} style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: (!n(adjPoints) || saving) ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Apply adjustment'}
              </button>
              <button onClick={() => setAdjModal(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '10px 16px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LoyaltySettings({ settings: init, restaurantId, onBack, onSave }) {
  const [s, setS] = useState({ ...init })
  const [saving, setSaving] = useState(false)
  const set = (f, v) => setS(p => ({ ...p, [f]: v }))

  const SI = { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }
  const SL = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }

  const submit = async () => {
    setSaving(true)
    try { await onSave(s) } catch (e) { alert(e.message) }
    setSaving(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)' }}>Loyalty settings</h2>
        <button onClick={onBack} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
      </div>

      {[
        {
          title: 'Points earning',
          fields: [
            { label: 'Points earned per AED spent', field: 'points_per_aed', type: 'number', note: 'e.g. 1 = 1 point per AED' },
            { label: 'Minimum points to redeem',    field: 'min_redeem',     type: 'number', note: 'e.g. 100 minimum' },
            { label: 'AED value per point',          field: 'aed_per_point',  type: 'number', note: 'e.g. 0.10 = 100pts = AED 10' },
            { label: 'Points expiry (days)',          field: 'expiry_days',    type: 'number', note: 'Leave empty = no expiry' },
          ]
        },
        {
          title: 'Tier thresholds (lifetime spend in AED)',
          fields: [
            { label: '🥈 Silver from',   field: 'silver_threshold', type: 'number' },
            { label: '🥇 Gold from',     field: 'gold_threshold',   type: 'number' },
            { label: '💎 Platinum from', field: 'plat_threshold',   type: 'number' },
          ]
        },
        {
          title: 'Tier multipliers (points earned)',
          fields: [
            { label: '🥈 Silver multiplier',   field: 'silver_mult', type: 'number', note: 'e.g. 1.5 = 50% bonus' },
            { label: '🥇 Gold multiplier',     field: 'gold_mult',   type: 'number', note: 'e.g. 2.0 = double points' },
            { label: '💎 Platinum multiplier', field: 'plat_mult',   type: 'number', note: 'e.g. 3.0 = triple points' },
          ]
        },
      ].map(section => (
        <div key={section.title} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '0.5px solid var(--border)' }}>{section.title}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {section.fields.map(f => (
              <div key={f.field} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={SL}>{f.label}</label>
                <input type={f.type} value={s[f.field] ?? ''} onChange={e => set(f.field, f.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)} style={SI} placeholder={f.note} />
                {f.note && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.note}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
        <label style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>Loyalty programme enabled</label>
        <button onClick={() => set('enabled', !s.enabled)} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 14px', background: s.enabled ? 'rgba(39,174,96,0.1)' : 'var(--bg-input)', border: `0.5px solid ${s.enabled ? '#27ae60' : 'var(--border)'}`, borderRadius: 999, color: s.enabled ? '#27ae60' : 'var(--text-muted)', cursor: 'pointer' }}>
          {s.enabled ? '● Enabled' : '○ Disabled'}
        </button>
      </div>

      <button onClick={submit} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 28px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : 'Save loyalty settings'}
      </button>
    </div>
  )
}
