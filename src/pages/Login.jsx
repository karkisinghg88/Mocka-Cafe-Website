import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthShell from '../components/AuthShell'
import { Button, Input, PasswordInput, Card } from '../components/ui'

const DEMO_LOGINS = [
  { label: '👑 Owner / Admin', email: 'admin@mocka.test' },
  { label: '👨‍🍳 Chef', email: 'chef@mocka.test' },
  { label: '🧑 Customer', email: 'guest@mocka.test' },
]

export default function Login() {
  const { signIn, isDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn({ email: email.trim(), password })
    } catch (err) {
      setError(err.message || 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  const demoLogin = async (demoEmail) => {
    setError(''); setBusy(true)
    try { await signIn({ email: demoEmail, password: '123456' }) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <AuthShell>
      {isDemo && (
        <Card className="mb-4 p-4">
          <p className="mb-2 text-sm font-semibold text-cafe-accent">Try it instantly, demo logins</p>
          <div className="grid grid-cols-1 gap-2">
            {DEMO_LOGINS.map((d) => (
              <Button key={d.email} variant="ghost" disabled={busy} onClick={() => demoLogin(d.email)}>
                {d.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-center text-[11px] text-cafe-muted">One tap, no password needed.</p>
        </Card>
      )}
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-bold">Sign in</h2>
        <form onSubmit={submit} className="space-y-3">
          <Input label="Email" type="email" autoComplete="email" required
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <PasswordInput label="Password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-cafe-muted">
        New here?{' '}
        <Link to="/signup" className="font-semibold text-cafe-accent">Create an account</Link>
      </p>
      <p className="mt-2 text-center text-xs text-cafe-muted">
        <Link to="/" className="underline">← Back to home</Link>
      </p>
    </AuthShell>
  )
}
