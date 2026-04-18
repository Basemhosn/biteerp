import { createClient } from '@supabase/supabase-js'

const supabaseUrl   = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check your .env or Vercel environment variables')
}

export const supabase = createClient(
  supabaseUrl  ?? 'https://placeholder.supabase.co',
  supabaseAnon ?? 'placeholder-key',
  {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
    },
  }
)

// ─── Auth helpers ───────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email, password, fullName, role = 'manager') {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName, role } },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password',
  })
  if (error) throw error
}

// ─── Profile helpers ─────────────────────────────────────────

export async function getProfile(userId) {
  // Retry up to 5 times with delay — profile row is created by trigger
  // and may not be immediately available after signup
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, restaurants(*)')
      .eq('id', userId)
      .maybeSingle()

    if (data) return data

    // No row yet — wait and retry
    if (attempt < 4) await new Promise(r => setTimeout(r, 600))
  }

  // Profile still missing — return a minimal default so the app doesn't crash
  return { id: userId, role: 'owner', restaurant_id: null, restaurants: null, full_name: null }
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw error
}

// ─── Restaurant helpers ──────────────────────────────────────

export async function createRestaurant(name, ownerUserId) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    + '-' + Math.random().toString(36).slice(2, 6) // ensure uniqueness

  const { data: restaurant, error: rErr } = await supabase
    .from('restaurants')
    .insert({ name, slug })
    .select()
    .single()
  if (rErr) throw rErr

  // Wait for profile trigger to fire, then link owner to restaurant
  await new Promise(r => setTimeout(r, 800))

  const { error: pErr } = await supabase
    .from('profiles')
    .update({ restaurant_id: restaurant.id, role: 'owner' })
    .eq('id', ownerUserId)
  if (pErr) throw pErr

  return restaurant
}

export async function inviteTeamMember(email, role, restaurantId) {
  // Create user via Supabase admin invite (requires service role key on server)
  const { error } = await supabase.functions.invoke('invite-member', {
    body: { email, role, restaurant_id: restaurantId },
  })
  if (error) throw error
}

// ─── Calculator state ────────────────────────────────────────

export async function loadCalculatorState(restaurantId) {
  const { data, error } = await supabase
    .from('calculator_state')
    .select('state')
    .eq('restaurant_id', restaurantId)
    .single()
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
  return data?.state ?? null
}

export async function saveCalculatorState(restaurantId, state, userId) {
  const { error } = await supabase
    .from('calculator_state')
    .upsert(
      { restaurant_id: restaurantId, state, saved_at: new Date().toISOString(), saved_by: userId },
      { onConflict: 'restaurant_id' }
    )
  if (error) throw error
}

// ─── P&L History ─────────────────────────────────────────────

