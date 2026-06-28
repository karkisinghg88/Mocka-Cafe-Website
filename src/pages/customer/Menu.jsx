import { useEffect, useMemo, useState } from 'react'
import { Plus, Minus, Search, ImageIcon, UtensilsCrossed } from 'lucide-react'
import { getMenu, getSettings } from '../../lib/db'
import { useCart } from '../../context/CartContext'
import { rupees, openStatus } from '../../lib/format'
import { Spinner, EmptyState, Input } from '../../components/ui'

function Stepper({ item, variant }) {
  const { qtyOf, add, dec } = useCart()
  const qty = qtyOf(item, variant)
  if (qty === 0) {
    return (
      <button onClick={() => add(item, variant)} className="flex items-center gap-1 rounded-xl bg-cafe-accent px-3 py-2 text-sm font-bold text-black">
        <Plus size={16} /> Add
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => dec(item, variant)} className="rounded-lg bg-cafe-line p-2"><Minus size={16} /></button>
      <span className="w-5 text-center font-bold">{qty}</span>
      <button onClick={() => add(item, variant)} className="rounded-lg bg-cafe-accent p-2 text-black"><Plus size={16} /></button>
    </div>
  )
}

export default function Menu() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [closedDates, setClosedDates] = useState([])

  useEffect(() => { getMenu().then((d) => { setItems(d.filter((i) => i.is_available)); setLoading(false) }) }, [])
  useEffect(() => { getSettings().then((s) => setClosedDates(s.closed_dates || [])).catch(() => {}) }, [])

  const categories = useMemo(() => ['All', ...new Set(items.map((i) => i.category))], [items])
  const filtered = items.filter((i) =>
    (cat === 'All' || i.category === cat) && i.name.toLowerCase().includes(q.toLowerCase()))

  if (loading) return <Spinner />

  const status = openStatus(closedDates)

  return (
    <div className="space-y-4">
      {!status.open && (
        <div className="rounded-xl border border-yellow-600/40 bg-yellow-500/10 px-4 py-3 text-center text-sm text-yellow-300">
          {status.reason} Orders cannot be placed right now.
        </div>
      )}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cafe-muted" />
        <Input placeholder="Search the menu…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {categories.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ${c === cat ? 'bg-cafe-accent text-black' : 'bg-cafe-card text-cafe-muted border border-cafe-line'}`}>
            {c}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="Nothing here yet" subtitle="Check back soon." />
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const variants = (m.variants || []).filter((v) => v.is_available !== false)
            return (
              <div key={m.id} className="rounded-2xl border border-cafe-line bg-cafe-card p-3">
                <div className="flex items-start gap-3">
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-cafe-bg">
                    {m.image_url
                      ? <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center text-cafe-muted"><ImageIcon size={20} /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{m.name}</p>
                    {m.description && <p className="text-xs text-cafe-muted">{m.description}</p>}
                    {variants.length === 0 && (
                      <div className="mt-2 flex items-center justify-between">
                        <p className="font-bold text-cafe-accent">{rupees(m.price)}</p>
                        <Stepper item={m} />
                      </div>
                    )}
                  </div>
                </div>

                {variants.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-cafe-line pt-2">
                    {variants.map((v) => (
                      <div key={v.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm">{v.name} · <span className="font-bold text-cafe-accent">{rupees(v.price)}</span></span>
                        <Stepper item={m} variant={{ name: v.name, price: v.price }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
