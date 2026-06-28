import { useEffect, useState, useCallback } from 'react'
import { Plus, Minus, Search, Trash2, ClipboardList } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getInventory, getPurchaseItems, addPurchaseItem, deletePurchaseItem } from '../../lib/db'
import { todayISO } from '../../lib/format'
import { Card, Input, Button, Spinner, EmptyState, Badge } from '../../components/ui'

const STATUS = {
  pending: { t: 'Requested', c: 'bg-yellow-500/15 text-yellow-400' },
  assigned: { t: 'Sent to shop', c: 'bg-blue-500/15 text-blue-400' },
  packed: { t: 'Packed', c: 'bg-emerald-500/15 text-emerald-400' },
  unavailable: { t: 'Not available', c: 'bg-red-500/15 text-red-400' },
  purchased: { t: 'Bought ✓', c: 'bg-cafe-accent/20 text-cafe-accent' },
}

export default function ChefSupplies() {
  const [inventory, setInventory] = useState([])
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [qty, setQty] = useState({}) // itemId -> qty

  const load = useCallback(async () => {
    const [inv, items] = await Promise.all([getInventory(), getPurchaseItems(todayISO())])
    setInventory(inv); setList(items); setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('chef-supplies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_items' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const setQ2 = (id, v) => setQty((m) => ({ ...m, [id]: Math.max(0, v) }))
  const add = async (item) => {
    const n = qty[item.id] || 1
    await addPurchaseItem({ item, qty: n, addedRole: 'chef' })
    setQ2(item.id, 0)
  }

  if (loading) return <Spinner />

  const filtered = inventory.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Need to buy</h2>
        <p className="text-sm text-cafe-muted">Low or out of stock? Add raw items here for the owner to order.</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cafe-muted" />
        <Input placeholder="Find a raw item…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {q && (
        <div className="space-y-1">
          {filtered.length === 0 && <p className="text-sm text-cafe-muted">No item. Ask the owner to add it to the raw-items list.</p>}
          {filtered.map((it) => {
            const n = qty[it.id] || 1
            return (
              <div key={it.id} className="flex items-center justify-between rounded-xl bg-cafe-card border border-cafe-line px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{it.name}</p>
                  <p className="text-xs text-cafe-muted">{it.current_qty} {it.unit} in stock</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQ2(it.id, n - 1)} className="rounded-lg bg-cafe-line p-1.5"><Minus size={14} /></button>
                  <span className="w-6 text-center text-sm font-semibold">{n}</span>
                  <button onClick={() => setQ2(it.id, n + 1)} className="rounded-lg bg-cafe-line p-1.5"><Plus size={14} /></button>
                  <Button className="ml-1 px-3 py-2" onClick={() => add(it)}>Add</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-cafe-muted">Today's request list ({list.length})</p>
        {list.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing requested yet" subtitle="Search above and add what's running low." />
        ) : (
          <div className="space-y-2">
            {list.map((p) => (
              <Card key={p.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.qty} {p.unit} · {p.name}</p>
                  <p className="text-xs text-cafe-muted">{p.added_role === 'chef' ? 'Added by kitchen' : 'Added by owner'}</p>
                </div>
                <Badge className={STATUS[p.status]?.c}>{STATUS[p.status]?.t}</Badge>
                {p.status === 'pending' && (
                  <button onClick={() => deletePurchaseItem(p.id)} className="rounded-lg p-2 text-cafe-muted hover:text-red-400"><Trash2 size={16} /></button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