export async function loadPLHistory(restaurantId) {
  const { data, error } = await supabase
    .from('pl_history')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function savePLSnapshot(restaurantId, snapshot, userId) {
  const { error } = await supabase
    .from('pl_history')
    .upsert(
      { ...snapshot, restaurant_id: restaurantId, saved_by: userId },
      { onConflict: 'restaurant_id,month,year' }
    )
  if (error) throw error
}

export async function deletePLSnapshot(id) {
  const { error } = await supabase.from('pl_history').delete().eq('id', id)
  if (error) throw error
}

// ─── Suppliers ───────────────────────────────────────────────

export async function loadSuppliers(restaurantId) {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertSupplier(restaurantId, supplier) {
  const { data, error } = await supabase
    .from('suppliers')
    .upsert({ ...supplier, restaurant_id: restaurantId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSupplier(id) {
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

// ─── Expenses ────────────────────────────────────────────────

export async function loadExpenses(restaurantId) {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addExpense(restaurantId, expense, userId) {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...expense, restaurant_id: restaurantId, logged_by: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExpense(id) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

// ─── Daily Sales ─────────────────────────────────────────────

export async function loadDailySales(restaurantId, weekStart) {
  const { data, error } = await supabase
    .from('daily_sales')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('week_start', weekStart)
  if (error) throw error
  return data ?? []
}

export async function saveDailySale(restaurantId, weekStart, dayOfWeek, values, userId) {
  const { error } = await supabase
    .from('daily_sales')
    .upsert(
      { restaurant_id: restaurantId, week_start: weekStart, day_of_week: dayOfWeek, ...values, logged_by: userId },
      { onConflict: 'restaurant_id,week_start,day_of_week' }
    )
  if (error) throw error
}

// ─── Staff ───────────────────────────────────────────────────

export async function loadStaff(restaurantId) {
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('role')
  if (error) throw error
  return data ?? []
}

export async function upsertStaff(restaurantId, member) {
  const { data, error } = await supabase
    .from('staff')
    .upsert({ ...member, restaurant_id: restaurantId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteStaffMember(id) {
  const { error } = await supabase.from('staff').update({ active: false }).eq('id', id)
  if (error) throw error
}

// ─── Staff Schedule ──────────────────────────────────────────

export async function loadSchedule(restaurantId, weekStart) {
  const { data, error } = await supabase
    .from('staff_schedule')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('week_start', weekStart)
  if (error) throw error
  return data ?? []
}

export async function saveShift(restaurantId, staffId, weekStart, dayOfWeek, shift) {
  const { error } = await supabase
    .from('staff_schedule')
    .upsert(
      { restaurant_id: restaurantId, staff_id: staffId, week_start: weekStart, day_of_week: dayOfWeek, ...shift },
      { onConflict: 'staff_id,week_start,day_of_week' }
    )
  if (error) throw error
}

// ─── Inventory / Wastage ─────────────────────────────────────

export async function loadInventoryLog(restaurantId, weekStart) {
  const { data, error } = await supabase
    .from('inventory_log')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('week_start', weekStart)
  if (error) throw error
  return data ?? []
}

export async function saveInventoryEntry(restaurantId, weekStart, category, logType, amount, wastageReason, userId) {
  const { error } = await supabase
    .from('inventory_log')
    .upsert(
      { restaurant_id: restaurantId, week_start: weekStart, category, log_type: logType, amount, wastage_reason: wastageReason, logged_by: userId },
      { onConflict: 'restaurant_id,week_start,category,log_type' }
    )
  if (error) throw error
}

// ─── POS — Menu ──────────────────────────────────────────────

export async function loadMenu(restaurantId) {
  const [{ data: categories }, { data: items }, { data: groups }, { data: modifiers }] = await Promise.all([
    supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('active', true).order('sort_order'),
    supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('available', true).order('sort_order'),
    supabase.from('menu_modifier_groups').select('*').eq('restaurant_id', restaurantId).order('sort_order'),
    supabase.from('menu_modifiers').select('*').order('sort_order'),
  ])
  return {
    categories: categories ?? [],
    items:       (items ?? []).map(item => ({
      ...item,
      modifierGroups: (groups ?? [])
        .filter(g => g.item_id === item.id)
        .map(g => ({ ...g, modifiers: (modifiers ?? []).filter(m => m.group_id === g.id) }))
    }))
  }
}

export async function saveCategory(restaurantId, category) {
  const { data, error } = await supabase
    .from('menu_categories')
    .upsert({ ...category, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('menu_categories').delete().eq('id', id)
  if (error) throw error
}

export async function saveMenuItem(restaurantId, item, modifierGroups = []) {
  // Strip computed fields before upserting — modifierGroups is not a DB column
  const { modifierGroups: _mg, ...itemData } = item
  const { data: savedItem, error } = await supabase
    .from('menu_items')
    .upsert({ ...itemData, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error

  // Save modifier groups and their modifiers
  for (const group of modifierGroups) {
    const { data: savedGroup, error: gErr } = await supabase
      .from('menu_modifier_groups')
      .upsert({ ...group, item_id: savedItem.id, restaurant_id: restaurantId })
      .select().single()
    if (gErr) throw gErr

    for (const mod of (group.modifiers ?? [])) {
      const { error: mErr } = await supabase
        .from('menu_modifiers')
        .upsert({ ...mod, group_id: savedGroup.id })
      if (mErr) throw mErr
    }
  }
  return savedItem
}

export async function deleteMenuItem(id) {
  const { error } = await supabase.from('menu_items').delete().eq('id', id)
  if (error) throw error
}

// ─── POS — Tables ────────────────────────────────────────────

export async function loadTables(restaurantId) {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('section').order('name')
  if (error) throw error
  return data ?? []
}

export async function saveTable(restaurantId, table) {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .upsert({ ...table, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteTable(id) {
  const { error } = await supabase.from('restaurant_tables').update({ active: false }).eq('id', id)
  if (error) throw error
}

// ─── POS — Orders ────────────────────────────────────────────

export async function loadOpenOrders(restaurantId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), restaurant_tables(name,section)')
    .eq('restaurant_id', restaurantId)
    .in('status', ['open', 'sent'])
    .order('opened_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function loadOrderHistory(restaurantId, date) {
  const start = date + 'T00:00:00'
  const end   = date + 'T23:59:59'
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), restaurant_tables(name)')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'paid')
    .gte('closed_at', start)
    .lte('closed_at', end)
    .order('closed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createOrder(restaurantId, tableId, orderType, userId) {
  // Get next order number
  const { count } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  const orderNumber = (count ?? 0) + 1

  const { data, error } = await supabase
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_id:      tableId,
      order_type:    orderType,
      order_number:  orderNumber,
      status:        'open',
      opened_by:     userId,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function addOrderItem(orderId, item) {
  const { data, error } = await supabase
    .from('order_items')
    .insert({ order_id: orderId, ...item })
    .select().single()
  if (error) throw error
  return data
}

export async function removeOrderItem(itemId) {
  const { error } = await supabase.from('order_items').delete().eq('id', itemId)
  if (error) throw error
}

export async function updateOrderTotals(orderId, subtotal, vatAmount, discount) {
  const total = subtotal + vatAmount - discount
  const { error } = await supabase
    .from('orders')
    .update({ subtotal, vat_amount: vatAmount, discount, total })
    .eq('id', orderId)
  if (error) throw error
}

export async function closeOrder(orderId, paymentMethod, userId, restaurantId) {
  const now = new Date().toISOString()

  // 1. Mark order as paid
  const { data: order, error } = await supabase
    .from('orders')
    .update({ status: 'paid', payment_method: paymentMethod, closed_by: userId, closed_at: now })
    .eq('id', orderId)
    .select('*, order_items(*)')
    .single()
  if (error) throw error

  // 2. Feed into daily_sales
  const today     = now.slice(0, 10)
  const weekStart = getMondayOf(today)
  const dayOfWeek = getDayName(today)

  const { data: existing } = await supabase
    .from('daily_sales')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('week_start', weekStart)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle()

  await supabase
    .from('daily_sales')
    .upsert({
      restaurant_id: restaurantId,
      week_start:    weekStart,
      day_of_week:   dayOfWeek,
      total:         (existing?.total ?? 0) + order.total,
      logged_by:     userId,
    }, { onConflict: 'restaurant_id,week_start,day_of_week' })

  // 3. Deduct ingredients from stock via recipe links
  try {
    for (const orderItem of (order.order_items ?? [])) {
      if (!orderItem.item_id) continue
      // Find recipe links for this menu item
      const { data: links } = await supabase
        .from('menu_item_recipes')
        .select('portions, recipes(recipe_lines(quantity, ingredient_id, ingredients(id, stock_qty)))')
        .eq('menu_item_id', orderItem.item_id)
      if (!links?.length) continue
      for (const link of links) {
        const portions = (link.portions ?? 1) * (orderItem.quantity ?? 1)
        for (const line of (link.recipes?.recipe_lines ?? [])) {
          if (!line.ingredient_id || !line.ingredients) continue
          const deduct = line.quantity * portions
          const newQty = Math.max(0, (line.ingredients.stock_qty ?? 0) - deduct)
          await supabase.from('ingredients').update({ stock_qty: newQty }).eq('id', line.ingredient_id)
        }
      }
    }
  } catch (e) {
    console.warn('Ingredient deduction failed:', e.message)
    // Don't throw — sale is already recorded, ingredient deduction is best-effort
  }

  return order
}

export async function voidOrder(orderId, userId) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'voided', closed_by: userId, closed_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) throw error
}

// ─── Helpers ─────────────────────────────────────────────────
function getMondayOf(dateStr) {
  const d   = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getDayName(dateStr) {
  return ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(dateStr).getDay()]
}

// ─── Recipe Engine ────────────────────────────────────────────

// Ingredients
export async function loadIngredients(restaurantId) {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*, suppliers(name)')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('category').order('name')
  if (error) throw error
  return data ?? []
}

export async function upsertIngredient(restaurantId, ingredient) {
  const { data, error } = await supabase
    .from('ingredients')
    .upsert({ ...ingredient, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteIngredient(id) {
  const { error } = await supabase.from('ingredients').update({ active: false }).eq('id', id)
  if (error) throw error
}

// Recipes + lines
export async function loadRecipes(restaurantId, type = null) {
  let q = supabase
    .from('recipes')
    .select(`*, recipe_lines(*, ingredients(name, unit, cost_per_unit), sub_recipe:recipes!recipe_lines_sub_recipe_id_fkey(name, yield_qty, yield_unit))`)
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('type').order('name')
  if (type) q = q.eq('type', type)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function upsertRecipe(restaurantId, recipe, lines = []) {
  const { recipe_lines: _rl, ...recipeData } = recipe
  const { data: saved, error } = await supabase
    .from('recipes')
    .upsert({ ...recipeData, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error

  // Delete old lines, insert new ones
  await supabase.from('recipe_lines').delete().eq('recipe_id', saved.id)
  if (lines.length > 0) {
    const { error: lErr } = await supabase.from('recipe_lines').insert(
      lines.map((l, i) => ({ ...l, recipe_id: saved.id, sort_order: i }))
    )
    if (lErr) throw lErr
  }
  return saved
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').update({ active: false }).eq('id', id)
  if (error) throw error
}

// Menu item ↔ recipe links
export async function loadMenuItemRecipes(restaurantId) {
  const { data, error } = await supabase
    .from('menu_item_recipes')
    .select('*, recipes(name, type), menu_items(name)')
    .eq('restaurant_id', restaurantId)
  if (error) throw error
  return data ?? []
}

export async function linkMenuItemRecipe(restaurantId, menuItemId, recipeId, portions = 1) {
  const { error } = await supabase
    .from('menu_item_recipes')
    .upsert({ restaurant_id: restaurantId, menu_item_id: menuItemId, recipe_id: recipeId, portions },
      { onConflict: 'menu_item_id,recipe_id' })
  if (error) throw error
}

export async function unlinkMenuItemRecipe(menuItemId, recipeId) {
  const { error } = await supabase
    .from('menu_item_recipes')
    .delete()
    .eq('menu_item_id', menuItemId)
    .eq('recipe_id', recipeId)
  if (error) throw error
}

// Production log
export async function logProduction(restaurantId, recipeId, qtyProduced, totalCost, notes, userId) {
  const { data, error } = await supabase
    .from('production_log')
    .insert({
      restaurant_id: restaurantId,
      recipe_id:     recipeId,
      qty_produced:  qtyProduced,
      total_cost:    totalCost,
      batch_notes:   notes,
      produced_by:   userId,
    })
    .select().single()
  if (error) throw error

  // Deduct ingredients from stock
  const { data: recipe } = await supabase
    .from('recipes')
    .select('recipe_lines(*, ingredients(id, stock_qty, unit, cost_per_unit))')
    .eq('id', recipeId)
    .single()

  if (recipe?.recipe_lines) {
    for (const line of recipe.recipe_lines) {
      if (line.ingredients) {
        const deduct = line.quantity * qtyProduced
        const newQty = Math.max(0, (line.ingredients.stock_qty ?? 0) - deduct)
        await supabase.from('ingredients').update({ stock_qty: newQty }).eq('id', line.ingredients.id)
      }
    }
  }
  return data
}

export async function loadProductionLog(restaurantId, limit = 50) {
  const { data, error } = await supabase
    .from('production_log')
    .select('*, recipes(name, yield_unit), profiles(full_name)')
    .eq('restaurant_id', restaurantId)
    .order('produced_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// Compute recipe cost
export function computeRecipeCost(recipe) {
  if (!recipe?.recipe_lines) return 0
  return recipe.recipe_lines.reduce((sum, line) => {
    if (line.ingredients) {
      const unitCost = line.ingredients.cost_per_unit ?? 0
      return sum + (line.quantity * unitCost)
    }
    if (line.sub_recipe) {
      const subCost = computeRecipeCost(line.sub_recipe)
      const portionCost = line.sub_recipe.yield_qty > 0 ? subCost / line.sub_recipe.yield_qty : 0
      return sum + (line.quantity * portionCost)
    }
    return sum
  }, 0)
}

// ─── Inventory / Stock Movements ─────────────────────────────

export async function loadStockMovements(restaurantId, ingredientId = null, limit = 100) {
  let q = supabase
    .from('stock_movements')
    .select('*, ingredients(name, unit)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (ingredientId) q = q.eq('ingredient_id', ingredientId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function recordStockMovement(restaurantId, ingredientId, type, qtyChange, unitCost = 0, notes = '', userId, referenceId = null, referenceType = null) {
  // Get current stock
  const { data: ing } = await supabase.from('ingredients').select('stock_qty').eq('id', ingredientId).single()
  const qtyBefore = ing?.stock_qty ?? 0
  const qtyAfter  = Math.max(0, qtyBefore + qtyChange)

  const { error: mErr } = await supabase.from('stock_movements').insert({
    restaurant_id: restaurantId, ingredient_id: ingredientId,
    movement_type: type, qty_change: qtyChange,
    qty_before: qtyBefore, qty_after: qtyAfter,
    unit_cost: unitCost, total_cost: Math.abs(qtyChange) * unitCost,
    reference_id: referenceId, reference_type: referenceType,
    notes, logged_by: userId,
  })
  if (mErr) throw mErr

  // Update ingredient stock
  const { error: iErr } = await supabase.from('ingredients').update({ stock_qty: qtyAfter }).eq('id', ingredientId)
  if (iErr) throw iErr

  return qtyAfter
}

export async function getInventoryValuation(restaurantId) {
  const { data, error } = await supabase
    .from('ingredients')
    .select('name, unit, stock_qty, cost_per_unit, category')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
  if (error) throw error
  return (data ?? []).map(i => ({
    ...i,
    total_value: (i.stock_qty ?? 0) * (i.cost_per_unit ?? 0)
  }))
}

// ─── Purchase Orders ──────────────────────────────────────────

export async function loadPurchaseOrders(restaurantId) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(name), po_lines(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createPurchaseOrder(restaurantId, supplierId, lines, notes, expectedDate, userId) {
  // Generate PO number
  const { count } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
  const poNumber = 'PO-' + String((count ?? 0) + 1).padStart(4, '0')

  const subtotal  = lines.reduce((s, l) => s + (l.qty_ordered * l.unit_cost), 0)
  const vatAmount = subtotal * 0.05
  const total     = subtotal + vatAmount

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert({ restaurant_id: restaurantId, po_number: poNumber, supplier_id: supplierId, subtotal, vat_amount: vatAmount, total, notes, expected_date: expectedDate, created_by: userId })
    .select().single()
  if (error) throw error

  // Insert lines
  const { error: lErr } = await supabase.from('po_lines').insert(
    lines.map((l, i) => ({
      po_id: po.id, ingredient_id: l.ingredient_id, description: l.description,
      qty_ordered: l.qty_ordered, unit: l.unit, unit_cost: l.unit_cost,
      total_cost: l.qty_ordered * l.unit_cost, sort_order: i,
    }))
  )
  if (lErr) throw lErr
  return po
}

export async function receivePurchaseOrder(poId, receivedLines, userId, restaurantId) {
  // Update each line with received qty and update stock
  for (const line of receivedLines) {
    const qty = parseFloat(line.qty_received) || 0
    if (qty <= 0) continue
    await supabase.from('po_lines').update({ qty_received: qty }).eq('id', line.id)
    if (line.ingredient_id) {
      await recordStockMovement(restaurantId, line.ingredient_id, 'purchase', qty, line.unit_cost, 'PO received', userId, poId, 'purchase_order')
    }
  }
  // Check if fully received
  const { data: po } = await supabase.from('purchase_orders').select('*, po_lines(*)').eq('id', poId).single()
  const allReceived = po.po_lines.every(l => l.qty_received >= l.qty_ordered)
  const anyReceived = po.po_lines.some(l => (l.qty_received ?? 0) > 0)
  const status = allReceived ? 'received' : anyReceived ? 'partial' : po.status
  await supabase.from('purchase_orders').update({ status, received_date: new Date().toISOString().slice(0,10) }).eq('id', poId)
}

export async function updatePOStatus(poId, status) {
  const { error } = await supabase.from('purchase_orders').update({ status }).eq('id', poId)
  if (error) throw error
}

// ─── Accounting ───────────────────────────────────────────────

export async function loadChartOfAccounts(restaurantId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('code')
  if (error) throw error
  return data ?? []
}

export async function seedChartOfAccounts(restaurantId) {
  const { error } = await supabase.rpc('seed_chart_of_accounts', { p_restaurant_id: restaurantId })
  if (error) throw error
}

export async function upsertAccount(restaurantId, account) {
  const { data, error } = await supabase
    .from('accounts')
    .upsert({ ...account, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error
  return data
}

export async function loadJournalEntries(restaurantId, limit = 100) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*, journal_lines(*, accounts(code, name, type))')
    .eq('restaurant_id', restaurantId)
    .order('entry_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function createJournalEntry(restaurantId, description, lines, source, referenceId, userId) {
  // Get period
  const today = new Date()
  const { data: period } = await supabase
    .from('accounting_periods')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('year', today.getFullYear())
    .eq('month', today.getMonth() + 1)
    .maybeSingle()

  let periodId = period?.id
  if (!periodId) {
    const { data: newPeriod } = await supabase
      .from('accounting_periods')
      .insert({ restaurant_id: restaurantId, year: today.getFullYear(), month: today.getMonth() + 1 })
      .select().single()
    periodId = newPeriod?.id
  }

  // Entry number
  const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
  const entryNumber = 'JE-' + String((count ?? 0) + 1).padStart(5, '0')

  const { data: entry, error } = await supabase
    .from('journal_entries')
    .insert({ restaurant_id: restaurantId, entry_number: entryNumber, description, source, reference_id: referenceId, period_id: periodId, posted: true, created_by: userId })
    .select().single()
  if (error) throw error

  const { error: lErr } = await supabase.from('journal_lines').insert(
    lines.map((l, i) => ({ entry_id: entry.id, account_id: l.account_id, description: l.description, debit: l.debit ?? 0, credit: l.credit ?? 0, sort_order: i }))
  )
  if (lErr) throw lErr
  return entry
}

export async function getTrialBalance(restaurantId) {
  const { data: lines, error } = await supabase
    .from('journal_lines')
    .select('debit, credit, accounts(code, name, type, sub_type)')
    .eq('accounts.restaurant_id', restaurantId)
  if (error) throw error

  const balances = {}
  for (const line of (lines ?? [])) {
    const acct = line.accounts
    if (!acct) continue
    if (!balances[acct.code]) balances[acct.code] = { ...acct, debit: 0, credit: 0 }
    balances[acct.code].debit  += line.debit ?? 0
    balances[acct.code].credit += line.credit ?? 0
  }

  return Object.values(balances).map(b => ({
    ...b,
    balance: ['asset','expense'].includes(b.type) ? b.debit - b.credit : b.credit - b.debit
  }))
}

export async function getPLStatement(restaurantId, year, month) {
  const { data: accounts } = await supabase.from('accounts').select('id, code, name, type, sub_type').eq('restaurant_id', restaurantId)
  const { data: entries }  = await supabase.from('journal_entries').select('id').eq('restaurant_id', restaurantId)
  const entryIds = (entries ?? []).map(e => e.id)
  if (!entryIds.length) return { revenue: [], cogs: [], expenses: [], totals: {} }

  const { data: lines } = await supabase.from('journal_lines').select('account_id, debit, credit').in('entry_id', entryIds)
  const acctMap = Object.fromEntries((accounts ?? []).map(a => [a.id, a]))
  const totals  = {}
  for (const line of (lines ?? [])) {
    const acct = acctMap[line.account_id]
    if (!acct) continue
    if (!totals[acct.id]) totals[acct.id] = { ...acct, balance: 0 }
    totals[acct.id].balance += (acct.type === 'revenue' ? (line.credit - line.debit) : (line.debit - line.credit))
  }

  const rows = Object.values(totals)
  const revenue  = rows.filter(r => r.type === 'revenue')
  const cogs     = rows.filter(r => r.type === 'expense' && r.sub_type === 'cogs')
  const expenses = rows.filter(r => r.type === 'expense' && r.sub_type !== 'cogs')
  const totalRevenue  = revenue.reduce((s, r) => s + r.balance, 0)
  const totalCOGS     = cogs.reduce((s, r) => s + r.balance, 0)
  const totalExpenses = expenses.reduce((s, r) => s + r.balance, 0)
  const grossProfit   = totalRevenue - totalCOGS
  const netProfit     = grossProfit - totalExpenses

  return { revenue, cogs, expenses, totals: { totalRevenue, totalCOGS, grossProfit, totalExpenses, netProfit } }
}

// ─── Company Profile ──────────────────────────────────────────

export async function loadCompanyProfile(restaurantId) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single()
  if (error) throw error
  return data
}

export async function saveCompanyProfile(restaurantId, profile) {
  const { error } = await supabase
    .from('restaurants')
    .update(profile)
    .eq('id', restaurantId)
  if (error) throw error
}

export async function uploadCompanyLogo(restaurantId, file) {
  const ext  = file.name.split('.').pop()
  const path = `logos/${restaurantId}.${ext}`
  const { error } = await supabase.storage
    .from('company-assets')
    .upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('company-assets').getPublicUrl(path)
  return data.publicUrl
}

// ─── Quotations / Purchase Orders v2 ─────────────────────────

export async function loadQuotations(restaurantId) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(name, phone, email), po_lines(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createQuotation(restaurantId, supplierId, lines, opts, userId) {
  // Get next quote number
  const { data: rest } = await supabase
    .from('restaurants')
    .select('next_po_number, quote_prefix')
    .eq('id', restaurantId)
    .single()

  const prefix = rest?.quote_prefix ?? 'QT'
  const num    = rest?.next_po_number ?? 1
  const quoteNumber = `${prefix}-${String(num).padStart(4, '0')}`

  // Increment counter
  await supabase.from('restaurants').update({ next_po_number: num + 1 }).eq('id', restaurantId)

  const subtotal  = lines.reduce((s, l) => s + (parseFloat(l.qty_ordered) || 0) * (parseFloat(l.unit_cost) || 0), 0)
  const vatAmount = subtotal * 0.05
  const total     = subtotal + vatAmount

  const { data: qt, error } = await supabase
    .from('purchase_orders')
    .insert({
      restaurant_id:    restaurantId,
      po_number:        quoteNumber,
      quote_number:     quoteNumber,
      doc_type:         'quotation',
      supplier_id:      supplierId || null,
      status:           'draft',
      subtotal, vat_amount: vatAmount, total,
      payment_terms:    opts.paymentTerms || null,
      notes:            opts.notes || null,
      expected_date:    opts.expectedDate || null,
      created_by:       userId,
    })
    .select().single()
  if (error) throw error

  if (lines.length > 0) {
    await supabase.from('po_lines').insert(
      lines.map((l, i) => ({
        po_id:          qt.id,
        ingredient_id:  l.ingredient_id || null,
        description:    l.description,
        qty_ordered:    parseFloat(l.qty_ordered) || 0,
        unit:           l.unit,
        unit_cost:      parseFloat(l.unit_cost) || 0,
        total_cost:     (parseFloat(l.qty_ordered) || 0) * (parseFloat(l.unit_cost) || 0),
        sort_order:     i,
      }))
    )
  }
  return qt
}

export async function confirmQuotation(quotationId, userId) {
  // Get existing quotation
  const { data: qt } = await supabase
    .from('purchase_orders')
    .select('*, restaurant_id, restaurants(next_po_number, po_prefix)')
    .eq('id', quotationId)
    .single()

  const prefix = qt.restaurants?.po_prefix ?? 'PO'
  const num    = qt.restaurants?.next_po_number ?? 1
  const poNumber = `${prefix}-${String(num).padStart(4, '0')}`

  await supabase.from('restaurants').update({ next_po_number: num + 1 }).eq('id', qt.restaurant_id)

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      doc_type:      'po',
      po_number:     poNumber,
      status:        'sent',
      confirmed_at:  new Date().toISOString(),
      confirmed_by:  userId,
    })
    .eq('id', quotationId)
  if (error) throw error
}

// ─── Receipts ────────────────────────────────────────────────

export async function loadReceipts(restaurantId) {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, suppliers(name), purchase_orders(po_number), receipt_lines(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createReceiptFromPO(poId, restaurantId, userId) {
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('*, po_lines(*), suppliers(name)')
    .eq('id', poId)
    .single()

  // Get next receipt number
  const { count } = await supabase
    .from('receipts')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  const receiptNumber = `REC-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data: receipt, error } = await supabase
    .from('receipts')
    .insert({
      restaurant_id:  restaurantId,
      po_id:          poId,
      receipt_number: receiptNumber,
      supplier_id:    po.supplier_id,
      status:         'draft',
      created_by:     userId,
    })
    .select().single()
  if (error) throw error

  // Create receipt lines from PO lines
  if (po.po_lines?.length > 0) {
    await supabase.from('receipt_lines').insert(
      po.po_lines.map((l, i) => ({
        receipt_id:    receipt.id,
        po_line_id:    l.id,
        ingredient_id: l.ingredient_id,
        description:   l.description,
        qty_expected:  l.qty_ordered,
        qty_received:  l.qty_ordered, // pre-fill with expected
        unit:          l.unit,
        unit_cost:     l.unit_cost,
        total_cost:    l.qty_ordered * l.unit_cost,
        sort_order:    i,
      }))
    )
  }
  return receipt
}

export async function validateReceipt(receiptId, lines, userId, restaurantId) {
  // Update receipt lines with actual received quantities
  for (const line of lines) {
    const qty  = parseFloat(line.qty_received) || 0
    const total = qty * (parseFloat(line.unit_cost) || 0)
    await supabase.from('receipt_lines')
      .update({ qty_received: qty, total_cost: total })
      .eq('id', line.id)

    // Update stock for each ingredient
    if (line.ingredient_id && qty > 0) {
      const { data: ing } = await supabase
        .from('ingredients')
        .select('stock_qty, cost_per_unit')
        .eq('id', line.ingredient_id)
        .single()

      const newQty  = (parseFloat(ing?.stock_qty) || 0) + qty
      // AVCO cost update
      const oldQty  = parseFloat(ing?.stock_qty) || 0
      const oldCost = parseFloat(ing?.cost_per_unit) || 0
      const newCost = oldQty + qty > 0
        ? ((oldQty * oldCost) + (qty * parseFloat(line.unit_cost))) / (oldQty + qty)
        : parseFloat(line.unit_cost)

      await supabase.from('ingredients').update({
        stock_qty:     newQty,
        cost_per_unit: newCost,
      }).eq('id', line.ingredient_id)

      // Log stock movement
      await supabase.from('stock_movements').insert({
        restaurant_id:  restaurantId,
        ingredient_id:  line.ingredient_id,
        movement_type:  'purchase',
        qty_change:     qty,
        qty_before:     oldQty,
        qty_after:      newQty,
        unit_cost:      parseFloat(line.unit_cost),
        total_cost:     total,
        reference_id:   receiptId,
        reference_type: 'receipt',
        logged_by:      userId,
      })
    }
  }

  // Mark receipt as validated
  await supabase.from('receipts').update({
    status:       'validated',
    validated_by: userId,
    validated_at: new Date().toISOString(),
  }).eq('id', receiptId)

  // Mark PO as received
  const { data: receipt } = await supabase.from('receipts').select('po_id').eq('id', receiptId).single()
  if (receipt?.po_id) {
    await supabase.from('purchase_orders').update({ status: 'received', received_date: new Date().toISOString().slice(0,10) }).eq('id', receipt.po_id)
    // Auto-post journal entry: Dr Inventory / Cr Accounts Payable
    autoPostPurchaseReceipt(receipt.po_id, restaurantId, userId).catch(e => console.warn('PO auto-post:', e.message))
  }
}

// ─── POS v2 helpers ───────────────────────────────────────────

export async function fireOrderToKitchen(orderId, userId) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'sent', fired_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) throw error
  // Mark all pending items as cooking
  await supabase.from('order_items')
    .update({ status: 'cooking' })
    .eq('order_id', orderId)
    .eq('status', 'pending')
}

export async function markOrderReady(orderId) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'ready', ready_at: new Date().toISOString() })
    .eq('id', orderId)
  if (error) throw error
  await supabase.from('order_items')
    .update({ status: 'ready' })
    .eq('order_id', orderId)
    .eq('status', 'cooking')
}

export async function updateItemStatus(itemId, status) {
  const { error } = await supabase.from('order_items').update({ status }).eq('id', itemId)
  if (error) throw error
}

export async function updateItemNotes(itemId, notes) {
  const { error } = await supabase.from('order_items').update({ notes }).eq('id', itemId)
  if (error) throw error
}

export async function transferTable(orderId, newTableId) {
  const { error } = await supabase
    .from('orders')
    .update({ table_id: newTableId })
    .eq('id', orderId)
  if (error) throw error
}

export async function updateOrderCovers(orderId, covers) {
  const { error } = await supabase.from('orders').update({ covers }).eq('id', orderId)
  if (error) throw error
}

export async function loadKitchenOrders(restaurantId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, restaurant_tables(name), order_items(*)')
    .eq('restaurant_id', restaurantId)
    .in('status', ['sent', 'ready'])
    .order('fired_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ─── Cash sessions ────────────────────────────────────────────

export async function getOpenCashSession(restaurantId) {
  const { data } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function openCashSession(restaurantId, openingFloat, userId) {
  const { data, error } = await supabase
    .from('cash_sessions')
    .insert({ restaurant_id: restaurantId, opening_float: openingFloat, opened_by: userId })
    .select().single()
  if (error) throw error
  return data
}

export async function closeCashSession(sessionId, closingCash, notes, userId) {
  // Get session totals from paid orders
  const { data: session } = await supabase.from('cash_sessions').select('*').eq('id', sessionId).single()
  const { data: movements } = await supabase.from('cash_movements').select('*').eq('session_id', sessionId)

  const cashIn  = (movements ?? []).filter(m => m.movement_type === 'cash_in').reduce((s, m) => s + m.amount, 0)
  const cashOut = (movements ?? []).filter(m => m.movement_type === 'cash_out').reduce((s, m) => s + m.amount, 0)
  const expectedCash = (session.opening_float ?? 0) + (session.total_cash_sales ?? 0) + cashIn - cashOut
  const difference   = closingCash - expectedCash

  const { error } = await supabase.from('cash_sessions').update({
    status: 'closed', closed_by: userId, closed_at: new Date().toISOString(),
    closing_cash: closingCash, expected_cash: expectedCash,
    cash_difference: difference, notes,
  }).eq('id', sessionId)
  if (error) throw error
}

export async function addCashMovement(sessionId, restaurantId, type, amount, reason, userId) {
  const { error } = await supabase.from('cash_movements').insert({
    session_id: sessionId, restaurant_id: restaurantId,
    movement_type: type, amount, reason, logged_by: userId,
  })
  if (error) throw error
}

export async function updateSessionSales(sessionId, payMethod, amount) {
  const field = payMethod === 'cash' ? 'total_cash_sales'
    : payMethod === 'card' ? 'total_card_sales' : 'total_split_sales'
  // Increment using RPC-style update
  const { data: s } = await supabase.from('cash_sessions').select(field + ', total_orders, total_revenue').eq('id', sessionId).single()
  if (!s) return
  await supabase.from('cash_sessions').update({
    [field]: (s[field] ?? 0) + amount,
    total_orders:  (s.total_orders ?? 0) + 1,
    total_revenue: (s.total_revenue ?? 0) + amount,
  }).eq('id', sessionId)
}

export async function loadCashSessions(restaurantId, limit = 10) {
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*, cash_movements(*)')
    .eq('restaurant_id', restaurantId)
    .order('opened_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ─── Barcode / SKU lookup ─────────────────────────────────────
export async function lookupBarcode(restaurantId, barcode) {
  // Check menu_items first
  const { data: item } = await supabase
    .from('menu_items')
    .select('*, menu_categories(name), menu_modifier_groups(*, menu_modifiers(*))')
    .eq('restaurant_id', restaurantId)
    .eq('barcode', barcode)
    .eq('available', true)
    .maybeSingle()
  if (item) return { type: 'item', data: { ...item, modifierGroups: item.menu_modifier_groups } }

  // Check variants
  const { data: variant } = await supabase
    .from('item_variants')
    .select('*, menu_items(*, menu_categories(name))')
    .eq('restaurant_id', restaurantId)
    .eq('barcode', barcode)
    .eq('available', true)
    .maybeSingle()
  if (variant) return { type: 'variant', data: variant }

  return null
}

export async function lookupSKU(restaurantId, sku) {
  const { data: item } = await supabase
    .from('menu_items')
    .select('*, menu_modifier_groups(*, menu_modifiers(*))')
    .eq('restaurant_id', restaurantId)
    .eq('sku', sku)
    .maybeSingle()
  if (item) return { type: 'item', data: { ...item, modifierGroups: item.menu_modifier_groups } }
  const { data: variant } = await supabase
    .from('item_variants')
    .select('*, menu_items(*)')
    .eq('restaurant_id', restaurantId)
    .eq('sku', sku)
    .maybeSingle()
  if (variant) return { type: 'variant', data: variant }
  return null
}

// ─── Variants ─────────────────────────────────────────────────
export async function loadItemVariants(itemId) {
  const { data, error } = await supabase
    .from('item_variants')
    .select('*')
    .eq('item_id', itemId)
    .eq('available', true)
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function saveItemVariant(restaurantId, variant) {
  const { data, error } = await supabase
    .from('item_variants')
    .upsert({ ...variant, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteItemVariant(id) {
  const { error } = await supabase.from('item_variants').delete().eq('id', id)
  if (error) throw error
}

// ─── Promotions ───────────────────────────────────────────────
export async function loadPromotions(restaurantId) {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function savePromotion(restaurantId, promo) {
  const { data, error } = await supabase
    .from('promotions')
    .upsert({ ...promo, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error
  return data
}

export async function applyPromoCode(restaurantId, code, orderTotal) {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('code', code.toUpperCase())
    .eq('active', true)
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .maybeSingle()
  if (error || !data) return { error: 'Invalid or expired promo code' }
  if (data.min_order_value && orderTotal < data.min_order_value) {
    return { error: `Minimum order of AED ${data.min_order_value} required` }
  }
  if (data.usage_limit && data.usage_count >= data.usage_limit) {
    return { error: 'Promo code usage limit reached' }
  }
  const discount = data.type === 'percent'
    ? orderTotal * data.value / 100
    : Math.min(data.value, orderTotal)
  return { promo: data, discount }
}

export async function incrementPromoUsage(promoId) {
  const { data: p } = await supabase.from('promotions').select('usage_count').eq('id', promoId).single()
  await supabase.from('promotions').update({ usage_count: (p?.usage_count ?? 0) + 1 }).eq('id', promoId)
}

// ─── Cashier shifts ───────────────────────────────────────────
export async function openCashierShift(restaurantId, sessionId, cashierName, openingFloat, userId) {
  const { data, error } = await supabase
    .from('cashier_shifts')
    .insert({
      restaurant_id: restaurantId, cash_session_id: sessionId,
      cashier_id: userId, cashier_name: cashierName,
      opening_float: openingFloat, status: 'open',
    })
    .select().single()
  if (error) throw error
  return data
}

export async function closeCashierShift(shiftId, closingCash, userId) {
  const { data: shift } = await supabase.from('cashier_shifts').select('*').eq('id', shiftId).single()
  const { error } = await supabase.from('cashier_shifts').update({
    status: 'closed', closed_at: new Date().toISOString(),
    closing_cash: closingCash,
  }).eq('id', shiftId)
  if (error) throw error
}

export async function getActiveShift(restaurantId, userId) {
  const { data } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('cashier_id', userId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function updateShiftSales(shiftId, amount) {
  const { data: s } = await supabase.from('cashier_shifts').select('total_sales, total_orders').eq('id', shiftId).single()
  if (!s) return
  await supabase.from('cashier_shifts').update({
    total_sales:  (s.total_sales ?? 0) + amount,
    total_orders: (s.total_orders ?? 0) + 1,
  }).eq('id', shiftId)
}

export async function loadShifts(restaurantId, limit = 20) {
  const { data, error } = await supabase
    .from('cashier_shifts')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('opened_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ─── Refunds ──────────────────────────────────────────────────
export async function createRefund(restaurantId, orderId, type, amount, reason, payMethod, lines, userId) {
  const { count } = await supabase.from('refunds').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
  const refundNumber = `REF-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data: refund, error } = await supabase
    .from('refunds')
    .insert({
      restaurant_id: restaurantId, order_id: orderId,
      refund_number: refundNumber, reason, type,
      amount, payment_method: payMethod,
      status: 'processed', processed_by: userId,
      processed_at: new Date().toISOString(),
      created_by: userId,
    })
    .select().single()
  if (error) throw error

  if (lines?.length > 0) {
    await supabase.from('refund_lines').insert(
      lines.map(l => ({ refund_id: refund.id, order_item_id: l.id, name: l.name, quantity: l.quantity, amount: l.item_total * l.quantity }))
    )
  }

  // Mark order as refunded
  await supabase.from('orders').update({
    is_refunded: true, refund_amount: amount,
  }).eq('id', orderId)

  return refund
}

export async function loadRefunds(restaurantId, limit = 50) {
  const { data, error } = await supabase
    .from('refunds')
    .select('*, orders(order_number), refund_lines(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ─── Sprint 1: FTA invoices, COGS deduction, auto-posting ────

export async function issueInvoiceNumber(restaurantId) {
  const { data: rest } = await supabase
    .from('restaurants')
    .select('next_invoice_number, invoice_prefix')
    .eq('id', restaurantId)
    .single()
  const prefix = rest?.invoice_prefix ?? 'INV'
  const num    = rest?.next_invoice_number ?? 1
  const invoiceNumber = `${prefix}-${String(num).padStart(4, '0')}`
  await supabase.from('restaurants')
    .update({ next_invoice_number: num + 1 })
    .eq('id', restaurantId)
  return invoiceNumber
}

export async function closeOrderWithInvoice(orderId, payMethod, userId, restaurantId) {
  // 1. Issue FTA invoice number
  const invoiceNumber = await issueInvoiceNumber(restaurantId)

  // 2. Update order — close + stamp invoice
  const { error } = await supabase.from('orders').update({
    status:            'paid',
    payment_method:    payMethod,
    closed_by:         userId,
    closed_at:         new Date().toISOString(),
    invoice_number:    invoiceNumber,
    invoice_issued_at: new Date().toISOString(),
  }).eq('id', orderId)
  if (error) throw error

  // 3. Auto-post journal entry
  const { error: rpcErr } = await supabase.rpc('auto_post_pos_sale', {
    p_order_id:      orderId,
    p_restaurant_id: restaurantId,
    p_user_id:       userId,
  })
  if (rpcErr) console.warn('Auto-post failed (non-fatal):', rpcErr.message)

  // 4. Deduct ingredients from stock via recipes
  await deductIngredientsFromOrder(orderId, restaurantId, userId)

  return invoiceNumber
}

async function deductIngredientsFromOrder(orderId, restaurantId, userId) {
  try {
    // Get order items with their menu item IDs
    const { data: items } = await supabase
      .from('order_items')
      .select('item_id, quantity, name')
      .eq('order_id', orderId)
    if (!items?.length) return

    for (const item of items) {
      if (!item.item_id) continue
      // Find recipe linked to this menu item
      const { data: links } = await supabase
        .from('menu_item_recipes')
        .select('recipe_id, portions')
        .eq('menu_item_id', item.item_id)
      if (!links?.length) continue

      for (const link of links) {
        // Get recipe lines
        const { data: lines } = await supabase
          .from('recipe_lines')
          .select('ingredient_id, quantity, unit')
          .eq('recipe_id', link.recipe_id)
          .not('ingredient_id', 'is', null)
        if (!lines?.length) continue

        // Deduct each ingredient
        for (const line of lines) {
          const totalQty = line.quantity * link.portions * item.quantity
          if (totalQty <= 0) continue

          const { data: ing } = await supabase
            .from('ingredients')
            .select('stock_qty, cost_per_unit')
            .eq('id', line.ingredient_id)
            .single()
          if (!ing) continue

          const qtyBefore = parseFloat(ing.stock_qty) || 0
          const qtyAfter  = Math.max(0, qtyBefore - totalQty)

          await supabase.from('ingredients').update({ stock_qty: qtyAfter }).eq('id', line.ingredient_id)
          await supabase.from('stock_movements').insert({
            restaurant_id:  restaurantId,
            ingredient_id:  line.ingredient_id,
            movement_type:  'sale_deduct',
            qty_change:     -totalQty,
            qty_before:     qtyBefore,
            qty_after:      qtyAfter,
            unit_cost:      parseFloat(ing.cost_per_unit) || 0,
            total_cost:     totalQty * (parseFloat(ing.cost_per_unit) || 0),
            reference_id:   orderId,
            reference_type: 'pos_order',
            logged_by:      userId,
          })
        }
      }
    }
  } catch (e) {
    console.warn('Ingredient deduction failed (non-fatal):', e.message)
  }
}

export async function getVATSummary(restaurantId, year, month) {
  // Get all paid orders in period
  const startDate = `${year}-${String(month).padStart(2,'0')}-01`
  const endDate   = new Date(year, month, 0).toISOString().slice(0,10)

  const { data: orders } = await supabase
    .from('orders')
    .select('subtotal, discount, vat_amount, total, payment_method, invoice_number, closed_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'paid')
    .gte('closed_at', startDate)
    .lte('closed_at', endDate + 'T23:59:59')

  if (!orders?.length) return { orders: [], totals: {} }

  const n = v => parseFloat(v) || 0
  const totalRevenue    = orders.reduce((s, o) => s + n(o.subtotal) - n(o.discount), 0)
  const totalVAT        = orders.reduce((s, o) => s + n(o.vat_amount), 0)
  const totalCollection = orders.reduce((s, o) => s + n(o.total), 0)
  const cashSales       = orders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + n(o.total), 0)
  const cardSales       = orders.filter(o => o.payment_method === 'card').reduce((s, o) => s + n(o.total), 0)

  return {
    orders,
    totals: { totalRevenue, totalVAT, totalCollection, cashSales, cardSales, orderCount: orders.length }
  }
}

export async function loadAuditLog(restaurantId, limit = 100) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function writeAuditLog(restaurantId, userId, action, entityType, entityId, details = {}) {
  await supabase.from('audit_log').insert({
    restaurant_id: restaurantId,
    user_id:       userId,
    action,
    entity_type:   entityType,
    entity_id:     entityId,
    details,
  })
}

// ─── Sprint 2: Customers & Loyalty ───────────────────────────

export async function searchCustomers(restaurantId, query) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function loadCustomers(restaurantId, limit = 200) {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('lifetime_spend', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function loadCustomer(customerId) {
  const { data, error } = await supabase
    .from('customers')
    .select('*, loyalty_transactions(*, orders(order_number, total, closed_at))')
    .eq('id', customerId)
    .single()
  if (error) throw error
  return data
}

export async function saveCustomer(restaurantId, customer) {
  const { data, error } = await supabase
    .from('customers')
    .upsert({ ...customer, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error
  return data
}

export async function getOrCreateCustomer(restaurantId, phone, name) {
  // Try find by phone
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('phone', phone)
    .maybeSingle()
  if (existing) return existing
  // Create new
  const { data, error } = await supabase
    .from('customers')
    .insert({ restaurant_id: restaurantId, phone, name: name || phone, source: 'pos' })
    .select().single()
  if (error) throw error
  return data
}

// ── Loyalty settings ──────────────────────────────────────────
export async function loadLoyaltySettings(restaurantId) {
  const { data } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  // Return defaults if not set up
  return data ?? {
    enabled: true, points_per_aed: 1, aed_per_point: 0.10,
    min_redeem: 100, expiry_days: null,
    silver_threshold: 500, gold_threshold: 2000, plat_threshold: 5000,
    silver_mult: 1.5, gold_mult: 2.0, plat_mult: 3.0,
  }
}

export async function saveLoyaltySettings(restaurantId, settings) {
  const { error } = await supabase
    .from('loyalty_settings')
    .upsert({ ...settings, restaurant_id: restaurantId })
  if (error) throw error
}

// ── Loyalty engine ────────────────────────────────────────────
export function calcTier(lifetimeSpend, settings) {
  const s = settings
  if (lifetimeSpend >= (s.plat_threshold ?? 5000))   return 'platinum'
  if (lifetimeSpend >= (s.gold_threshold ?? 2000))   return 'gold'
  if (lifetimeSpend >= (s.silver_threshold ?? 500))  return 'silver'
  return 'bronze'
}

export function calcPointsEarned(amount, tier, settings) {
  if (!settings.enabled) return 0
  const base = Math.floor(amount * (settings.points_per_aed ?? 1))
  const mult = tier === 'platinum' ? (settings.plat_mult ?? 3)
    : tier === 'gold'     ? (settings.gold_mult ?? 2)
    : tier === 'silver'   ? (settings.silver_mult ?? 1.5)
    : 1
  return Math.floor(base * mult)
}

export function calcPointsValue(points, settings) {
  return points * (settings.aed_per_point ?? 0.10)
}

export async function earnPoints(restaurantId, customerId, orderId, orderTotal, userId) {
  const settings = await loadLoyaltySettings(restaurantId)
  if (!settings.enabled) return 0

  const { data: customer } = await supabase.from('customers').select('loyalty_points, tier, lifetime_spend, visit_count').eq('id', customerId).single()
  if (!customer) return 0

  const points      = calcPointsEarned(orderTotal, customer.tier, settings)
  const newBalance  = (customer.loyalty_points ?? 0) + points
  const newSpend    = (parseFloat(customer.lifetime_spend) || 0) + orderTotal
  const newTier     = calcTier(newSpend, settings)

  // Update customer
  await supabase.from('customers').update({
    loyalty_points: newBalance,
    lifetime_spend: newSpend,
    visit_count:    (customer.visit_count ?? 0) + 1,
    last_visit_at:  new Date().toISOString(),
    tier:           newTier,
  }).eq('id', customerId)

  // Log transaction
  if (points > 0) {
    await supabase.from('loyalty_transactions').insert({
      restaurant_id: restaurantId, customer_id: customerId,
      order_id: orderId, type: 'earn', points,
      balance_after: newBalance,
      description: `Earned from order — ${orderTotal.toFixed(2)} AED`,
      created_by: userId,
    })
  }

  // Update order
  await supabase.from('orders').update({ loyalty_earned: points }).eq('id', orderId)

  return points
}

export async function redeemPoints(restaurantId, customerId, pointsToRedeem, orderId, userId) {
  const settings = await loadLoyaltySettings(restaurantId)
  const { data: customer } = await supabase.from('customers').select('loyalty_points').eq('id', customerId).single()
  if (!customer || customer.loyalty_points < pointsToRedeem) throw new Error('Insufficient points')
  if (pointsToRedeem < (settings.min_redeem ?? 100)) throw new Error(`Minimum redemption is ${settings.min_redeem} points`)

  const discount    = calcPointsValue(pointsToRedeem, settings)
  const newBalance  = customer.loyalty_points - pointsToRedeem

  await supabase.from('customers').update({ loyalty_points: newBalance }).eq('id', customerId)
  await supabase.from('loyalty_transactions').insert({
    restaurant_id: restaurantId, customer_id: customerId,
    order_id: orderId, type: 'redeem', points: -pointsToRedeem,
    balance_after: newBalance,
    description: `Redeemed for AED ${discount.toFixed(2)} discount`,
    created_by: userId,
  })
  await supabase.from('orders').update({ loyalty_redeemed: pointsToRedeem, loyalty_discount: discount }).eq('id', orderId)

  return discount
}

export async function adjustPoints(restaurantId, customerId, points, reason, userId) {
  const { data: customer } = await supabase.from('customers').select('loyalty_points').eq('id', customerId).single()
  const newBalance = Math.max(0, (customer?.loyalty_points ?? 0) + points)
  await supabase.from('customers').update({ loyalty_points: newBalance }).eq('id', customerId)
  await supabase.from('loyalty_transactions').insert({
    restaurant_id: restaurantId, customer_id: customerId,
    type: 'adjust', points, balance_after: newBalance,
    description: reason, created_by: userId,
  })
}

export async function loadCustomerOrders(customerId, limit = 20) {
  const { data, error } = await supabase
    .from('orders')
    .select('order_number, total, status, payment_method, closed_at, loyalty_earned, loyalty_redeemed, invoice_number')
    .eq('customer_id', customerId)
    .eq('status', 'paid')
    .order('closed_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ─── Sprint 3: Permissions & Audit ───────────────────────────

export async function loadPOSPermissions(restaurantId) {
  const { data } = await supabase
    .from('pos_permissions')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  // Return safe defaults if not configured
  return data ?? {
    max_discount_cashier:       10,
    max_discount_manager:       100,
    require_override_void:      true,
    require_override_refund:    true,
    require_override_discount:  true,
    require_override_price_edit:false,
    manager_pin:                '0000',
    cashier_can_reopen:         false,
    cashier_can_delete_item:    true,
  }
}

export async function savePOSPermissions(restaurantId, perms) {
  // Check if row exists first to decide insert vs update
  const { data: existing } = await supabase
    .from('pos_permissions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  if (existing?.id) {
    const { id, ...updates } = { ...perms, restaurant_id: restaurantId }
    const { error } = await supabase.from('pos_permissions').update(updates).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('pos_permissions')
      .insert({ ...perms, restaurant_id: restaurantId })
    if (error) throw error
  }
}

export async function verifyManagerPIN(restaurantId, pin) {
  const { data } = await supabase
    .from('pos_permissions')
    .select('manager_pin')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  const correct = data?.manager_pin ?? '0000'
  return pin === correct
}

export async function loadAuditLogFull(restaurantId, filters = {}, limit = 200) {
  let q = supabase
    .from('audit_log')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (filters.action)      q = q.eq('action', filters.action)
  if (filters.entity_type) q = q.eq('entity_type', filters.entity_type)
  if (filters.user_id)     q = q.eq('user_id', filters.user_id)
  if (filters.from)        q = q.gte('created_at', filters.from)
  if (filters.to)          q = q.lte('created_at', filters.to + 'T23:59:59')

  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function writeAuditLogFull(restaurantId, userId, userName, action, entityType, entityId, details = {}, overrideBy = null, overrideName = null) {
  await supabase.from('audit_log').insert({
    restaurant_id: restaurantId,
    user_id:       userId,
    user_name:     userName,
    action,
    entity_type:   entityType,
    entity_id:     entityId,
    details,
    override_by:   overrideBy,
    override_name: overrideName,
  })
}

// ── Price history for ingredient across past POs ─────────────
export async function loadIngredientPriceHistory(restaurantId, ingredientId, limit = 5) {
  const { data } = await supabase
    .from('po_lines')
    .select('unit_cost, unit, created_at, purchase_orders!inner(restaurant_id, status, suppliers(name), created_at)')
    .eq('ingredient_id', ingredientId)
    .eq('purchase_orders.restaurant_id', restaurantId)
    .in('purchase_orders.status', ['confirmed', 'received', 'partial'])
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map(r => ({
    unit_cost:     r.unit_cost,
    unit:          r.unit,
    date:          r.purchase_orders?.created_at,
    supplier_name: r.purchase_orders?.suppliers?.name ?? '—',
  }))
}

// ─── Contacts ─────────────────────────────────────────────────

export async function loadContacts(restaurantId, type = null) {
  let q = supabase.from('contacts').select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('name')
  if (type) q = q.eq('type', type)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function searchContacts(restaurantId, query, type = null) {
  let q = supabase.from('contacts').select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
    .order('name').limit(20)
  if (type) q = q.eq('type', type)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function saveContact(restaurantId, contact) {
  // Sanitize numeric fields — empty string -> null to avoid postgres type errors
  const clean = { ...contact, restaurant_id: restaurantId }
  const numericFields = ['credit_limit','payment_terms','opening_balance','loyalty_points','lifetime_spend','visit_count']
  for (const f of numericFields) {
    if (clean[f] === '' || clean[f] === undefined) clean[f] = null
    else if (clean[f] !== null) clean[f] = parseFloat(clean[f]) || null
  }
  // Use explicit insert vs update — upsert can fail RLS checks
  if (clean.id) {
    const { id, ...updates } = clean
    const { data, error } = await supabase.from('contacts')
      .update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
  } else {
    const { id, ...insert } = clean
    const { data, error } = await supabase.from('contacts')
      .insert(insert).select().single()
    if (error) throw error
    return data
  }
}

export async function loadContact(id) {
  const { data, error } = await supabase.from('contacts')
    .select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function deleteContact(id) {
  const { error } = await supabase.from('contacts')
    .update({ active: false }).eq('id', id)
  if (error) throw error
}

// ── Partner Ledger ────────────────────────────────────────────

export async function loadPartnerLedger(contactId, limit = 100) {
  const { data, error } = await supabase.from('partner_ledger')
    .select('*')
    .eq('contact_id', contactId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function addLedgerEntry(restaurantId, contactId, entry) {
  // Calculate running balance
  const { data: prev } = await supabase.from('partner_ledger')
    .select('balance').eq('contact_id', contactId)
    .order('date', { ascending: false }).order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  const prevBalance = parseFloat(prev?.balance) || 0
  const newBalance  = prevBalance + (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0)
  const { data, error } = await supabase.from('partner_ledger').insert({
    ...entry, restaurant_id: restaurantId, contact_id: contactId, balance: newBalance,
  }).select().single()
  if (error) throw error
  return data
}

export async function getContactBalance(contactId) {
  const { data } = await supabase.from('partner_ledger')
    .select('balance').eq('contact_id', contactId)
    .order('date', { ascending: false }).order('created_at', { ascending: false })
    .limit(1).maybeSingle()
  return parseFloat(data?.balance) || 0
}

export async function loadContactOrders(contactId, limit = 30) {
  const { data } = await supabase.from('orders')
    .select('id, order_number, total, status, payment_method, closed_at, invoice_number, loyalty_earned')
    .eq('contact_id', contactId).eq('status', 'paid')
    .order('closed_at', { ascending: false }).limit(limit)
  return data ?? []
}

export async function loadContactPurchases(contactId, limit = 30) {
  const { data } = await supabase.from('purchase_orders')
    .select('id, po_number, total, status, created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false }).limit(limit)
  return data ?? []
}

// ── Import existing customers into contacts ───────────────────
export async function migrateCustomersToContacts(restaurantId) {
  const { data: custs } = await supabase.from('customers')
    .select('*').eq('restaurant_id', restaurantId)
  if (!custs?.length) return 0
  for (const c of custs) {
    await supabase.from('contacts').upsert({
      restaurant_id: restaurantId, type: 'customer',
      name: c.name, phone: c.phone, email: c.email,
      birthday: c.birthday, gender: c.gender, notes: c.notes,
      tags: c.tags, loyalty_points: c.loyalty_points,
      lifetime_spend: c.lifetime_spend, visit_count: c.visit_count,
      last_visit_at: c.last_visit_at, tier: c.tier, source: c.source,
    }, { onConflict: 'restaurant_id,phone', ignoreDuplicates: true })
  }
  return custs.length
}

// ─── Import helpers ───────────────────────────────────────────

export async function bulkUpsertContacts(restaurantId, rows) {
  if (!rows.length) return { inserted: 0, errors: [] }
  const clean = rows.map(r => ({ ...r, restaurant_id: restaurantId }))
  const { data, error } = await supabase.from('contacts').upsert(clean, { onConflict: 'restaurant_id,phone', ignoreDuplicates: false }).select()
  if (error) throw error
  return { inserted: data?.length ?? 0, errors: [] }
}

export async function bulkUpsertMenuItems(restaurantId, rows) {
  if (!rows.length) return { inserted: 0, errors: [] }
  const errors = []
  let inserted = 0
  for (const row of rows) {
    try {
      // Find or create category
      let catId = row.category_id
      if (!catId && row.category_name) {
        const { data: cat } = await supabase.from('menu_categories')
          .select('id').eq('restaurant_id', restaurantId).eq('name', row.category_name).maybeSingle()
        if (cat) { catId = cat.id }
        else {
          const { data: newCat } = await supabase.from('menu_categories')
            .insert({ restaurant_id: restaurantId, name: row.category_name, icon: '🍽', color: '#0D7377' })
            .select().single()
          catId = newCat?.id
        }
      }
      if (!catId) { errors.push({ row, error: 'No category found' }); continue }
      await supabase.from('menu_items').upsert({
        restaurant_id: restaurantId, category_id: catId,
        name: row.name, description: row.description,
        price: parseFloat(row.price) || 0, cost: parseFloat(row.cost) || 0,
        sku: row.sku || null, barcode: row.barcode || null,
        available: row.available !== false, tags: row.tags || [],
      }, { onConflict: 'restaurant_id,sku', ignoreDuplicates: false })
      inserted++
    } catch (e) { errors.push({ row, error: e.message }) }
  }
  return { inserted, errors }
}

export async function bulkUpsertIngredients(restaurantId, rows) {
  if (!rows.length) return { inserted: 0, errors: [] }
  const errors = []
  let inserted = 0
  for (const row of rows) {
    try {
      await supabase.from('ingredients').upsert({
        restaurant_id: restaurantId,
        name: row.name, unit: row.unit || 'kg',
        stock_qty: parseFloat(row.stock_qty) || 0,
        min_stock: parseFloat(row.min_stock) || 0,
        cost_per_unit: parseFloat(row.cost_per_unit) || 0,
        supplier: row.supplier || null,
      }, { onConflict: 'restaurant_id,name', ignoreDuplicates: false })
      inserted++
    } catch (e) { errors.push({ row, error: e.message }) }
  }
  return { inserted, errors }
}

export async function bulkImportOpeningBalance(restaurantId, rows, userId) {
  // Creates a single journal entry with all Dr/Cr lines
  if (!rows.length) return { inserted: 0, errors: [] }
  try {
    const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    const entryNumber = 'JE-OB-' + String((count ?? 0) + 1).padStart(4, '0')
    const { data: entry } = await supabase.from('journal_entries').insert({
      restaurant_id: restaurantId, entry_number: entryNumber,
      entry_date: rows[0]?.date || new Date().toISOString().slice(0,10),
      description: rows[0]?.reference || 'Opening Balance',
      source: 'import', posted: true, created_by: userId,
    }).select().single()
    if (!entry) throw new Error('Failed to create journal entry')
    let sort = 1
    for (const row of rows) {
      // Find account by name or code
      const { data: acc } = await supabase.from('accounts')
        .select('id').eq('restaurant_id', restaurantId)
        .or(`name.eq.${row.account_name},code.eq.${row.account_code}`)
        .maybeSingle()
      await supabase.from('journal_lines').insert({
        entry_id: entry.id, account_id: acc?.id || null,
        description: row.account_name,
        debit: parseFloat(row.debit) || 0,
        credit: parseFloat(row.credit) || 0,
        sort_order: sort++,
      })
    }
    return { inserted: rows.length, errors: [] }
  } catch (e) { return { inserted: 0, errors: [{ error: e.message }] } }
}

export async function bulkImportBankStatement(restaurantId, rows, userId) {
  const errors = []
  let inserted = 0
  for (const row of rows) {
    try {
      const amt = parseFloat(row.amount) || 0
      const { count } = await supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
      const entryNumber = 'JE-BS-' + String((count ?? 0) + 1).padStart(5, '0')
      await supabase.from('journal_entries').insert({
        restaurant_id: restaurantId, entry_number: entryNumber,
        entry_date: row.date?.toString().slice(0,10) || new Date().toISOString().slice(0,10),
        description: row.label || 'Bank statement line',
        source: 'bank_import', posted: true, created_by: userId,
      })
      inserted++
    } catch (e) { errors.push({ row, error: e.message }) }
  }
  return { inserted, errors }
}

export async function bulkImportStockMovements(restaurantId, rows, type, userId) {
  const errors = []
  let inserted = 0
  for (const row of rows) {
    try {
      const { data: ing } = await supabase.from('ingredients').select('id, stock_qty, cost_per_unit')
        .eq('restaurant_id', restaurantId).ilike('name', row.product_name || '').maybeSingle()
      const qty     = parseFloat(row.quantity) || 0
      const cost    = parseFloat(row.cost) || (ing?.cost_per_unit ?? 0)
      const before  = parseFloat(ing?.stock_qty) || 0
      const after   = type === 'scrap' ? Math.max(0, before - qty) : before + qty
      if (ing) {
        await supabase.from('ingredients').update({ stock_qty: after }).eq('id', ing.id)
        await supabase.from('stock_movements').insert({
          restaurant_id: restaurantId, ingredient_id: ing.id,
          movement_type: type, qty_change: type === 'scrap' ? -qty : qty,
          qty_before: before, qty_after: after,
          unit_cost: cost, total_cost: qty * cost,
          reference_type: 'import', logged_by: userId,
        })
      }
      inserted++
    } catch (e) { errors.push({ row, error: e.message }) }
  }
  return { inserted, errors }
}

export async function bulkImportPurchaseOrders(restaurantId, rows, userId) {
  const errors = []
  let inserted = 0
  // Group by order reference
  const groups = {}
  for (const row of rows) {
    const ref = row.ref || row.po_number || 'IMPORT-' + Date.now()
    if (!groups[ref]) groups[ref] = { ...row, lines: [] }
    groups[ref].lines.push(row)
  }
  for (const [ref, order] of Object.entries(groups)) {
    try {
      const total = order.lines.reduce((s, l) => s + (parseFloat(l.quantity)||0) * (parseFloat(l.unit_price)||0), 0)
      const { data: po } = await supabase.from('purchase_orders').insert({
        restaurant_id: restaurantId, po_number: ref,
        supplier_name: order.supplier || order.vendor || 'Unknown',
        status: 'confirmed', total, created_by: userId,
      }).select().single()
      if (po) {
        for (const line of order.lines) {
          await supabase.from('po_lines').insert({
            po_id: po.id, ingredient_id: null,
            ingredient_name: line.product, unit: line.uom || 'Units',
            quantity: parseFloat(line.quantity) || 0,
            unit_cost: parseFloat(line.unit_price) || 0,
            total_cost: (parseFloat(line.quantity)||0) * (parseFloat(line.unit_price)||0),
          })
        }
        inserted++
      }
    } catch (e) { errors.push({ row: order, error: e.message }) }
  }
  return { inserted, errors }
}

export async function bulkUpsertChartOfAccounts(restaurantId, rows) {
  const errors = []
  let inserted = 0
  for (const row of rows) {
    try {
      await supabase.from('accounts').upsert({
        restaurant_id: restaurantId,
        code: String(row.code || ''), name: row.name,
        account_type: row.account_type || 'expense',
        allow_reconciliation: row.reconcile === true || row.reconcile === 'TRUE',
      }, { onConflict: 'restaurant_id,code', ignoreDuplicates: false })
      inserted++
    } catch (e) { errors.push({ row, error: e.message }) }
  }
  return { inserted, errors }
}

// ─── Invoice / Bill import ────────────────────────────────────

export async function bulkImportInvoices(restaurantId, rows, type, userId) {
  // type = 'invoice' (customer) | 'bill' (supplier)
  // Rows may be multi-line: header fields only on first row of each invoice
  // OR single-line where every row is a complete invoice
  const errors = []
  let inserted = 0

  // Determine if this is multi-line format (some rows lack partner/date)
  // or single-line format (every row has partner+date)
  const allHavePartner = rows.every(r => r.partner || r.partner_name)
  
  const groups = []
  if (allHavePartner) {
    // Single-line: group by partner+date+number combination
    const seen = {}
    for (const row of rows) {
      const key = `${row.partner||row.partner_name}|${row.invoice_date||row.date}|${row.number||''}`
      if (!seen[key]) {
        seen[key] = { ...row, lines: [] }
        groups.push(seen[key])
      }
      const g = seen[key]
      if (row.product || row.product_name) {
        g.lines.push({
          product:    row.product || row.product_name || '',
          account:    row.account || row.account_ref || '',
          quantity:   parseFloat(row.quantity)   || 1,
          unit_price: parseFloat(row.unit_price) || parseFloat(row.price) || 0,
          uom:        row.uom || row.unit || 'Units',
        })
      }
    }
  } else {
    // Multi-line: new invoice starts when partner or date is present
    let current = null
    for (const row of rows) {
      const hasHeader = row.partner || row.partner_name || row.due_date || row.invoice_date || row.date || row.number
      if (hasHeader && (row.partner || row.partner_name)) {
        if (current) groups.push(current)
        current = { ...row, lines: [] }
      }
      if (current && (row.product || row.product_name || row.account)) {
        current.lines.push({
          product:    row.product || row.product_name || '',
          account:    row.account || row.account_ref || '',
          quantity:   parseFloat(row.quantity)   || 1,
          unit_price: parseFloat(row.unit_price) || parseFloat(row.price) || 0,
          uom:        row.uom || row.unit || 'Units',
        })
      }
    }
    if (current) groups.push(current)
  }

  for (const inv of groups) {
    if (!inv.lines?.length) continue
    try {
      // Generate invoice/bill number
      const number = inv.number || await generateInvoiceNumber(restaurantId, type)
      const subtotal   = inv.lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)
      const vat_amount = subtotal * 0.05
      const total      = subtotal + vat_amount

      // Find or create contact
      let contactId = null
      if (inv.partner) {
        const { data: contact } = await supabase.from('contacts')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .ilike('name', inv.partner)
          .maybeSingle()
        contactId = contact?.id ?? null
      }

      const { data: invoice, error } = await supabase.from('invoices').insert({
        restaurant_id: restaurantId,
        type,
        number,
        contact_id:    contactId,
        partner_name:  inv.partner || inv.partner_name || inv['Invoice Partner Display Name'] || 'Unknown',
        invoice_date:  formatDate(inv.invoice_date || inv['Invoice/Bill Date'] || inv.date) || new Date().toISOString().slice(0, 10),
        due_date:      formatDate(inv.due_date || inv['Due Date']) || null,
        subtotal,
        vat_amount,
        total,
        status:        'draft',
        created_by:    userId,
      }).select().single()

      if (error) throw new Error(error.message)

      // Insert lines
      for (const line of inv.lines) {
        await supabase.from('invoice_lines').insert({
          invoice_id:  invoice.id,
          product_name: line.product,
          account_ref:  line.account,
          quantity:     line.quantity,
          unit_price:   line.unit_price,
          subtotal:     line.quantity * line.unit_price,
          uom:          line.uom,
        })
      }

      // Add to partner ledger if contact exists
      if (contactId) {
        await supabase.from('partner_ledger').insert({
          restaurant_id: restaurantId,
          contact_id:    contactId,
          date:          formatDate(inv.invoice_date || inv.date) || new Date().toISOString().slice(0, 10),
          type:          type === 'invoice' ? 'invoice' : 'bill',
          reference:     number,
          description:   `${type === 'invoice' ? 'Invoice' : 'Bill'} — ${inv.partner}`,
          debit:         type === 'invoice' ? total : 0,
          credit:        type === 'bill'    ? total : 0,
          source_type:   'import',
          source_id:     invoice.id,
          created_by:    userId,
        })
      }

      inserted++
    } catch (e) {
      errors.push({ row: inv, error: e.message })
    }
  }

  return { inserted, errors }
}

async function generateInvoiceNumber(restaurantId, type) {
  const prefix = type === 'invoice' ? 'INV' : 'BILL'
  const year   = new Date().getFullYear()
  // Count existing invoices of this type for this restaurant to get next sequence
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('type', type)
  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `${prefix}/${year}/${seq}`
}

function formatDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10)
  // Excel serial number
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  return String(val).slice(0, 10)
}

// ─── Multi-branch / Multi-company ────────────────────────────

// ── Company groups ────────────────────────────────────────────
export async function loadCompanyGroups(userId) {
  const { data, error } = await supabase
    .from('company_groups')
    .select('*, restaurants(*)')
    .eq('owner_id', userId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function saveCompanyGroup(userId, group) {
  const { data, error } = await supabase
    .from('company_groups')
    .upsert({ ...group, owner_id: userId })
    .select().single()
  if (error) throw error
  return data
}

export async function linkRestaurantToGroup(restaurantId, groupId, isHQ = false) {
  const { error } = await supabase.from('restaurants')
    .update({ company_group_id: groupId, is_headquarters: isHQ })
    .eq('id', restaurantId)
  if (error) throw error
}

// ── Branches ──────────────────────────────────────────────────
export async function loadBranches(restaurantId) {
  const { data, error } = await supabase
    .from('branches')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('is_main', { ascending: false })
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function saveBranch(restaurantId, branch) {
  const { data, error } = await supabase
    .from('branches')
    .upsert({ ...branch, restaurant_id: restaurantId })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteBranch(id) {
  const { error } = await supabase.from('branches').update({ active: false }).eq('id', id)
  if (error) throw error
}

// ── Branch inventory (ingredients scoped to branch) ───────────
export async function loadBranchIngredients(restaurantId, branchId) {
  let q = supabase.from('ingredients').select('*').eq('restaurant_id', restaurantId)
  if (branchId) q = q.eq('branch_id', branchId)
  else          q = q.is('branch_id', null)    // main/unscoped
  const { data, error } = await q.order('name')
  if (error) throw error
  return data ?? []
}

// ── Branch transfers ──────────────────────────────────────────
export async function loadBranchTransfers(restaurantId, branchId = null) {
  let q = supabase
    .from('branch_transfers')
    .select('*, branch_transfer_lines(*), from_branch:branches!from_branch_id(name), to_branch:branches!to_branch_id(name)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
  if (branchId) q = q.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createBranchTransfer(restaurantId, fromBranchId, toBranchId, lines, notes, userId) {
  const { count } = await supabase.from('branch_transfers')
    .select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
  const transferNumber = 'TRF-' + String((count ?? 0) + 1).padStart(4, '0')

  const { data: transfer, error } = await supabase.from('branch_transfers').insert({
    restaurant_id: restaurantId, transfer_number: transferNumber,
    from_branch_id: fromBranchId, to_branch_id: toBranchId,
    status: 'draft', notes, requested_by: userId,
  }).select().single()
  if (error) throw error

  for (const line of lines) {
    await supabase.from('branch_transfer_lines').insert({
      transfer_id:    transfer.id,
      ingredient_id:  line.ingredient_id || null,
      ingredient_name:line.ingredient_name,
      quantity_sent:  parseFloat(line.quantity_sent) || 0,
      unit:           line.unit,
      cost_per_unit:  parseFloat(line.cost_per_unit) || 0,
    })
  }
  return transfer
}

export async function sendBranchTransfer(transferId, userId) {
  const { error } = await supabase.from('branch_transfers').update({
    status: 'sent', sent_at: new Date().toISOString()
  }).eq('id', transferId)
  if (error) throw error
}

export async function receiveBranchTransfer(transferId, lines, userId) {
  // Update line received quantities then deduct from source, add to destination
  const { data: transfer } = await supabase.from('branch_transfers')
    .select('*, branch_transfer_lines(*)')
    .eq('id', transferId).single()
  if (!transfer) return

  for (const line of lines) {
    const received = parseFloat(line.quantity_received) || 0
    await supabase.from('branch_transfer_lines').update({ quantity_received: received }).eq('id', line.id)

    if (line.ingredient_id) {
      // Deduct from source branch
      const { data: srcIng } = await supabase.from('ingredients').select('stock_qty')
        .eq('id', line.ingredient_id).eq('branch_id', transfer.from_branch_id).maybeSingle()
      if (srcIng) {
        await supabase.from('ingredients').update({ stock_qty: Math.max(0, (srcIng.stock_qty ?? 0) - line.quantity_sent) })
          .eq('id', line.ingredient_id).eq('branch_id', transfer.from_branch_id)
      }
      // Add to destination branch (upsert branch-scoped copy)
      const { data: dstIng } = await supabase.from('ingredients').select('id, stock_qty')
        .eq('restaurant_id', transfer.restaurant_id)
        .eq('branch_id', transfer.to_branch_id)
        .eq('id', line.ingredient_id).maybeSingle()
      if (dstIng) {
        await supabase.from('ingredients').update({ stock_qty: (dstIng.stock_qty ?? 0) + received })
          .eq('id', line.ingredient_id).eq('branch_id', transfer.to_branch_id)
      }
    }
  }

  await supabase.from('branch_transfers').update({
    status: 'received', received_at: new Date().toISOString(), approved_by: userId
  }).eq('id', transferId)
}

export async function getBranchInventorySummary(restaurantId) {
  const { data: branches } = await supabase.from('branches')
    .select('id, name').eq('restaurant_id', restaurantId).eq('active', true)
  if (!branches?.length) return []

  const result = []
  for (const branch of branches) {
    const { data: ings } = await supabase.from('ingredients')
      .select('id, name, stock_qty, min_stock, unit, cost_per_unit')
      .eq('restaurant_id', restaurantId).eq('branch_id', branch.id)
    const totalValue   = (ings ?? []).reduce((s, i) => s + (i.stock_qty || 0) * (i.cost_per_unit || 0), 0)
    const lowStockCnt  = (ings ?? []).filter(i => (i.stock_qty || 0) <= (i.min_stock || 0)).length
    result.push({ ...branch, ingredient_count: ings?.length ?? 0, total_value: totalValue, low_stock: lowStockCnt })
  }
  return result
}

// ── Company-level consolidated reporting ──────────────────────
export async function loadGroupCompanies(groupId) {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('company_group_id', groupId)
    .order('is_headquarters', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ─── Invoices & Bills UI helpers ─────────────────────────────

export async function loadInvoices(restaurantId, type = 'invoice', filters = {}) {
  let q = supabase
    .from('invoices')
    .select('*, invoice_lines(*), contacts(name, phone, email, trn)')
    .eq('restaurant_id', restaurantId)
    .eq('type', type)
    .order('invoice_date', { ascending: false })
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.contact_id) q = q.eq('contact_id', filters.contact_id)
  if (filters.from)   q = q.gte('invoice_date', filters.from)
  if (filters.to)     q = q.lte('invoice_date', filters.to)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function saveInvoice(restaurantId, invoice, lines, userId) {
  const isNew = !invoice.id
  // Calculate totals from lines
  const subtotal   = lines.reduce((s, l) => s + (parseFloat(l.quantity)||0) * (parseFloat(l.unit_price)||0), 0)
  const vat_amount = subtotal * 0.05
  const total      = subtotal + vat_amount

  // Generate number if new
  let number = invoice.number
  if (isNew && !number) {
    number = await generateInvoiceNumber(restaurantId, invoice.type)
  }

  const payload = { ...invoice, restaurant_id: restaurantId, number, subtotal, vat_amount, total, created_by: userId }
  let saved
  if (isNew) {
    const { data, error } = await supabase.from('invoices').insert(payload).select().single()
    if (error) throw error
    saved = data
  } else {
    const { data, error } = await supabase.from('invoices').update(payload).eq('id', invoice.id).select().single()
    if (error) throw error
    saved = data
  }

  // Replace lines
  if (saved) {
    await supabase.from('invoice_lines').delete().eq('invoice_id', saved.id)
    if (lines.length) {
      await supabase.from('invoice_lines').insert(lines.map(l => ({
        invoice_id:   saved.id,
        product_name: l.product_name || l.product || '',
        account_ref:  l.account_ref  || l.account  || '',
        quantity:     parseFloat(l.quantity)   || 1,
        unit_price:   parseFloat(l.unit_price) || 0,
        subtotal:     (parseFloat(l.quantity)||1) * (parseFloat(l.unit_price)||0),
        uom:          l.uom || 'Units',
        notes:        l.notes || null,
      })))
    }
  }
  return saved
}

export async function postInvoice(invoiceId, restaurantId, userId) {
  // Mark as posted and auto-create journal entry
  const { data: inv, error } = await supabase.from('invoices')
    .update({ status: 'posted' }).eq('id', invoiceId).select('*, invoice_lines(*)').single()
  if (error) throw error

  // Auto-post journal entry
  const isInvoice = inv.type === 'invoice'
  const { count } = await supabase.from('journal_entries')
    .select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
  const entryNumber = `JE-${isInvoice ? 'INV' : 'BILL'}-${String((count ?? 0) + 1).padStart(5, '0')}`

  const { data: entry } = await supabase.from('journal_entries').insert({
    restaurant_id: restaurantId, entry_number: entryNumber,
    entry_date: inv.invoice_date || new Date().toISOString().slice(0,10),
    description: `${isInvoice ? 'Customer Invoice' : 'Supplier Bill'} — ${inv.number} · ${inv.partner_name}`,
    source: isInvoice ? 'customer_invoice' : 'supplier_bill',
    reference_id: invoiceId, posted: true, created_by: userId,
  }).select().single()

  if (entry) {
    // Dr Accounts Receivable / Cr Revenue (invoice)  OR  Dr Expense / Cr Accounts Payable (bill)
    const receivable = await supabase.from('accounts').select('id')
      .eq('restaurant_id', restaurantId)
      .ilike('name', isInvoice ? '%receivable%' : '%payable%').limit(1).maybeSingle()
    const revenue = await supabase.from('accounts').select('id')
      .eq('restaurant_id', restaurantId)
      .ilike('code', isInvoice ? '4%' : '5%').limit(1).maybeSingle()
    const vat = await supabase.from('accounts').select('id')
      .eq('restaurant_id', restaurantId).ilike('name', '%vat%').limit(1).maybeSingle()

    const lines = [
      { account_id: receivable?.data?.id || null, description: inv.partner_name,
        debit: isInvoice ? inv.total : 0, credit: isInvoice ? 0 : inv.total, sort_order: 1 },
      { account_id: revenue?.data?.id || null, description: 'Revenue / Expense',
        debit: isInvoice ? 0 : inv.subtotal, credit: isInvoice ? inv.subtotal : 0, sort_order: 2 },
    ]
    if (vat?.data?.id && inv.vat_amount > 0) {
      lines.push({ account_id: vat.data.id, description: 'VAT 5%',
        debit: isInvoice ? 0 : inv.vat_amount, credit: isInvoice ? inv.vat_amount : 0, sort_order: 3 })
    }
    await supabase.from('journal_lines').insert(lines.map(l => ({ ...l, entry_id: entry.id })))
  }

  // Update partner ledger
  if (inv.contact_id) {
    const existing = await supabase.from('partner_ledger')
      .select('id').eq('source_id', invoiceId).maybeSingle()
    if (!existing.data) {
      await supabase.from('partner_ledger').insert({
        restaurant_id: restaurantId, contact_id: inv.contact_id,
        date: inv.invoice_date || new Date().toISOString().slice(0,10),
        type: isInvoice ? 'invoice' : 'bill',
        reference: inv.number, description: `${inv.partner_name} — ${inv.number}`,
        debit:  isInvoice ? inv.total : 0,
        credit: isInvoice ? 0 : inv.total,
        source_type: isInvoice ? 'customer_invoice' : 'supplier_bill',
        source_id: invoiceId,
      })
    }
  }
  return inv
}

export async function markInvoicePaid(invoiceId, restaurantId, paymentMethod, userId) {
  const { data: inv } = await supabase.from('invoices').select('*')
    .eq('id', invoiceId).single()
  if (!inv) throw new Error('Invoice not found')
  await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId)

  // Update partner ledger with payment
  if (inv.contact_id) {
    await supabase.from('partner_ledger').insert({
      restaurant_id: restaurantId, contact_id: inv.contact_id,
      date: new Date().toISOString().slice(0,10),
      type: 'payment', reference: `PMT-${inv.number}`,
      description: `Payment for ${inv.number} via ${paymentMethod}`,
      debit:  inv.type === 'invoice' ? 0 : inv.total,
      credit: inv.type === 'invoice' ? inv.total : 0,
      source_type: 'payment', source_id: invoiceId,
    })
  }
}

export async function cancelInvoice(invoiceId) {
  const { error } = await supabase.from('invoices')
    .update({ status: 'cancelled' }).eq('id', invoiceId)
  if (error) throw error
}

export async function getInvoiceSummary(restaurantId, type = 'invoice') {
  const { data } = await supabase.from('invoices')
    .select('status, total')
    .eq('restaurant_id', restaurantId).eq('type', type)
  if (!data) return {}
  const n = v => parseFloat(v) || 0
  return {
    draft:     { count: data.filter(i=>i.status==='draft').length,     total: data.filter(i=>i.status==='draft').reduce((s,i)=>s+n(i.total),0) },
    posted:    { count: data.filter(i=>i.status==='posted').length,    total: data.filter(i=>i.status==='posted').reduce((s,i)=>s+n(i.total),0) },
    paid:      { count: data.filter(i=>i.status==='paid').length,      total: data.filter(i=>i.status==='paid').reduce((s,i)=>s+n(i.total),0) },
    overdue:   { count: data.filter(i=>i.status==='posted' && i.due_date && new Date(i.due_date) < new Date()).length,
                 total: data.filter(i=>i.status==='posted' && i.due_date && new Date(i.due_date) < new Date()).reduce((s,i)=>s+n(i.total),0) },
  }
}


// ── Debug: test RLS and table existence ──────────────────────
export async function debugTableAccess(restaurantId) {
  const results = {}
  
  // Test contacts table exists and is accessible
  const { data: c, error: ce } = await supabase
    .from('contacts').select('count', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  results.contacts = ce ? 'ERROR: ' + ce.message : 'OK (count query works)'
  
  // Test insert permission with a dry-run approach
  const { data: ci, error: cie } = await supabase
    .from('contacts')
    .insert({ restaurant_id: restaurantId, name: '__test__', type: 'customer' })
    .select().single()
  if (cie) {
    results.contacts_insert = 'INSERT ERROR: ' + cie.message + ' | code: ' + cie.code
  } else {
    results.contacts_insert = 'INSERT OK — id: ' + ci?.id
    // Clean up test row
    if (ci?.id) await supabase.from('contacts').delete().eq('id', ci.id)
  }
  
  // Test branches
  const { data: b, error: be } = await supabase
    .from('branches').select('count', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
  results.branches = be ? 'ERROR: ' + be.message : 'OK'
  
  return results
}

// ─── Cross-module connection helpers ─────────────────────────

// PO Receipt → Auto-post journal entry (Purchase → Accounting)
export async function autoPostPurchaseReceipt(poId, restaurantId, userId) {
  try {
    const { data: po } = await supabase.from('purchase_orders')
      .select('*, po_lines(*)').eq('id', poId).single()
    if (!po) return null

    const total    = po.po_lines?.reduce((s,l) => s + (l.total_cost||0), 0) ?? 0
    if (total <= 0) return null

    const { count } = await supabase.from('journal_entries')
      .select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    const entryNumber = 'JE-PO-' + String((count ?? 0) + 1).padStart(5, '0')

    const { data: entry } = await supabase.from('journal_entries').insert({
      restaurant_id: restaurantId, entry_number: entryNumber,
      entry_date: new Date().toISOString().slice(0, 10),
      description: `Purchase Receipt — ${po.po_number} · ${po.supplier_name}`,
      source: 'purchase_receipt', reference_id: poId, posted: true, created_by: userId,
    }).select().single()

    if (entry) {
      const invAcc = await supabase.from('accounts').select('id').eq('restaurant_id', restaurantId).ilike('code', '12%').limit(1).maybeSingle()
      const payAcc = await supabase.from('accounts').select('id').eq('restaurant_id', restaurantId).ilike('name', '%payable%').limit(1).maybeSingle()
      await supabase.from('journal_lines').insert([
        { entry_id: entry.id, account_id: invAcc?.data?.id || null, description: 'Inventory received', debit: total, credit: 0, sort_order: 1 },
        { entry_id: entry.id, account_id: payAcc?.data?.id || null, description: po.supplier_name, debit: 0, credit: total, sort_order: 2 },
      ])
    }
    return entry
  } catch (e) { console.warn('PO auto-post failed:', e.message); return null }
}

// Expense → Auto-post journal entry
export async function autoPostExpense(expense, restaurantId, userId) {
  try {
    const amt = parseFloat(expense.amount) || 0
    if (amt <= 0) return null

    const { count } = await supabase.from('journal_entries')
      .select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
    const entryNumber = 'JE-EXP-' + String((count ?? 0) + 1).padStart(5, '0')

    const { data: entry } = await supabase.from('journal_entries').insert({
      restaurant_id: restaurantId, entry_number: entryNumber,
      entry_date: expense.date || new Date().toISOString().slice(0,10),
      description: `Expense — ${expense.description || expense.category}`,
      source: 'expense', posted: true, created_by: userId,
    }).select().single()

    if (entry) {
      const expAcc  = await supabase.from('accounts').select('id').eq('restaurant_id', restaurantId).ilike('code', '4%').limit(1).maybeSingle()
      const cashAcc = await supabase.from('accounts').select('id').eq('restaurant_id', restaurantId).eq('code', '1010').maybeSingle()
      await supabase.from('journal_lines').insert([
        { entry_id: entry.id, account_id: expAcc?.data?.id || null, description: expense.description || expense.category, debit: amt, credit: 0, sort_order: 1 },
        { entry_id: entry.id, account_id: cashAcc?.data?.id || null, description: 'Cash/Bank payment', debit: 0, credit: amt, sort_order: 2 },
      ])
    }
    return entry
  } catch (e) { console.warn('Expense auto-post failed:', e.message); return null }
}

// Dashboard smart data — all modules in one call
export async function loadDashboardData(restaurantId) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const [
      orders, openInvoices, overdueInvoices,
      lowStock, pendingPOs, openTransfers,
      openShifts, recentExpenses,
    ] = await Promise.all([
      supabase.from('orders').select('id, total, status').eq('restaurant_id', restaurantId).in('status', ['open','sent','ready']),
      supabase.from('invoices').select('id, total, type').eq('restaurant_id', restaurantId).eq('status', 'posted'),
      supabase.from('invoices').select('id, total, type, due_date').eq('restaurant_id', restaurantId).eq('status', 'posted').lt('due_date', today),
      supabase.from('ingredients').select('id, name, stock_qty, min_stock').eq('restaurant_id', restaurantId).filter('stock_qty', 'lte', supabase.rpc ? 0 : 0),
      supabase.from('purchase_orders').select('id').eq('restaurant_id', restaurantId).eq('status', 'confirmed'),
      supabase.from('branch_transfers').select('id').eq('restaurant_id', restaurantId).eq('status', 'sent'),
      supabase.from('cashier_shifts').select('id').eq('restaurant_id', restaurantId).eq('status', 'open'),
      supabase.from('expenses').select('id, amount, category').eq('restaurant_id', restaurantId).gte('created_at', today).limit(5),
    ])

    // Low stock — need to compare properly
    const { data: allStock } = await supabase.from('ingredients').select('id, name, stock_qty, min_stock').eq('restaurant_id', restaurantId)
    const lowStockItems = (allStock ?? []).filter(i => (i.stock_qty ?? 0) <= (i.min_stock ?? 0) && (i.min_stock ?? 0) > 0)

    return {
      openOrders:       orders.data?.length ?? 0,
      openInvoicesAED:  (openInvoices.data ?? []).filter(i=>i.type==='invoice').reduce((s,i) => s + (i.total||0), 0),
      openBillsAED:     (openInvoices.data ?? []).filter(i=>i.type==='bill').reduce((s,i) => s + (i.total||0), 0),
      overdueCount:     overdueInvoices.data?.length ?? 0,
      overdueAED:       (overdueInvoices.data ?? []).reduce((s,i) => s + (i.total||0), 0),
      lowStockCount:    lowStockItems.length,
      lowStockItems:    lowStockItems.slice(0, 5),
      pendingPOs:       pendingPOs.data?.length ?? 0,
      openTransfers:    openTransfers.data?.length ?? 0,
      openShifts:       openShifts.data?.length ?? 0,
    }
  } catch (e) { console.error('Dashboard data error:', e); return {} }
}

// ─── Users & Permissions ──────────────────────────────────────

export async function loadTeamFull(restaurantId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, job_title, role, avatar_color, last_seen_at, is_online, allowed_modules, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function updateTeamMember(profileId, updates) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)
  if (error) throw error
}

export async function pingOnline(userId) {
  await supabase.from('profiles').update({
    last_seen_at: new Date().toISOString(),
    is_online: true,
  }).eq('id', userId)
}

export async function loadUserPermissions(restaurantId, profileId) {
  const { data } = await supabase.from('user_permissions')
    .select('*').eq('restaurant_id', restaurantId).eq('profile_id', profileId)
  return data ?? []
}

export async function saveUserPermissions(restaurantId, profileId, perms) {
  // Upsert each module permission
  for (const p of perms) {
    await supabase.from('user_permissions').upsert({
      ...p, restaurant_id: restaurantId, profile_id: profileId,
    }, { onConflict: 'profile_id,restaurant_id,module' })
  }
}

// ─── Chatter ──────────────────────────────────────────────────

export async function loadMessages(restaurantId, recordType = 'general', recordId = null, limit = 50) {
  let q = supabase
    .from('chatter_messages')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('record_type', recordType)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (recordId) q = q.eq('record_id', recordId)
  else          q = q.is('record_id', null)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function sendMessage(restaurantId, authorId, authorName, authorColor, content, recordType = 'general', recordId = null, messageType = 'comment', mentions = []) {
  const { data, error } = await supabase.from('chatter_messages').insert({
    restaurant_id: restaurantId,
    author_id:     authorId,
    author_name:   authorName,
    author_color:  authorColor || '#0D7377',
    content,
    record_type:   recordType,
    record_id:     recordId,
    message_type:  messageType,
    mentions,
  }).select().single()
  if (error) throw error
  return data
}

export async function editMessage(messageId, content) {
  const { error } = await supabase.from('chatter_messages').update({
    content, edited: true, edited_at: new Date().toISOString(),
  }).eq('id', messageId)
  if (error) throw error
}

export async function deleteMessage(messageId) {
  const { error } = await supabase.from('chatter_messages').delete().eq('id', messageId)
  if (error) throw error
}

export async function markChatterRead(profileId, restaurantId) {
  await supabase.from('chatter_reads').upsert({
    profile_id: profileId, restaurant_id: restaurantId, last_read_at: new Date().toISOString(),
  }, { onConflict: 'profile_id,restaurant_id' })
}

export async function getUnreadCount(restaurantId, profileId) {
  const { data: read } = await supabase.from('chatter_reads')
    .select('last_read_at').eq('profile_id', profileId).eq('restaurant_id', restaurantId).maybeSingle()
  const since = read?.last_read_at || '2000-01-01'
  const { count } = await supabase.from('chatter_messages')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('record_type', 'general')
    .neq('author_id', profileId)
    .gt('created_at', since)
  return count ?? 0
}

export function subscribeToMessages(restaurantId, callback) {
  return supabase.channel(`chatter:${restaurantId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'chatter_messages',
      filter: `restaurant_id=eq.${restaurantId}`,
    }, payload => callback(payload.new))
    .subscribe()
}
