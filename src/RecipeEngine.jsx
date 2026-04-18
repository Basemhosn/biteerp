import { useState, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import {
  loadIngredients, upsertIngredient, deleteIngredient,
  loadRecipes, upsertRecipe, deleteRecipe,
  loadMenuItemRecipes, linkMenuItemRecipe, unlinkMenuItemRecipe,
  logProduction, loadProductionLog, computeRecipeCost,
  loadMenu
} from './supabase.js'
import styles from './RecipeEngine.module.css'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toFixed(2)

const UNITS = ['kg','g','L','ml','pcs','box','bag','can','bottle','bunch','slice','portion']
const ING_CATS = ['Meat & Poultry','Seafood','Dairy & Eggs','Produce','Dry Goods','Sauces & Condiments','Beverages','Bakery','Frozen','Other']

export default function RecipeEngine({ restaurantId, userId, activeTab }) {
  const [tab,          setTab]          = useState(activeTab ?? 'ingredients')
  const [ingredients,  setIngredients]  = useState([])
  const [recipes,      setRecipes]      = useState([])
  const [menuData,     setMenuData]     = useState({ categories: [], items: [] })
  const [itemRecipes,  setItemRecipes]  = useState([])
  const [prodLog,      setProdLog]      = useState([])
  const [loading,      setLoading]      = useState(true)

  // Edit states
  const [editIng,      setEditIng]      = useState(null)
  const [editRecipe,   setEditRecipe]   = useState(null)
  const [recipeLines,  setRecipeLines]  = useState([])
  const [saving,       setSaving]       = useState(false)

  // Production modal
  const [prodModal,    setProdModal]    = useState(null) // recipe
  const [prodQty,      setProdQty]      = useState('1')
  const [prodNotes,    setProdNotes]    = useState('')

  // Import
  const [showImport,   setShowImport]   = useState(false)
  const [importType,   setImportType]   = useState('ingredients') // ingredients | recipes

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
  }, [restaurantId])

  useEffect(() => {
    if (activeTab) {
      const tabMap = {
        ingredients: 'ingredients', subrecipes: 'subrecipes',
        recipes: 'recipes', links: 'links', production: 'production'
      }
      if (tabMap[activeTab]) setTab(tabMap[activeTab])
    }
  }, [activeTab])

  async function reload() {
    setLoading(true)
    try {
      const [ings, recs, menu, links, prod] = await Promise.all([
        loadIngredients(restaurantId),
        loadRecipes(restaurantId),
        loadMenu(restaurantId),
        loadMenuItemRecipes(restaurantId),
        loadProductionLog(restaurantId, 30),
      ])
      setIngredients(ings)
      setRecipes(recs)
      setMenuData(menu)
      setItemRecipes(links)
      setProdLog(prod)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  // ── Ingredient CRUD ───────────────────────────────────────
  const blankIng = () => ({ name: '', category: 'General', unit: 'kg', cost_per_unit: '', stock_qty: '', min_stock: '' })

  const saveIng = async () => {
    if (!editIng?.name?.trim()) return
    setSaving(true)
    try {
      await upsertIngredient(restaurantId, {
        ...editIng,
        cost_per_unit: n(editIng.cost_per_unit),
        stock_qty:     n(editIng.stock_qty),
        min_stock:     n(editIng.min_stock),
      })
      setEditIng(null)
      const ings = await loadIngredients(restaurantId)
      setIngredients(ings)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const delIng = async (id) => {
    if (!confirm('Delete ingredient?')) return
    await deleteIngredient(id)
    setIngredients(prev => prev.filter(i => i.id !== id))
  }

  // ── Recipe CRUD ───────────────────────────────────────────
  const blankRecipe = (type = 'recipe') => ({
    name: '', type, category: '', description: '',
    yield_qty: '1', yield_unit: type === 'recipe' ? 'portion' : 'kg',
    prep_time_mins: '', cook_time_mins: '', instructions: ''
  })

  const openRecipe = (recipe) => {
    setEditRecipe({ ...recipe })
    setRecipeLines(recipe.recipe_lines?.map(l => ({ ...l })) ?? [])
  }

  const addLine = (type) => {
    setRecipeLines(prev => [...prev, {
      type,  // 'ingredient' | 'sub_recipe'
      ingredient_id: null, sub_recipe_id: null,
      quantity: '', unit: '', notes: '',
    }])
  }

  const updateLine = (i, field, val) => {
    setRecipeLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  const removeLine = (i) => setRecipeLines(prev => prev.filter((_, idx) => idx !== i))

  const saveRecipe = async () => {
    if (!editRecipe?.name?.trim()) return
    setSaving(true)
    try {
      const lines = recipeLines
        .filter(l => (l.ingredient_id || l.sub_recipe_id) && n(l.quantity) > 0)
        .map(l => ({
          ingredient_id: l.ingredient_id || null,
          sub_recipe_id: l.sub_recipe_id || null,
          quantity:      n(l.quantity),
          unit:          l.unit || null,
          notes:         l.notes || null,
        }))
      await upsertRecipe(restaurantId, {
        ...editRecipe,
        yield_qty:      n(editRecipe.yield_qty),
        prep_time_mins: n(editRecipe.prep_time_mins),
        cook_time_mins: n(editRecipe.cook_time_mins),
      }, lines)
      setEditRecipe(null)
      setRecipeLines([])
      const recs = await loadRecipes(restaurantId)
      setRecipes(recs)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Production ────────────────────────────────────────────
  const runProduction = async () => {
    if (!prodModal || n(prodQty) <= 0) return
    setSaving(true)
    try {
      const cost = computeRecipeCost(prodModal) * n(prodQty)
      await logProduction(restaurantId, prodModal.id, n(prodQty), cost, prodNotes, userId)
      setProdModal(null); setProdQty('1'); setProdNotes('')
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Import ────────────────────────────────────────────────
  const handleImportFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const wb   = XLSX.read(e.target.result, { type: 'binary' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length < 2) { alert('File is empty'); return }

      const headers = rows[0].map(h => h?.toString().toLowerCase().trim())
      const data    = rows.slice(1).filter(r => r[0])

      if (importType === 'ingredients') {
        const nameIdx = headers.findIndex(h => h.includes('name'))
        const unitIdx = headers.findIndex(h => h.includes('unit'))
        const costIdx = headers.findIndex(h => h.includes('cost'))
        const catIdx  = headers.findIndex(h => h.includes('categ'))
        const stkIdx  = headers.findIndex(h => h.includes('stock'))

        let imported = 0
        for (const row of data) {
          const name = row[nameIdx]?.toString().trim()
          if (!name) continue
          try {
            await upsertIngredient(restaurantId, {
              name,
              unit:          unitIdx !== -1 ? row[unitIdx] || 'kg' : 'kg',
              cost_per_unit: costIdx !== -1 ? n(row[costIdx]) : 0,
              category:      catIdx  !== -1 ? row[catIdx]  || 'General' : 'General',
              stock_qty:     stkIdx  !== -1 ? n(row[stkIdx]) : 0,
            })
            imported++
          } catch {}
        }
        alert(`Imported ${imported} ingredients`)
        await reload()
      }

      if (importType === 'recipes') {
        // Flat format: Recipe Name | Type | Ingredient | Quantity | Unit
        const recNameIdx = headers.findIndex(h => h.includes('recipe'))
        const typeIdx    = headers.findIndex(h => h.includes('type'))
        const ingIdx     = headers.findIndex(h => h.includes('ingredient') || h.includes('item'))
        const qtyIdx     = headers.findIndex(h => h.includes('qty') || h.includes('quantity'))
        const unitIdx    = headers.findIndex(h => h.includes('unit'))
        const yieldIdx   = headers.findIndex(h => h.includes('yield'))

        // Group rows by recipe name
        const recipeGroups = {}
        for (const row of data) {
          const rName = row[recNameIdx]?.toString().trim()
          if (!rName) continue
          if (!recipeGroups[rName]) {
            recipeGroups[rName] = {
              type:      typeIdx  !== -1 ? (row[typeIdx]?.toString().includes('sub') ? 'sub_recipe' : 'recipe') : 'recipe',
              yield_qty: yieldIdx !== -1 ? n(row[yieldIdx]) || 1 : 1,
              lines: []
            }
          }
          const ingName = ingIdx !== -1 ? row[ingIdx]?.toString().trim() : ''
          if (ingName) {
            const ing = ingredients.find(i => i.name.toLowerCase() === ingName.toLowerCase())
            if (ing) {
              recipeGroups[rName].lines.push({
                ingredient_id: ing.id,
                sub_recipe_id: null,
                quantity:      qtyIdx  !== -1 ? n(row[qtyIdx]) : 0,
                unit:          unitIdx !== -1 ? row[unitIdx] || ing.unit : ing.unit,
              })
            }
          }
        }

        let imported = 0
        for (const [name, rec] of Object.entries(recipeGroups)) {
          try {
            await upsertRecipe(restaurantId,
              { name, type: rec.type, yield_qty: rec.yield_qty, yield_unit: 'portion' },
              rec.lines
            )
            imported++
          } catch {}
        }
        alert(`Imported ${imported} recipes`)
        await reload()
      }

      setShowImport(false)
    }
    reader.readAsBinaryString(file)
  }

  const downloadTemplate = (type) => {
    let rows
    if (type === 'ingredients') {
      rows = [
        ['Name', 'Category', 'Unit', 'Cost per Unit (AED)', 'Current Stock', 'Min Stock'],
        ['Chicken Breast', 'Meat & Poultry', 'kg', 28, 10, 2],
        ['Garlic', 'Produce', 'kg', 12, 5, 1],
        ['Olive Oil', 'Sauces & Condiments', 'L', 22, 3, 0.5],
        ['Pita Bread', 'Bakery', 'pcs', 0.8, 100, 20],
        ['Tomatoes', 'Produce', 'kg', 8, 5, 1],
      ]
    } else {
      rows = [
        ['Recipe Name', 'Type', 'Yield Qty', 'Ingredient/Item', 'Quantity', 'Unit'],
        ['Chicken Shawarma', 'recipe',     '1', 'Chicken Breast', 0.2, 'kg'],
        ['Chicken Shawarma', 'recipe',     '1', 'Garlic Sauce',   0.05, 'kg'],
        ['Chicken Shawarma', 'recipe',     '1', 'Pita Bread',     1, 'pcs'],
        ['Garlic Sauce',     'sub_recipe', '1', 'Garlic',         0.1, 'kg'],
        ['Garlic Sauce',     'sub_recipe', '1', 'Olive Oil',      0.05, 'L'],
      ]
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = rows[0].map(() => ({ wch: 20 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, type === 'ingredients' ? 'Ingredients' : 'Recipes')
    XLSX.writeFile(wb, `biteerp-${type}-template.xlsx`)
  }

  // Derived
  const subRecipes = recipes.filter(r => r.type === 'sub_recipe')
  const mainRecipes = recipes.filter(r => r.type === 'recipe')
  const lowStock = ingredients.filter(i => n(i.stock_qty) <= n(i.min_stock) && n(i.min_stock) > 0)

  if (loading) return <div className={styles.loading}>Loading manufacturing…</div>
  if (!restaurantId) return <div className={styles.loading}>No restaurant linked.</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Manufacturing</h2>
          <p className={styles.pageSub}>Manage ingredients, recipes, sub-recipes, link to menu items, and log manufacturing batches.</p>
        </div>
        <div className={styles.topActions}>
          <button className={styles.importBtn} onClick={() => setShowImport(true)}>↑ Import</button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className={styles.alertBanner}>
          ⚠ {lowStock.length} ingredient{lowStock.length > 1 ? 's' : ''} below minimum stock:
          {lowStock.map(i => ` ${i.name} (${n(i.stock_qty)} ${i.unit})`).join(',')}
        </div>
      )}

      {/* Tabs */}


      {/* ── INGREDIENTS ── */}
      {tab === 'ingredients' && (
        <div>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionCount}>{ingredients.length} ingredients</span>
            <button className={styles.addBtn} onClick={() => setEditIng(blankIng())}>+ Add ingredient</button>
          </div>

          {editIng && (
            <div className={styles.formCard}>
              <div className={styles.formTitle}>{editIng.id ? 'Edit ingredient' : 'New ingredient'}</div>
              <div className={styles.formGrid4}>
                <div className={styles.field}>
                  <label className={styles.label}>Name *</label>
                  <input value={editIng.name} onChange={e => setEditIng(p => ({ ...p, name: e.target.value }))}
                    className={styles.input} placeholder="e.g. Chicken Breast" autoFocus />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Category</label>
                  <select value={editIng.category} onChange={e => setEditIng(p => ({ ...p, category: e.target.value }))} className={styles.input}>
                    {ING_CATS.map(c => <option key={c}>{c}</option>)}
                    <option>General</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Unit</label>
                  <select value={editIng.unit} onChange={e => setEditIng(p => ({ ...p, unit: e.target.value }))} className={styles.input}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Cost per unit (AED)</label>
                  <input type="number" min="0" step="0.01" value={editIng.cost_per_unit}
                    onChange={e => setEditIng(p => ({ ...p, cost_per_unit: e.target.value }))} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Current stock</label>
                  <input type="number" min="0" step="0.01" value={editIng.stock_qty}
                    onChange={e => setEditIng(p => ({ ...p, stock_qty: e.target.value }))} className={styles.input} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Min stock (reorder point)</label>
                  <input type="number" min="0" step="0.01" value={editIng.min_stock}
                    onChange={e => setEditIng(p => ({ ...p, min_stock: e.target.value }))} className={styles.input} />
                </div>
              </div>
              <div className={styles.formActions}>
                <button className={styles.saveBtn} onClick={saveIng} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button className={styles.cancelBtn} onClick={() => setEditIng(null)}>Cancel</button>
              </div>
            </div>
          )}

          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead><tr>
                <th>Name</th><th>Category</th><th>Unit</th>
                <th>Cost/unit</th><th>Stock</th><th>Min stock</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {ingredients.map(ing => {
                  const low = n(ing.stock_qty) <= n(ing.min_stock) && n(ing.min_stock) > 0
                  return (
                    <tr key={ing.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{ing.name}</td>
                      <td><span className={styles.catChip}>{ing.category}</span></td>
                      <td>{ing.unit}</td>
                      <td style={{ color: 'var(--accent)' }}>{fmt(ing.cost_per_unit)}</td>
                      <td style={{ color: low ? '#c0392b' : 'var(--text-secondary)', fontWeight: low ? 600 : 400 }}>
                        {n(ing.stock_qty)} {ing.unit}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{n(ing.min_stock)} {ing.unit}</td>
                      <td><span className={styles.statusBadge} data-low={low}>{low ? '⚠ Low' : '✓ OK'}</span></td>
                      <td>
                        <div className={styles.rowActions}>
                          <button className={styles.editBtn} onClick={() => setEditIng({ ...ing })}>✏</button>
                          <button className={styles.delBtn}  onClick={() => delIng(ing.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {ingredients.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No ingredients yet — add your first ingredient or import from a file
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUB-RECIPES & RECIPES (shared UI) ── */}
      {(tab === 'subrecipes' || tab === 'recipes') && (
        <RecipeList
          type={tab === 'subrecipes' ? 'sub_recipe' : 'recipe'}
          recipes={tab === 'subrecipes' ? subRecipes : mainRecipes}
          ingredients={ingredients}
          subRecipes={subRecipes}
          editRecipe={editRecipe}
          setEditRecipe={setEditRecipe}
          recipeLines={recipeLines}
          setRecipeLines={setRecipeLines}
          blankRecipe={blankRecipe}
          openRecipe={openRecipe}
          saveRecipe={saveRecipe}
          deleteRecipe={async (id) => { await deleteRecipe(id); const recs = await loadRecipes(restaurantId); setRecipes(recs) }}
          addLine={addLine}
          updateLine={updateLine}
          removeLine={removeLine}
          saving={saving}
          setProdModal={setProdModal}
        />
      )}

      {/* ── MENU LINKS ── */}
      {tab === 'links' && (
        <div>
          <p className={styles.sectionDesc}>Link each menu item to a recipe so the POS can auto-deduct ingredients when a sale closes.</p>
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead><tr>
                <th>Menu item</th><th>Category</th><th>Linked recipe</th><th>Portions per sale</th><th>Cost/sale</th><th></th>
              </tr></thead>
              <tbody>
                {menuData.items.map(item => {
                  const link    = itemRecipes.find(l => l.menu_item_id === item.id)
                  const recipe  = link ? recipes.find(r => r.id === link.recipe_id) : null
                  const cost    = recipe ? computeRecipeCost(recipe) * n(link?.portions ?? 1) : null
                  const cat     = menuData.categories.find(c => c.id === item.category_id)
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</td>
                      <td><span className={styles.catChip}>{cat?.name ?? '—'}</span></td>
                      <td>
                        <select
                          value={link?.recipe_id ?? ''}
                          onChange={async e => {
                            const val = e.target.value
                            if (!val) { if (link) await unlinkMenuItemRecipe(item.id, link.recipe_id) }
                            else await linkMenuItemRecipe(restaurantId, item.id, val, link?.portions ?? 1)
                            const links = await loadMenuItemRecipes(restaurantId)
                            setItemRecipes(links)
                          }}
                          className={styles.linkSelect}
                        >
                          <option value="">— No recipe linked —</option>
                          {mainRecipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </td>
                      <td>
                        {link && (
                          <input type="number" min="0.1" step="0.1"
                            value={link.portions}
                            onChange={async e => {
                              await linkMenuItemRecipe(restaurantId, item.id, link.recipe_id, n(e.target.value))
                              const links = await loadMenuItemRecipes(restaurantId)
                              setItemRecipes(links)
                            }}
                            className={styles.portionsInput}
                          />
                        )}
                      </td>
                      <td style={{ color: cost !== null ? '#27ae60' : 'var(--text-muted)' }}>
                        {cost !== null ? fmt(cost) : '—'}
                      </td>
                      <td>
                        {link && (
                          <span className={styles.marginBadge} data-ok={item.price > 0 && cost !== null && ((item.price - cost) / item.price) >= 0.4}>
                            {item.price > 0 && cost !== null
                              ? Math.round(((item.price - cost) / item.price) * 100) + '% margin'
                              : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PRODUCTION ── */}
      {tab === 'production' && (
        <div>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionDesc}>Log manufacturing batches — deducts raw materials from stock automatically.</span>
            <div className={styles.recipeQuickBtns}>
              {[...subRecipes, ...mainRecipes].map(r => (
                <button key={r.id} className={styles.prodQuickBtn} onClick={() => { setProdModal(r); setProdQty('1'); setProdNotes('') }}>
                  + {r.name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead><tr>
                <th>Recipe</th><th>Qty produced</th><th>Total cost</th><th>Produced by</th><th>Date & time</th>
              </tr></thead>
              <tbody>
                {prodLog.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.recipes?.name}</td>
                    <td>{n(p.qty_produced)} {p.recipes?.yield_unit}</td>
                    <td style={{ color: 'var(--accent)' }}>{fmt(p.total_cost)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{p.profiles?.full_name ?? '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      {new Date(p.produced_at).toLocaleString('en-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {prodLog.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No production logged yet
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PRODUCTION MODAL ── */}
      {prodModal && (
        <div className={styles.modalOverlay} onClick={() => setProdModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Log production — {prodModal.name}</span>
              <button className={styles.modalClose} onClick={() => setProdModal(null)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.prodCostPreview}>
                <span>Cost per {prodModal.yield_unit}: {fmt(computeRecipeCost(prodModal))}</span>
                <span>Total cost: {fmt(computeRecipeCost(prodModal) * n(prodQty))}</span>
              </div>

              {/* Ingredient breakdown */}
              <div className={styles.ingredientBreakdown}>
                {prodModal.recipe_lines?.map((line, i) => (
                  <div key={i} className={styles.breakdownRow}>
                    <span>{line.ingredients?.name ?? line.sub_recipe?.name}</span>
                    <span>{n(line.quantity) * n(prodQty)} {line.unit || line.ingredients?.unit}</span>
                  </div>
                ))}
              </div>

              <div className={styles.field} style={{ marginTop: 12 }}>
                <label className={styles.label}>Quantity to produce ({prodModal.yield_unit})</label>
                <input type="number" min="0.1" step="0.1" value={prodQty}
                  onChange={e => setProdQty(e.target.value)} className={styles.input} autoFocus />
              </div>
              <div className={styles.field} style={{ marginTop: 10 }}>
                <label className={styles.label}>Notes (optional)</label>
                <input value={prodNotes} onChange={e => setProdNotes(e.target.value)}
                  className={styles.input} placeholder="Batch notes…" />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.saveBtn} onClick={runProduction} disabled={saving}>
                {saving ? 'Logging…' : `✓ Log ${prodQty} ${prodModal.yield_unit}`}
              </button>
              <button className={styles.cancelBtn} onClick={() => setProdModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT MODAL ── */}
      {showImport && (
        <div className={styles.modalOverlay} onClick={() => setShowImport(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Import from file</span>
              <button className={styles.modalClose} onClick={() => setShowImport(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.importTypeRow}>
                {['ingredients','recipes'].map(t => (
                  <button key={t} className={styles.importTypeBtn} data-active={importType === t}
                    onClick={() => setImportType(t)}>
                    {t === 'ingredients' ? '🥦 Ingredients' : '📋 Recipes'}
                  </button>
                ))}
              </div>
              <button className={styles.templateBtn} onClick={() => downloadTemplate(importType)}>
                ↓ Download {importType} template
              </button>
              <div
                className={styles.dropZone}
                onClick={() => document.getElementById('recipeImportInput').click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleImportFile(e.dataTransfer.files[0]) }}
              >
                <input id="recipeImportInput" type="file" accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }} onChange={e => handleImportFile(e.target.files[0])} />
                <div style={{ fontSize: 32, marginBottom: 8 }}>↑</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Drop file or click to browse</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>CSV, XLSX, XLS</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Recipe list sub-component ────────────────────────────────
function RecipeList({ type, recipes, ingredients, subRecipes, editRecipe, setEditRecipe, recipeLines, setRecipeLines, blankRecipe, openRecipe, saveRecipe, deleteRecipe, addLine, updateLine, removeLine, saving, setProdModal }) {
  const styles_local = {}
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{recipes.length} {type === 'sub_recipe' ? 'sub-recipes' : 'recipes'}</span>
        <button style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '7px 14px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer' }}
          onClick={() => { setEditRecipe(blankRecipe(type)); setRecipeLines([]) }}>
          + New {type === 'sub_recipe' ? 'sub-recipe' : 'recipe'}
        </button>
      </div>

      {editRecipe?.type === type && (
        <RecipeForm
          recipe={editRecipe} lines={recipeLines}
          ingredients={ingredients} subRecipes={type === 'recipe' ? subRecipes : []}
          onChange={setEditRecipe} onLinesChange={setRecipeLines}
          onSave={saveRecipe} onCancel={() => { setEditRecipe(null); setRecipeLines([]) }}
          addLine={addLine} updateLine={updateLine} removeLine={removeLine}
          saving={saving} type={type}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recipes.map(r => {
          const cost = computeRecipeCost(r)
          return (
            <div key={r.id} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Yield: {r.yield_qty} {r.yield_unit}
                    {r.prep_time_mins > 0 && ` · Prep: ${r.prep_time_mins}m`}
                    {r.cook_time_mins > 0 && ` · Cook: ${r.cook_time_mins}m`}
                    {' · '}{(r.recipe_lines?.length ?? 0)} ingredients
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#27ae60' }}>{fmt(cost)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>per {r.yield_unit}</span>
                  {type === 'recipe' && (
                    <button style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px', background: 'rgba(39,174,96,0.1)', border: '0.5px solid #27ae60', borderRadius: 'var(--radius)', color: '#27ae60', cursor: 'pointer' }}
                      onClick={() => setProdModal(r)}>
                      + Produce
                    </button>
                  )}
                  <button style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                    onClick={() => openRecipe(r)}>✏ Edit</button>
                  <button style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                    onClick={() => deleteRecipe(r.id)}>✕</button>
                </div>
              </div>
              {/* Ingredient lines preview */}
              {r.recipe_lines?.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.recipe_lines.map((line, i) => (
                    <span key={i} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--bg-input)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                      {line.ingredients?.name ?? line.sub_recipe?.name} · {line.quantity} {line.unit || line.ingredients?.unit}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {recipes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
            No {type === 'sub_recipe' ? 'sub-recipes' : 'recipes'} yet
          </div>
        )}
      </div>
    </div>
  )
}

// ── Recipe form sub-component ────────────────────────────────
function RecipeForm({ recipe, lines, ingredients, subRecipes, onChange, onLinesChange, onSave, onCancel, addLine, updateLine, removeLine, saving, type }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        {recipe.id ? 'Edit' : 'New'} {type === 'sub_recipe' ? 'sub-recipe' : 'recipe'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
        {[
          { label: 'Name *', field: 'name', type: 'text', placeholder: type === 'sub_recipe' ? 'e.g. Garlic Sauce' : 'e.g. Chicken Shawarma' },
          { label: 'Category', field: 'category', type: 'text', placeholder: 'e.g. Wraps, Grills' },
          { label: 'Yield qty', field: 'yield_qty', type: 'number', placeholder: '1' },
          { label: 'Yield unit', field: 'yield_unit', type: 'text', placeholder: 'portion / kg / L' },
          { label: 'Prep time (min)', field: 'prep_time_mins', type: 'number', placeholder: '10' },
          { label: 'Cook time (min)', field: 'cook_time_mins', type: 'number', placeholder: '15' },
        ].map(({ label, field, type: ft, placeholder }) => (
          <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</label>
            <input type={ft} value={recipe[field] ?? ''} placeholder={placeholder}
              onChange={e => onChange(p => ({ ...p, [field]: e.target.value }))}
              style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }} />
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Instructions (optional)</label>
        <textarea value={recipe.instructions ?? ''} onChange={e => onChange(p => ({ ...p, instructions: e.target.value }))}
          placeholder="Step by step preparation instructions…" rows={3}
          style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%', resize: 'vertical' }} />
      </div>

      {/* Ingredient lines */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Ingredients</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => addLine('ingredient')} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 10px', border: '0.5px solid var(--accent)', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer' }}>+ Ingredient</button>
            {subRecipes.length > 0 && (
              <button onClick={() => addLine('sub_recipe')} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 10px', border: '0.5px solid #8e44ad', borderRadius: 4, background: 'rgba(142,68,173,0.1)', color: '#8e44ad', cursor: 'pointer' }}>+ Sub-recipe</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, alignItems: 'center', background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '8px 10px' }}>
              <select
                value={line.ingredient_id || line.sub_recipe_id || ''}
                onChange={e => {
                  const val = e.target.value
                  if (!line.sub_recipe_id && !line.ingredient_id) {
                    // auto-detect
                    const isIng = ingredients.some(i => i.id === val)
                    updateLine(i, isIng ? 'ingredient_id' : 'sub_recipe_id', val)
                    if (isIng) updateLine(i, 'sub_recipe_id', null)
                    else updateLine(i, 'ingredient_id', null)
                  } else if (line.ingredient_id) {
                    updateLine(i, 'ingredient_id', val)
                  } else {
                    updateLine(i, 'sub_recipe_id', val)
                  }
                }}
                style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, padding: '5px 8px', outline: 'none', fontFamily: 'var(--font-body)' }}
              >
                <option value="">Select…</option>
                {ingredients.length > 0 && <optgroup label="Ingredients">
                  {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>)}
                </optgroup>}
                {subRecipes.length > 0 && <optgroup label="Sub-recipes">
                  {subRecipes.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
                </optgroup>}
              </select>
              <input type="number" min="0" step="0.001" value={line.quantity} placeholder="Qty"
                onChange={e => updateLine(i, 'quantity', e.target.value)}
                style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, padding: '5px 8px', width: 70, outline: 'none', fontFamily: 'var(--font-body)' }} />
              <input value={line.unit ?? ''} placeholder="Unit"
                onChange={e => updateLine(i, 'unit', e.target.value)}
                style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, padding: '5px 8px', width: 60, outline: 'none', fontFamily: 'var(--font-body)' }} />
              <button onClick={() => removeLine(i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
          {lines.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: 12, border: '0.5px dashed var(--border)', borderRadius: 'var(--radius)' }}>
              No ingredients yet — click "+ Ingredient" to add
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}
          onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save recipe'}</button>
        <button style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '9px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}
          onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
