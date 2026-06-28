import { useEffect, useState } from 'react'
import { Plus, ChefHat, Store, Bike, Users, Eye, EyeOff, Lock, Copy } from 'lucide-react'
import { getStaffCredentials, getCustomersWithStats, getStaffByRole } from '../../lib/db'
import { adminCreateStaff } from '../../lib/createStaff'
import { rupees } from '../../lib/format'
import { Button, Card, Input, Modal, Spinner, EmptyState } from '../../components/ui'

const REVEAL_PIN = '0506'

export default function Staff() {
  const [creds, setCreds] = useState([])
  const [profiles, setProfiles] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [addRole, setAddRole] = useState(null) // 'chef' | 'shopkeeper' | 'rider'

  const load = async () => {
    const [c, cust, chefs, shops, riders] = await Promise.all([
      getStaffCredentials(), getCustomersWithStats(),
      getStaffByRole('chef'), getStaffByRole('shopkeeper'), getStaffByRole('rider'),
    ])
    setCreds(c); setCustomers(cust)
    setProfiles([
      ...chefs.map((p) => ({ ...p, role: 'chef' })),
      ...shops.map((p) => ({ ...p, role: 'shopkeeper' })),
      ...riders.map((p) => ({ ...p, role: 'rider' })),
    ])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  if (loading) return <Spinner />

  // Staff that have stored credentials (skip old orphan accounts with no vault row).
  const byRole = (r) => profiles.filter((p) => p.role === r).map((p) => {
    const cred = creds.find((c) => c.user_id === p.id)
    return { id: p.id, user_id: p.id, role: r, full_name: p.full_name || p.shop_name || 'Staff',
      email: cred?.email, password: cred?.password, hasCred: !!cred }
  }).filter((x) => x.hasCred)
  const tryUnlock = () => { if (pin === REVEAL_PIN) { setUnlocked(true); setPin('') } else alert('Wrong PIN.') }

  const sections = [
    { role: 'chef', title: 'Chefs', icon: ChefHat },
    { role: 'shopkeeper', title: 'Shopkeepers', icon: Store },
    { role: 'rider', title: 'Riders', icon: Bike },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">Staff &amp; accounts</h2>

      {/* PIN to reveal passwords */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Lock size={16} className={unlocked ? 'text-emerald-400' : 'text-cafe-muted'} />
          {unlocked ? (
            <span className="text-sm text-emerald-400">Passwords unlocked. <button onClick={() => setUnlocked(false)} className="underline">Hide</button></span>
          ) : (
            <div className="flex flex-1 items-center gap-2">
              <input type="password" inputMode="numeric" placeholder="PIN to view passwords" value={pin}
                onChange={(e) => setPin(e.target.value)} className="w-40 rounded-lg bg-cafe-bg border border-cafe-line px-3 py-2 text-sm" />
              <Button className="px-3 py-2" onClick={tryUnlock}>Unlock</Button>
            </div>
          )}
        </div>
      </Card>

      {sections.map(({ role, title, icon: Icon }) => (
        <div key={role}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-cafe-accent">
              <Icon size={15} /> {title} <span className="text-xs font-normal text-cafe-muted">({byRole(role).length})</span>
            </h3>
            <Button className="px-3 py-1.5" onClick={() => setAddRole(role)}><Plus size={14} /> Add</Button>
          </div>
          {byRole(role).length === 0 ? (
            <p className="rounded-xl border border-cafe-line bg-cafe-card p-3 text-sm text-cafe-muted">No {title.toLowerCase()} yet.</p>
          ) : (
            <div className="space-y-2">
              {byRole(role).map((c) => <CredCard key={c.id} cred={c} unlocked={unlocked} />)}
            </div>
          )}
        </div>
      ))}

      {/* Customers */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-cafe-accent">
          <Users size={15} /> Customers <span className="text-xs font-normal text-cafe-muted">({customers.length})</span>
        </h3>
        {customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers yet" subtitle="Customers who sign up appear here." />
        ) : (
          <div className="space-y-2">
            {customers.map((c) => (
              <Card key={c.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{c.full_name || 'Customer'}</p>
                  <span className="text-xs text-cafe-muted">{c.count} order{c.count === 1 ? '' : 's'} · {rupees(c.spent)}</span>
                </div>
                <p className="text-xs text-cafe-muted">{c.phone || 'no phone'}</p>
                {c.lastAddress && <p className="mt-0.5 truncate text-xs text-cafe-muted">📍 {c.lastAddress}</p>}
              </Card>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-cafe-muted">Customer emails &amp; passwords are private, not shown here.</p>
      </div>

      {addRole && <AddStaffModal role={addRole} onClose={() => setAddRole(null)} onDone={load} />}
    </div>
  )
}

function CredCard({ cred, unlocked }) {
  const copy = (t) => navigator.clipboard?.writeText(t)
  if (!cred.hasCred) {
    return (
      <Card className="p-3">
        <p className="font-semibold">{cred.full_name}</p>
        <p className="mt-1 text-xs text-yellow-400">Created earlier, login details aren't on file. Use “Add” to recreate it so you can view/manage the password here.</p>
      </Card>
    )
  }
  return (
    <Card className="p-3">
      <p className="font-semibold">{cred.full_name}</p>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="min-w-0 truncate text-cafe-muted">{cred.email}</span>
        <button onClick={() => copy(cred.email)} className="text-cafe-muted hover:text-white"><Copy size={14} /></button>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="font-mono text-cafe-muted">{unlocked ? cred.password : '••••••••'}</span>
        {unlocked
          ? <button onClick={() => copy(cred.password)} className="text-cafe-muted hover:text-white"><Copy size={14} /></button>
          : <EyeOff size={14} className="text-cafe-muted" />}
      </div>
    </Card>
  )
}

function AddStaffModal({ role, onClose, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const titleMap = { chef: 'chef', shopkeeper: 'shopkeeper (shop)', rider: 'rider' }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      await adminCreateStaff({
        email: form.email.trim(), password: form.password,
        fullName: form.name.trim(), role,
        shopName: role === 'shopkeeper' ? form.name.trim() : '',
      })
      setDone(`${form.name} created. Share the email & password with them; they confirm the email once, then log in.`)
      await onDone()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={`Add ${titleMap[role]}`}>
      {done ? (
        <div className="space-y-3"><p className="text-sm text-emerald-400">{done}</p><Button className="w-full" onClick={onClose}>Done</Button></div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-xs text-cafe-muted">Creates a login. You set the password and can view it later with your PIN.</p>
          <Input label={role === 'shopkeeper' ? 'Shop name' : 'Name'} required value={form.name} onChange={set('name')}
            placeholder={role === 'shopkeeper' ? 'Sharma Vegetables' : role === 'rider' ? 'Rider name' : 'Chef name'} />
          <Input label="Login email" type="email" required value={form.email} onChange={set('email')} />
          <Input label="Password" type="text" minLength={6} required value={form.password} onChange={set('password')} placeholder="give them this" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create login'}</Button>
        </form>
      )}
    </Modal>
  )
}
