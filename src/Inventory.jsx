import { useState, useEffect, useMemo } from 'react'
import { loadIngredients, loadStockMovements, recordStockMovement, getInventoryValuation } from './supabase.js'
import styles from './Inventory.module.css'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toFixed(2)

const MOVEMENT_TYPES = [
  { key: 'adjustment', label: 'Adjustment',   color: '#2980b9' },
  { key: 'purchase',   label: 'Purchase',     color: '#27ae60' },
  { key: 'wastage',    label: 'Wastage',       color: '#c0392b' },
  { key: 'transfer',   label: 'Transfer',      color: '#8e44ad' },
]

export default function Inventory({ restaurantId, userId, activeTab }) {
  const [tab,        setTab]        = useState(activeTab ?? 'stock')
  const [ingredients,setIngredients]= useState([])
  const [movements,  setMovements]  = useState([])
  const [valuation,  setValuation]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [searchQ,    setSearchQ]    = useState('')
  const [catFilter,  setCatFilter]  = useState('All')

  // Adjustment modal
  const [adjModal,   setAdjModal]   = useState(null) // ingredient
  const [adjType,    setAdjType]    = useState('adjustment')
  const [adjQty,     setAdjQty]     = useState('')
  const [adjCost,    setAdjCost]    = useState('')
  const [adjNotes,   setAdjNotes]   = useState('')
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
  }, [restaurantId])

  useEffect(() => {
    if (activeTab) setTab(activeTab)
  }, [activeTab])

  async function reload() {
    setLoading(true)
    try {
      const [ings, movs, val] = await Promise.all([
        loadIngredients(restaurantId),
        loadStockMovements(restaurantId, null, 200),
        getInventoryValuation(restaurantId),
      ])
      setIngredients(ings); setMovements(movs); setValuation(val)
    } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  const recordMovement = async () => {
    if (!adjModal || !n(adjQty)) return
    setSaving(true)
    try {
      const direction = ['wastage','sale_deduct'].includes(adjType) ? -Math.abs(n(adjQty)) : Math.abs(n(adjQty))
      await recordStockMovement(restaurantId, adjModal.id, adjType, direction, n(adjCost), adjNotes, userId)
      setAdjModal(null); setAdjQty(''); setAdjCost(''); setAdjNotes('')
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const categories = ['All', ...new Set(ingredients.map(i => i.category).filter(Boolean))]
  const filtered = ingredients.filter(i => {
    const matchQ   = !searchQ || i.name.toLowerCase().includes(searchQ.toLowerCase())
    const matchCat = catFilter === 'All' || i.category === catFilter
    return matchQ && matchCat
  })
  const lowStock   = ingredients.filter(i => n(i.stock_qty) <= n(i.min_stock) && n(i.min_stock) > 0)
  const totalValue = valuation.reduce((s, i) => s + i.total_value, 0)

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading inventory…</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Inventory</h2>
          <p className={styles.pageSub}>Live stock levels, movements, and valuation across all raw materials.</p>
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        {[
          { label: 'Total SKUs',        val: ingredients.length,        color: 'var(--accent)' },
          { label: 'Low stock alerts',  val: lowStock.length,           color: lowStock.length > 0 ? '#c0392b' : '#27ae60' },
          { label: 'Total stock value', val: fmt(totalValue),           color: 'var(--accent)' },
          { label: 'Movements (30d)',   val: movements.length,          color: 'var(--text-primary)' },
        ].map(k => (
          <div key={k.label} className={styles.kpiCard}>
            <span className={styles.kpiVal} style={{ color: k.color }}>{k.val}</span>
            <span className={styles.kpiLabel}>{k.label}</span>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className={styles.alertBanner}>
          ⚠ Low stock: {lowStock.map(i => `${i.name} (${n(i.stock_qty)}${i.unit})`).join(' · ')}
        </div>
      )}



      {/* ── STOCK LEVELS ── */}
      {tab === 'stock' && (
        <div>
          <div className={styles.filterRow}>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search ingredients…" className={styles.searchInput} />
            <div className={styles.catFilters}>
              {categories.map(c => (
                <button key={c} className={styles.catFilterBtn} data-active={catFilter === c} onClick={() => setCatFilter(c)}>{c}</button>
              ))}
            </div>
          </div>

          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead><tr>
                <th>Ingredient</th><th>Category</th><th>Unit</th>
                <th>In stock</th><th>Min stock</th><th>Unit cost</th><th>Value</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map(ing => {
                  const low   = n(ing.stock_qty) <= n(ing.min_stock) && n(ing.min_stock) > 0
                  const value = n(ing.stock_qty) * n(ing.cost_per_unit)
                  return (
                    <tr key={ing.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ing.name}</td>
                      <td><span className={styles.catChip}>{ing.category}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{ing.unit}</td>
                      <td style={{ fontWeight: 600, color: low ? '#c0392b' : 'var(--text-primary)' }}>
                        {n(ing.stock_qty).toFixed(2)} {ing.unit}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{n(ing.min_stock)} {ing.unit}</td>
                      <td style={{ color: 'var(--accent)' }}>{fmt(ing.cost_per_unit)}</td>
                      <td style={{ color: '#27ae60', fontWeight: 500 }}>{fmt(value)}</td>
                      <td>
                        <span className={styles.statusBadge} data-low={low}>
                          {low ? '⚠ Low' : '✓ OK'}
                        </span>
                      </td>
                      <td>
                        <button className={styles.adjBtn} onClick={() => { setAdjModal(ing); setAdjType('adjustment'); setAdjCost(ing.cost_per_unit) }}>
                          Adjust
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>
                    No ingredients found
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MOVEMENTS ── */}
      {tab === 'movements' && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead><tr>
              <th>Date</th><th>Ingredient</th><th>Type</th>
              <th>Change</th><th>Before</th><th>After</th>
              <th>Unit cost</th><th>Total cost</th><th>Notes</th>
            </tr></thead>
            <tbody>
              {movements.map(m => {
                const mt = MOVEMENT_TYPES.find(t => t.key === m.movement_type)
                const positive = m.qty_change > 0
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleString('en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.ingredients?.name}</td>
                    <td>
                      <span className={styles.movTypeBadge} style={{ background: (mt?.color ?? '#888') + '18', color: mt?.color ?? '#888' }}>
                        {mt?.label ?? m.movement_type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: positive ? '#27ae60' : '#c0392b' }}>
                      {positive ? '+' : ''}{n(m.qty_change).toFixed(3)} {m.ingredients?.unit}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{n(m.qty_before).toFixed(2)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{n(m.qty_after).toFixed(2)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{fmt(m.unit_cost)}</td>
                    <td style={{ color: 'var(--accent)', fontSize: 12 }}>{fmt(m.total_cost)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{m.notes ?? '—'}</td>
                  </tr>
                )
              })}
              {movements.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>
                  No movements yet
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VALUATION ── */}
      {tab === 'valuation' && (
        <div>
          <div className={styles.valuationSummary}>
            {['Meat & Poultry','Seafood','Dairy & Eggs','Produce','Dry Goods','Beverages','Other'].map(cat => {
              const catItems = valuation.filter(i => i.category === cat)
              const catValue = catItems.reduce((s, i) => s + i.total_value, 0)
              if (catValue === 0 && catItems.length === 0) return null
              return (
                <div key={cat} className={styles.valCard}>
                  <span className={styles.valCat}>{cat}</span>
                  <span className={styles.valAmt}>{fmt(catValue)}</span>
                  <span className={styles.valCount}>{catItems.length} items</span>
                </div>
              )
            })}
            <div className={styles.valCard} style={{ borderColor: 'var(--accent)', background: 'var(--accent-dim)' }}>
              <span className={styles.valCat} style={{ color: 'var(--accent)' }}>Total</span>
              <span className={styles.valAmt} style={{ color: 'var(--accent)', fontSize: 20 }}>{fmt(totalValue)}</span>
              <span className={styles.valCount}>{valuation.length} items</span>
            </div>
          </div>
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead><tr><th>Ingredient</th><th>Category</th><th>Stock</th><th>Unit cost</th><th>Value</th><th>% of total</th></tr></thead>
              <tbody>
                {valuation.sort((a, b) => b.total_value - a.total_value).map((i, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{i.name}</td>
                    <td><span className={styles.catChip}>{i.category}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{n(i.stock_qty).toFixed(2)} {i.unit}</td>
                    <td style={{ color: 'var(--accent)' }}>{fmt(i.cost_per_unit)}</td>
                    <td style={{ fontWeight: 600, color: '#27ae60' }}>{fmt(i.total_value)}</td>
                    <td>
                      <div className={styles.pctBarWrap}>
                        <div className={styles.pctBar} style={{ width: totalValue > 0 ? (i.total_value / totalValue * 100) + '%' : '0%' }} />
                        <span className={styles.pctLabel}>{totalValue > 0 ? (i.total_value / totalValue * 100).toFixed(1) : 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adjustment Modal */}
      {adjModal && (
        <div className={styles.modalOverlay} onClick={() => setAdjModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Stock movement — {adjModal.name}</span>
              <button className={styles.modalClose} onClick={() => setAdjModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.currentStock}>
                Current stock: <strong>{n(adjModal.stock_qty).toFixed(2)} {adjModal.unit}</strong>
              </div>
              <div className={styles.movTypeRow}>
                {MOVEMENT_TYPES.map(t => (
                  <button key={t.key} className={styles.movTypeBtn} data-active={adjType === t.key}
                    style={{ '--tc': t.color }} onClick={() => setAdjType(t.key)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Quantity ({adjModal.unit})
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                      {['wastage'].includes(adjType) ? '(will deduct)' : '(will add)'}
                    </span>
                  </label>
                  <input type="number" min="0" step="0.001" value={adjQty}
                    onChange={e => setAdjQty(e.target.value)} className={styles.input} autoFocus placeholder="0" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Unit cost (AED)</label>
                  <input type="number" min="0" step="0.01" value={adjCost}
                    onChange={e => setAdjCost(e.target.value)} className={styles.input} />
                </div>
                <div className={styles.field} style={{ gridColumn: '1/-1' }}>
                  <label className={styles.label}>Notes</label>
                  <input value={adjNotes} onChange={e => setAdjNotes(e.target.value)}
                    className={styles.input} placeholder="Reason for adjustment…" />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.saveBtn} onClick={recordMovement} disabled={saving || !n(adjQty)}>
                {saving ? 'Saving…' : 'Record movement'}
              </button>
              <button className={styles.cancelBtn} onClick={() => setAdjModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
