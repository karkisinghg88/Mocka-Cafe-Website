import { useEffect, useState, useCallback } from 'react'
import { PackageCheck, Ban, RotateCcw, ClipboardList } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { updatePurchaseItem, markUnavailable } from '../../lib/db'
import { rupees, todayISO } from '../../lib/format'
import { Card, Button, Spinner, EmptyState } from '../../components/ui'

export default function ShopToday() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('purchase_items')
      .select('*').eq('shopkeeper_id', user.id).eq('business_date', todayISO())
      .order('created_at')
    setItems(data || []); setLoading(false)
  }, [user.id])

  useEffect(() => {
    load()
    const ch = supabase.channel('shop-today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_items', filter: `shopkeeper_id=eq.${user.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, user.id])

  const setPrice = async (id, price) => { await updatePurchaseItem(id, { unit_price: Number(price) || 0 }) }
  const toggleNA = async (it) => {
    if (it.status === 'unavailable') await updatePurchaseItem(it.id, { status: 'assigned' })
    else await markUnavailable(it.id)
  }
  const packAll = async () => {
    const ready = items.filter((i) => i.status === 'assigned')
    await Promise.all(ready.map((i) => updatePurchaseItem(i.id, { status: 'packed', packed_at: new Date().toISOString() })))
  }

  if (loading) return <Spinner />
  if (items.length === 0) return <EmptyState icon={ClipboardList} title="No list yet today" subtitle="When the cafe assigns items, they show here." />

  const active = items.filter((i) => i.status !== 'unavailable')
  const total = active.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price || 0), 0)
  const allPacked = items.every((i) => i.status === 'packed' || i.status === 'unavailable' || i.status === 'purchased')
  const anyToPack = items.some((i) => i.status === 'assigned')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Today's order</h2>
        <p className="text-sm text-cafe-muted">Enter your price per item. Mark anything you don't have as "Not available".</p>
      </div>

      <div className="space-y-2">
        {items.map((it) => {
          const na = it.status === 'unavailable'
          const line = Number(it.qty) * Number(it.unit_price || 0)
          return (
            <Card key={it.id} className={`p-3 ${na ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <p className={`font-semibold ${na ? 'line-through' : ''}`}>{it.name}</p>
                <span className="text-sm text-cafe-muted">{it.qty} {it.unit}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg bg-cafe-bg border border-cafe-line px-2">
                  <span className="text-sm text-cafe-muted">₹</span>
                  <input type="number" min="0" step="any" disabled={na || it.status === 'purchased'}
                    defaultValue={it.unit_price || ''} placeholder="price/unit"
                    onBlur={(e) => setPrice(it.id, e.target.value)}
                    className="w-24 bg-transparent py-2 text-sm outline-none disabled:opacity-50" />
                  <span className="text-xs text-cafe-muted">/{it.unit}</span>
                </div>
                <span className="ml-auto font-bold text-cafe-accent">{na ? 'n/a' : rupees(line)}</span>
                {it.status !== 'purchased' && (
                  <button onClick={() => toggleNA(it)}
                    className={`rounded-lg p-2 ${na ? 'text-cafe-muted hover:text-white' : 'text-red-400'}`}
                    title={na ? 'Available again' : 'Mark not available'}>
                    {na ? <RotateCcw size={16} /> : <Ban size={16} />}
                  </button>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="flex items-center justify-between p-4">
        <span className="text-cafe-muted">Total to pack</span>
        <span className="text-2xl font-black text-cafe-accent">{rupees(total)}</span>
      </Card>

      {anyToPack ? (
        <Button variant="success" className="w-full" onClick={packAll}>
          <PackageCheck size={18} /> Finalize &amp; mark packed
        </Button>
      ) : allPacked ? (
        <p className="text-center text-sm font-semibold text-emerald-400">All packed, ready for pickup ✓</p>
      ) : null}
    </div>
  )
}
