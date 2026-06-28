import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { rupees, STATUS_LABELS, STATUS_COLORS } from '../lib/format'
import { Badge } from './ui'

function paymentLabel(order) {
  if (order.payment_method === 'both') return `Cash ${rupees(order.cash_amount)} + UPI ${rupees(order.upi_amount)}`
  if (order.payment_method === 'upi') return 'UPI'
  if (order.payment_method === 'cod') return 'Cash on delivery'
  return 'Cash'
}

// Collapsed: order # + total. Expanded: item-by-item breakdown.
export default function BillRow({ order, showStatus = false }) {
  const [open, setOpen] = useState(false)
  const items = order.order_items || []
  return (
    <div className="rounded-2xl border border-cafe-line bg-cafe-card">
      <button onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm">
          <ChevronDown size={16} className={`text-cafe-muted transition ${open ? 'rotate-180' : ''}`} />
          <span className="font-semibold">#{order.daily_number}</span>
          <span className="text-cafe-muted">{order.customer_name || 'Walk-in'}</span>
          {showStatus && <Badge className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</Badge>}
        </span>
        <span className="font-bold text-cafe-accent">{rupees(order.total)}</span>
      </button>

      {open && (
        <div className="border-t border-cafe-line px-4 py-3">
          <ul className="space-y-1 text-sm">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between">
                <span className={it.is_available === false ? 'text-cafe-muted line-through' : ''}>
                  {it.quantity}× {it.name_snapshot}
                </span>
                <span className="text-cafe-muted">{rupees(it.price_snapshot * it.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-1 border-t border-cafe-line pt-2 text-sm">
            {order.delivery_charge > 0 && (
              <div className="flex justify-between text-cafe-muted"><span>Delivery</span><span>{rupees(order.delivery_charge)}</span></div>
            )}
            <div className="flex justify-between font-semibold"><span>Total</span><span className="text-cafe-accent">{rupees(order.total)}</span></div>
            <div className="flex justify-between text-xs text-cafe-muted">
              <span>{order.type === 'delivery' ? 'Delivery' : 'Dine-in'} · {paymentLabel(order)}</span>
              <span>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
