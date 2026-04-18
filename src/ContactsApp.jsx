import { useState, useEffect, useRef } from 'react'
import {
  loadContacts, searchContacts, saveContact, deleteContact,
  loadPartnerLedger, addLedgerEntry, getContactBalance,
  loadContactOrders, loadContactPurchases, migrateCustomersToContacts,
  loadLoyaltySettings, saveLoyaltySettings, adjustPoints, calcTier, calcPointsValue,
  loadPromotions, savePromotion,
} from './supabase.js'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toFixed(2)

const TIER_STYLE = {
  bronze:   { bg: '#fef5e7', color: '#b7770d', icon: '🥉' },
  silver:   { bg: '#f2f3f4', color: '#707b7c', icon: '🥈' },
  gold:     { bg: '#fef9e7', color: '#b7950b', icon: '🥇' },
  platinum: { bg: '#eaf4fb', color: '#1a5276', icon: '💎' },
}

const TYPE_STYLE = {
  customer: { bg: 'rgba(13,115,119,0.1)',   color: 'var(--accent)',  label: 'Customer' },
  supplier: { bg: 'rgba(41,128,185,0.1)',   color: '#2980b9',        label: 'Supplier' },
  both:     { bg: 'rgba(142,68,173,0.1)',   color: '#8e44ad',        label: 'Customer & Supplier' },
}

const LEDGER_TYPE_STYLE = {
  invoice:         { color: '#c0392b',  label: 'Invoice'         },
  bill:            { color: '#2980b9',  label: 'Bill'            },
  payment:         { color: '#27ae60',  label: 'Payment'         },
  refund:          { color: '#e67e22',  label: 'Refund'          },
  credit_note:     { color: '#8e44ad',  label: 'Credit Note'     },
  opening_balance: { color: '#7f8c8d',  label: 'Opening Balance' },
}

// ── PROMO TYPES ───────────────────────────────────────────────
const PROMO_TYPES = [
  { key: 'percent',    label: '% Off'      },
  { key: 'fixed',      label: 'Fixed AED'  },
  { key: 'bogo',       label: 'BOGO'       },
  { key: 'happy_hour', label: 'Happy Hour' },
]

