// =====================================================================
//  DEMO MODE, a tiny in-browser stand-in for Supabase.
//  Activates ONLY when no real Supabase .env is configured, so you can
//  see and click the whole app with sample data and zero setup.
//  Data lives in localStorage; the real Supabase client replaces this
//  automatically once you add your VITE_SUPABASE_* keys.
// =====================================================================

const DB_KEY = 'mocka_demo_db'
const SESSION_KEY = 'mocka_demo_session'

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2))
const nowISO = () => new Date().toISOString()
const today = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

function load() {
  try { return JSON.parse(localStorage.getItem(DB_KEY)) } catch { return null }
}
function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)) }

// ---------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------
function seed() {
  const adminId = uuid(), chefId = uuid(), custId = uuid()
  const auth_users = [
    { id: adminId, email: 'admin@mocka.test', password: '123456', meta: { full_name: 'Cafe Owner', phone: '+918954312812', role: 'admin' } },
    { id: chefId, email: 'chef@mocka.test', password: '123456', meta: { full_name: 'Head Chef', phone: '', role: 'chef' } },
    { id: custId, email: 'guest@mocka.test', password: '123456', meta: { full_name: 'Aarav Sharma', phone: '+919812345678', role: 'customer' } },
  ]
  const profiles = auth_users.map((u) => ({ id: u.id, full_name: u.meta.full_name, phone: u.meta.phone, role: u.meta.role, created_at: nowISO() }))

  const M = (name, price, category, description) => ({
    id: uuid(), name, price, category, description: description || null,
    stock_qty: null, is_available: true, image_url: null, sort_order: 0, created_at: nowISO(),
  })
  const menu_items = [
    M('Cappuccino', 120, 'Coffee', 'Rich espresso with steamed milk'),
    M('Cafe Latte', 130, 'Coffee', 'Smooth and creamy'),
    M('Cold Coffee', 150, 'Coffee', 'Chilled & frothy'),
    M('Masala Chai', 40, 'Tea', 'Classic Indian spiced tea'),
    M('Green Tea', 60, 'Tea'),
    M('Oreo Shake', 160, 'Shakes', 'Crunchy cookies & cream'),
    M('Veg Sandwich', 110, 'Sandwiches', 'Grilled veggies & cheese'),
    M('Paneer Burger', 140, 'Burgers'),
    M('Cheese Maggi', 90, 'Maggi', 'Comfort in a bowl'),
    M('French Fries', 100, 'Snacks', 'Crispy & salted'),
    M('Chocolate Brownie', 130, 'Desserts', 'Warm, with a scoop'),
    M('Cold Drink', 50, 'Cold Drinks'),
  ]

  const I = (name, category, unit, current_qty, unit_cost) => ({
    id: uuid(), name, category, unit, current_qty, unit_cost, created_at: nowISO(),
  })
  const inventory_items = [
    I('Coffee Beans', 'kitchen', 'kg', 4, 800),
    I('Milk', 'fridge', 'L', 18, 60),
    I('Sugar', 'kitchen', 'kg', 9, 45),
    I('Bread Loaf', 'kitchen', 'pcs', 22, 35),
    I('Cheese Slices', 'fridge', 'pack', 6, 120),
    I('Paneer', 'fridge', 'kg', 3, 360),
  ]

  // A couple of live orders so the screens look real.
  const ord1 = uuid(), ord2 = uuid()
  const orders = [
    { id: ord1, daily_number: 1, business_date: today(), type: 'dine_in', status: 'sent_to_chef',
      customer_id: null, customer_name: 'Rohan', customer_phone: '', address: '', table_no: '4',
      subtotal: 250, delivery_charge: 0, total: 250, payment_status: 'unpaid', payment_method: 'cash',
      notes: null, paid_at: null, created_at: nowISO() },
    { id: ord2, daily_number: 2, business_date: today(), type: 'delivery', status: 'pending',
      customer_id: custId, customer_name: 'Aarav Sharma', customer_phone: '+919812345678',
      address: '21B, Hauz Khas, New Delhi', table_no: '',
      subtotal: 290, delivery_charge: 30, total: 320, payment_status: 'unpaid', payment_method: 'upi',
      notes: null, paid_at: null, created_at: nowISO() },
  ]
  const order_items = [
    { id: uuid(), order_id: ord1, menu_item_id: menu_items[0].id, name_snapshot: 'Cappuccino', price_snapshot: 120, quantity: 1, is_ready: false, is_available: true, created_at: nowISO() },
    { id: uuid(), order_id: ord1, menu_item_id: menu_items[8].id, name_snapshot: 'Cheese Maggi', price_snapshot: 90, quantity: 1, is_ready: true, is_available: true, created_at: nowISO() },
    { id: uuid(), order_id: ord1, menu_item_id: menu_items[11].id, name_snapshot: 'Cold Drink', price_snapshot: 50, quantity: 1, is_ready: false, is_available: true, created_at: nowISO() },
    { id: uuid(), order_id: ord2, menu_item_id: menu_items[2].id, name_snapshot: 'Cold Coffee', price_snapshot: 150, quantity: 1, is_ready: false, is_available: true, created_at: nowISO() },
    { id: uuid(), order_id: ord2, menu_item_id: menu_items[6].id, name_snapshot: 'Veg Sandwich', price_snapshot: 110, quantity: 1, is_ready: false, is_available: true, created_at: nowISO() },
    { id: uuid(), order_id: ord2, menu_item_id: menu_items[11].id, name_snapshot: 'Cold Drink', price_snapshot: 50, quantity: 1, is_ready: false, is_available: true, created_at: nowISO() },
  ]

  const settings = [
    { key: 'delivery_charge', value: '30' },
    { key: 'upi_id', value: 'mockacafe@okicici' },
    { key: 'upi_qr_url', value: '' },
  ]

  return { auth_users, profiles, menu_items, orders, order_items, inventory_items, inventory_purchases: [], recipe_items: [], purchase_items: [], settings, files: {} }
}

