import { CheckCircle2, Circle, ChefHat, Package, Utensils } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOrders } from '../../hooks/useOrders'
import { setOrderStatus } from '../../lib/db'
import { Button, Card, Spinner, EmptyState, Badge } from '../../components/ui'

export default function ChefOrders() {
  const { orders, loading } = useOrders()

  // Chef only sees orders that have been sent to the kitchen and not yet finished.
  const queue = orders.filter((o) => ['sent_to_chef', 'preparing'].includes(o.status))

  const toggleItem = async (order, item) => {
    await supabase.from('order_items').update({ is_ready: !item.is_ready }).eq('id', item.id)
    if (order.status === 'sent_to_chef') await setOrderStatus(order.id, 'preparing')
  }

  const completeOrder = async (order) => {
    await supabase.from('order_items').update({ is_ready: true }).eq('order_id', order.id)
    await setOrderStatus(order.id, 'ready')
  }

  if (loading) return <Spinner />
  if (queue.length === 0) return <EmptyState icon={ChefHat} title="No orders right now" subtitle="New orders appear here automatically." />

  return (
    <div className="space-y-3">
      {queue.map((order) => {
        const ready = order.order_items.filter((i) => i.is_ready).length
        const isDelivery = order.type === 'delivery'
        return (
          <Card key={order.id} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-black">#{order.daily_number}</p>
              <Badge className={isDelivery ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}>
                {isDelivery ? <><Package size={12} className="mr-1 inline" />PACKING</> : <><Utensils size={12} className="mr-1 inline" />DINE-IN</>}
              </Badge>
            </div>
            {(order.table_no || order.customer_name) && (
              <p className="text-xs text-cafe-muted">{order.customer_name}{order.table_no ? ` · Table ${order.table_no}` : ''}</p>
            )}
            <ul className="mt-3 space-y-1">
              {order.order_items.filter((i) => i.is_available !== false).map((it) => (
                <li key={it.id}>
                  <button onClick={() => toggleItem(order, it)}
                    className="flex w-full items-center gap-3 rounded-xl bg-cafe-bg px-3 py-2.5 text-left">
                    {it.is_ready ? <CheckCircle2 className="text-emerald-400" size={22} /> : <Circle className="text-cafe-muted" size={22} />}
                    <span className={`flex-1 font-semibold ${it.is_ready ? 'text-cafe-muted line-through' : ''}`}>
                      {it.quantity}× {it.name_snapshot}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-cafe-muted">{ready}/{order.order_items.length} items ready</p>
            <Button variant="success" onClick={() => completeOrder(order)} className="mt-3 w-full">
              <CheckCircle2 size={18} /> {isDelivery ? 'Order packed & ready' : 'Order complete'}
            </Button>
          </Card>
        )
      })}
    </div>
  )
}
