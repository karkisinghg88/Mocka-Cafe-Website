import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'
import { Button, Input, PasswordInput, Card } from '../components/ui'

export default function Signup() {
  const { signUp } = useAuth()
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setInfo(''); setBusy(true)
    try {
      // Public sign-up is always a customer. Staff logins are created by the owner.
      await signUp({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        role: 'customer',
      })
      setInfo('Account created! Check your email to confirm (if enabled), then sign in.')
    } catch (err) {
      setError(err.message || 'Could not create account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      <Card className="p-5">
        <h2 className="mb-1 text-lg font-bold">Create your account</h2>
        <p className="mb-4 text-sm text-cafe-muted">Order in a few taps and track your delivery.</p>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Full name" required value={form.fullName} onChange={set('fullName')} />
          <Input label="Phone" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} />
          <Input label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
          <PasswordInput label="Password" autoComplete="new-password" minLength={6} required
            value={form.password} onChange={set('password')} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-cafe-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-cafe-accent">Sign in</Link>
      </p>
      <p className="mt-2 text-center text-xs text-cafe-muted">
        <Link to="/" className="underline">← Back to home</Link>
      </p>
    </AuthShell>
  )
}
