import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import styles from './DeliveryOrders.module.css'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtT = d => new Date(d).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })
const fmtD = d => new Date(d).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })

const PLATFORMS = [
  { key: 'talabat',   label: 'Talabat',   color: '#FF6B00', bg: 'rgba(255,107,0,0.1)' },
  { key: 'deliveroo', label: 'Deliveroo', color: '#00CCBC', bg: 'rgba(0,204,188,0.1)' },
  { key: 'noon',      label: 'Noon Food', color: '#FEEE00', bg: 'rgba(254,238,0,0.15)', textColor: '#7a6e00' },
  { key: 'careem',    label: 'Careem',    color: '#5FCE39', bg: 'rgba(95,206,57,0.1)' },
  { key: 'manual',    label: 'Direct',    color: 'var(--accent)', bg: 'var(--accent-dim)' },
]

const STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled']

const STATUS_COLORS = {
  pending:          { color: '#e67e22', bg: 'rgba(230,126,34,0.1)' },
  accepted:         { color: '#3498db', bg: 'rgba(52,152,219,0.1)' },
  preparing:        { color: '#9b59b6', bg: 'rgba(155,89,182,0.1)' },
  ready:            { color: '#27ae60', bg: 'rgba(39,174,96,0.1)'  },
  out_for_delivery: { color: 'var(--accent)', bg: 'var(--accent-dim)' },
  delivered:        { color: '#5db88a', bg: 'rgba(93,184,138,0.1)' },
  cancelled:        { color: '#d47060', bg: 'rgba(212,112,96,0.1)' },
}

const STATUS_LABELS = {
  pending: 'Pending', accepted: 'Accepted', preparing: 'Preparing',
  ready: 'Ready', out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered', cancelled: 'Cancelled',
}