function getDB() {
  let db = load()
  if (!db || !db.menu_items) { db = seed(); save(db) }
  return db
}

// ---------------------------------------------------------------------
// Realtime (very small): fire all listeners on any change.
// ---------------------------------------------------------------------
const listeners = new Set()
function emitChange() { listeners.forEach((cb) => { try { cb({}) } catch {} }) }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === DB_KEY) emitChange() })
}

// ---------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------
const DEFAULTS = {
  orders: { payment_status: 'unpaid', delivery_charge: 0, subtotal: 0, total: 0 },
  order_items: { is_ready: false, is_available: true },
  menu_items: { is_available: true, sort_order: 0 },
}

class Query {
  constructor(table) {
    this.table = table
    this.op = 'select'
    this.cols = '*'
    this.filters = []
    this.orders = []
    this._limit = null
    this._single = null
    this.payload = null
    this.returnRows = false
    this.onConflict = null
    this.embed = []
  }

  _parseEmbed(cols) {
    if (typeof cols !== 'string') return
    const m = cols.match(/(\w+)\s*\(\s*\*\s*\)/g)
    if (m) this.embed = m.map((s) => s.replace(/\s*\(\s*\*\s*\)/, ''))
  }

  select(cols = '*') {
    this.cols = cols
    if (this.op !== 'select') this.returnRows = true
    this._parseEmbed(cols)
    return this
  }
  insert(rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this }
  update(obj) { this.op = 'update'; this.payload = obj; return this }
  upsert(obj, opts = {}) { this.op = 'upsert'; this.payload = obj; this.onConflict = opts.onConflict; return this }
  delete() { this.op = 'delete'; return this }

