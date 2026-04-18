import { useState, useEffect } from 'react'
import { loadPromotions, savePromotion } from './supabase.js'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toFixed(2)

const PROMO_TYPES = [
  { key: 'percent',    label: '% Off',       desc: 'Percentage discount on order' },
  { key: 'fixed',      label: 'Fixed AED',   desc: 'Fixed amount off order' },
  { key: 'bogo',       label: 'BOGO',        desc: 'Buy one get one free' },
  { key: 'happy_hour', label: 'Happy Hour',  desc: 'Discount during specific hours' },
]

export default function PromotionsManager({ restaurantId, userId }) {
  const [promos,   setPromos]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState({
    name: '', code: '', type: 'percent', value: '',
    min_order_value: '', applies_to: 'order',
    valid_from: '', valid_until: '', active: true,
    start_time: '', end_time: '', usage_limit: '',
  })

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
  }, [restaurantId])

  async function reload() {
    setLoading(true)
    try { setPromos(await loadPromotions(restaurantId)) }
    catch (e) { console.error(e) }
    setLoading(false)
  }

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const submit = async () => {
    if (!form.name || !n(form.value)) { alert('Name and value required'); return }
    setSaving(true)
    try {
      await savePromotion(restaurantId, {
        ...form,
        value: n(form.value),
        min_order_value: n(form.min_order_value) || 0,
        usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
        code: form.code?.toUpperCase() || null,
        valid_from:  form.valid_from  || null,
        valid_until: form.valid_until || null,
        start_time:  form.start_time  || null,
        end_time:    form.end_time    || null,
      })
      setShowForm(false)
      resetForm()
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const resetForm = () => setForm({
    name: '', code: '', type: 'percent', value: '',
    min_order_value: '', applies_to: 'order',
    valid_from: '', valid_until: '', active: true,
    start_time: '', end_time: '', usage_limit: '',
  })

  const toggleActive = async (promo) => {
    await savePromotion(restaurantId, { ...promo, active: !promo.active })
    await reload()
  }

  const S = {
    wrap:    { padding: 0 },
    topRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 },
    title:   { fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 },
    sub:     { fontSize: 13, color: 'var(--text-muted)' },
    newBtn:  { fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' },
    card:    { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' },
    grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
    field:   { display: 'flex', flexDirection: 'column', gap: 5 },
    label:   { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 },
    input:   { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' },
    actions: { display: 'flex', gap: 8 },
    saveBtn: { fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' },
    cancelBtn:{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '9px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' },
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  return (
    <div style={S.wrap}>
      <div style={S.topRow}>
        <div>
          <h2 style={S.title}>Promotions & Discounts</h2>
          <p style={S.sub}>Create promo codes, happy hour discounts, and automatic promotions.</p>
        </div>
        <button style={S.newBtn} onClick={() => { setShowForm(true); resetForm() }}>+ New promotion</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, borderTop: '2px solid var(--accent)' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            New promotion
          </div>

          {/* Type selector */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {PROMO_TYPES.map(t => (
              <button key={t.key} onClick={() => set('type', t.key)}
                style={{ padding: '10px 8px', background: form.type === t.key ? 'var(--accent-dim)' : 'var(--bg-input)', border: `1px solid ${form.type === t.key ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: form.type === t.key ? 'var(--accent)' : 'var(--text-primary)' }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          <div style={S.grid}>
            <div style={S.field}>
              <label style={S.label}>Promotion name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} style={S.input} placeholder="e.g. Weekend 20% Off" />
            </div>
            <div style={S.field}>
              <label style={S.label}>Promo code (optional)</label>
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} style={{ ...S.input, fontFamily: 'var(--font-mono)' }} placeholder="e.g. SAVE20" />
            </div>
            <div style={S.field}>
              <label style={S.label}>{form.type === 'percent' ? 'Discount %' : 'Discount (AED)'} *</label>
              <input type="number" min="0" value={form.value} onChange={e => set('value', e.target.value)} style={S.input} placeholder={form.type === 'percent' ? '20' : '10.00'} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Min. order value (AED)</label>
              <input type="number" min="0" value={form.min_order_value} onChange={e => set('min_order_value', e.target.value)} style={S.input} placeholder="0 = no minimum" />
            </div>
            <div style={S.field}>
              <label style={S.label}>Valid from</label>
              <input type="date" value={form.valid_from} onChange={e => set('valid_from', e.target.value)} style={S.input} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Valid until</label>
              <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} style={S.input} />
            </div>
            {form.type === 'happy_hour' && (
              <>
                <div style={S.field}>
                  <label style={S.label}>Start time</label>
                  <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={S.input} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>End time</label>
                  <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} style={S.input} />
                </div>
              </>
            )}
            <div style={S.field}>
              <label style={S.label}>Usage limit</label>
              <input type="number" min="0" value={form.usage_limit} onChange={e => set('usage_limit', e.target.value)} style={S.input} placeholder="Leave empty = unlimited" />
            </div>
          </div>

          <div style={S.actions}>
            <button style={S.saveBtn} onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save promotion'}</button>
            <button style={S.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Promotions list */}
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Name', 'Code', 'Type', 'Value', 'Min order', 'Valid until', 'Uses', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {promos.map(p => (
              <tr key={p.id}>
                <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{p.name}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '0.5px solid var(--border)' }}>{p.code ?? '—'}</td>
                <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)' }}>{p.type}</span>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#27ae60', borderBottom: '0.5px solid var(--border)' }}>
                  {p.type === 'percent' ? p.value + '%' : fmt(p.value)}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{n(p.min_order_value) > 0 ? fmt(p.min_order_value) : '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '0.5px solid var(--border)' }}>{p.valid_until ? new Date(p.valid_until).toLocaleDateString('en-AE') : '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{p.usage_count ?? 0}{p.usage_limit ? ' / ' + p.usage_limit : ''}</td>
                <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: p.active ? 'rgba(39,174,96,0.1)' : 'var(--bg-input)', color: p.active ? '#27ae60' : 'var(--text-muted)' }}>
                    {p.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                  <button onClick={() => toggleActive(p)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {p.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {promos.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>
                No promotions yet — create your first one above
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
