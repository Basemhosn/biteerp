import { useState, useEffect } from 'react'
import { loadMenu, saveCategory, deleteCategory, saveMenuItem, deleteMenuItem } from './supabase.js'
import MenuImport from './MenuImport.jsx'
import styles from './MenuBuilder.module.css'

const n = v => parseFloat(v) || 0
const ICONS = ['🍽','🍖','🥗','🌮','🍕','🍔','🥪','🥘','🍜','🍱','🥤','☕','🧃','🍰','🍪','🥙','🌯','🥚','🥩','🍗']
const COLORS = ['#0D7377','#e74c3c','#e67e22','#27ae60','#8e44ad','#2980b9','#c0392b','#16a085','#d35400','#7f8c8d']

export default function MenuBuilder({ restaurantId, userId }) {
  const [menu,         setMenu]         = useState({ categories: [], items: [] })
  const [loading,      setLoading]      = useState(true)
  const [activeTab,    setActiveTab]    = useState('categories')
  const [selCategory,  setSelCategory]  = useState(null)
  const [editCat,      setEditCat]      = useState(null)  // null | {} | {id,...}
  const [editItem,     setEditItem]     = useState(null)
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    loadMenu(restaurantId).then(m => { setMenu(m); setLoading(false) }).catch(err => { console.error('Menu load error:', err); setLoading(false) })
  }, [restaurantId])

  const reload = () => loadMenu(restaurantId).then(setMenu)

  // ── Category form
  const blankCat = () => ({ name: '', icon: '🍽', color: '#0D7377', sort_order: menu.categories.length })
  const saveCat = async () => {
    if (!editCat?.name?.trim()) return
    setSaving(true)
    try { await saveCategory(restaurantId, editCat); setEditCat(null); await reload() }
    catch (e) { alert(e.message) } finally { setSaving(false) }
  }
  const delCat = async (id) => {
    if (!confirm('Delete category and all its items?')) return
    await deleteCategory(id); await reload()
    if (selCategory === id) setSelCategory(null)
  }

  // ── Item form
  const [itemMods, setItemMods] = useState([])
  const blankItem = () => ({ name: '', description: '', price: '', cost: '', tags: [], available: true, category_id: selCategory, sort_order: 0 })

  const openNewItem = () => { setEditItem(blankItem()); setItemMods([]) }
  const openEditItem = (item) => {
    setEditItem({ ...item })
    setItemMods(item.modifierGroups?.map(g => ({ ...g, modifiers: [...(g.modifiers ?? [])] })) ?? [])
  }

  const addModGroup = () => setItemMods(prev => [...prev, { name: '', required: false, multi_select: false, modifiers: [] }])
  const addMod = (gi) => setItemMods(prev => prev.map((g, i) => i === gi ? { ...g, modifiers: [...g.modifiers, { name: '', price_delta: 0 }] } : g))
  const updateModGroup = (gi, field, val) => setItemMods(prev => prev.map((g, i) => i === gi ? { ...g, [field]: val } : g))
  const updateMod = (gi, mi, field, val) => setItemMods(prev => prev.map((g, i) => i === gi ? { ...g, modifiers: g.modifiers.map((m, j) => j === mi ? { ...m, [field]: val } : m) } : g))
  const removeModGroup = (gi) => setItemMods(prev => prev.filter((_, i) => i !== gi))
  const removeMod = (gi, mi) => setItemMods(prev => prev.map((g, i) => i === gi ? { ...g, modifiers: g.modifiers.filter((_, j) => j !== mi) } : g))

  const saveItem = async () => {
    if (!editItem?.name?.trim() || !editItem?.price) return
    setSaving(true)
    try {
      await saveMenuItem(restaurantId, { ...editItem, price: n(editItem.price), cost: n(editItem.cost) }, itemMods)
      setEditItem(null); setItemMods([]); await reload()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const delItem = async (id) => {
    if (!confirm('Delete this item?')) return
    await deleteMenuItem(id); await reload()
  }

  const catItems = menu.items.filter(i => i.category_id === selCategory)

  if (!restaurantId) return <div className={styles.loading}>No restaurant linked. Please sign out and back in.</div>
  if (loading) return <div className={styles.loading}>Loading menu…</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Menu builder</h2>
          <p className={styles.pageSub}>Build your full menu with categories, items, prices and modifiers. Changes reflect instantly in the POS.</p>
        </div>
        <div className={styles.tabs}>
          <button className={styles.tabBtn} data-active={activeTab === 'categories'} onClick={() => setActiveTab('categories')}>Categories</button>
          <button className={styles.tabBtn} data-active={activeTab === 'items'}      onClick={() => setActiveTab('items')}>Items</button>
          <button className={styles.tabBtn} data-active={activeTab === 'import'}     onClick={() => setActiveTab('import')}>↑ Import</button>
        </div>
      </div>

      {/* ── CATEGORIES TAB ── */}
      {activeTab === 'categories' && (
        <div>
          <div className={styles.catGrid}>
            {menu.categories.map(cat => (
              <div key={cat.id} className={styles.catCard} style={{ '--cc': cat.color }}
                data-sel={selCategory === cat.id} onClick={() => { setSelCategory(cat.id); setActiveTab('items') }}>
                <span className={styles.catIcon}>{cat.icon}</span>
                <span className={styles.catName}>{cat.name}</span>
                <span className={styles.catCount}>{menu.items.filter(i => i.category_id === cat.id).length} items</span>
                <div className={styles.catActions} onClick={e => e.stopPropagation()}>
                  <button className={styles.editBtn} onClick={() => setEditCat({ ...cat })}>✏</button>
                  <button className={styles.delBtn} onClick={() => delCat(cat.id)}>✕</button>
                </div>
              </div>
            ))}
            <div className={styles.catCardNew} onClick={() => setEditCat(blankCat())}>
              <span className={styles.catNewIcon}>+</span>
              <span className={styles.catNewLabel}>New category</span>
            </div>
          </div>

          {/* Category form */}
          {editCat && (
            <div className={styles.formCard}>
              <div className={styles.formTitle}>{editCat.id ? 'Edit category' : 'New category'}</div>
              <div className={styles.formGrid}>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Name *</label>
                  <input value={editCat.name} onChange={e => setEditCat(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Hot Food, Juices…" className={styles.formInput} autoFocus />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Icon</label>
                  <div className={styles.iconPicker}>
                    {ICONS.map(ic => (
                      <button key={ic} className={styles.iconBtn} data-sel={editCat.icon === ic}
                        onClick={() => setEditCat(p => ({ ...p, icon: ic }))}>{ic}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.formField}>
                  <label className={styles.formLabel}>Color</label>
                  <div className={styles.colorPicker}>
                    {COLORS.map(c => (
                      <button key={c} className={styles.colorBtn} data-sel={editCat.color === c}
                        style={{ background: c }} onClick={() => setEditCat(p => ({ ...p, color: c }))} />
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.formActions}>
                <button className={styles.saveBtn} onClick={saveCat} disabled={saving}>{saving ? 'Saving…' : 'Save category'}</button>
                <button className={styles.cancelBtn} onClick={() => setEditCat(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ITEMS TAB ── */}
      {activeTab === 'items' && (
        <div>
          {/* Category selector */}
          <div className={styles.catSelector}>
            {menu.categories.map(cat => (
              <button key={cat.id} className={styles.catSelectorBtn} data-active={selCategory === cat.id}
                style={{ '--cc': cat.color }} onClick={() => setSelCategory(cat.id)}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          {!selCategory && <p className={styles.hint}>Select a category above to manage its items</p>}

          {selCategory && (
            <>
              <div className={styles.itemsHeader}>
                <span className={styles.itemsCount}>{catItems.length} items</span>
                <button className={styles.addItemBtn} onClick={openNewItem}>+ Add item</button>
              </div>

              <div className={styles.itemsList}>
                {catItems.map(item => (
                  <div key={item.id} className={styles.itemRow}>
                    <div className={styles.itemInfo}>
                      {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0, marginBottom: 2 }} onError={e => e.target.style.display='none'} />}
                      <span className={styles.itemName}>{item.name}</span>
                      {item.description && <span className={styles.itemDesc}>{item.description}</span>}
                      <div className={styles.itemTags}>
                        {(item.tags ?? []).map(t => <span key={t} className={styles.tag}>{t}</span>)}
                      </div>
                    </div>
                    <div className={styles.itemRight}>
                      <span className={styles.itemPrice}>AED {n(item.price).toFixed(2)}</span>
                      <span className={styles.itemCost}>Cost: AED {n(item.cost).toFixed(2)}</span>
                      <span className={styles.itemMargin}>
                        {item.cost > 0 ? Math.round(((item.price - item.cost) / item.price) * 100) + '% margin' : ''}
                      </span>
                      {item.sku && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>SKU: {item.sku}</span>}
                      {item.barcode && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>▦ {item.barcode}</span>}
                    </div>
                    <div className={styles.itemModCount}>
                      {item.modifierGroups?.length > 0 && <span className={styles.modBadge}>{item.modifierGroups.length} mod groups</span>}
                    </div>
                    <div className={styles.itemActions}>
                      <button className={styles.editBtn} onClick={() => openEditItem(item)}>✏</button>
                      <button className={styles.delBtn} onClick={() => delItem(item.id)}>✕</button>
                    </div>
                  </div>
                ))}
                {catItems.length === 0 && <p className={styles.hint}>No items yet — click "Add item" to start</p>}
              </div>

              {/* Item form */}
              {editItem && (
                <div className={styles.formCard}>
                  <div className={styles.formTitle}>{editItem.id ? 'Edit item' : 'New item'}</div>
                  <div className={styles.formGrid}>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Item name *</label>
                      <input value={editItem.name} onChange={e => setEditItem(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Shawarma Wrap" className={styles.formInput} autoFocus />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Description</label>
                      <input value={editItem.description ?? ''} onChange={e => setEditItem(p => ({ ...p, description: e.target.value }))}
                        placeholder="Optional short description" className={styles.formInput} />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Selling price (AED) *</label>
                      <input type="number" min="0" step="0.5" value={editItem.price}
                        onChange={e => setEditItem(p => ({ ...p, price: e.target.value }))} className={styles.formInput} />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Cost / COGS (AED)</label>
                      <input type="number" min="0" step="0.5" value={editItem.cost}
                        onChange={e => setEditItem(p => ({ ...p, cost: e.target.value }))} className={styles.formInput} />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>SKU</label>
                      <input value={editItem.sku ?? ''} onChange={e => setEditItem(p => ({ ...p, sku: e.target.value }))}
                        placeholder="e.g. SHWR-001" className={styles.formInput} />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Barcode</label>
                      <input value={editItem.barcode ?? ''} onChange={e => setEditItem(p => ({ ...p, barcode: e.target.value }))}
                        placeholder="Scan or enter barcode" className={styles.formInput} style={{ fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Image URL</label>
                      <input value={editItem.image_url ?? ''} onChange={e => setEditItem(p => ({ ...p, image_url: e.target.value }))}
                        placeholder="https://…" className={styles.formInput} />
                      {editItem.image_url && <img src={editItem.image_url} alt="Preview" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, marginTop: 6 }} onError={e => e.target.style.display='none'} />}
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Tags (comma separated)</label>
                      <input value={(editItem.tags ?? []).join(', ')}
                        onChange={e => setEditItem(p => ({ ...p, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                        placeholder="popular, vegan, spicy" className={styles.formInput} />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Tax rate (%)</label>
                      <input type="number" min="0" max="100" value={editItem.tax_rate ?? 5}
                        onChange={e => setEditItem(p => ({ ...p, tax_rate: parseFloat(e.target.value) || 5 }))}
                        className={styles.formInput} />
                    </div>
                    <div className={styles.formField}>
                      <label className={styles.formLabel}>Available on POS</label>
                      <label className={styles.toggle}>
                        <input type="checkbox" checked={editItem.available}
                          onChange={e => setEditItem(p => ({ ...p, available: e.target.checked }))} />
                        <span className={styles.toggleLabel}>{editItem.available ? 'Visible on POS' : 'Hidden from POS'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Modifier groups */}
                  <div className={styles.modsSection}>
                    <div className={styles.modsSectionHeader}>
                      <span className={styles.modsSectionTitle}>Modifier groups</span>
                      <button className={styles.addModBtn} onClick={addModGroup}>+ Add group</button>
                    </div>
                    {itemMods.map((group, gi) => (
                      <div key={gi} className={styles.modGroup}>
                        <div className={styles.modGroupHeader}>
                          <input value={group.name} onChange={e => updateModGroup(gi, 'name', e.target.value)}
                            placeholder="Group name (e.g. Size, Extras, Remove)" className={styles.modGroupName} />
                          <label className={styles.modCheck}>
                            <input type="checkbox" checked={group.required} onChange={e => updateModGroup(gi, 'required', e.target.checked)} />
                            Required
                          </label>
                          <label className={styles.modCheck}>
                            <input type="checkbox" checked={group.multi_select} onChange={e => updateModGroup(gi, 'multi_select', e.target.checked)} />
                            Multi-select
                          </label>
                          <button className={styles.delBtn} onClick={() => removeModGroup(gi)}>✕</button>
                        </div>
                        <div className={styles.modList}>
                          {group.modifiers.map((mod, mi) => (
                            <div key={mi} className={styles.modRow}>
                              <input value={mod.name} onChange={e => updateMod(gi, mi, 'name', e.target.value)}
                                placeholder="Option name" className={styles.modInput} />
                              <div className={styles.modPriceWrap}>
                                <span className={styles.modPricePre}>AED</span>
                                <input type="number" step="0.5" value={mod.price_delta}
                                  onChange={e => updateMod(gi, mi, 'price_delta', n(e.target.value))}
                                  className={styles.modPriceInput} />
                              </div>
                              <button className={styles.delBtn} onClick={() => removeMod(gi, mi)}>✕</button>
                            </div>
                          ))}
                          <button className={styles.addModOptionBtn} onClick={() => addMod(gi)}>+ Add option</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={styles.formActions}>
                    <button className={styles.saveBtn} onClick={saveItem} disabled={saving}>{saving ? 'Saving…' : 'Save item'}</button>
                    <button className={styles.cancelBtn} onClick={() => { setEditItem(null); setItemMods([]) }}>Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* ── IMPORT TAB ── */}
      {activeTab === 'import' && (
        <MenuImport
          restaurantId={restaurantId}
          onDone={() => { setActiveTab('items'); reload() }}
        />
      )}

    </div>
  )
}