  eq(col, val) { this.filters.push({ t: 'eq', col, val }); return this }
  neq(col, val) { this.filters.push({ t: 'neq', col, val }); return this }
  in(col, vals) { this.filters.push({ t: 'in', col, vals }); return this }
  gte(col, val) { this.filters.push({ t: 'gte', col, val }); return this }
  lte(col, val) { this.filters.push({ t: 'lte', col, val }); return this }
  or(str) {
    const conds = str.split(',').map((c) => {
      const [col, op, val] = c.split('.')
      return { col, op, val }
    })
    this.filters.push({ t: 'or', conds })
    return this
  }
  order(col, opts = {}) { this.orders.push({ col, asc: opts.ascending !== false }); return this }
  limit(n) { this._limit = n; return this }
  single() { this._single = 'one'; return this }
  maybeSingle() { this._single = 'maybe'; return this }

  _match(row) {
    return this.filters.every((f) => {
      if (f.t === 'eq') return row[f.col] === f.val
      if (f.t === 'neq') return row[f.col] !== f.val
      if (f.t === 'in') return f.vals.includes(row[f.col])
      if (f.t === 'gte') return row[f.col] >= f.val
      if (f.t === 'lte') return row[f.col] <= f.val
      if (f.t === 'or') return f.conds.some((c) => {
        if (c.op === 'eq') return String(row[c.col]) === c.val
        return false
      })
      return true
    })
  }

  _exec() {
    const db = getDB()
    const tbl = db[this.table] || []

    if (this.op === 'select') {
      let rows = tbl.filter((r) => this._match(r))
      for (const o of this.orders) {
        rows = rows.slice().sort((a, b) => {
          const av = a[o.col], bv = b[o.col]
          if (av === bv) return 0
          const r = av > bv ? 1 : -1
          return o.asc ? r : -r
        })
      }
      if (this._limit != null) rows = rows.slice(0, this._limit)
      rows = rows.map((r) => {
        const copy = { ...r }
        for (const e of this.embed) copy[e] = (db[e] || []).filter((x) => x.order_id === r.id)
        return copy
      })
      if (this._single) return { data: rows[0] || null, error: null }
      return { data: rows, error: null }
    }

    if (this.op === 'insert') {
      const inserted = this.payload.map((row) => ({
        id: uuid(), created_at: nowISO(),
        ...(DEFAULTS[this.table] || {}), ...row,
      }))
      db[this.table] = [...tbl, ...inserted]
      save(db); emitChange()
      if (this.returnRows) return { data: this._single ? inserted[0] : inserted, error: null }
      return { data: null, error: null }
    }

    if (this.op === 'update') {
      const updated = []
      db[this.table] = tbl.map((r) => {
        if (this._match(r)) { const n = { ...r, ...this.payload }; updated.push(n); return n }
        return r
      })
      save(db); emitChange()
      return { data: this.returnRows ? updated : null, error: null }
    }

    if (this.op === 'upsert') {
      const key = this.onConflict || 'id'
      const incoming = Array.isArray(this.payload) ? this.payload : [this.payload]
      incoming.forEach((row) => {
        const idx = tbl.findIndex((r) => r[key] === row[key])
        if (idx >= 0) tbl[idx] = { ...tbl[idx], ...row }
        else tbl.push({ id: uuid(), created_at: nowISO(), ...row })
      })
      db[this.table] = tbl
      save(db); emitChange()
      return { data: null, error: null }
    }

    if (this.op === 'delete') {
      db[this.table] = tbl.filter((r) => !this._match(r))
      save(db); emitChange()
      return { data: null, error: null }
    }

    return { data: null, error: null }
  }

