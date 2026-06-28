import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Minus, Trash2, ShoppingBag, QrCode, MapPin, Check } from 'lucide-react'
import { useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { getSettings, createOrder, getAddresses, addAddress, deleteAddress } from '../../lib/db'
import { rupees, isOpenNow, distanceKm, CAFE } from '../../lib/format'
import { Button, Card, Input, Textarea, EmptyState, Spinner } from '../../components/ui'

export default function Cart() {
  const navigate = useNavigate()
  const { lines, subtotal, add, dec, removeKey, clear, priceOf } = useCart()
  const lineName = (l) => l.item.name + (l.variant ? ` (${l.variant.name})` : '')
  const { user, profile } = useAuth()
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', note: '' })
  const [addresses, setAddresses] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newAddr, setNewAddr] = useState('')
  const [loc, setLoc] = useState(null) // { lat, lng } for the address being added
  const [locating, setLocating] = useState(false)
  const [pay, setPay] = useState('upi') // 'upi' | 'cod'
  const [placing, setPlacing] = useState(false)

  const loadAddresses = async () => {
    const list = await getAddresses(user.id)
    setAddresses(list)
    setSelectedId((id) => id || list[0]?.id || null)
    setAdding(list.length === 0)
  }
  useEffect(() => { getSettings().then(setSettings); loadAddresses() }, [])
  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, name: f.name || profile.full_name || '', phone: f.phone || profile.phone || '' }))
  }, [profile])

  if (!settings) return <Spinner />

  const deliveryCharge = Number(settings.delivery_charge || 0)
  const total = subtotal + deliveryCharge
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  if (lines.length === 0) {
    return <EmptyState icon={ShoppingBag} title="Your cart is empty" subtitle="Add items from the menu." />
  }

  const dropLocation = () => {
    if (!navigator.geolocation) { alert('Location is not supported on this device.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocating(false) },
      (err) => { alert('Could not get location: ' + err.message); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const saveNewAddress = async () => {
    if (!newAddr.trim()) { alert('Please type the address first.'); return }
    const saved = await addAddress({ user_id: user.id, address: newAddr.trim(), lat: loc?.lat ?? null, lng: loc?.lng ?? null })
    setNewAddr(''); setLoc(null); setAdding(false)
    await loadAddresses(); setSelectedId(saved.id)
    return saved
  }
  const removeAddress = async (id) => {
    if (!confirm('Remove this saved address?')) return
    await deleteAddress(id); await loadAddresses()
  }

  const place = async () => {
    if (!isOpenNow()) {
      alert(`We are open ${CAFE.openHour > 12 ? CAFE.openHour - 12 : CAFE.openHour} AM to ${CAFE.closeHour - 12} PM (Delhi time). Please order during these hours.`)
      return
    }
    if (!form.name.trim()) { alert('Please add your name.'); return }
    const phone = form.phone.replace(/\s/g, '')
    if (phone.replace(/\D/g, '').length < 10) { alert('Please add a valid phone number we can call you on.'); return }

    // Resolve the delivery address: a saved one, or save the new one being typed.
    let chosen = addresses.find((a) => a.id === selectedId)
    if (adding || !chosen) {
      if (!newAddr.trim()) { alert('Please add your delivery address.'); return }
      chosen = await saveNewAddress()
    }
    if (!chosen) return

    // Verify the delivery location is within range (needs a dropped GPS pin).
    if (chosen.lat == null || chosen.lng == null) {
      alert('Please use "Drop my current location" on your address so we can confirm you are within our delivery range.')
      setAdding(true)
      return
    }
    const dist = distanceKm(CAFE.lat, CAFE.lng, Number(chosen.lat), Number(chosen.lng))
    if (dist > CAFE.deliveryRadiusKm) {
      alert(`Sorry, you are about ${dist.toFixed(1)} km away, outside our ${CAFE.deliveryRadiusKm} km delivery range. Delivery is not possible, but you are welcome to visit the store.`)
      return
    }

    setPlacing(true)
    try {
      await createOrder({
        type: 'delivery',
        status: 'pending',
        customer_id: user.id,
        customer_name: form.name.trim(),
        customer_phone: form.phone.trim(),
        address: chosen.address,
        lat: chosen.lat ?? null,
        lng: chosen.lng ?? null,
        notes: form.note.trim(),
        delivery_charge: deliveryCharge,
        payment_method: pay,
        items: lines.map((l) => ({
          menu_item_id: l.item.id, name_snapshot: lineName(l),
          price_snapshot: priceOf(l.item, l.variant), quantity: l.qty,
        })),
      })
      clear()
      navigate('/app/orders')
    } catch (err) { alert(err.message) } finally { setPlacing(false) }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Your order</h2>

      <div className="space-y-2">
        {lines.map((l) => (
          <Card key={l.key} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{lineName(l)}</p>
              <p className="text-xs text-cafe-muted">{rupees(priceOf(l.item, l.variant))}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => dec(l.item, l.variant)} className="rounded-lg bg-cafe-line p-1.5"><Minus size={14} /></button>
              <span className="w-5 text-center font-semibold">{l.qty}</span>
              <button onClick={() => add(l.item, l.variant)} className="rounded-lg bg-cafe-accent p-1.5 text-black"><Plus size={14} /></button>
            </div>
            <button onClick={() => removeKey(l.key)} className="rounded-lg p-2 text-cafe-muted hover:text-red-400"><Trash2 size={16} /></button>
          </Card>
        ))}
      </div>

      <Card className="space-y-3 p-4">
        <p className="font-semibold">Delivery details</p>
        <Input label="Name" required value={form.name} onChange={set('name')} />
        <Input label="Phone (required, we'll call you)" type="tel" inputMode="tel" required
          value={form.phone} onChange={set('phone')} placeholder="10-digit mobile" />

        {/* Saved addresses */}
        <div>
          <span className="mb-1 block text-sm text-cafe-muted">Deliver to</span>
          {addresses.length > 0 && (
            <div className="space-y-2">
              {addresses.map((a) => (
                <label key={a.id}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${!adding && selectedId === a.id ? 'border-cafe-accent bg-cafe-accent/5' : 'border-cafe-line'}`}>
                  <input type="radio" checked={!adding && selectedId === a.id} onChange={() => { setSelectedId(a.id); setAdding(false) }}
                    className="mt-1 h-4 w-4 accent-cafe-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="whitespace-pre-line">{a.address}</span>
                    {(a.lat && a.lng) && <span className="ml-1 text-[11px] text-emerald-400">📍 pin</span>}
                  </span>
                  <button type="button" onClick={() => removeAddress(a.id)} className="text-cafe-muted hover:text-red-400"><Trash2 size={15} /></button>
                </label>
              ))}
            </div>
          )}

          {!adding ? (
            <button type="button" onClick={() => setAdding(true)}
              className="mt-2 flex items-center gap-1 text-sm font-semibold text-cafe-accent">
              <Plus size={15} /> Add new address
            </button>
          ) : (
            <div className="mt-2 space-y-2 rounded-xl border border-cafe-line bg-cafe-bg p-3">
              <Textarea rows={3} value={newAddr} onChange={(e) => setNewAddr(e.target.value)}
                placeholder="House/flat, street, area, landmark, city, pincode" />
              <button type="button" onClick={dropLocation}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${loc ? 'border-emerald-500/50 bg-emerald-600/10 text-emerald-400' : 'border-cafe-line text-cafe-accent'}`}>
                {loc ? <><Check size={16} /> Current location attached</> : <><MapPin size={16} /> {locating ? 'Getting location…' : 'Drop my current location'}</>}
              </button>
              <div className="flex gap-2">
                {addresses.length > 0 && <Button variant="ghost" className="flex-1" onClick={() => { setAdding(false); setNewAddr(''); setLoc(null) }}>Cancel</Button>}
                <Button className="flex-1" onClick={saveNewAddress}>Save address</Button>
              </div>
            </div>
          )}
        </div>

        <Textarea label="Note for this order (optional)" rows={2} value={form.note} onChange={set('note')}
          placeholder="e.g. ring the bell, gate code, no onions…" />
      </Card>

      <Card className="space-y-2 p-4">
        <p className="font-semibold">Payment</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setPay('upi')} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${pay === 'upi' ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line'}`}>Pay now (UPI)</button>
          <button onClick={() => setPay('cod')} className={`rounded-xl border px-3 py-3 text-sm font-semibold ${pay === 'cod' ? 'border-cafe-accent bg-cafe-accent/10 text-cafe-accent' : 'border-cafe-line'}`}>Cash on delivery</button>
        </div>
        {pay === 'upi' && (
          <div className="mt-2 flex flex-col items-center rounded-xl bg-cafe-bg p-4 text-center">
            {settings.upi_qr_url
              ? <img src={settings.upi_qr_url} alt="UPI QR" className="h-44 w-44 rounded-lg bg-white object-contain p-2" />
              : <div className="flex h-44 w-44 items-center justify-center rounded-lg bg-cafe-line text-cafe-muted"><QrCode size={40} /></div>}
            {settings.upi_id && <p className="mt-2 text-sm font-semibold">{settings.upi_id}</p>}
            <p className="mt-1 text-xs text-cafe-muted">Scan & pay {rupees(total)}. The cafe confirms once received.</p>
          </div>
        )}
      </Card>

      <Card className="space-y-1 p-4 text-sm">
        <div className="flex justify-between text-cafe-muted"><span>Items</span><span>{rupees(subtotal)}</span></div>
        <div className="flex justify-between text-cafe-muted"><span>Delivery</span><span>{rupees(deliveryCharge)}</span></div>
        <div className="flex justify-between border-t border-cafe-line pt-2 text-base font-bold"><span>Total</span><span className="text-cafe-accent">{rupees(total)}</span></div>
      </Card>

      <Button onClick={place} disabled={placing} className="w-full">
        {placing ? 'Placing…' : `Place order · ${rupees(total)}`}
      </Button>
    </div>
  )
}
