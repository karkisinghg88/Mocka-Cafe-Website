import { supabase } from './supabase'
import { todayISO } from './format'

// ---------- Settings ----------
export async function getSettings() {
  const { data } = await supabase.from('settings').select('*')
  const map = {}
  ;(data || []).forEach((r) => { map[r.key] = r.value })
  return map
}

export async function saveSetting(key, value) {
  const { error } = await supabase.from('settings').upsert({ key, value }, { onConflict: 'key' })
  if (error) throw error
}

// ---------- Menu ----------
export async function getMenu() {
  // Try with variants embedded; fall back if the table isn't there yet.
  let res = await supabase.from('menu_items')
    .select('*, menu_variants(*)')
    .order('sort_order', { ascending: true }).order('name', { ascending: true })
  if (res.error) {
    res = await supabase.from('menu_items').select('*')
      .order('sort_order', { ascending: true }).order('name', { ascending: true })
  }
  return (res.data || []).map((m) => ({
    ...m,
    variants: (m.menu_variants || []).slice().sort((a, b) => a.sort_order - b.sort_order),
  }))
}

// Save the variant rows for a menu item (replace all).
export async function saveVariants(menuItemId, variants) {
  await supabase.from('menu_variants').delete().eq('menu_item_id', menuItemId)
  if (variants.length) {
    await supabase.from('menu_variants').insert(
      variants.map((v, i) => ({ menu_item_id: menuItemId, name: v.name.trim(), price: Number(v.price) || 0, sort_order: i }))
    )
  }
}

// Display price for a menu item: a single price, or a "₹min to ₹max" range.
export function priceLabel(item) {
  const vs = item.variants || []
  if (vs.length === 0) return `₹${Number(item.price).toLocaleString('en-IN')}`
  const prices = vs.map((v) => Number(v.price))
  const min = Math.min(...prices), max = Math.max(...prices)
  return min === max ? `₹${min.toLocaleString('en-IN')}` : `₹${min} to ₹${max}`
}

// ---------- Order totals ----------
export function computeTotals(items, deliveryCharge = 0) {
  // Items explicitly marked unavailable (delivery flow) are not charged.
  const subtotal = items
    .filter((it) => it.is_available !== false)
    .reduce((s, it) => s + Number(it.price_snapshot) * it.quantity, 0)
  const total = subtotal + Number(deliveryCharge || 0)
  return { subtotal, total }
}

// ---------- Create order (admin billing or customer delivery) ----------
// items: [{ menu_item_id, name_snapshot, price_snapshot, quantity }]
export async function createOrder({
  type = 'dine_in',
  status = 'sent_to_chef',
  customer_id = null,
  customer_name = '',
  customer_phone = '',
  address = '',
  lat = null,
  lng = null,
  table_no = '',
  delivery_charge = 0,
  payment_method = 'cash',
  notes = '',
  items = [],
}) {
  const business_date = todayISO()
  const { subtotal, total } = computeTotals(items, delivery_charge)

  // Daily order number = (max daily_number for today) + 1.
  const { data: last } = await supabase
    .from('orders')
    .select('daily_number')
    .eq('business_date', business_date)
    .order('daily_number', { ascending: false })
    .limit(1)
  const daily_number = (last?.[0]?.daily_number || 0) + 1

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      daily_number, business_date, type, status,
      customer_id, customer_name, customer_phone, address, lat, lng, table_no,
      subtotal, delivery_charge, total,
      payment_status: 'unpaid', payment_method, notes,
    })
    .select()
    .single()
  if (error) throw error

  const rows = items.map((it) => ({
    order_id: order.id,
    menu_item_id: it.menu_item_id,
    name_snapshot: it.name_snapshot,
    price_snapshot: it.price_snapshot,
    quantity: it.quantity,
  }))
  const { error: e2 } = await supabase.from('order_items').insert(rows)
  if (e2) throw e2

  return order
}

export async function recalcOrderTotal(orderId) {
  const { data: order } = await supabase.from('orders').select('delivery_charge').eq('id', orderId).single()
  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId)
  const { subtotal, total } = computeTotals(items || [], order?.delivery_charge || 0)
  await supabase.from('orders').update({ subtotal, total }).eq('id', orderId)
  return { subtotal, total }
}

export async function setOrderStatus(orderId, status, extra = {}) {
  const { error } = await supabase.from('orders').update({ status, ...extra }).eq('id', orderId)
  if (error) throw error
}

// Deduct recipe ingredients from inventory + snapshot cost. Idempotent (DB-guarded).
export async function finalizeOrderInventory(orderId) {
  const { error } = await supabase.rpc('consume_inventory_for_order', { p_order: orderId })
  if (error) console.warn('inventory deduction skipped:', error.message)
}

