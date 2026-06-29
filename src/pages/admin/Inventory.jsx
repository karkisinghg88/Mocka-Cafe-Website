import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, ShoppingCart, Boxes, Blend, X, ArrowRight, ClipboardList, ClipboardCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { rupees } from '../../lib/format'
import { convertInventory, saveStockCount } from '../../lib/db'
import { Button, Card, Input, Select, Modal, Spinner, EmptyState } from '../../components/ui'
import RestockModal from '../../components/RestockModal'

const EMPTY = { name: '', category: 'kitchen', unit: 'pcs', current_qty: '', unit_cost: '', low_stock_threshold: '', shelf_life_days: '' }

const isLow = (it) => Number(it.low_stock_threshold) > 0 && Number(it.current_qty) <= Number(it.low_stock_threshold)

export default function Inventory() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [buy, setBuy] = useState(null) // item being restocked
  const [convert, setConvert] = useState(false) // make/convert modal
  const [counting, setCounting] = useState(false) // stock count modal

  const load = async () => {
    const { data } = await supabase.from('inventory_items').select('*').order('category').order('name')
    setItems(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const openNew = () => { setForm(EMPTY); setEditId(null); setOpen(true) }
  const openEdit = (it) => { setForm({ ...it, current_qty: String(it.current_qty), unit_cost: String(it.unit_cost), low_stock_threshold: String(it.low_stock_threshold ?? ''), shelf_life_days: String(it.shelf_life_days ?? '') }); setEditId(it.id); setOpen(true) }

  const save = async (e) => {
    e.preventDefault()
    const payload = {
      name: form.name.trim(), category: form.category, unit: form.unit.trim() || 'pcs',
      current_qty: Number(form.current_qty || 0), unit_cost: Number(form.unit_cost || 0),
      low_stock_threshold: Number(form.low_stock_threshold || 0),
      shelf_life_days: Number(form.shelf_life_days || 0),
    }
    if (editId) await supabase.from('inventory_items').update(payload).eq('id', editId)
    else await supabase.from('inventory_items').insert(payload)
    setOpen(false); await load()
  }

  const remove = async (it) => {
    if (!confirm(`Delete "${it.name}"?`)) return
    await supabase.from('inventory_items').delete().eq('id', it.id); await load()
  }

  if (loading) return <Spinner />

  const cats = [...new Set(items.map((i) => i.category || 'Other'))].sort()
  const stockValue = items.reduce((s, i) => s + i.current_qty * i.unit_cost, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Inventory</h2>
        <div className="flex gap-2">
          <Button variant="ghost" className="px-3" onClick={() => navigate('/admin/purchasing')}><ClipboardList size={16} /> Buy list</Button>
          <Button className="px-3" onClick={openNew}><Plus size={16} /> Add</Button>
        </div>
      </div>

      <Card className="p-4">
        <p className="text-xs text-cafe-muted">Current stock value</p>
        <p className="mt-1 text-2xl font-black text-cafe-accent">{rupees(stockValue)}</p>
      </Card>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant="ghost" onClick={() => setConvert(true)} disabled={items.length === 0}>
          <Blend size={18} /> Make / convert item
        </Button>
        <Button variant="ghost" onClick={() => setCounting(true)} disabled={items.length === 0}>
          <ClipboardCheck size={18} /> Count stock
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Boxes} title="No inventory yet" subtitle="Add kitchen and fridge items you buy." />
      ) : (
        cats.map((cat) => (
          <div key={cat}>
            <p className="mb-2 text-sm font-semibold capitalize text-cafe-muted">{cat}</p>
            <div className="space-y-2">
              {items.filter((i) => (i.category || 'Other') === cat).map((it) => (
                <Card key={it.id} className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{it.name}</p>
                      {isLow(it) && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">LOW</span>}
                    </div>
                    <p className="text-xs text-cafe-muted">
                      {it.current_qty} {it.unit} · {rupees(it.unit_cost)}/{it.unit}
                      {Number(it.shelf_life_days) === 1 && ' · daily'}
                      {Number(it.shelf_life_days) > 1 && ` · ${it.shelf_life_days}d shelf`}
                    </p>
                  </div>
                  <button onClick={() => setBuy(it)} className="rounded-lg p-2 text-cafe-muted hover:text-cafe-accent" title="Record purchase"><ShoppingCart size={18} /></button>
                  <button onClick={() => openEdit(it)} className="rounded-lg p-2 text-cafe-muted hover:text-white"><Pencil size={18} /></button>
                  <button onClick={() => remove(it)} className="rounded-lg p-2 text-cafe-muted hover:text-red-400"><Trash2 size={18} /></button>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit item' : 'Add item'}>
        <form onSubmit={save} className="space-y-3">
          <Input label="Item name" required value={form.name} onChange={set('name')} />
          <Input label="Category" value={form.category} onChange={set('category')} placeholder="Vegetables, Dairy, Cold Drink, Kitchen…" list="inv-cats" />
          <datalist id="inv-cats">
            {cats.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="grid grid-cols-3 gap-2">
            <Input label="Qty now" type="number" min="0" step="any" value={form.current_qty} onChange={set('current_qty')} />
            <Input label="Unit" value={form.unit} onChange={set('unit')} placeholder="kg, L, pcs" />
            <Input label="Cost/unit" type="number" min="0" step="any" value={form.unit_cost} onChange={set('unit_cost')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input label="Low-stock alert at (qty)" type="number" min="0" step="any"
              value={form.low_stock_threshold} onChange={set('low_stock_threshold')} placeholder="e.g. 2" />
            <Input label="Shelf life (days, 0=long)" type="number" min="0" step="any"
              value={form.shelf_life_days} onChange={set('shelf_life_days')} placeholder="milk = 1" />
          </div>
          <Button type="submit" className="w-full">Save</Button>
        </form>
      </Modal>

      {buy && <RestockModal item={buy} onClose={() => setBuy(null)} onDone={load} />}
      {convert && <ConvertModal items={items} onClose={() => setConvert(false)} onDone={load} />}
      {counting && <StockCountModal items={items} onClose={() => setCounting(false)} onDone={load} />}
    </div>
  )
}

function StockCountModal({ items, onClose, onDone }) {
  const [vals, setVals] = useState(() => Object.fromEntries(items.map((i) => [i.id, String(i.current_qty)])))
  const [saving, setSaving] = useState(false)
  const submit = async () => {
    setSaving(true)
    try {
      await saveStockCount(items.map((i) => ({ item_id: i.id, qty: vals[i.id] })))
      onClose(); await onDone()
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }
  return (
    <Modal open onClose={onClose} title="Count stock">
      <p className="mb-3 text-xs text-cafe-muted">Enter the actual quantity you have right now for each item. This corrects the stock figure and helps the monthly recipe check measure real usage. Do it now and then (e.g. weekly or month end).</p>
      <div className="max-h-[55vh] space-y-2 overflow-y-auto">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">{i.name}</span>
            <input type="number" min="0" step="any" value={vals[i.id]}
              onChange={(e) => setVals((v) => ({ ...v, [i.id]: e.target.value }))}
              className="w-24 rounded-lg bg-cafe-bg border border-cafe-line px-2 py-2 text-sm" />
            <span className="w-8 text-xs text-cafe-muted">{i.unit}</span>
          </div>
        ))}
      </div>
      <Button onClick={submit} disabled={saving} className="mt-4 w-full">{saving ? 'Saving…' : 'Save count'}</Button>
    </Modal>
  )
}

function ConvertModal({ items, onClose, onDone }) {
  const [inputs, setInputs] = useState([{ inventory_item_id: items[0]?.id || '', qty: '' }])
  const [outMode, setOutMode] = useState('new') // 'new' | 'existing'
  const [out, setOut] = useState({ name: '', unit: 'L', category: 'kitchen', qty: '', existingId: items[0]?.id || '' })
  const [saving, setSaving] = useState(false)

  const map = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items])
  const setOutF = (k) => (e) => setOut((o) => ({ ...o, [k]: e.target.value }))
  const setRow = (i, k, v) => setInputs((r) => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const addRow = () => setInputs((r) => [...r, { inventory_item_id: items[0]?.id || '', qty: '' }])
  const removeRow = (i) => setInputs((r) => r.filter((_, idx) => idx !== i))

  const inputCost = inputs.reduce((s, r) => s + (Number(r.qty) || 0) * Number(map[r.inventory_item_id]?.unit_cost || 0), 0)
  const outQty = Number(out.qty) || 0
  const producedUnitCost = outQty > 0 ? inputCost / outQty : 0

  const submit = async (e) => {
    e.preventDefault()
    const valid = inputs.filter((r) => r.inventory_item_id && Number(r.qty) > 0)
    if (valid.length === 0) { alert('Add at least one ingredient to use.'); return }
    if (outQty <= 0) { alert('Enter how much you made.'); return }
    if (outMode === 'new' && !out.name.trim()) { alert('Name the item you made.'); return }
    setSaving(true)
    try {
      await convertInventory({
        inputs: valid.map((r) => ({ item: map[r.inventory_item_id], qty: r.qty })),
        output: outMode === 'new'
          ? { mode: 'new', name: out.name.trim(), unit: out.unit.trim() || 'pcs', category: out.category, qty: outQty }
          : { mode: 'existing', existingId: out.existingId, qty: outQty },
      })
      onClose(); await onDone()
    } catch (err) { alert(err.message) } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title="Make / convert item">
      <form onSubmit={submit} className="space-y-4">
        {/* Ingredients used */}
        <div>
          <p className="mb-2 text-sm font-semibold">Use from inventory</p>
          <div className="space-y-2">
            {inputs.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={row.inventory_item_id} onChange={(e) => setRow(i, 'inventory_item_id', e.target.value)}
                  className="min-w-0 flex-1 rounded-lg bg-cafe-bg border border-cafe-line px-2 py-2 text-sm">
                  {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.current_qty} {it.unit})</option>)}
                </select>
                <input type="number" min="0" step="any" placeholder="qty" value={row.qty}
                  onChange={(e) => setRow(i, 'qty', e.target.value)}
                  className="w-20 rounded-lg bg-cafe-bg border border-cafe-line px-2 py-2 text-sm" />
                <span className="w-10 text-xs text-cafe-muted">{map[row.inventory_item_id]?.unit}</span>
                {inputs.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="rounded-lg p-1.5 text-cafe-muted hover:text-red-400"><X size={16} /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={addRow} className="flex items-center gap-1 text-sm font-semibold text-cafe-accent">
              <Plus size={14} /> Add ingredient
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center text-cafe-muted"><ArrowRight size={18} /></div>

        {/* Output */}
        <div>
          <p className="mb-2 text-sm font-semibold">What you made</p>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setOutMode('new')}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${outMode === 'new' ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line'}`}>New item</button>
            <button type="button" onClick={() => setOutMode('existing')}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${outMode === 'existing' ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line'}`}>Add to existing</button>
          </div>

          {outMode === 'new' ? (
            <div className="space-y-2">
              <Input label="New item name" placeholder="Tomato puree" value={out.name} onChange={setOutF('name')} />
              <div className="grid grid-cols-3 gap-2">
                <Input label="Made qty" type="number" min="0" step="any" value={out.qty} onChange={setOutF('qty')} />
                <Input label="Unit" value={out.unit} onChange={setOutF('unit')} placeholder="L, kg" />
                <Select label="Where" value={out.category} onChange={setOutF('category')}>
                  <option value="kitchen">Kitchen</option>
                  <option value="fridge">Fridge</option>
                </Select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Select label="Existing item" value={out.existingId} onChange={setOutF('existingId')}>
                {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
              </Select>
              <Input label={`Made qty (${map[out.existingId]?.unit || ''})`} type="number" min="0" step="any" value={out.qty} onChange={setOutF('qty')} />
            </div>
          )}
        </div>

        {/* Cost summary */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-cafe-line bg-cafe-bg p-3 text-center text-sm">
          <div><p className="text-xs text-cafe-muted">Ingredients cost</p><p className="font-bold">{rupees(inputCost)}</p></div>
          <div><p className="text-xs text-cafe-muted">Cost per {outMode === 'new' ? (out.unit || 'unit') : (map[out.existingId]?.unit || 'unit')}</p><p className="font-bold text-cafe-accent">{rupees(producedUnitCost)}</p></div>
        </div>

        <Button type="submit" disabled={saving} className="w-full">{saving ? 'Making…' : 'Make item'}</Button>
      </form>
    </Modal>
  )
}
