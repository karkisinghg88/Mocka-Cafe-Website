import { useEffect, useState, useCallback } from 'react'
import { Phone, ClipboardList, Star, Plus, Minus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getMenu, removeUnavailableItems, addOrderItem, setOrderStatus, rateOrder } from '../../lib/db'
import { rupees, CAFE, STATUS_LABELS, STATUS_COLORS } from '../../lib/format'
import { Card, Spinner, EmptyState, Badge, Button, Modal, Input } from '../../components/ui'

const CUSTOMER_STATUS = {
  pending: 'Waiting for cafe to accept',
  rejected: 'Order not accepted',
  requoted: 'Some items are unavailable, please choose',
  accepted: 'Accepted, preparing soon',
  sent_to_chef: 'Preparing your order',
  preparing: 'Preparing your order',
  ready: 'Packed, ready to dispatch',
  out_for_delivery: 'Out for delivery 🛵',
  reached: 'Rider has reached you 🛵',
  delivered: 'Delivered ✓',
  paid: 'Completed ✓',
}

export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [changeOrder, setChangeOrder] = useState(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('orders').select('*, order_items(*)')
      .eq('customer_id', user.id).order('created_at', { ascending: false }).limit(30)
    setOrders(data || []); setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
    const ch = supabase.channel('my-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${user.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, user.id])

  const acceptRest = async (o) => {
    await removeUnavailableItems(o.id)
    await setOrderStatus(o.id, 'pending')
  }
  const rate = async (o, stars) => { await rateOrder(o.id, stars); load() }

  if (loading) return <Spinner />
  if (orders.length === 0) return <EmptyState icon={ClipboardList} title="No orders yet" subtitle="Your orders will show up here." />

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">My orders</h2>
      {orders.map((o) => {
        const unavailable = o.order_items.filter((it) => it.is_available === false)
        const isDone = ['delivered', 'paid'].includes(o.status)
        return (
          <Card key={o.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-black">Order #{o.daily_number}</p>
                <p className="text-xs text-cafe-muted">{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
              <Badge className={STATUS_COLORS[o.status]}>{STATUS_LABELS[o.status]}</Badge>
            </div>

            <p className="mt-2 text-sm font-medium text-cafe-accent">{CUSTOMER_STATUS[o.status]}</p>

            <ul className="mt-2 space-y-0.5 text-sm text-cafe-muted">
              {o.order_items.map((it) => (
                <li key={it.id} className={it.is_available === false ? 'text-red-400 line-through' : ''}>
                  {it.quantity}× {it.name_snapshot}{it.is_available === false ? ' (not available)' : ''}
                </li>
              ))}
            </ul>

            {/* Requote: customer accepts the rest or changes items */}
            {o.status === 'requoted' && (
              <div className="mt-3 rounded-xl border border-yellow-600/40 bg-yellow-500/5 p-3">
                <p className="text-sm text-yellow-300">
                  {unavailable.map((u) => u.name_snapshot).join(', ')} {unavailable.length > 1 ? 'are' : 'is'} not available right now.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => acceptRest(o)}>Order the rest</Button>
                  <Button onClick={() => setChangeOrder(o)}>Add other items</Button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-cafe-line pt-3">
              <div className="text-xs text-cafe-muted">
                {o.payment_method === 'upi' ? 'Paid via UPI' : 'Cash on delivery'}
                {o.payment_status === 'received' && ' · ✓ confirmed'}
              </div>
              <span className="text-lg font-bold text-cafe-accent">{rupees(o.total)}</span>
            </div>

            {/* Rating after delivery */}
            {isDone && (
              <div className="mt-3 border-t border-cafe-line pt-3 text-center">
                {o.rating ? (
                  <p className="text-sm text-cafe-muted">You rated the food <span className="font-bold text-cafe-accent">{o.rating}/5 ★</span>. Thank you!</p>
                ) : (
                  <>
                    <p className="text-sm text-cafe-muted">How was the food?</p>
                    <div className="mt-2 flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => rate(o, n)} aria-label={`${n} star`} className="p-1 text-cafe-muted hover:text-cafe-accent">
                          <Star size={28} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {['out_for_delivery', 'reached', 'sent_to_chef', 'preparing', 'ready'].includes(o.status) && (
              <a href={`tel:${CAFE.phone}`} className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-cafe-line py-2.5 text-sm text-cafe-muted">
                <Phone size={15} /> Call {CAFE.phoneDisplay}
              </a>
            )}
          </Card>
        )
      })}

      {changeOrder && <ChangeItemsModal order={changeOrder} onClose={() => setChangeOrder(null)} onDone={load} />}
    </div>
  )
}

// Lets the customer add replacement items, drop the unavailable ones, and resend.
function ChangeItemsModal({ order, onClose, onDone }) {
  const [menu, setMenu] = useState([])
  const [q, setQ] = useState('')
  const [cart, setCart] = useState({}) // key -> { item, variant, qty }
  const [saving, setSaving] = useState(false)

  useEffect(() => { getMenu().then((m) => setMenu(m.filter((x) => x.is_available))) }, [])

  const keyOf = (item, v) => `${item.id}|${v?.name || ''}`
  const inc = (item, v) => setCart((c) => { const k = keyOf(item, v); return { ...c, [k]: { item, variant: v, qty: (c[k]?.qty || 0) + 1 } } })
  const dec = (item, v) => setCart((c) => { const k = keyOf(item, v); const n = (c[k]?.qty || 0) - 1; const x = { ...c }; if (n <= 0) delete x[k]; else x[k] = { ...x[k], qty: n }; return x })

  const filtered = menu.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
  const lines = Object.values(cart)

  const submit = async () => {
    setSaving(true)
    try {
      for (const l of lines) for (let i = 0; i < l.qty; i++) await addOrderItem(order.id, l.item, l.variant)
      await removeUnavailableItems(order.id)
      await setOrderStatus(order.id, 'pending')
      onClose(); await onDone()
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="Add other items">
      <div className="space-y-3">
        <p className="text-xs text-cafe-muted">Pick replacements. The unavailable items are removed and your order is sent back to the cafe.</p>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cafe-muted" />
          <Input placeholder="Search the menu…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((m) => {
            const vs = (m.variants || []).filter((v) => v.is_available !== false)
            const Row = ({ v }) => {
              const qty = cart[keyOf(m, v)]?.qty || 0
              return (
                <div className="flex items-center justify-between">
                  <span className="text-sm">{v ? `${v.name} · ${rupees(v.price)}` : `${rupees(m.price)}`}</span>
                  <div className="flex items-center gap-2">
                    {qty > 0 && (<><button onClick={() => dec(m, v)} className="rounded-lg bg-cafe-line p-1.5"><Minus size={14} /></button><span className="w-5 text-center text-sm font-semibold">{qty}</span></>)}
                    <button onClick={() => inc(m, v)} className="rounded-lg bg-cafe-accent p-1.5 text-black"><Plus size={14} /></button>
                  </div>
                </div>
              )
            }
            return (
              <div key={m.id} className="rounded-xl bg-cafe-bg px-3 py-2">
                <p className="text-sm font-semibold">{m.name}</p>
                <div className="mt-1 space-y-1">
                  {vs.length ? vs.map((v) => <Row key={v.id} v={{ name: v.name, price: v.price }} />) : <Row v={null} />}
                </div>
              </div>
            )
          })}
        </div>
        <Button onClick={submit} disabled={saving || lines.length === 0} className="w-full">
          {saving ? 'Sending…' : 'Send updated order'}
        </Button>
      </div>
    </Modal>
  )
}
