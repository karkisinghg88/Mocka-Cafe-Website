import { useEffect, useMemo, useState } from 'react'
import { Plus, Minus, Search, CheckCircle2, Send, Wallet, QrCode, Banknote, Trash2, ArrowLeft, ClipboardList } from 'lucide-react'
import { getMenu, getSettings, createOrder, addOrderItem, updateOrderItemQty, setOrderStatus, recalcOrderTotal, finalizeOrderInventory } from '../../lib/db'
import { useOrders } from '../../hooks/useOrders'
import { supabase } from '../../lib/supabase'
import { rupees, STATUS_LABELS, STATUS_COLORS } from '../../lib/format'
import { Button, Card, Input, Modal, Spinner, EmptyState, Badge } from '../../components/ui'
import BillRow from '../../components/BillRow'

export default function Billing() {
  const [menu, setMenu] = useState([])
  const [settings, setSettings] = useState({})
  const { orders, loading } = useOrders({ types: ['dine_in'] })
  const [building, setBuilding] = useState(false)
  const [editOrder, setEditOrder] = useState(null)
  const [paying, setPaying] = useState(null)

  useEffect(() => { getMenu().then(setMenu); getSettings().then(setSettings) }, [])

  const active = orders.filter((o) => o.status !== 'paid')
  const paid = orders.filter((o) => o.status === 'paid')

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Billing</h2>
        <Button onClick={() => setBuilding(true)}><Plus size={18} /> New order</Button>
      </div>

      {active.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No active orders" subtitle="Create a new order to send to the kitchen." />
      ) : (
        <div className="space-y-3">
          {active.map((o) => (
            <OrderCard key={o.id} order={o} onEdit={() => setEditOrder(o)} onPay={() => setPaying(o)} />
          ))}
        </div>
      )}

      {paid.length > 0 && (
        <div className="pt-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-cafe-muted">Paid bills today ({paid.length})</p>
            <p className="text-sm font-bold text-cafe-accent">{rupees(paid.reduce((s, o) => s + Number(o.total), 0))}</p>
          </div>
          <p className="mb-2 text-xs text-cafe-muted">Tap a bill to see its items.</p>
          <div className="space-y-2">
            {paid.map((o) => <BillRow key={o.id} order={o} />)}
          </div>
        </div>
      )}

      {building && (
        <NewOrderModal menu={menu} onClose={() => setBuilding(false)} />
      )}
      {editOrder && (
        <EditOrderModal order={editOrder} menu={menu} onClose={() => setEditOrder(null)} />
      )}
      {paying && (
        <PaymentModal order={paying} settings={settings} onClose={() => setPaying(null)} />
      )}
    </div>
  )
}

