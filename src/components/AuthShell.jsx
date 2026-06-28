import { Link } from 'react-router-dom'
import { CAFE } from '../lib/format'

export default function AuthShell({ children }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-cafe-card border border-cafe-line">
          <img src="/logo.svg" alt="Mocka Cafe logo" className="h-10 w-10" />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-cafe-accent">{CAFE.name}</h1>
        <p className="mt-1 text-sm text-cafe-muted">{CAFE.tagline}</p>
      </div>
      {children}
      <p className="mt-8 text-center text-xs text-cafe-muted">
        <Link to="/terms" className="underline hover:text-white">Terms</Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="underline hover:text-white">Privacy</Link>
      </p>
    </div>
  )
}
