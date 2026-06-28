import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Store, Banknote, QrCode, PackageCheck, AlertTriangle, ShoppingBag, Truck, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  getShopkeepers, getInventory, getPurchaseItems, addPurchaseItem,
  assignToShop, updatePurchaseItem, completePurchase, deletePurchaseItem,
} from '../../lib/db'
import { rupees, todayISO } from '../../lib/format'
import { Button, Card, Input, Modal, Spinner, EmptyState, Badge } from '../../components/ui'

export default function Purchasing() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [shops, setShops] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const [it, sk, inv] = await Promise.all([getPurchaseItems(todayISO()), getShopkeepers(), getInventory()])
    setItems(it); setShops(sk); setInventory(inv); setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('admin-purchasing')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_items' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const shopName = (id) => { const s = shops.find((x) => x.id === id); return s?.shop_name || s?.full_name || 'Shop' }

  const assignPool = items.filter((i) => i.source === 'shop' && ['pending', 'unavailable'].includes(i.status))
  const storePool = items.filter((i) => i.source === 'store' && i.status !== 'purchased')
  const atShops = useMemo(() => {
    const g = {}
    items.filter((i) => i.source === 'shop' && ['assigned', 'packed'].includes(i.status))
      .forEach((i) => { (g[i.shopkeeper_id] ||= []).push(i) })
    return g
  }, [items])
  const purchased = items.filter((i) => i.status === 'purchased')

  const lowStock = inventory.filter((i) => Number(i.low_stock_threshold) > 0 && Number(i.current_qty) <= Number(i.low_stock_threshold))
  const addAllLow = async () => {
    const have = new Set(items.map((i) => i.inventory_item_id))
    for (const inv of lowStock) {
      if (!have.has(inv.id)) await addPurchaseItem({ item: inv, qty: inv.low_stock_threshold || 1, addedRole: 'admin' })
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Buy list</h2>
        <div className="flex gap-2">
          <Button variant="ghost" className="px-3" onClick={() => navigate('/admin/staff')}><Store size={16} /> Shops</Button>
          <Button className="px-3" onClick={() => setAdding(true)}><Plus size={16} /> Add</Button>
        </div>
      </div>

      {lowStock.length > 0 && (
        <button onClick={addAllLow} className="flex w-full items-center gap-2 rounded-xl border border-red-600/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={16} /> {lowStock.length} item(s) low in stock, tap to add all to the buy list
        </button>
      )}

      {/* TO ASSIGN */}
      <Section title="To assign" icon={ShoppingBag} count={assignPool.length}>
        {assignPool.length === 0 ? <Empty>Nothing waiting. Add items or pull in low stock.</Empty> : assignPool.map((it) => (
          <Card key={it.id} className="p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{it.qty} {it.unit} · {it.name}</p>
              <span className="text-xs text-cafe-muted">{it.added_role === 'chef' ? 'kitchen' : 'owner'}</span>
            </div>
            {it.status === 'unavailable' && <p className="mt-0.5 text-xs text-red-400">Returned, {shopName(it.shopkeeper_id)} didn't have it</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {shops.map((s) => (
                <button key={s.id} onClick={() => assignToShop(it.id, s.id)}
                  className="rounded-lg bg-cafe-line px-3 py-1.5 text-xs font-semibold hover:bg-cafe-accent hover:text-black">
                  → {s.shop_name || s.full_name}
                </button>
              ))}
              <button onClick={() => updatePurchaseItem(it.id, { source: 'store', status: 'pending', shopkeeper_id: null })}
                className="rounded-lg bg-cafe-line px-3 py-1.5 text-xs font-semibold hover:bg-white hover:text-black">
                Buy from store
              </button>
              <button onClick={() => deletePurchaseItem(it.id)} className="rounded-lg px-2 py-1.5 text-xs text-cafe-muted hover:text-red-400">Remove</button>
            </div>
          </Card>
        ))}
      </Section>

      {/* AT SHOPS */}
      <Section title="With shops" icon={Truck} count={Object.keys(atShops).length}>
        {Object.keys(atShops).length === 0 ? <Empty>No items assigned to shops yet.</Empty> : Object.entries(atShops).map(([sid, list]) => (
          <ShopGroup key={sid} name={shopName(sid)} list={list} onReload={load} />
        ))}
      </Section>

      {/* STORE */}
      <Section title="Buy from store myself" icon={ShoppingBag} count={storePool.length}>
        {storePool.length === 0 ? <Empty>Items you'll buy directly will show here.</Empty> : storePool.map((it) => (
          <StoreItem key={it.id} item={it} />
        ))}
      </Section>

      {/* DONE TODAY */}
      {purchased.length > 0 && (
        <Section title="Bought today" icon={PackageCheck} count={purchased.length}>
          {purchased.map((it) => (
            <Card key={it.id} className="flex items-center justify-between p-3 opacity-80">
              <span className="text-sm">{it.qty} {it.unit} · {it.name}</span>
              <span className="flex items-center gap-2 text-sm">
                {rupees(Number(it.qty) * Number(it.unit_price))}
                <Badge className="bg-emerald-500/15 text-emerald-400">{it.payment_method === 'upi' ? 'UPI' : 'Cash'}</Badge>
              </span>
            </Card>
          ))}
        </Section>
      )}

      {adding && <AddModal inventory={inventory} onClose={() => setAdding(false)} />}
    </div>
  )
}

