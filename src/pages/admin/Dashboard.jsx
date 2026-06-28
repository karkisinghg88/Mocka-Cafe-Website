import { useNavigate } from 'react-router-dom'
import { ReceiptText, Bike, Boxes, BarChart3, UtensilsCrossed, ChefHat, Users } from 'lucide-react'
import { useOrders } from '../../hooks/useOrders'
import { Card, Spinner } from '../../components/ui'
import { rupees } from '../../lib/format'

export default function Dashboard() {
  const navigate = useNavigate()
  const { orders, loading } = useOrders()

  if (loading) return <Spinner />

  const paid = orders.filter((o) => o.payment_status === 'received' || o.status === 'paid')
  const salesToday = paid.reduce((s, o) => s + Number(o.total), 0)
  const activeKitchen = orders.filter((o) => ['sent_to_chef', 'preparing', 'ready'].includes(o.status))
  const pendingDelivery = orders.filter((o) => o.type === 'delivery' && o.status === 'pending')

  const stats = [
    { label: "Today's sales", value: rupees(salesToday), accent: true },
    { label: 'Orders today', value: orders.length },
    { label: 'In kitchen', value: activeKitchen.length },
    { label: 'Delivery requests', value: pendingDelivery.length },
  ]

  const actions = [
    { icon: ReceiptText, label: 'New bill / orders', to: '/admin/billing' },
    { icon: Bike, label: 'Delivery requests', to: '/admin/delivery', badge: pendingDelivery.length },
    { icon: UtensilsCrossed, label: 'Edit menu', to: '/admin/menu' },
    { icon: Boxes, label: 'Inventory', to: '/admin/inventory' },
    { icon: BarChart3, label: 'Reports', to: '/admin/reports' },
    { icon: Users, label: 'Staff & accounts', to: '/admin/staff' },
    { icon: ChefHat, label: 'Open kitchen view', to: '/chef' },
  ]

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cafe-muted">Today at a glance</h2>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="p-4">
              <p className="text-xs text-cafe-muted">{s.label}</p>
              <p className={`mt-1 text-2xl font-black ${s.accent ? 'text-cafe-accent' : 'text-white'}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-cafe-line pt-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cafe-muted">Manage</h2>
        <div className="grid grid-cols-2 gap-3">
        {actions.map(({ icon: Icon, label, to, badge }) => (
          <button key={to} onClick={() => navigate(to)}
            className="relative flex flex-col items-start gap-3 rounded-2xl border border-cafe-line bg-cafe-card p-4 text-left transition hover:border-cafe-accent/60">
            <Icon className="text-cafe-accent" size={24} />
            <span className="text-sm font-semibold">{label}</span>
            {badge > 0 && (
              <span className="absolute right-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-cafe-accent px-1.5 text-xs font-bold text-black">
                {badge}
              </span>
            )}
          </button>
        ))}
        </div>
      </section>
    </div>
  )
}
