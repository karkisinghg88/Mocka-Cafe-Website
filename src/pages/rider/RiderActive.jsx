import { useEffect, useState, useCallback } from 'react'
import { Phone, Navigation, MapPin, CheckCircle2, Banknote, QrCode, PackageCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { setOrderStatus, finalizeOrderInventory } from '../../lib/db'
import { rupees, STATUS_LABELS, STATUS_COLORS } from '../../lib/format'
import { Button, Card, Spinner, EmptyState, Badge } from '../../components/ui'

function mapsUrl(o) {
  const dest = (o.lat && o.lng) ? `${o.lat},${o.lng}` : encodeURIComponent(o.address || '')
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

export default function RiderActive() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders')
      .select('*, order_items(*)')
      .eq('rider_id', user.id).in('status', ['out_for_delivery', 'reached'])
      .order('created_at')
    setOrders(data || []); setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
    const ch = supabase.channel('rider-active')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `rider_id=eq.${user.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, user.id])

  if (loading) return <Spinner />
  if (orders.length === 0) return <EmptyState icon={PackageCheck} title="No deliveries right now" subtitle="Orders assigned to you appear here." />

  return (
    <div className="space-y-3">
      {orders.map((o) => <DeliveryCard key={o.id} order={o} />)}
    </div>
  )
}

function DeliveryCard({ order }) {
  const [pay, setPay] = useState('cash')
  const [busy, setBusy] = useState(false)

  const reached = () => setOrderStatus(order.id, 'reached')
  const deliver = async () => {
    setBusy(true)
    try {
      await setOrderStatus(order.id, 'delivered', {
        payment_status: 'received', payment_method: pay,
        cash_amount: pay === 'cash' ? Number(order.total) : 0,
        upi_amount: pay === 'upi' ? Number(order.total) : 0,
        paid_at: new Date().toISOString(),
      })
      await finalizeOrderInventory(order.id)
    } finally { setBusy(false) }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-black">#{order.daily_number}</p>
          <p className="text-sm font-semibold">{order.customer_name}</p>
        </div>
        <Badge className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
      </div>

      {order.address && <p className="mt-2 whitespace-pre-line text-sm text-cafe-muted">{order.address}</p>}
      {order.notes && <p className="mt-1 text-sm text-yellow-400">📝 {order.notes}</p>}

      <ul className="mt-2 space-y-0.5 text-sm text-cafe-muted">
        {order.order_items.map((it) => <li key={it.id}>{it.quantity}× {it.name_snapshot}</li>)}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-cafe-line pt-2">
        <span className="text-cafe-muted">Collect</span>
        <span className="text-xl font-black text-cafe-accent">{rupees(order.total)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={`tel:${order.customer_phone}`} className="flex items-center justify-center gap-2 rounded-xl border border-cafe-line py-2.5 text-sm text-cafe-muted"><Phone size={15} /> Call</a>
        <a href={mapsUrl(order)} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-cafe-line py-2.5 text-sm font-semibold text-cafe-accent">
          {order.lat && order.lng ? <><MapPin size={15} /> Navigate (pin)</> : <><Navigation size={15} /> Navigate</>}
        </a>
      </div>

      {order.status === 'out_for_delivery' ? (
        <Button variant="ghost" className="mt-2 w-full" onClick={reached}><CheckCircle2 size={16} /> Mark reached</Button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-center text-xs text-cafe-muted">Payment received by:</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPay('cash')} className={`flex items-center justify-center gap-1 rounded-xl border py-2.5 text-sm font-semibold ${pay === 'cash' ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line'}`}><Banknote size={15} /> Cash</button>
            <button onClick={() => setPay('upi')} className={`flex items-center justify-center gap-1 rounded-xl border py-2.5 text-sm font-semibold ${pay === 'upi' ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line'}`}><QrCode size={15} /> UPI</button>
          </div>
          <Button variant="success" className="w-full" disabled={busy} onClick={deliver}>
            <PackageCheck size={16} /> {busy ? 'Saving…' : `Delivered · ${rupees(order.total)} (${pay === 'upi' ? 'UPI' : 'Cash'})`}
          </Button>
        </div>
      )}
    </Card>
  )
}
