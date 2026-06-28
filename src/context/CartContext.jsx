import { createContext, useContext, useEffect, useState } from 'react'

const CartContext = createContext(null)
const KEY = 'mocka_cart'

// A cart line is keyed by item + chosen variant, so "Kadhai Paneer, Half" and
// ", Full" are separate lines. variant = { name, price } or null.
const lineKey = (itemId, variant) => `${itemId}|${variant?.name || ''}`
const priceOf = (item, variant) => Number(variant ? variant.price : item.price)

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
  })

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(cart)) }, [cart])

  const add = (item, variant = null) => setCart((c) => {
    const k = lineKey(item.id, variant)
    return { ...c, [k]: { item, variant, qty: (c[k]?.qty || 0) + 1 } }
  })
  const dec = (item, variant = null) => setCart((c) => {
    const k = lineKey(item.id, variant)
    const cur = c[k]; if (!cur) return c
    const qty = cur.qty - 1; const next = { ...c }
    if (qty <= 0) delete next[k]; else next[k] = { ...cur, qty }
    return next
  })
  const removeKey = (k) => setCart((c) => { const n = { ...c }; delete n[k]; return n })
  const clear = () => setCart({})
  const qtyOf = (item, variant = null) => cart[lineKey(item.id, variant)]?.qty || 0

  const lines = Object.entries(cart).map(([key, l]) => ({ key, ...l }))
  const count = lines.reduce((s, l) => s + l.qty, 0)
  const subtotal = lines.reduce((s, l) => s + priceOf(l.item, l.variant) * l.qty, 0)

  return (
    <CartContext.Provider value={{ cart, lines, count, subtotal, add, dec, removeKey, clear, qtyOf, priceOf }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