function Section({ title, icon: Icon, count, children }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-cafe-accent">
        <Icon size={15} /> {title} <span className="text-xs font-normal text-cafe-muted">({count})</span>
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
const Empty = ({ children }) => <p className="rounded-xl border border-cafe-line bg-cafe-card p-3 text-sm text-cafe-muted">{children}</p>

function ShopGroup({ name, list, onReload }) {
  const [paying, setPaying] = useState(false)
  const total = list.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price || 0), 0)
  const allPacked = list.every((i) => i.status === 'packed')

  const pickup = async (method) => {
    setPaying(true)
    try { for (const it of list) await completePurchase(it, method); await onReload() }
    finally { setPaying(false) }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-bold">{name}</p>
        <Badge className={allPacked ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'}>
          {allPacked ? 'Packed' : 'Packing…'}
        </Badge>
      </div>
      <ul className="space-y-1 text-sm">
        {list.map((it) => (
          <li key={it.id} className="flex items-center justify-between">
            <span>{it.qty} {it.unit} · {it.name}</span>
            <span className="text-cafe-muted">{it.unit_price ? rupees(Number(it.qty) * Number(it.unit_price)) : 'n/a'}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between border-t border-cafe-line pt-3">
        <span className="text-cafe-muted">Total</span><span className="text-lg font-bold text-cafe-accent">{rupees(total)}</span>
      </div>
      {allPacked && total > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="success" disabled={paying} onClick={() => pickup('cash')}><Banknote size={16} /> Picked · Cash</Button>
          <Button disabled={paying} onClick={() => pickup('upi')}><QrCode size={16} /> Picked · UPI</Button>
        </div>
      )}
      {!allPacked && <p className="mt-2 text-xs text-cafe-muted">Waiting for the shop to price &amp; pack.</p>}
    </Card>
  )
}

function StoreItem({ item }) {
  const [price, setPrice] = useState(item.unit_price || '')
  const [busy, setBusy] = useState(false)
  const buy = async (method) => {
    setBusy(true)
    try { await updatePurchaseItem(item.id, { unit_price: Number(price) || 0 }); await completePurchase({ ...item, unit_price: Number(price) || 0 }, method) }
    finally { setBusy(false) }
  }
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">{item.qty} {item.unit} · {item.name}</p>
        <span className="text-sm font-bold text-cafe-accent">{rupees(item.qty * (Number(price) || 0))}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-cafe-bg border border-cafe-line px-2">
          <span className="text-sm text-cafe-muted">₹</span>
          <input type="number" min="0" step="any" value={price} placeholder="price/unit"
            onChange={(e) => setPrice(e.target.value)} className="w-20 bg-transparent py-2 text-sm outline-none" />
        </div>
        <Button variant="success" className="ml-auto px-3 py-2" disabled={busy || !price} onClick={() => buy('cash')}><Banknote size={14} /> Cash</Button>
        <Button className="px-3 py-2" disabled={busy || !price} onClick={() => buy('upi')}><QrCode size={14} /> UPI</Button>
      </div>
    </Card>
  )
}

function AddModal({ inventory, onClose }) {
  const [q, setQ] = useState('')
  const [qty, setQty] = useState({})
  const filtered = inventory.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
  const add = async (item) => { await addPurchaseItem({ item, qty: qty[item.id] || 1, addedRole: 'admin' }); onClose() }
  return (
    <Modal open onClose={onClose} title="Add to buy list">
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cafe-muted" />
          <Input placeholder="Find a raw item…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.map((it) => (
            <div key={it.id} className="flex items-center justify-between rounded-xl bg-cafe-bg px-3 py-2">
              <div className="min-w-0"><p className="truncate text-sm">{it.name}</p><p className="text-xs text-cafe-muted">{it.current_qty} {it.unit} in stock</p></div>
              <div className="flex items-center gap-2">
                <input type="number" min="1" placeholder="qty" value={qty[it.id] || ''} onChange={(e) => setQty((m) => ({ ...m, [it.id]: Number(e.target.value) }))}
                  className="w-16 rounded-lg bg-cafe-card border border-cafe-line px-2 py-1.5 text-sm" />
                <Button className="px-3 py-2" onClick={() => add(it)}>Add</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}