function OrderCard({ order, onEdit, onPay }) {
  const allReady = order.order_items.length > 0 && order.order_items.every((i) => i.is_ready)
  const markDone = () => setOrderStatus(order.id, 'done')

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-black">#{order.daily_number}</p>
          <p className="text-xs text-cafe-muted">
            {order.customer_name || 'Walk-in'}{order.table_no ? ` · Table ${order.table_no}` : ''}
          </p>
        </div>
        <Badge className={STATUS_COLORS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
      </div>

      <ul className="mt-3 space-y-1">
        {order.order_items.map((it) => (
          <li key={it.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {it.is_ready && <CheckCircle2 size={14} className="text-emerald-400" />}
              <span className={it.is_ready ? 'text-cafe-muted line-through' : ''}>
                {it.quantity}× {it.name_snapshot}
              </span>
            </span>
            <span className="text-cafe-muted">{rupees(it.price_snapshot * it.quantity)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-cafe-line pt-3">
        <span className="text-cafe-muted">Total</span>
        <span className="text-lg font-bold text-cafe-accent">{rupees(order.total)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={onEdit}>Edit items</Button>
        {order.status !== 'done'
          ? <Button variant="success" onClick={markDone} disabled={!allReady}>
              {allReady ? 'Mark done' : 'Waiting kitchen'}
            </Button>
          : <Button onClick={onPay}><Wallet size={16} /> Collect · {rupees(order.total)}</Button>}
      </div>
    </Card>
  )
}

// ---- Payment: cash / UPI / both, with amounts ----
function PaymentModal({ order, settings, onClose }) {
  const [method, setMethod] = useState('cash')
  const [cash, setCash] = useState('')
  const [upi, setUpi] = useState('')
  const [saving, setSaving] = useState(false)

  const total = Number(order.total)
  const cashN = Number(cash) || 0
  const upiN = Number(upi) || 0
  const collected = method === 'cash' ? total : method === 'upi' ? total : cashN + upiN
  const remaining = total - collected

  const pay = async () => {
    let cashAmt = 0, upiAmt = 0
    if (method === 'cash') cashAmt = total
    else if (method === 'upi') upiAmt = total
    else { cashAmt = cashN; upiAmt = upiN }
    setSaving(true)
    try {
      await recalcOrderTotal(order.id)
      await setOrderStatus(order.id, 'paid', {
        payment_status: 'received', payment_method: method,
        cash_amount: cashAmt, upi_amount: upiAmt, paid_at: new Date().toISOString(),
      })
      await finalizeOrderInventory(order.id)
      onClose()
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  const Qr = () => (
    <div className="flex flex-col items-center rounded-xl bg-cafe-bg p-3 text-center">
      {settings.upi_qr_url
        ? <img src={settings.upi_qr_url} alt="UPI QR" className="h-40 w-40 rounded-lg bg-white object-contain p-2" />
        : <div className="flex h-40 w-40 items-center justify-center rounded-lg bg-cafe-line text-cafe-muted"><QrCode size={36} /></div>}
      {settings.upi_id && <p className="mt-2 text-sm font-semibold">{settings.upi_id}</p>}
      {!settings.upi_qr_url && <p className="mt-1 text-xs text-cafe-muted">Upload your QR in Settings.</p>}
    </div>
  )

  const tabs = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'upi', label: 'UPI', icon: QrCode },
    { id: 'both', label: 'Both', icon: Wallet },
  ]

  return (
    <Modal open onClose={onClose} title={`Collect payment · #${order.daily_number}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-cafe-bg px-4 py-3">
          <span className="text-cafe-muted">Amount due</span>
          <span className="text-xl font-black text-cafe-accent">{rupees(total)}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setMethod(id)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-semibold ${method === id ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line text-cafe-muted'}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>

        {method === 'upi' && <Qr />}

        {method === 'both' && (
          <div className="space-y-3">
            <Input label="Cash amount (₹)" type="number" min="0" step="any" value={cash} onChange={(e) => setCash(e.target.value)} />
            <Qr />
            <Input label="UPI amount (₹)" type="number" min="0" step="any" value={upi} onChange={(e) => setUpi(e.target.value)} />
            <div className={`flex justify-between rounded-lg px-3 py-2 text-sm ${Math.abs(remaining) < 0.01 ? 'bg-emerald-600/15 text-emerald-400' : 'bg-cafe-bg text-cafe-muted'}`}>
              <span>Cash {rupees(cashN)} + UPI {rupees(upiN)}</span>
              <span>{Math.abs(remaining) < 0.01 ? 'Matches total ✓' : `${remaining > 0 ? 'Short' : 'Over'} ${rupees(Math.abs(remaining))}`}</span>
            </div>
          </div>
        )}

        <Button onClick={pay} disabled={saving || (method === 'both' && collected <= 0)} className="w-full">
          {saving ? 'Saving…' : `Mark paid · ${rupees(total)}`}
        </Button>
      </div>
    </Modal>
  )
}

// key + helpers for variant-aware billing cart
const keyOf = (item, variant) => `${item.id}|${variant?.name || ''}`
const priceOf = (item, variant) => Number(variant ? variant.price : item.price)
const nameOf = (item, variant) => item.name + (variant ? ` (${variant.name})` : '')

// A search-result row: single +/- if no variants, else one row per variant.
function PickRow({ item, cart, inc, dec }) {
  const variants = (item.variants || []).filter((v) => v.is_available !== false)
  const Ctrl = ({ variant }) => {
    const qty = cart[keyOf(item, variant)]?.qty || 0
    return (
      <div className="flex items-center gap-2">
        {qty > 0 && (<>
          <button onClick={() => dec(item, variant)} className="rounded-lg bg-cafe-line p-1.5"><Minus size={14} /></button>
          <span className="w-5 text-center text-sm font-semibold">{qty}</span>
        </>)}
        <button onClick={() => inc(item, variant)} className="rounded-lg bg-cafe-accent p-1.5 text-black"><Plus size={14} /></button>
      </div>
    )
  }
  if (variants.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-cafe-bg px-3 py-2">
        <div className="min-w-0"><p className="text-sm">{item.name}</p><p className="text-xs text-cafe-muted">{rupees(item.price)}</p></div>
        <Ctrl variant={null} />
      </div>
    )
  }
  return (
    <div className="rounded-xl bg-cafe-bg px-3 py-2">
      <p className="text-sm font-semibold">{item.name}</p>
      <div className="mt-1 space-y-1">
        {variants.map((v) => (
          <div key={v.id} className="flex items-center justify-between">
            <span className="text-sm text-cafe-muted">{v.name} · {rupees(v.price)}</span>
            <Ctrl variant={{ name: v.name, price: v.price }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- New order builder (build items, then review, then send) ----
function NewOrderModal({ menu, onClose }) {
  const [cart, setCart] = useState({}) // key -> { item, variant, qty }
  const [customer, setCustomer] = useState('')
  const [table, setTable] = useState('')
  const [q, setQ] = useState('')
  const [step, setStep] = useState('build') // 'build' | 'review'
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(
    () => menu.filter((m) => m.is_available && m.name.toLowerCase().includes(q.toLowerCase())),
    [menu, q]
  )
  const inc = (item, variant) => setCart((c) => { const k = keyOf(item, variant); return { ...c, [k]: { item, variant, qty: (c[k]?.qty || 0) + 1 } } })
  const dec = (item, variant) => setCart((c) => { const k = keyOf(item, variant); const n = (c[k]?.qty || 0) - 1; const x = { ...c }; if (n <= 0) delete x[k]; else x[k] = { ...x[k], qty: n }; return x })
  const removeLine = (item, variant) => setCart((c) => { const x = { ...c }; delete x[keyOf(item, variant)]; return x })

  const lines = Object.values(cart)
  const count = lines.reduce((s, l) => s + l.qty, 0)
  const total = lines.reduce((s, l) => s + priceOf(l.item, l.variant) * l.qty, 0)

  const submit = async () => {
    if (lines.length === 0) return
    setSaving(true)
    try {
      await createOrder({
        type: 'dine_in',
        status: 'sent_to_chef',
        customer_name: customer.trim(),
        table_no: table.trim(),
        items: lines.map((l) => ({
          menu_item_id: l.item.id, name_snapshot: nameOf(l.item, l.variant),
          price_snapshot: priceOf(l.item, l.variant), quantity: l.qty,
        })),
      })
      onClose()
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={step === 'review' ? 'Review order' : 'New order'}>
      {step === 'build' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Customer name" value={customer} onChange={(e) => setCustomer(e.target.value)} />
            <Input placeholder="Table no." value={table} onChange={(e) => setTable(e.target.value)} />
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cafe-muted" />
            <Input placeholder="Search menu…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {filtered.map((m) => <PickRow key={m.id} item={m} cart={cart} inc={inc} dec={dec} />)}
          </div>

          <div className="flex items-center justify-between border-t border-cafe-line pt-3">
            <span className="text-cafe-muted">{count} item{count === 1 ? '' : 's'}</span>
            <span className="text-lg font-bold text-cafe-accent">{rupees(total)}</span>
          </div>
          <Button onClick={() => setStep('review')} disabled={lines.length === 0} className="w-full">
            <ClipboardList size={16} /> Review order{count ? ` · ${count} item${count === 1 ? '' : 's'}` : ''}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-cafe-muted">Check the order, change quantity or remove items, then send to the kitchen.</p>
          {(customer || table) && (
            <p className="text-sm font-semibold">{customer || 'Walk-in'}{table ? ` · Table ${table}` : ''}</p>
          )}

          {lines.length === 0 ? (
            <p className="rounded-xl bg-cafe-bg px-3 py-4 text-center text-sm text-cafe-muted">No items left. Go back to add some.</p>
          ) : (
            <div className="space-y-1">
              {lines.map((l) => (
                <div key={keyOf(l.item, l.variant)} className="flex items-center gap-2 rounded-xl bg-cafe-bg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">{nameOf(l.item, l.variant)}</p>
                    <p className="text-xs text-cafe-muted">{rupees(priceOf(l.item, l.variant) * l.qty)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => dec(l.item, l.variant)} className="rounded-lg bg-cafe-line p-1.5"><Minus size={14} /></button>
                    <span className="w-5 text-center text-sm font-semibold">{l.qty}</span>
                    <button onClick={() => inc(l.item, l.variant)} className="rounded-lg bg-cafe-accent p-1.5 text-black"><Plus size={14} /></button>
                  </div>
                  <button onClick={() => removeLine(l.item, l.variant)} className="rounded-lg p-1.5 text-cafe-muted hover:text-red-400" aria-label="Remove item"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-cafe-line pt-3">
            <span className="text-cafe-muted">Total</span>
            <span className="text-lg font-bold text-cafe-accent">{rupees(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => setStep('build')}><ArrowLeft size={16} /> Add more items</Button>
            <Button variant="success" onClick={submit} disabled={saving || lines.length === 0}>
              <Send size={16} /> {saving ? 'Sending…' : 'Send to kitchen'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---- Edit existing order ----
function EditOrderModal({ order, menu, onClose }) {
  const [items, setItems] = useState(order.order_items)
  const [q, setQ] = useState('')

  const refresh = async () => {
    const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id).order('created_at')
    setItems(data || [])
  }

  const changeQty = async (it, qty) => { await updateOrderItemQty(it.id, order.id, qty); await refresh() }
  const add = async (m, variant) => { await addOrderItem(order.id, m, variant); await refresh() }

  const filtered = menu.filter((m) => m.is_available && m.name.toLowerCase().includes(q.toLowerCase()))
  const total = items.reduce((s, it) => s + it.price_snapshot * it.quantity, 0)
  // Flatten each menu item into its addable choices (variants, or the item itself).
  const choices = filtered.flatMap((m) => {
    const vs = (m.variants || []).filter((v) => v.is_available !== false)
    return vs.length ? vs.map((v) => ({ m, variant: { name: v.name, price: v.price }, label: `${m.name} (${v.name})`, price: v.price }))
                     : [{ m, variant: null, label: m.name, price: m.price }]
  })

  return (
    <Modal open onClose={onClose} title={`Edit order #${order.daily_number}`}>
      <div className="space-y-3">
        <p className="text-xs text-cafe-muted">Changes are saved instantly and update the kitchen view.</p>
        <div className="space-y-1">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 rounded-xl bg-cafe-bg px-3 py-2">
              <span className="min-w-0 flex-1 text-sm">{it.name_snapshot}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => changeQty(it, it.quantity - 1)} className="rounded-lg bg-cafe-line p-1.5"><Minus size={14} /></button>
                <span className="w-5 text-center text-sm font-semibold">{it.quantity}</span>
                <button onClick={() => changeQty(it, it.quantity + 1)} className="rounded-lg bg-cafe-accent p-1.5 text-black"><Plus size={14} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cafe-muted" />
          <Input placeholder="Add item…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {q && (
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {choices.map((ch, i) => (
              <button key={i} onClick={() => add(ch.m, ch.variant)}
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-cafe-bg px-3 py-2 text-left text-sm hover:bg-cafe-line">
                <span className="min-w-0 flex-1">{ch.label}</span><span className="text-cafe-accent">{rupees(ch.price)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-cafe-line pt-3">
          <span className="text-cafe-muted">Total</span>
          <span className="text-lg font-bold text-cafe-accent">{rupees(total)}</span>
        </div>
        <Button onClick={onClose} className="w-full">Done</Button>
      </div>
    </Modal>
  )
}
