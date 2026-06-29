import { useEffect, useState } from 'react'
import { Check, X, Send, Bike, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrders } from '../../hooks/useOrders'
import { setOrderStatus, setItemAvailability, recalcOrderTotal, getSettings, getStaffByRole } from '../../lib/db'
import { rupees, clockTime, minutesBetween, STATUS_LABELS, STATUS_COLORS } from '../../lib/format'
import { Button, Card, Spinner, EmptyState, Badge } from '../../components/ui'
import BillRow from '../../components/BillRow'

export default function Delivery() {
  const { orders, loading } = useOrders({ types: ['delivery'] })
  const [defaultCharge, setDefaultCharge] = useState(0)
  const [riders, setRiders] = useState([])

  useEffect(() => {
    getSettings().then((s) => setDefaultCharge(Number(s.delivery_charge || 0)))
    getStaffByRole('rider').then(setRiders)
  }, [])

  if (loading) return <Spinner />

  const live = orders.filter((o) => !['delivered', 'paid', 'rejected'].includes(o.status))
  const closed = orders.filter((o) => ['delivered', 'paid', 'rejected'].includes(o.status))
  const riderName = (id) => riders.find((r) => r.id === id)?.full_name || 'rider'

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Delivery orders</h2>

      {live.length === 0 ? (
        <EmptyState icon={Bike} title="No delivery requests" subtitle="Customer orders will appear here." />
      ) : (
        <div className="space-y-3">
          {live.map((o) => <DeliveryCard key={o.id} order={o} defaultCharge={defaultCharge} riders={riders} riderName={riderName} />)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="pt-2">
          <p className="mb-2 text-sm font-semibold text-cafe-muted">Done today ({closed.length})</p>
          <p className="mb-2 text-xs text-cafe-muted">Tap a bill to see its items.</p>
          <div className="space-y-2">
            {closed.map((o) => (
              <div key={o.id}>
                <BillRow order={o} showStatus />
                <RiderTimes order={o} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DeliveryCard({ order, defaultCharge, riders, riderName }) {
  const [charge, setCharge] = useState(order.delivery_charge || defaultCharge || 0)
  const [riderId, setRiderId] = useState('')

  const saveCharge = async (val) => {
    setCharge(val)
    await supabase.from('orders').update({ delivery_charge: Number(val || 0) }).eq('id', order.id)
    await recalcOrderTotal(order.id)
  }

  const hasUnavailable = order.order_items.some((i) => i.is_available === false)
  const accept = () => saveCharge(charge).then(() => setOrderStatus(order.id, 'accepted'))
  const reject = () => { if (confirm('Reject this order?')) setOrderStatus(order.id, 'rejected') }
  const requote = () => setOrderStatus(order.id, 'requoted')
  const sendToChef = () => setOrderStatus(order.id, 'sent_to_chef')
  const assignAndSend = async () => {
    if (!riderId) { alert('Choose a rider to assign this delivery.'); return }
    await setOrderStatus(order.id, 'out_for_delivery', { rider_id: riderId })
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-black">#{order.daily_number} <span className="text-sm font-normal text-cafe-muted">delivery</span></p>
          <p className="text-xs text-cafe-muted">{order.customer_name} · {order.customer_phone}</p>
          {order.address && <p className="mt-1 text-xs text-cafe-muted whitespace-pre-line">{order.address}</p>}
          {order.notes && <p className="mt-1 text-xs text-yellow-400">📝 {order.notes}</p>}
          {(order.lat && order.lng) && <p className="mt-0.5 text-[11px] text-emerald-400">📍 Location pin attached</p>}
        </div>
        <Badge className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
      </div>

      <ul className="mt-3 space-y-1">
        {order.order_items.map((it) => (
          <li key={it.id} className="flex items-center justify-between text-sm">
            <span className={it.is_available === false ? 'text-cafe-muted line-through' : ''}>
              {it.quantity}× {it.name_snapshot}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-cafe-muted">{rupees(it.price_snapshot * it.quantity)}</span>
              {order.status === 'pending' && (
                <button onClick={() => setItemAvailability(it.id, order.id, it.is_available === false)}
                  className={`rounded px-2 py-0.5 text-[10px] ${it.is_available === false ? 'bg-cafe-line text-white' : 'bg-red-500/15 text-red-400'}`}>
                  {it.is_available === false ? 'Restore' : 'N/A'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1 border-t border-cafe-line pt-3 text-sm">
        <div className="flex justify-between text-cafe-muted"><span>Items</span><span>{rupees(order.subtotal)}</span></div>
        <div className="flex items-center justify-between">
          <span className="text-cafe-muted">Delivery charge</span>
          {['pending', 'accepted'].includes(order.status)
            ? <input type="number" min="0" value={charge} onChange={(e) => saveCharge(e.target.value)}
                className="w-24 rounded-lg bg-cafe-bg border border-cafe-line px-2 py-1 text-right" />
            : <span>{rupees(order.delivery_charge)}</span>}
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span><span className="text-cafe-accent">{rupees(order.total)}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {order.status === 'pending' && (
          hasUnavailable ? (
            <Button className="col-span-2" onClick={requote}><Send size={16} /> Requote customer</Button>
          ) : (<>
            <Button variant="danger" onClick={reject}><X size={16} /> Reject</Button>
            <Button variant="success" onClick={accept}><Check size={16} /> Accept</Button>
          </>)
        )}
        {order.status === 'requoted' && (
          <p className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-yellow-500/10 py-2.5 text-sm font-semibold text-yellow-300">
            Waiting for customer to confirm…
          </p>
        )}
        {order.status === 'accepted' && (
          <Button onClick={sendToChef} className="col-span-2"><Send size={16} /> Send to kitchen (packed)</Button>
        )}
        {['sent_to_chef', 'preparing'].includes(order.status) && (
          <Button variant="ghost" className="col-span-2" disabled>In kitchen…</Button>
        )}
        {order.status === 'ready' && (
          <div className="col-span-2 space-y-2">
            <select value={riderId} onChange={(e) => setRiderId(e.target.value)}
              className="w-full rounded-xl bg-cafe-bg border border-cafe-line px-3 py-2.5 text-sm">
              <option value="">Assign a rider…</option>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
            <Button onClick={assignAndSend} className="w-full"><Bike size={16} /> Out for delivery</Button>
            {riders.length === 0 && <p className="text-center text-xs text-yellow-400">No riders yet, add one in Staff & accounts.</p>}
          </div>
        )}
        {['out_for_delivery', 'reached'].includes(order.status) && (
          <p className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-purple-500/10 py-2.5 text-sm font-semibold text-purple-300">
            <Bike size={15} /> {order.status === 'reached' ? 'Rider reached' : 'Out'} with {riderName(order.rider_id)}
          </p>
        )}
        <a href={`tel:${order.customer_phone}`} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-cafe-line py-2.5 text-sm text-cafe-muted">
          <Phone size={15} /> Call customer
        </a>
      </div>

      <RiderTimes order={order} />
    </Card>
  )
}

// Compact rider delivery times, shown to the admin once the rider records them.
function RiderTimes({ order }) {
  if (!order.left_cafe_at && !order.reached_at && !order.back_at_cafe_at) return null
  const toReach = minutesBetween(order.left_cafe_at, order.reached_at)
  const round = minutesBetween(order.left_cafe_at, order.back_at_cafe_at)
  return (
    <div className="mt-2 rounded-lg bg-cafe-bg p-2 text-[11px] text-cafe-muted">
      <span className="font-semibold">Rider times: </span>
      {order.left_cafe_at && <>left {clockTime(order.left_cafe_at)}</>}
      {order.reached_at && <> · reached {clockTime(order.reached_at)}{toReach != null ? ` (${toReach}m)` : ''}</>}
      {order.paid_at && <> · delivered {clockTime(order.paid_at)}</>}
      {order.back_at_cafe_at && <> · back {clockTime(order.back_at_cafe_at)}{round != null ? ` (round ${round}m)` : ''}</>}
    </div>
  )
}