// ---------- Recipes (menu item -> inventory ingredients) ----------
export async function getRecipe(menuItemId) {
  const { data } = await supabase
    .from('recipe_items')
    .select('*, inventory_items(name, unit, unit_cost)')
    .eq('menu_item_id', menuItemId)
  return data || []
}

// Replace the whole recipe for a menu item.
export async function saveRecipe(menuItemId, rows) {
  await supabase.from('recipe_items').delete().eq('menu_item_id', menuItemId)
  if (rows.length) {
    await supabase.from('recipe_items').insert(
      rows.map((r) => ({ menu_item_id: menuItemId, inventory_item_id: r.inventory_item_id, qty: Number(r.qty) || 0 }))
    )
  }
}

// Cost of one serving from its recipe rows (each row carries inventory_items.unit_cost).
export function recipeCost(rows) {
  return rows.reduce((s, r) => s + (Number(r.qty) || 0) * Number(r.inventory_items?.unit_cost || 0), 0)
}

// Record a purchase and top up an item's stock (recalculates unit cost).
export async function restockItem(item, qty, totalCost) {
  const q = Number(qty), cost = Number(totalCost)
  await supabase.from('inventory_purchases').insert({
    item_id: item.id, qty: q, total_cost: cost, purchased_on: todayISO(),
  })
  const newQty = Number(item.current_qty) + q
  const newUnitCost = q > 0 ? cost / q : Number(item.unit_cost)
  await supabase.from('inventory_items').update({ current_qty: newQty, unit_cost: newUnitCost }).eq('id', item.id)
}

// ---------- Saved customer addresses ----------
export async function getAddresses(userId) {
  const { data } = await supabase.from('customer_addresses').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false })
  return data || []
}
export async function addAddress({ user_id, address, lat = null, lng = null, label = '' }) {
  const { data, error } = await supabase.from('customer_addresses')
    .insert({ user_id, address: address.trim(), lat, lng, label }).select().single()
  if (error) throw error
  return data
}
export async function deleteAddress(id) {
  await supabase.from('customer_addresses').delete().eq('id', id)
}

// ---------- Expenses ----------
export async function getExpenses(start, end) {
  const { data } = await supabase.from('expenses').select('*')
    .gte('expense_date', start).lte('expense_date', end).order('expense_date', { ascending: false })
  return data || []
}
export async function addExpense({ type, label = '', qty = 1, amount, date }) {
  const { error } = await supabase.from('expenses').insert({
    type, label, qty: Number(qty) || 1, amount: Number(amount) || 0, expense_date: date,
  })
  if (error) throw error
}
export async function deleteExpense(id) {
  await supabase.from('expenses').delete().eq('id', id)
}

// ---------- Inventory catalog / shopkeepers ----------
export async function getInventory() {
  const { data } = await supabase.from('inventory_items').select('*').order('category').order('name')
  return data || []
}
export async function getShopkeepers() {
  const { data } = await supabase.from('profiles').select('id, full_name, shop_name').eq('role', 'shopkeeper').order('shop_name')
  return data || []
}
export async function getStaffByRole(role) {
  const { data } = await supabase.from('profiles').select('id, full_name, shop_name').eq('role', role).order('full_name')
  return data || []
}

// ---------- Staff vault + customer records (admin) ----------
export async function getStaffCredentials() {
  const { data } = await supabase.from('staff_credentials').select('*').order('created_at', { ascending: false })
  return data || []
}

export async function getCustomersWithStats() {
  const [{ data: profs }, { data: ords }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'customer'),
    supabase.from('orders').select('customer_id, total, address, created_at').not('customer_id', 'is', null).order('created_at', { ascending: false }),
  ])
  const by = {}
  ;(ords || []).forEach((o) => {
    const b = (by[o.customer_id] ||= { count: 0, spent: 0, lastAddress: null })
    b.count++; b.spent += Number(o.total)
    if (!b.lastAddress && o.address) b.lastAddress = o.address
  })
  return (profs || [])
    .map((p) => ({ ...p, count: by[p.id]?.count || 0, spent: by[p.id]?.spent || 0, lastAddress: by[p.id]?.lastAddress }))
    .sort((a, b) => b.count - a.count)
}

// ---------- Procurement / buy list ----------
export async function getPurchaseItems(businessDate) {
  let q = supabase.from('purchase_items').select('*').order('created_at', { ascending: true })
  if (businessDate) q = q.eq('business_date', businessDate)
  const { data } = await q
  return data || []
}

// Add an item to the buy list (chef request or admin).
export async function addPurchaseItem({ item, qty, addedRole, source = 'shop', note = '' }) {
  const { error } = await supabase.from('purchase_items').insert({
    inventory_item_id: item?.id || null,
    name: item?.name || note || 'Item',
    unit: item?.unit || 'pcs',
    qty: Number(qty) || 1,
    source, added_role: addedRole, note,
    status: 'pending',
  })
  if (error) throw error
}