export default function DeliveryOrders({ restaurantId, userId }) {
  const [orders,    setOrders]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('active') // active | all | platform
  const [platform,  setPlatform]  = useState('all')
  const [showForm,  setShowForm]  = useState(false)
  const [selOrder,  setSelOrder]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [form,      setForm]      = useState(blankForm())

  function blankForm() {
    return {
      platform: 'manual', platform_order_id: '', customer_name: '', customer_phone: '',
      customer_address: '', items_description: '', subtotal: '', delivery_fee: '',
      discount: '', notes: '', status: 'pending',
    }
  }

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
    // Poll every 30s for new orders
    const interval = setInterval(reload, 30000)
    return () => clearInterval(interval)
  }, [restaurantId])

  async function reload() {
    try {
      const { data, error } = await supabase
        .from('delivery_orders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!error) setOrders(data ?? [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const save = async () => {
    if (!form.customer_name?.trim()) return
    setSaving(true)
    try {
      const total = n(form.subtotal) + n(form.delivery_fee) - n(form.discount)
      const payload = { ...form, total, restaurant_id: restaurantId, created_by: userId }
      if (selOrder) {
        await supabase.from('delivery_orders').update(payload).eq('id', selOrder.id)
      } else {
        await supabase.from('delivery_orders').insert(payload)
      }
      setShowForm(false); setSelOrder(null); setForm(blankForm())
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const updateStatus = async (id, status) => {
    await supabase.from('delivery_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  const openEdit = (o) => {
    setSelOrder(o); setForm({ ...o }); setShowForm(true)
  }

  const filtered = orders.filter(o => {
    if (filter === 'active') return !['delivered','cancelled'].includes(o.status)
    if (platform !== 'all') return o.platform === platform
    return true
  })

  // Stats
  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
  const todayRevenue = todayOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + n(o.total), 0)
  const activeCount  = orders.filter(o => !['delivered','cancelled'].includes(o.status)).length

  if (loading) return <div className={styles.loading}>Loading delivery orders…</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.pageTitle}>Delivery Orders</h2>
          <p className={styles.pageSub}>Manage Talabat, Deliveroo, Noon Food, Careem and direct delivery orders</p>
        </div>
        <button className={styles.addBtn} onClick={() => { setSelOrder(null); setForm(blankForm()); setShowForm(true) }}>
          + New order
        </button>
      </div>

      {/* KPIs */}
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Active orders</span>
          <span className={styles.kpiVal} style={{ color: activeCount > 0 ? '#e67e22' : 'var(--text-muted)' }}>{activeCount}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Today's orders</span>
          <span className={styles.kpiVal}>{todayOrders.length}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Today's revenue</span>
          <span className={styles.kpiVal} style={{ color: 'var(--accent)' }}>{fmt(todayRevenue)}</span>
        </div>
        {PLATFORMS.map(p => {
          const cnt = todayOrders.filter(o => o.platform === p.key && o.status !== 'cancelled').length
          if (cnt === 0) return null
          return (
            <div key={p.key} className={styles.kpi} style={{ background: p.bg, borderColor: p.color + '33' }}>
              <span className={styles.kpiLabel}>{p.label}</span>
              <span className={styles.kpiVal} style={{ color: p.textColor ?? p.color }}>{cnt} orders</span>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          {['active','all'].map(f => (
            <button key={f} className={styles.filterBtn} data-active={filter === f}
              onClick={() => { setFilter(f); setPlatform('all') }}>
              {f === 'active' ? 'Active' : 'All orders'}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <button className={styles.filterBtn} data-active={platform === 'all'} onClick={() => setPlatform('all')}>All platforms</button>
          {PLATFORMS.map(p => (
            <button key={p.key} className={styles.filterBtn} data-active={platform === p.key}
              style={platform === p.key ? { borderColor: p.color, color: p.textColor ?? p.color } : {}}
              onClick={() => { setPlatform(p.key); setFilter('all') }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛵</div>
          <div>{filter === 'active' ? 'No active delivery orders' : 'No orders found'}</div>
        </div>
      ) : (
        <div className={styles.orderGrid}>
          {filtered.map(o => {
            const plat = PLATFORMS.find(p => p.key === o.platform) ?? PLATFORMS[4]
            const st   = STATUS_COLORS[o.status] ?? STATUS_COLORS.pending
            const nextStatuses = STATUSES.slice(STATUSES.indexOf(o.status) + 1).filter(s => s !== 'cancelled')
            return (
              <div key={o.id} className={styles.orderCard}>
                <div className={styles.cardTop}>
                  <div className={styles.platformBadge} style={{ background: plat.bg, color: plat.textColor ?? plat.color }}>
                    {plat.label}
                  </div>
                  <div className={styles.statusBadge} style={{ background: st.bg, color: st.color }}>
                    {STATUS_LABELS[o.status]}
                  </div>
                  <span className={styles.orderTime}>{fmtD(o.created_at)} {fmtT(o.created_at)}</span>
                </div>

                <div className={styles.customerRow}>
                  <span className={styles.customerName}>{o.customer_name}</span>
                  {o.platform_order_id && <span className={styles.platformId}>#{o.platform_order_id}</span>}
                </div>
                {o.customer_phone && <div className={styles.customerPhone}>📞 {o.customer_phone}</div>}
                {o.customer_address && <div className={styles.address}>📍 {o.customer_address}</div>}
                {o.items_description && <div className={styles.items}>{o.items_description}</div>}

                <div className={styles.totals}>
                  <span>Subtotal: {fmt(o.subtotal)}</span>
                  {n(o.delivery_fee) > 0 && <span>+ Delivery: {fmt(o.delivery_fee)}</span>}
                  {n(o.discount) > 0 && <span style={{ color: '#5db88a' }}>− Disc: {fmt(o.discount)}</span>}
                  <span className={styles.totalAmt}>Total: {fmt(o.total)}</span>
                </div>

                <div className={styles.cardActions}>
                  {nextStatuses.length > 0 && o.status !== 'cancelled' && (
                    <button className={styles.nextBtn}
                      onClick={() => updateStatus(o.id, nextStatuses[0])}>
                      → {STATUS_LABELS[nextStatuses[0]]}
                    </button>
                  )}
                  {o.status !== 'delivered' && o.status !== 'cancelled' && (
                    <button className={styles.cancelBtn} onClick={() => updateStatus(o.id, 'cancelled')}>Cancel</button>
                  )}
                  <button className={styles.editBtn} onClick={() => openEdit(o)}>✏</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className={styles.overlay} onClick={() => setShowForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{selOrder ? 'Edit order' : 'New delivery order'}</span>
              <button className={styles.modalClose} onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Platform</label>
                  <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} className={styles.input}>
                    {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Platform order ID</label>
                  <input value={form.platform_order_id} onChange={e => setForm(p => ({ ...p, platform_order_id: e.target.value }))}
                    className={styles.input} placeholder="e.g. TAL-12345" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Customer name *</label>
                  <input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                    className={styles.input} placeholder="Customer name" autoFocus />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone</label>
                  <input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))}
                    className={styles.input} placeholder="+971 50 000 0000" />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Delivery address</label>
                <input value={form.customer_address} onChange={e => setForm(p => ({ ...p, customer_address: e.target.value }))}
                  className={styles.input} placeholder="Building, street, area" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Items</label>
                <textarea value={form.items_description} onChange={e => setForm(p => ({ ...p, items_description: e.target.value }))}
                  className={styles.input} rows={2} placeholder="e.g. 2x Chicken Shawarma, 1x Juice" />
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Subtotal (AED)</label>
                  <input type="number" min="0" step="0.01" value={form.subtotal}
                    onChange={e => setForm(p => ({ ...p, subtotal: e.target.value }))} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Delivery fee (AED)</label>
                  <input type="number" min="0" step="0.01" value={form.delivery_fee}
                    onChange={e => setForm(p => ({ ...p, delivery_fee: e.target.value }))} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Discount (AED)</label>
                  <input type="number" min="0" step="0.01" value={form.discount}
                    onChange={e => setForm(p => ({ ...p, discount: e.target.value }))} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={styles.input}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className={styles.input} placeholder="Special instructions, allergies…" />
              </div>
              {(n(form.subtotal) + n(form.delivery_fee) - n(form.discount)) > 0 && (
                <div className={styles.totalPreview}>
                  Total: {fmt(n(form.subtotal) + n(form.delivery_fee) - n(form.discount))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.saveBtn} onClick={save} disabled={saving || !form.customer_name?.trim()}>
                {saving ? 'Saving…' : selOrder ? 'Update order' : 'Create order'}
              </button>
              <button className={styles.cancelModalBtn} onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
