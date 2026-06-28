import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { rupees } from '../../lib/format'
import { Card, Spinner, EmptyState, Badge } from '../../components/ui'

export default function RiderHistory() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('orders').select('*')
      .eq('rider_id', user.id).in('status', ['delivered', 'paid'])
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { setOrders(data || []); setLoading(false) })
  }, [user.id])

  if (loading) return <Spinner />
  if (orders.length === 0) return <EmptyState icon={History} title="No deliveries yet" subtitle="Completed deliveries will appear here." />

  const total = orders.reduce((s, o) => s + Number(o.total), 0)
  const cash = orders.filter((o) => o.payment_method === 'cash').reduce((s, o) => s + Number(o.total), 0)
  const upi = orders.filter((o) => o.payment_method === 'upi').reduce((s, o) => s + Number(o.total), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3"><p className="text-xs text-cafe-muted">Delivered</p><p className="text-lg font-black">{orders.length}</p></Card>
        <Card className="p-3"><p className="text-xs text-cafe-muted">Cash</p><p className="text-lg font-black">{rupees(cash)}</p></Card>
        <Card className="p-3"><p className="text-xs text-cafe-muted">UPI</p><p className="text-lg font-black">{rupees(upi)}</p></Card>
      </div>
      {orders.map((o) => (
        <Card key={o.id} className="flex items-center justify-between p-3">
          <div>
            <p className="font-semibold">#{o.daily_number} · {o.customer_name}</p>
            <p className="text-xs text-cafe-muted">{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-cafe-accent">{rupees(o.total)}</p>
            <Badge className="bg-emerald-500/15 text-emerald-400">{o.payment_method === 'upi' ? 'UPI' : 'Cash'}</Badge>
          </div>
        </Card>
      ))}
      <p className="text-center text-sm text-cafe-muted">Total collected: <span className="font-bold text-cafe-accent">{rupees(total)}</span></p>
    </div>
  )
}
