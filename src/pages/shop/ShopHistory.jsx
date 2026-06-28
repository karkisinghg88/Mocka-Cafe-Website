import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { rupees } from '../../lib/format'
import { Card, Spinner, EmptyState, Badge } from '../../components/ui'

export default function ShopHistory() {
  const { user } = useAuth()
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('purchase_items').select('*').eq('shopkeeper_id', user.id)
      .order('business_date', { ascending: false }).order('created_at')
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach((p) => { (map[p.business_date] ||= []).push(p) })
        setDays(Object.entries(map).map(([date, items]) => ({ date, items })))
        setLoading(false)
      })
  }, [user.id])

  if (loading) return <Spinner />
  if (days.length === 0) return <EmptyState icon={History} title="No history yet" subtitle="Past daily lists will appear here." />

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Daily history</h2>
      {days.map(({ date, items }) => {
        const total = items.filter((i) => i.status !== 'unavailable').reduce((s, i) => s + Number(i.qty) * Number(i.unit_price || 0), 0)
        return (
          <Card key={date} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-bold">{new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
              <span className="font-bold text-cafe-accent">{rupees(total)}</span>
            </div>
            <ul className="space-y-1 text-sm">
              {items.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span className={p.status === 'unavailable' ? 'text-cafe-muted line-through' : ''}>{p.qty} {p.unit} · {p.name}</span>
                  <span className="flex items-center gap-2 text-cafe-muted">
                    {rupees(Number(p.qty) * Number(p.unit_price || 0))}
                    {p.paid && <Badge className="bg-emerald-500/15 text-emerald-400">{p.payment_method === 'upi' ? 'UPI' : 'Cash'}</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}