export default function ContactsApp({ restaurantId, userId, session, initialSection = 'customers' }) {
  const [section,   setSection]   = useState(initialSection) // customers|suppliers|loyalty|promotions
  const [contacts,  setContacts]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [view,      setView]      = useState('list')       // list|detail|form
  const [selContact,setSelContact]= useState(null)
  const [ledger,    setLedger]    = useState([])
  const [orders,    setOrders]    = useState([])
  const [purchases, setPurchases] = useState([])
  const [search,    setSearch]    = useState('')
  const [typeFilter,setTypeFilter]= useState('all')
  const [saving,    setSaving]    = useState(false)
  const [migrated,  setMigrated]  = useState(false)

  // Form
  const BLANK_CONTACT = { name: '', company: '', phone: '', email: '', address: '', city: '', country: 'UAE', trn: '', notes: '', tags: [], type: 'customer', credit_limit: '', payment_terms: 30, currency: 'AED', opening_balance: '' }
  const [form, setForm] = useState(BLANK_CONTACT)

  // Ledger entry form
  const [ledgerForm, setLedgerForm] = useState({ date: new Date().toISOString().slice(0,10), type: 'invoice', reference: '', description: '', debit: '', credit: '' })
  const [showLedgerForm, setShowLedgerForm] = useState(false)

  // Loyalty
  const [loyaltySettings, setLoyaltySettings] = useState(null)
  const [adjModal, setAdjModal] = useState(null)
  const [adjPoints, setAdjPoints] = useState('')
  const [adjReason, setAdjReason] = useState('')

  // Promotions
  const [promotions, setPromotions] = useState([])
  const [promoForm,  setPromoForm]  = useState({ name:'', code:'', type:'percent', value:'', min_order_value:'', valid_from:'', valid_until:'', usage_limit:'', start_time:'', end_time:'', active: true })
  const [showPromoForm, setShowPromoForm] = useState(false)

  const isManager = session?.role === 'owner' || session?.role === 'manager'

  // ── Style objects (declared early to avoid TDZ) ──
  const SI = { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }
  const SL = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }
  const SF = { display: 'flex', flexDirection: 'column', gap: 5 }
  const SC = { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 12 }
  const ST = { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
  }, [restaurantId, section])

  async function reload() {
    setLoading(true)
    try {
      if (section === 'customers') {
        const d = await loadContacts(restaurantId, 'customer').catch(() => [])
        setContacts(d)
      } else if (section === 'suppliers') {
        const d = await loadContacts(restaurantId, 'supplier').catch(() => [])
        setContacts(d)
      } else if (section === 'loyalty') {
        const [custs, sett] = await Promise.all([
          loadContacts(restaurantId, 'customer').catch(() => []),
          loadLoyaltySettings(restaurantId).catch(() => ({}))
        ])
        setContacts(custs); setLoyaltySettings(sett)
      } else if (section === 'promotions') {
        const d = await loadPromotions(restaurantId).catch(() => [])
        setPromotions(d)
      }
    } catch (e) {
      console.error('ContactsApp reload error:', e)
    } finally {
      setLoading(false)
    }
  }

  const openDetail = async (c) => {
    setSelContact(c); setView('detail')
    const [l, o, p] = await Promise.all([
      loadPartnerLedger(c.id),
      loadContactOrders(c.id),
      loadContactPurchases(c.id),
    ])
    setLedger(l); setOrders(o); setPurchases(p)
  }

  const openForm = (c = null) => {
    setForm(c ? { ...c } : { ...BLANK_CONTACT, type: section === 'suppliers' ? 'supplier' : 'customer' })
    setView('form')
  }

  const submitForm = async () => {
    if (!form.name?.trim()) { alert('Name required'); return }
    setSaving(true)
    try {
      const tier = calcTier(n(form.lifetime_spend), loyaltySettings ?? {})
      const saved = await saveContact(restaurantId, { ...form, tier })
      // Add opening balance to ledger if set
      if (!form.id && n(form.opening_balance) !== 0) {
        await addLedgerEntry(restaurantId, saved.id, {
          date: new Date().toISOString().slice(0,10),
          type: 'opening_balance',
          description: 'Opening balance',
          debit:  n(form.opening_balance) > 0 ? n(form.opening_balance) : 0,
          credit: n(form.opening_balance) < 0 ? Math.abs(n(form.opening_balance)) : 0,
          source_type: 'manual', created_by: userId,
        })
      }
      await reload(); setView('list')
    } catch (e) {
      console.error('saveContact error full:', JSON.stringify(e), e.message, e.code, e.details, e.hint)
      setFormError(e.message + (e.details ? ' | ' + e.details : '') + (e.hint ? ' | Hint: ' + e.hint : ''))
    }
    setSaving(false)
  }

  const addLedger = async () => {
    if (!ledgerForm.reference && !ledgerForm.description) { alert('Reference or description required'); return }
    setSaving(true)
    try {
      await addLedgerEntry(restaurantId, selContact.id, { ...ledgerForm, source_type: 'manual', created_by: userId })
      const updated = await loadPartnerLedger(selContact.id)
      setLedger(updated); setShowLedgerForm(false)
      setLedgerForm({ date: new Date().toISOString().slice(0,10), type: 'invoice', reference: '', description: '', debit: '', credit: '' })
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleAdjust = async () => {
    if (!n(adjPoints)) return
    setSaving(true)
    try {
      await adjustPoints(restaurantId, adjModal.id, parseInt(adjPoints), adjReason || 'Manual adjustment', userId)
      setAdjModal(null); setAdjPoints(''); setAdjReason('')
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const submitPromo = async () => {
    if (!promoForm.name || !n(promoForm.value)) { alert('Name and value required'); return }
    setSaving(true)
    try {
      await savePromotion(restaurantId, {
        ...promoForm, value: n(promoForm.value),
        min_order_value: n(promoForm.min_order_value) || 0,
        usage_limit: promoForm.usage_limit ? parseInt(promoForm.usage_limit) : null,
        code: promoForm.code?.toUpperCase() || null,
        valid_from: promoForm.valid_from || null, valid_until: promoForm.valid_until || null,
        start_time: promoForm.start_time || null, end_time: promoForm.end_time || null,
      })
      await reload(); setShowPromoForm(false)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleMigrate = async () => {
    setSaving(true)
    try {
      const count = await migrateCustomersToContacts(restaurantId)
      await reload(); setMigrated(true)
      alert(`Migrated ${count} customers to Contacts.`)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Filtered list ──────────────────────────────────────────
  const filtered = contacts.filter(c => {
    const ms = !search || [c.name, c.phone, c.email, c.company].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    const mt = typeFilter === 'all' || c.type === typeFilter || c.tier === typeFilter
    return ms && mt
  })

  const balance = (c) => {
    // Positive = they owe us, Negative = we owe them
    return n(c.opening_balance) // simplified — real balance from ledger
  }

  // ── Styles ─────────────────────────────────────────────────

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ══ CUSTOMERS / SUPPLIERS LIST ══════════════════════ */}
      {(section === 'customers' || section === 'suppliers') && view === 'list' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>
                {section === 'customers' ? 'Customers' : 'Suppliers'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {section === 'customers' ? 'Customer CRM — linked to POS orders, invoices, and loyalty.' : 'Supplier directory — linked to purchase orders and bills.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {section === 'customers' && !migrated && (
                <button onClick={handleMigrate} disabled={saving}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '8px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  ↑ Import existing
                </button>
              )}
              <button onClick={() => openForm()}
                style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>
                + New {section === 'customers' ? 'customer' : 'supplier'}
              </button>
            </div>
          </div>

          {/* KPIs */}
          {(() => {
            const kpis = section === 'customers' ? [
              { label: 'Total customers',   val: contacts.length },
              { label: 'Total spend',       val: fmt(contacts.reduce((s,c) => s + n(c.lifetime_spend), 0)) },
              { label: 'Avg spend',         val: contacts.length ? fmt(contacts.reduce((s,c) => s + n(c.lifetime_spend), 0) / contacts.length) : 'AED 0.00' },
              { label: 'Points issued',     val: contacts.reduce((s,c) => s + (c.loyalty_points ?? 0), 0).toLocaleString() },
            ] : [
              { label: 'Total suppliers',   val: contacts.length },
              { label: 'Active suppliers',  val: contacts.filter(c => c.active).length },
            ]
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: '1rem' }}>
                {kpis.map(k => (
                  <div key={k.label} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--accent)', marginBottom: 3 }}>{k.val}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email, company…"
              style={{ ...SI, width: 260 }} />
            {section === 'customers' && (
              <div style={{ display: 'flex', gap: 4 }}>
                {['all','bronze','silver','gold','platinum'].map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '5px 10px', borderRadius: 999, border: '0.5px solid var(--border)', background: typeFilter === t ? 'var(--accent-dim)' : 'transparent', color: typeFilter === t ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}>
                    {t === 'all' ? 'All tiers' : (TIER_STYLE[t]?.icon + ' ' + t)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {(section === 'customers'
                  ? ['Contact', 'Phone', 'Email', 'Tier', 'Points', 'Lifetime spend', 'Last visit', 'Outstanding', '']
                  : ['Contact', 'Company', 'Phone', 'Email', 'TRN', 'Payment terms', 'Credit limit', 'Outstanding', '']
                ).map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(c => {
                  const ts = TIER_STYLE[c.tier] ?? TIER_STYLE.bronze
                  const outstanding = n(c.opening_balance)
                  return (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: ts.bg, color: ts.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                            {c.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{c.name}</div>
                            {c.company && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.company}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>{c.phone ?? '—'}</td>
                      {section === 'customers' ? <>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>{c.email ?? '—'}</td>
                        <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                          <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: ts.bg, color: ts.color }}>{ts.icon} {c.tier}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#e67e22', borderBottom: '0.5px solid var(--border)' }}>{(c.loyalty_points ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 500, borderBottom: '0.5px solid var(--border)' }}>{fmt(c.lifetime_spend)}</td>
                        <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('en-AE') : '—'}</td>
                      </> : <>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>{c.company ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>{c.email ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{c.trn ?? '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>{c.payment_terms ? `Net ${c.payment_terms}` : '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{c.credit_limit ? fmt(c.credit_limit) : '—'}</td>
                      </>}
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)', fontWeight: 500, color: outstanding > 0 ? '#c0392b' : outstanding < 0 ? '#27ae60' : 'var(--text-muted)' }}>
                        {outstanding !== 0 ? fmt(Math.abs(outstanding)) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <button onClick={e => { e.stopPropagation(); openForm(c) }}
                          style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Edit</button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 13 }}>
                    {search ? 'No results match your search' : `No ${section} yet`}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ CONTACT DETAIL + PARTNER LEDGER ═════════════════ */}
      {view === 'detail' && selContact && (
        <div>
          {/* Back + actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 2 }}>{selContact.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selContact.company && <span>{selContact.company} · </span>}
                  {selContact.phone && <span>{selContact.phone} · </span>}
                  {selContact.email && <span>{selContact.email}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selContact.type !== 'supplier' && (
                <button onClick={() => setAdjModal(selContact)}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>⊕ Adjust points</button>
              )}
              <button onClick={() => setShowLedgerForm(p => !p)}
                style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>+ Ledger entry</button>
              <button onClick={() => openForm(selContact)}
                style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>Edit</button>
            </div>
          </div>

          {/* Smart buttons — linked records */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
            {orders.length > 0 && (
              <div style={{ fontSize: 12, padding: '5px 12px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 999, color: 'var(--accent)', fontWeight: 500 }}>
                🍽 {orders.length} POS order{orders.length > 1 ? 's' : ''}
              </div>
            )}
            {purchases.length > 0 && (
              <div style={{ fontSize: 12, padding: '5px 12px', background: 'rgba(41,128,185,0.1)', border: '0.5px solid rgba(41,128,185,0.3)', borderRadius: 999, color: '#2980b9', fontWeight: 500 }}>
                🛒 {purchases.length} purchase order{purchases.length > 1 ? 's' : ''}
              </div>
            )}
            {ledger.length > 0 && (
              <div style={{ fontSize: 12, padding: '5px 12px', background: 'rgba(142,68,173,0.1)', border: '0.5px solid rgba(142,68,173,0.3)', borderRadius: 999, color: '#8e44ad', fontWeight: 500 }}>
                📒 {ledger.length} ledger entr{ledger.length > 1 ? 'ies' : 'y'}
              </div>
            )}
            {selContact.loyalty_points > 0 && (
              <div style={{ fontSize: 12, padding: '5px 12px', background: 'rgba(230,126,34,0.1)', border: '0.5px solid rgba(230,126,34,0.3)', borderRadius: 999, color: '#e67e22', fontWeight: 500 }}>
                🏆 {selContact.loyalty_points.toLocaleString()} pts
              </div>
            )}
            {(() => {
              const bal = ledger[0] ? parseFloat(ledger[0].balance) : 0
              if (bal === 0) return null
              return (
                <div style={{ fontSize: 12, padding: '5px 12px', background: bal > 0 ? 'rgba(192,57,43,0.08)' : 'rgba(39,174,96,0.08)', border: `0.5px solid ${bal > 0 ? 'rgba(192,57,43,0.3)' : 'rgba(39,174,96,0.3)'}`, borderRadius: 999, color: bal > 0 ? '#c0392b' : '#27ae60', fontWeight: 500 }}>
                  {bal > 0 ? '⚠' : '✓'} Balance: AED {Math.abs(bal).toFixed(2)} {bal > 0 ? 'owed' : 'credit'}
                </div>
              )
            })()}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {/* Balance card */}
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={ST}>Account balance</div>
              {(() => {
                const lastEntry  = ledger[0]
                const bal        = n(lastEntry?.balance)
                const isOwed     = bal > 0
                return (
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: isOwed ? '#c0392b' : bal < 0 ? '#27ae60' : 'var(--text-primary)', marginBottom: 6 }}>{fmt(Math.abs(bal))}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isOwed ? 'Outstanding (they owe us)' : bal < 0 ? 'Credit (we owe them)' : 'Settled'}</div>
                    {selContact.credit_limit > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Credit limit: {fmt(selContact.credit_limit)}</div>
                    )}
                    {selContact.payment_terms > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Payment terms: Net {selContact.payment_terms}</div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* Profile */}
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
              <div style={ST}>Profile</div>
              {[
                { label: 'Type',          val: TYPE_STYLE[selContact.type]?.label },
                { label: 'Phone',         val: selContact.phone         },
                { label: 'Email',         val: selContact.email         },
                { label: 'TRN',           val: selContact.trn           },
                { label: 'Address',       val: selContact.address       },
                { label: 'Currency',      val: selContact.currency      },
                { label: 'Last visit',    val: selContact.last_visit_at ? new Date(selContact.last_visit_at).toLocaleDateString('en-AE') : null },
              ].filter(r => r.val).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Loyalty card (customers only) */}
          {selContact.type !== 'supplier' && (
            <div style={{ background: TIER_STYLE[selContact.tier]?.bg ?? '#fff', border: `1.5px solid ${TIER_STYLE[selContact.tier]?.color ?? 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: TIER_STYLE[selContact.tier]?.color }}>{TIER_STYLE[selContact.tier]?.icon} {(selContact.tier ?? 'bronze').toUpperCase()} MEMBER</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Points',         val: (selContact.loyalty_points ?? 0).toLocaleString() },
                  { label: 'Lifetime spend', val: fmt(selContact.lifetime_spend) },
                  { label: 'Visits',         val: selContact.visit_count ?? 0 },
                  { label: 'Points value',   val: loyaltySettings ? fmt(calcPointsValue(selContact.loyalty_points ?? 0, loyaltySettings)) : '—' },
                ].map(k => (
                  <div key={k.label}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: TIER_STYLE[selContact.tier]?.color }}>{k.val}</div>
                    <div style={{ fontSize: 10, color: TIER_STYLE[selContact.tier]?.color, opacity: 0.7 }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ledger entry form */}
          {showLedgerForm && (
            <div style={{ ...SC, borderTop: '2px solid var(--accent)', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>New ledger entry</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                <div style={SF}><label style={SL}>Date</label><input type="date" value={ledgerForm.date} onChange={e => setLedgerForm(p => ({ ...p, date: e.target.value }))} style={SI} /></div>
                <div style={SF}>
                  <label style={SL}>Type</label>
                  <select value={ledgerForm.type} onChange={e => setLedgerForm(p => ({ ...p, type: e.target.value }))} style={SI}>
                    {Object.entries(LEDGER_TYPE_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div style={SF}><label style={SL}>Reference</label><input value={ledgerForm.reference} onChange={e => setLedgerForm(p => ({ ...p, reference: e.target.value }))} style={SI} placeholder="Invoice/PO number" /></div>
                <div style={SF}><label style={SL}>Description</label><input value={ledgerForm.description} onChange={e => setLedgerForm(p => ({ ...p, description: e.target.value }))} style={SI} placeholder="Description" /></div>
                <div style={SF}><label style={SL}>Debit (AED) — amount owed</label><input type="number" min="0" value={ledgerForm.debit} onChange={e => setLedgerForm(p => ({ ...p, debit: e.target.value }))} style={SI} placeholder="0.00" /></div>
                <div style={SF}><label style={SL}>Credit (AED) — payment received</label><input type="number" min="0" value={ledgerForm.credit} onChange={e => setLedgerForm(p => ({ ...p, credit: e.target.value }))} style={SI} placeholder="0.00" /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addLedger} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>{saving ? 'Saving…' : 'Add entry'}</button>
                <button onClick={() => setShowLedgerForm(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '9px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Partner Ledger table */}
          <div style={{ ...SC, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={ST}>Partner Ledger — Customer Statement</span>
              <button onClick={() => {
                const rows = ledger.map(l => `${l.date}\t${LEDGER_TYPE_STYLE[l.type]?.label ?? l.type}\t${l.reference ?? ''}\t${l.description ?? ''}\t${n(l.debit).toFixed(2)}\t${n(l.credit).toFixed(2)}\t${n(l.balance).toFixed(2)}`).join('\n')
                const blob = new Blob([`Date\tType\tRef\tDesc\tDebit\tCredit\tBalance\n` + rows], { type: 'text/plain' })
                const url  = URL.createObjectURL(blob)
                const a    = document.createElement('a'); a.href = url; a.download = `${selContact.name}-statement.tsv`; a.click()
              }} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 12px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer' }}>
                ↓ Export
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {['Date','Type','Reference','Description','Debit','Credit','Balance'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {ledger.map((l, i) => {
                  const ls = LEDGER_TYPE_STYLE[l.type] ?? { color: 'var(--text-muted)', label: l.type }
                  return (
                    <tr key={l.id ?? i}>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l.date}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 4, background: ls.color + '18', color: ls.color }}>{ls.label}</span>
                      </td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 11 }}>{l.reference ?? '—'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description ?? '—'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', color: n(l.debit) > 0 ? '#c0392b' : 'var(--text-muted)', fontWeight: n(l.debit) > 0 ? 500 : 400 }}>{n(l.debit) > 0 ? fmt(l.debit) : '—'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', color: n(l.credit) > 0 ? '#27ae60' : 'var(--text-muted)', fontWeight: n(l.credit) > 0 ? 500 : 400 }}>{n(l.credit) > 0 ? fmt(l.credit) : '—'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)', fontWeight: 600, color: n(l.balance) > 0 ? '#c0392b' : n(l.balance) < 0 ? '#27ae60' : 'var(--text-muted)' }}>{fmt(l.balance)}</td>
                    </tr>
                  )
                })}
                {ledger.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>No ledger entries yet</td></tr>}
              </tbody>
            </table>
          </div>

          {/* POS Orders */}
          {orders.length > 0 && (
            <div style={{ ...SC, padding: 0, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}><span style={ST}>POS Orders</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  {['Invoice','Date','Total','Payment','Pts earned'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {orders.map((o, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>{o.invoice_number ?? `#${o.order_number}`}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>{o.closed_at ? new Date(o.closed_at).toLocaleDateString('en-AE') : '—'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{fmt(o.total)}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{o.payment_method}</td>
                      <td style={{ padding: '8px 12px', color: '#e67e22', fontWeight: 500, borderBottom: '0.5px solid var(--border)' }}>{o.loyalty_earned > 0 ? '+' + o.loyalty_earned : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Purchase orders (suppliers) */}
          {purchases.length > 0 && (
            <div style={{ ...SC, padding: 0, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}><span style={ST}>Purchase Orders</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  {['PO Number','Date','Total','Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {purchases.map((p, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>{p.po_number}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>{new Date(p.created_at).toLocaleDateString('en-AE')}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{fmt(p.total)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-muted)' }}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ CONTACT FORM ════════════════════════════════════ */}
      {view === 'form' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)' }}>{form.id ? 'Edit contact' : `New ${section === 'suppliers' ? 'supplier' : 'customer'}`}</h2>
            <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
          </div>
          <div style={{ ...SC, borderTop: '2px solid var(--accent)' }}>
            {/* Type selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...SL, display: 'block', marginBottom: 8 }}>Contact type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ k: 'customer', l: '👤 Customer' }, { k: 'supplier', l: '🏭 Supplier' }, { k: 'both', l: '🔄 Both' }].map(t => (
                  <button key={t.k} onClick={() => setForm(p => ({ ...p, type: t.k }))}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 14px', borderRadius: 'var(--radius)', border: `1px solid ${form.type === t.k ? 'var(--accent)' : 'var(--border)'}`, background: form.type === t.k ? 'var(--accent-dim)' : 'transparent', color: form.type === t.k ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}>
                    {t.l}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
              {[
                { label: 'Full name *', field: 'name',     ph: 'e.g. Ahmed Al Mansouri' },
                { label: 'Company',     field: 'company',  ph: 'Company name (optional)' },
                { label: 'Phone',       field: 'phone',    ph: '+971 50 XXX XXXX' },
                { label: 'Email',       field: 'email',    ph: 'email@example.com' },
                { label: 'TRN (UAE)',   field: 'trn',      ph: 'Tax registration number' },
                { label: 'Website',     field: 'website',  ph: 'https://…' },
                { label: 'Address',     field: 'address',  ph: 'Street address' },
                { label: 'City',        field: 'city',     ph: 'Dubai' },
                { label: 'Country',     field: 'country',  ph: 'UAE' },
              ].map(({ label, field, ph }) => (
                <div key={field} style={SF}>
                  <label style={SL}>{label}</label>
                  <input value={form[field] ?? ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} style={SI} placeholder={ph} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
              <div style={SF}><label style={SL}>Credit limit (AED)</label><input type="number" min="0" value={form.credit_limit ?? ''} onChange={e => setForm(p => ({ ...p, credit_limit: e.target.value }))} style={SI} placeholder="0 = no limit" /></div>
              <div style={SF}><label style={SL}>Payment terms (days)</label><input type="number" min="0" value={form.payment_terms ?? 30} onChange={e => setForm(p => ({ ...p, payment_terms: parseInt(e.target.value) || 0 }))} style={SI} placeholder="e.g. 30" /></div>
              {!form.id && <div style={SF}><label style={SL}>Opening balance (AED)</label><input type="number" value={form.opening_balance ?? ''} onChange={e => setForm(p => ({ ...p, opening_balance: e.target.value }))} style={SI} placeholder="Positive = they owe us" /></div>}
            </div>
            <div style={{ ...SF, marginBottom: 16 }}>
              <label style={SL}>Notes</label>
              <textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                style={{ ...SI, resize: 'vertical', minHeight: 72 }} placeholder="Any notes…" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={submitForm} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 24px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create contact'}
              </button>
              <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '10px 16px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOYALTY SETTINGS ════════════════════════════════ */}
      {section === 'loyalty' && view === 'list' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Loyalty Programme</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Points, tiers, and redemption settings.</p>
            </div>
          </div>

          {loyaltySettings && (
            <LoyaltySettingsPanel settings={loyaltySettings} onSave={async s => { await saveLoyaltySettings(restaurantId, s); setLoyaltySettings(s) }} />
          )}

          {/* Tier overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '1.25rem 0' }}>
            {['bronze','silver','gold','platinum'].map(tier => {
              const ts    = TIER_STYLE[tier]
              const count = contacts.filter(c => c.tier === tier).length
              return (
                <div key={tier} style={{ background: ts.bg, border: `1.5px solid ${ts.color}40`, borderRadius: 'var(--radius-lg)', padding: '1.25rem', cursor: 'pointer' }} onClick={() => setTypeFilter(tier)}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{ts.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: ts.color, marginBottom: 2 }}>{count} members</div>
                  <div style={{ fontSize: 12, color: ts.color, opacity: 0.8, textTransform: 'capitalize' }}>{tier}</div>
                </div>
              )
            })}
          </div>

          {/* Customer list */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {['Customer','Tier','Points','Points value','Lifetime spend','Adjust'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(typeFilter !== 'all' ? contacts.filter(c => c.tier === typeFilter) : contacts).map(c => {
                  const ts  = TIER_STYLE[c.tier] ?? TIER_STYLE.bronze
                  const val = loyaltySettings ? fmt(calcPointsValue(c.loyalty_points ?? 0, loyaltySettings)) : '—'
                  return (
                    <tr key={c.id}>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)', fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: ts.bg, color: ts.color, fontWeight: 500 }}>{ts.icon} {c.tier}</span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)', fontWeight: 600, color: '#e67e22' }}>{(c.loyalty_points ?? 0).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-secondary)' }}>{val}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)', color: 'var(--accent)', fontWeight: 500 }}>{fmt(c.lifetime_spend)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <button onClick={() => setAdjModal(c)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>⊕ Adjust</button>
                      </td>
                    </tr>
                  )
                })}
                {contacts.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>No customers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ PROMOTIONS ══════════════════════════════════════ */}
      {section === 'promotions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Promotions</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Promo codes, happy hours, and automatic discounts.</p>
            </div>
            <button onClick={() => { setPromoForm({ name:'', code:'', type:'percent', value:'', min_order_value:'', valid_from:'', valid_until:'', usage_limit:'', start_time:'', end_time:'', active:true }); setShowPromoForm(true) }}
              style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>
              + New promotion
            </button>
          </div>

          {showPromoForm && (
            <div style={{ ...SC, borderTop: '2px solid var(--accent)', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                {PROMO_TYPES.map(t => (
                  <button key={t.key} onClick={() => setPromoForm(p => ({ ...p, type: t.key }))}
                    style={{ padding: '10px', background: promoForm.type === t.key ? 'var(--accent-dim)' : 'var(--bg-input)', border: `1px solid ${promoForm.type === t.key ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: promoForm.type === t.key ? 'var(--accent)' : 'var(--text-primary)' }}>{t.label}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                {[
                  { label: 'Name *', field: 'name', ph: 'e.g. Weekend 20% Off' },
                  { label: 'Promo code', field: 'code', ph: 'e.g. SAVE20' },
                  { label: promoForm.type === 'percent' ? 'Discount %' : 'Discount AED', field: 'value', type: 'number', ph: '20' },
                  { label: 'Min order (AED)', field: 'min_order_value', type: 'number', ph: '0' },
                  { label: 'Valid from', field: 'valid_from', type: 'date' },
                  { label: 'Valid until', field: 'valid_until', type: 'date' },
                  { label: 'Usage limit', field: 'usage_limit', type: 'number', ph: 'Unlimited' },
                  ...(promoForm.type === 'happy_hour' ? [{ label: 'Start time', field: 'start_time', type: 'time' }, { label: 'End time', field: 'end_time', type: 'time' }] : []),
                ].map(f => (
                  <div key={f.field} style={SF}>
                    <label style={SL}>{f.label}</label>
                    <input type={f.type ?? 'text'} value={promoForm[f.field] ?? ''} onChange={e => setPromoForm(p => ({ ...p, [f.field]: e.target.value }))} style={SI} placeholder={f.ph} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitPromo} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>Save promotion</button>
                <button onClick={() => setShowPromoForm(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '9px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {['Name','Code','Type','Value','Min order','Valid until','Uses','Status',''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {promotions.map(p => (
                  <tr key={p.id}>
                    <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{p.name}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>{p.code ?? '—'}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)' }}>{p.type}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#27ae60', borderBottom: '0.5px solid var(--border)' }}>{p.type === 'percent' ? p.value + '%' : fmt(p.value)}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{n(p.min_order_value) > 0 ? fmt(p.min_order_value) : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '0.5px solid var(--border)' }}>{p.valid_until ? new Date(p.valid_until).toLocaleDateString('en-AE') : '—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{p.usage_count ?? 0}{p.usage_limit ? ' / ' + p.usage_limit : ''}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: p.active ? 'rgba(39,174,96,0.1)' : 'var(--bg-input)', color: p.active ? '#27ae60' : 'var(--text-muted)' }}>{p.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                      <button onClick={async () => { await savePromotion(restaurantId, { ...p, active: !p.active }); await reload() }}
                        style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {p.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {promotions.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>No promotions yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ ADJUST POINTS MODAL ═════════════════════════════ */}
      {adjModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }} onClick={() => setAdjModal(null)}>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 380, padding: '1.25rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Adjust points — {adjModal.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius)' }}>
              Current balance: <strong style={{ color: '#e67e22' }}>{(adjModal.loyalty_points ?? 0).toLocaleString()} pts</strong>
            </div>
            <div style={{ ...SF, marginBottom: 12 }}>
              <label style={SL}>Points to add (positive) or deduct (negative)</label>
              <input type="number" value={adjPoints} onChange={e => setAdjPoints(e.target.value)} style={SI} placeholder="e.g. 100 or -50" autoFocus />
            </div>
            <div style={{ ...SF, marginBottom: 16 }}>
              <label style={SL}>Reason</label>
              <input value={adjReason} onChange={e => setAdjReason(e.target.value)} style={SI} placeholder="e.g. Goodwill gesture, correction…" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleAdjust} disabled={saving || !n(adjPoints)} style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: (!n(adjPoints) || saving) ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Apply'}
              </button>
              <button onClick={() => setAdjModal(null)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '10px 16px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Loyalty Settings sub-component ───────────────────────────
function LoyaltySettingsPanel({ settings: init, onSave }) {
  const [s, setS] = useState({ ...init })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const set = (f, v) => setS(p => ({ ...p, [f]: v }))

  return (
    <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Loyalty configuration</span>
        <button onClick={() => set('enabled', !s.enabled)}
          style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 14px', background: s.enabled ? 'rgba(39,174,96,0.1)' : 'var(--bg-input)', border: `0.5px solid ${s.enabled ? '#27ae60' : 'var(--border)'}`, borderRadius: 999, color: s.enabled ? '#27ae60' : 'var(--text-muted)', cursor: 'pointer' }}>
          {s.enabled ? '● Enabled' : '○ Disabled'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        {[
          { label: 'Points per AED spent', field: 'points_per_aed', note: '1 = 1 point per AED' },
          { label: 'AED value per point',  field: 'aed_per_point',  note: '0.10 = 100pts = AED 10' },
          { label: 'Minimum to redeem',    field: 'min_redeem',     note: 'Points minimum' },
          { label: 'Expiry (days)',         field: 'expiry_days',    note: 'Empty = no expiry' },
          { label: '🥈 Silver from (AED)', field: 'silver_threshold' },
          { label: '🥇 Gold from (AED)',   field: 'gold_threshold'  },
          { label: '💎 Platinum from (AED)',field: 'plat_threshold' },
          { label: '🥈 Silver multiplier', field: 'silver_mult',    note: '1.5 = 50% bonus' },
          { label: '🥇 Gold multiplier',   field: 'gold_mult',      note: '2.0 = double pts' },
          { label: '💎 Platinum multiplier',field: 'plat_mult',     note: '3.0 = triple pts' },
        ].map(f => (
          <div key={f.field} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={SL}>{f.label}</label>
            <input type="number" value={s[f.field] ?? ''} onChange={e => set(f.field, parseFloat(e.target.value) || '')} style={SI} placeholder={f.note} />
          </div>
        ))}
      </div>
      <button onClick={async () => { setSaving(true); try { await onSave(s); setSaved(true); setTimeout(() => setSaved(false), 2000) } catch (e) { alert(e.message) } setSaving(false) }}
        style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save loyalty settings'}
      </button>
    </div>
  )
}