  then(onFulfilled, onRejected) {
    return Promise.resolve().then(() => this._exec()).then(onFulfilled, onRejected)
  }
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
function makeAuth() {
  const authCallbacks = new Set()
  const currentUser = () => {
    const id = localStorage.getItem(SESSION_KEY)
    if (!id) return null
    const u = getDB().auth_users.find((x) => x.id === id)
    return u ? { id: u.id, email: u.email, user_metadata: u.meta } : null
  }
  const fire = () => {
    const user = currentUser()
    const session = user ? { user } : null
    authCallbacks.forEach((cb) => cb('CHANGE', session))
  }

  return {
    async getSession() {
      const user = currentUser()
      return { data: { session: user ? { user } : null }, error: null }
    },
    onAuthStateChange(cb) {
      authCallbacks.add(cb)
      return { data: { subscription: { unsubscribe() { authCallbacks.delete(cb) } } } }
    },
    async signUp({ email, password, options }) {
      const db = getDB()
      if (db.auth_users.some((u) => u.email === email)) {
        return { data: null, error: { message: 'An account with this email already exists.' } }
      }
      const id = uuid()
      const data = options?.data || {}
      // Same key check as the real DB trigger.
      let role = 'customer'
      if (data.requested_role === 'admin' && data.signup_key === '1999') role = 'admin'
      else if (data.requested_role === 'chef' && data.signup_key === '0506') role = 'chef'
      else if (data.requested_role === 'shopkeeper' && data.signup_key === '0707') role = 'shopkeeper'
      const meta = { full_name: data.full_name, phone: data.phone, role, shop_name: data.shop_name }
      db.auth_users.push({ id, email, password, meta })
      db.profiles.push({ id, full_name: meta.full_name || '', phone: meta.phone || '', role, shop_name: data.shop_name || null, created_at: nowISO() })
      save(db)
      localStorage.setItem(SESSION_KEY, id)
      setTimeout(fire, 0)
      return { data: { user: { id, email } }, error: null }
    },
    async signInWithPassword({ email, password }) {
      const u = getDB().auth_users.find((x) => x.email === email && x.password === password)
      if (!u) return { error: { message: 'Wrong email or password. (Demo: try the quick-login buttons.)' } }
      localStorage.setItem(SESSION_KEY, u.id)
      setTimeout(fire, 0)
      return { data: { user: { id: u.id, email } }, error: null }
    },
    async signOut() {
      localStorage.removeItem(SESSION_KEY)
      setTimeout(fire, 0)
      return { error: null }
    },
  }
}

// ---------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------
function makeStorage() {
  return {
    from(bucket) {
      return {
        async upload(path, file) {
          const dataUrl = await new Promise((res) => {
            const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file)
          })
          const db = getDB(); db.files[`${bucket}/${path}`] = dataUrl; save(db)
          return { data: { path }, error: null }
        },
        getPublicUrl(path) {
          const db = getDB()
          return { data: { publicUrl: db.files[`${bucket}/${path}`] || path } }
        },
      }
    },
  }
}

// ---------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------
export function createMockClient() {
  getDB() // ensure seeded
  return {
    auth: makeAuth(),
    storage: makeStorage(),
    from(table) { return new Query(table) },
    async rpc(name, params = {}) {
      if (name === 'consume_inventory_for_order') {
        const db = getDB()
        const order = db.orders.find((o) => o.id === params.p_order)
        if (order && !order.inventory_deducted) {
          db.order_items.filter((oi) => oi.order_id === order.id && oi.is_available !== false).forEach((oi) => {
            let unitCost = 0
            ;(db.recipe_items || []).filter((r) => r.menu_item_id === oi.menu_item_id).forEach((r) => {
              const inv = db.inventory_items.find((i) => i.id === r.inventory_item_id)
              if (inv) { unitCost += Number(r.qty) * Number(inv.unit_cost); inv.current_qty -= Number(r.qty) * oi.quantity }
            })
            oi.cost_snapshot = unitCost
          })
          order.inventory_deducted = true
          save(db); emitChange()
        }
      }
      return { data: null, error: null }
    },
    channel() {
      const cbs = []
      const ch = {
        on(_evt, _opts, cb) { cbs.push(cb); return ch },
        subscribe() { cbs.forEach((cb) => listeners.add(cb)); return ch },
        _cbs: cbs,
      }
      return ch
    },
    removeChannel(ch) { (ch?._cbs || []).forEach((cb) => listeners.delete(cb)) },
  }
}