export async function updatePurchaseItem(id, patch) {
  const { error } = await supabase.from('purchase_items').update(patch).eq('id', id)
  if (error) throw error
}
export async function deletePurchaseItem(id) {
  await supabase.from('purchase_items').delete().eq('id', id)
}

// Admin assigns a pending/unavailable item to a shop.
export async function assignToShop(id, shopkeeperId) {
  await updatePurchaseItem(id, { shopkeeper_id: shopkeeperId, source: 'shop', status: 'assigned', paid: false, packed_at: null })
}

// Shopkeeper marks an item unavailable -> returns to admin's list.
export async function markUnavailable(id) {
  await updatePurchaseItem(id, { status: 'unavailable' })
}

// Complete a purchase: mark paid + add the bought qty into inventory stock.
export async function completePurchase(pItem, paymentMethod) {
  if (pItem.inventory_item_id) {
    const { data: inv } = await supabase.from('inventory_items').select('*').eq('id', pItem.inventory_item_id).single()
    if (inv) await restockItem(inv, pItem.qty, Number(pItem.qty) * Number(pItem.unit_price))
  }
  await updatePurchaseItem(pItem.id, {
    status: 'purchased', paid: true, payment_method: paymentMethod, purchased_at: new Date().toISOString(),
  })
}

// ---------- Inventory conversion (e.g. tomato + onion -> tomato puree) ----------
// inputs: [{ item, qty }]  output: { mode:'new'|'existing', name, unit, category, qty, existingId }
// Consumes the inputs and produces the output; the input cost is carried into
// the produced item's unit cost (weighted average when adding to existing stock).
export async function convertInventory({ inputs, output }) {
  const inputCost = inputs.reduce((s, i) => s + Number(i.qty) * Number(i.item.unit_cost), 0)
  const outQty = Number(output.qty)

  // Deduct the consumed raw items.
  for (const i of inputs) {
    await supabase.from('inventory_items')
      .update({ current_qty: Number(i.item.current_qty) - Number(i.qty) })
      .eq('id', i.item.id)
  }

  if (output.mode === 'existing') {
    const { data: ex } = await supabase.from('inventory_items').select('*').eq('id', output.existingId).single()
    const totalQty = Number(ex.current_qty) + outQty
    const newCost = totalQty > 0
      ? (Number(ex.current_qty) * Number(ex.unit_cost) + inputCost) / totalQty
      : Number(ex.unit_cost)
    await supabase.from('inventory_items')
      .update({ current_qty: totalQty, unit_cost: newCost }).eq('id', ex.id)
  } else {
    const unitCost = outQty > 0 ? inputCost / outQty : 0
    await supabase.from('inventory_items').insert({
      name: output.name, unit: output.unit, category: output.category,
      current_qty: outQty, unit_cost: unitCost,
    })
  }
  return { inputCost, unitCost: outQty > 0 ? inputCost / outQty : 0 }
}

// ---------- Editing an existing order's items ----------
export async function addOrderItem(orderId, menuItem, variant = null) {
  const name = menuItem.name + (variant ? ` (${variant.name})` : '')
  const price = variant ? variant.price : menuItem.price
  // If the same item+variant is already on the order, bump its quantity instead.
  const { data: existing } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .eq('name_snapshot', name)
    .maybeSingle()
  if (existing) {
    await supabase.from('order_items').update({ quantity: existing.quantity + 1 }).eq('id', existing.id)
  } else {
    await supabase.from('order_items').insert({
      order_id: orderId,
      menu_item_id: menuItem.id,
      name_snapshot: name,
      price_snapshot: price,
      quantity: 1,
    })
  }
  await recalcOrderTotal(orderId)
}

export async function updateOrderItemQty(itemId, orderId, qty) {
  if (qty <= 0) {
    await supabase.from('order_items').delete().eq('id', itemId)
  } else {
    await supabase.from('order_items').update({ quantity: qty }).eq('id', itemId)
  }
  await recalcOrderTotal(orderId)
}

export async function setItemAvailability(itemId, orderId, available) {
  await supabase.from('order_items').update({ is_available: available }).eq('id', itemId)
  await recalcOrderTotal(orderId)
}

// Customer accepted the requote: drop the unavailable lines, recompute total.
export async function removeUnavailableItems(orderId) {
  await supabase.from('order_items').delete().eq('order_id', orderId).eq('is_available', false)
  await recalcOrderTotal(orderId)
}

// Customer star rating (1..5) for the food on a delivered order.
export async function rateOrder(orderId, rating) {
  await supabase.from('orders').update({ rating }).eq('id', orderId)
}
