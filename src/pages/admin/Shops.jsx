import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Store, ArrowLeft } from 'lucide-react'
import { getShopkeepers } from '../../lib/db'
import { adminCreateStaff } from '../../lib/createStaff'
import { Button, Card, Input, Modal, Spinner, EmptyState } from '../../components/ui'

export default function Shops() {
  const navigate = useNavigate()
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = async () => { setShops(await getShopkeepers()); setLoading(false) }
  useEffect(() => { load() }, [])

  if (loading) return <Spinner />

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/admin/purchasing')} className="flex items-center gap-1 text-sm text-cafe-muted">
        <ArrowLeft size={16} /> Back to buy list
      </button>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Shops / Suppliers</h2>
        <Button onClick={() => setOpen(true)}><Plus size={18} /> Add shop</Button>
      </div>

      {shops.length === 0 ? (
        <EmptyState icon={Store} title="No shops yet" subtitle="Add the shops you buy supplies from." />
      ) : (
        <div className="space-y-2">
          {shops.map((s) => (
            <Card key={s.id} className="flex items-center gap-3 p-3">
              <Store size={20} className="text-cafe-accent" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{s.shop_name || s.full_name}</p>
                <p className="text-xs text-cafe-muted">{s.full_name}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {open && <AddShopModal onClose={() => setOpen(false)} onDone={load} />}
    </div>
  )
}

function AddShopModal({ onClose, onDone }) {
  const [form, setForm] = useState({ shopName: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      await adminCreateStaff({
        email: form.email.trim(), password: form.password,
        fullName: form.shopName.trim(), role: 'shopkeeper', shopName: form.shopName.trim(),
      })
      setDone(`Shop "${form.shopName}" created. Ask them to confirm the email we just sent, then log in with this email & password.`)
      await onDone()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title="Add a shop">
      {done ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-400">{done}</p>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-cafe-muted">Creates a Shopkeeper login. You give them the email &amp; password to sign in.</p>
          <Input label="Shop name" required value={form.shopName} onChange={set('shopName')} placeholder="Sharma Vegetables" />
          <Input label="Login email" type="email" required value={form.email} onChange={set('email')} />
          <Input label="Password" type="text" minLength={6} required value={form.password} onChange={set('password')} placeholder="give them this" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create shop login'}</Button>
        </form>
      )}
    </Modal>
  )
}
