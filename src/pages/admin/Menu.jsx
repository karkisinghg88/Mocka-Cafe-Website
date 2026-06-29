import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ImageIcon, X, FlaskConical, Layers, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getMenu, getRecipe, saveRecipe, saveVariants, priceLabel } from '../../lib/db'
import { suggestRecipe } from '../../lib/ai'
import { rupees, convertQty, unitsForFamily } from '../../lib/format'
import { Button, Card, Input, Select, Modal, Spinner, EmptyState } from '../../components/ui'

// Section order for the grouped menu. Anything else falls under "Other".
const CATEGORY_ORDER = [
  'Momos', 'Pizza', 'Rolls', 'Soup', 'Starter', 'Fast Food',
  'Veg Main Course', 'Non Veg Main Course', 'Rice', 'Roti and Naan', 'Raita',
  'Drinks', 'Cold Drink', 'Shakes', 'Coffee', 'Tea', 'Desserts', 'Combos', 'Other',
]
const CATEGORIES = CATEGORY_ORDER

const EMPTY = { name: '', description: '', price: '', category: 'Momos', stock_qty: '', is_available: true, image_url: '' }

export default function Menu() {
  const [items, setItems] = useState([])
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [recipe, setRecipe] = useState([]) // [{ inventory_item_id, qty, unit }]
  const [batchMode, setBatchMode] = useState(true)  // batch (easy) vs per plate
  const [batchYield, setBatchYield] = useState('')   // plates one batch makes
  const [aiBusy, setAiBusy] = useState(false)
  const [variants, setVariants] = useState([]) // [{ name, price }]
  const [editId, setEditId] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [menu, inv] = await Promise.all([
      getMenu(),
      supabase.from('inventory_items').select('*').order('name'),
    ])
    setItems(menu); setInventory(inv.data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const invMap = useMemo(() => Object.fromEntries(inventory.map((i) => [i.id, i])), [inventory])
  const recipeCostOf = (rows) => rows.reduce((s, r) => s + (Number(r.qty) || 0) * Number(invMap[r.inventory_item_id]?.unit_cost || 0), 0)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const openNew = () => {
    setForm(EMPTY); setRecipe([]); setVariants([]); setEditId(null)
    setBatchMode(true); setBatchYield(''); setOpen(true)
  }
  const openEdit = async (it) => {
    setForm({ ...it, price: String(it.price), stock_qty: it.stock_qty ?? '' })
    setVariants((it.variants || []).map((v) => ({ name: v.name, price: String(v.price) })))
    setEditId(it.id); setOpen(true)
    const r = await getRecipe(it.id)
    // Stored recipes are per serving, so open in per-plate mode for editing.
    setBatchMode(false); setBatchYield('')
    setRecipe(r.map((x) => ({ inventory_item_id: x.inventory_item_id, qty: String(x.qty), unit: x.inventory_items?.unit || '' })))
  }

  // Per-serving quantity for a recipe row, accounting for batch mode + units.
  const perServingQty = (row) => {
    const iu = invMap[row.inventory_item_id]?.unit || ''
    const inItemUnit = batchMode ? convertQty(row.qty, row.unit || iu, iu) : (Number(row.qty) || 0)
    const y = batchMode ? (Number(batchYield) || 1) : 1
    return y > 0 ? inItemUnit / y : 0
  }

  const aiSuggest = async () => {
    if (!form.name.trim()) { alert('Type the item name first.'); return }
    if (inventory.length === 0) { alert('Add your raw items in Inventory first.'); return }
    setAiBusy(true)
    try {
      const rows = await suggestRecipe(form.name.trim(), inventory)
      const mapped = rows.map((r) => {
        const n = String(r.name || '').toLowerCase()
        const inv = inventory.find((i) => i.name.toLowerCase() === n)
          || inventory.find((i) => i.name.toLowerCase().includes(n) || n.includes(i.name.toLowerCase()))
        if (!inv) return null
        return { inventory_item_id: inv.id, qty: String(r.qty ?? ''), unit: r.unit || inv.unit }
      }).filter(Boolean)
      if (mapped.length === 0) { alert('AI could not match any ingredients to your inventory. Add the raw items first, then try again.'); return }
      setBatchMode(true); setBatchYield('1'); setRecipe(mapped)
    } catch (err) { alert(err.message) } finally { setAiBusy(false) }
  }

  const addVariant = () => setVariants((v) => [...v, { name: '', price: '' }])
  const setVariant = (i, k, val) => setVariants((v) => v.map((row, idx) => idx === i ? { ...row, [k]: val } : row))
  const removeVariant = (i) => setVariants((v) => v.filter((_, idx) => idx !== i))

  const uploadImage = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('menu').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('menu').getPublicUrl(path)
      setForm((f) => ({ ...f, image_url: data.publicUrl }))
    } catch (err) { alert('Image upload failed: ' + err.message) }
    finally { setUploading(false) }
  }

  // recipe row helpers
  const addIngredient = () => setRecipe((r) => [...r, { inventory_item_id: inventory[0]?.id || '', qty: '', unit: inventory[0]?.unit || '' }])
  const setIngredient = (i, k, v) => setRecipe((r) => r.map((row, idx) => {
    if (idx !== i) return row
    if (k === 'inventory_item_id') return { ...row, inventory_item_id: v, unit: invMap[v]?.unit || '' }
    return { ...row, [k]: v }
  }))
  const removeIngredient = (i) => setRecipe((r) => r.filter((_, idx) => idx !== i))

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || null,
      price: Number(form.price),
      category: form.category,
      stock_qty: form.stock_qty === '' ? null : Number(form.stock_qty),
      is_available: form.is_available,
      image_url: form.image_url || null,
    }
    try {
      let itemId = editId
      if (editId) await supabase.from('menu_items').update(payload).eq('id', editId)
      else {
        const { data, error } = await supabase.from('menu_items').insert(payload).select().single()
        if (error) throw error
        itemId = data.id
      }
      const recipeRows = recipe
        .filter((r) => r.inventory_item_id && Number(r.qty) > 0)
        .map((r) => ({ inventory_item_id: r.inventory_item_id, qty: perServingQty(r) }))
        .filter((r) => r.qty > 0)
      await saveRecipe(itemId, recipeRows)
      await saveVariants(itemId, variants.filter((v) => v.name.trim()))
      setOpen(false); await load()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  const remove = async (it) => {
    if (!confirm(`Delete "${it.name}"?`)) return
    await supabase.from('menu_items').delete().eq('id', it.id)
    await load()
  }

  if (loading) return <Spinner />

  // group items by category in section order
  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, list: items.filter((i) => i.category === cat) }))
    .filter((g) => g.list.length > 0)
  const known = new Set(CATEGORY_ORDER)
  const others = items.filter((i) => !known.has(i.category))
  if (others.length) grouped.push({ cat: 'Other', list: others })

  const cost = recipe.reduce((s, r) => s + perServingQty(r) * Number(invMap[r.inventory_item_id]?.unit_cost || 0), 0)
  const price = Number(form.price) || 0
  const profit = price - cost

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Menu</h2>
        <Button onClick={openNew}><Plus size={18} /> Add item</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No items yet" subtitle="Add your first menu item." />
      ) : (
        <div className="space-y-5">
          {grouped.map(({ cat, list }) => (
            <div key={cat}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-cafe-accent">
                {cat} <span className="text-xs font-normal text-cafe-muted">({list.length})</span>
              </h3>
              <div className="space-y-2">
                {list.map((it) => (
                  <Card key={it.id} className="flex items-center gap-3 p-3">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-cafe-bg">
                      {it.image_url
                        ? <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                        : <div className="flex h-full w-full items-center justify-center text-cafe-muted"><ImageIcon size={20} /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold leading-snug">{it.name}</p>
                        {!it.is_available && <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">Off</span>}
                      </div>
                      {it.variants?.length > 0 && <p className="text-[11px] text-cafe-muted">{it.variants.map((v) => v.name).join(' · ')}</p>}
                      {it.description && <p className="text-xs text-cafe-muted">{it.description}</p>}
                    </div>
                    <p className="whitespace-nowrap font-bold text-cafe-accent">{priceLabel(it)}</p>
                    <button onClick={() => openEdit(it)} className="rounded-lg p-2 text-cafe-muted hover:text-white"><Pencil size={18} /></button>
                    <button onClick={() => remove(it)} className="rounded-lg p-2 text-cafe-muted hover:text-red-400"><Trash2 size={18} /></button>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit item' : 'Add item'}>
        <form onSubmit={save} className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-cafe-bg">
              {form.image_url
                ? <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center text-cafe-muted"><ImageIcon size={22} /></div>}
            </div>
            <label className="flex-1">
              <span className="mb-1 block text-sm text-cafe-muted">Photo</span>
              <input type="file" accept="image/*" onChange={(e) => uploadImage(e.target.files?.[0])}
                className="block w-full text-sm text-cafe-muted file:mr-3 file:rounded-lg file:border-0 file:bg-cafe-line file:px-3 file:py-2 file:text-white" />
              {uploading && <span className="text-xs text-cafe-accent">Uploading…</span>}
            </label>
          </div>
          <Input label="Name" required value={form.name} onChange={set('name')} />
          <Input label="Description (optional)" value={form.description || ''} onChange={set('description')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={variants.length ? 'Base price (ignored, using sizes)' : 'Price (₹)'} type="number" min="0" step="1"
              required={variants.length === 0} value={form.price} onChange={set('price')} />
            <Select label="Category" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </div>

          {/* Sizes / variants */}
          <div className="rounded-xl border border-cafe-line bg-cafe-bg p-3">
            <div className="mb-1 flex items-center gap-2">
              <Layers size={16} className="text-cafe-accent" />
              <p className="text-sm font-semibold">Sizes / options</p>
            </div>
            <p className="mb-2 text-xs text-cafe-muted">e.g. Half/Full or Steamed/Fried/Tandoori/Mast. Leave empty for a single-price item.</p>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input placeholder="Half / Full / Steamed…" value={v.name} onChange={(e) => setVariant(i, 'name', e.target.value)}
                    className="min-w-0 flex-1 rounded-lg bg-cafe-card border border-cafe-line px-2 py-2 text-sm" />
                  <div className="flex items-center rounded-lg bg-cafe-card border border-cafe-line px-2">
                    <span className="text-xs text-cafe-muted">₹</span>
                    <input type="number" min="0" placeholder="price" value={v.price} onChange={(e) => setVariant(i, 'price', e.target.value)}
                      className="w-20 bg-transparent py-2 text-sm outline-none" />
                  </div>
                  <button type="button" onClick={() => removeVariant(i)} className="rounded-lg p-1.5 text-cafe-muted hover:text-red-400"><X size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={addVariant} className="flex items-center gap-1 text-sm font-semibold text-cafe-accent">
                <Plus size={14} /> Add size / option
              </button>
            </div>
          </div>

          {/* Recipe / ingredients -> inventory sync */}
          <div className="rounded-xl border border-cafe-line bg-cafe-bg p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <FlaskConical size={16} className="text-cafe-accent" /> Ingredients used
              </p>
              <button type="button" onClick={aiSuggest} disabled={aiBusy}
                className="flex items-center gap-1 rounded-lg border border-cafe-line px-2 py-1 text-xs font-semibold text-cafe-accent disabled:opacity-50">
                <Sparkles size={13} /> {aiBusy ? 'Thinking…' : 'Suggest with AI'}
              </button>
            </div>

            {/* mode toggle */}
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setBatchMode(true)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${batchMode ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line text-cafe-muted'}`}>Batch (easy)</button>
              <button type="button" onClick={() => setBatchMode(false)}
                className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${!batchMode ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line text-cafe-muted'}`}>Per plate</button>
            </div>
            <p className="mb-3 text-xs text-cafe-muted">
              {batchMode
                ? 'Enter what one whole batch uses, and how many plates it makes. We work out the per-plate amount and deduct it on each sale.'
                : 'Enter the amount used for one plate. Deducted from inventory on each sale.'}
            </p>

            {inventory.length === 0 ? (
              <p className="text-xs text-yellow-400">Add items in Inventory first to build a recipe.</p>
            ) : (
              <div className="space-y-2">
                {recipe.map((row, i) => {
                  const iu = invMap[row.inventory_item_id]?.unit || ''
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <select value={row.inventory_item_id} onChange={(e) => setIngredient(i, 'inventory_item_id', e.target.value)}
                        className="min-w-0 flex-1 rounded-lg bg-cafe-card border border-cafe-line px-2 py-2 text-sm">
                        {inventory.map((inv) => <option key={inv.id} value={inv.id}>{inv.name} ({inv.unit})</option>)}
                      </select>
                      <input type="number" min="0" step="any" placeholder="qty" value={row.qty}
                        onChange={(e) => setIngredient(i, 'qty', e.target.value)}
                        className="w-16 rounded-lg bg-cafe-card border border-cafe-line px-2 py-2 text-sm" />
                      {batchMode ? (
                        <select value={row.unit || iu} onChange={(e) => setIngredient(i, 'unit', e.target.value)}
                          className="w-16 rounded-lg bg-cafe-card border border-cafe-line px-1 py-2 text-sm">
                          {unitsForFamily(iu).map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      ) : (
                        <span className="w-10 text-xs text-cafe-muted">{iu}</span>
                      )}
                      <button type="button" onClick={() => removeIngredient(i)} className="rounded-lg p-1.5 text-cafe-muted hover:text-red-400"><X size={16} /></button>
                    </div>
                  )
                })}
                <button type="button" onClick={addIngredient}
                  className="flex items-center gap-1 text-sm font-semibold text-cafe-accent">
                  <Plus size={14} /> Add ingredient
                </button>
              </div>
            )}

            {batchMode && recipe.length > 0 && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <span className="text-cafe-muted">This batch makes</span>
                <input type="number" min="1" step="any" placeholder="e.g. 11" value={batchYield}
                  onChange={(e) => setBatchYield(e.target.value)}
                  className="w-20 rounded-lg bg-cafe-card border border-cafe-line px-2 py-1.5 text-sm" />
                <span className="text-cafe-muted">plates</span>
              </label>
            )}

            {recipe.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-cafe-line pt-2 text-center text-xs">
                <div><p className="text-cafe-muted">Cost / plate</p><p className="font-bold">{rupees(cost)}</p></div>
                <div><p className="text-cafe-muted">Sell</p><p className="font-bold">{rupees(price)}</p></div>
                <div><p className="text-cafe-muted">Profit</p><p className={`font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{rupees(profit)}</p></div>
              </div>
            )}
            {batchMode && recipe.length > 0 && !batchYield && (
              <p className="mt-1 text-center text-[11px] text-yellow-400">Enter how many plates the batch makes to get the per-plate cost.</p>
            )}
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-cafe-line bg-cafe-bg px-4 py-3">
            <input type="checkbox" checked={form.is_available}
              onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
              className="h-5 w-5 accent-cafe-accent" />
            <span className="text-sm">Available to order</span>
          </label>
          <Button type="submit" disabled={saving || uploading} className="w-full">
            {saving ? 'Saving…' : 'Save item'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
