import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { CAFE } from '../lib/format'

// Simple, readable shell for the Terms and Privacy pages.
export default function LegalShell({ title, updated, children }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-cafe-line bg-cafe-bg/90 px-3 py-3 backdrop-blur">
        <button onClick={() => navigate(-1)} aria-label="Go back"
          className="flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-semibold text-cafe-muted hover:text-white">
          <ChevronLeft size={18} /> Back
        </button>
        <span className="font-display font-extrabold text-cafe-accent">{CAFE.name}</span>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {updated && <p className="mt-1 text-xs text-cafe-muted">Last updated {updated}</p>}
        <div className="legal mt-6 space-y-6 text-sm leading-relaxed text-cafe-muted">
          {children}
        </div>
        <p className="mt-10 border-t border-cafe-line pt-6 text-xs text-cafe-muted">
          Questions? Call us at {CAFE.phoneDisplay} or visit {CAFE.address}.
        </p>
        <p className="mt-4 text-center text-xs">
          <Link to="/" className="text-cafe-muted underline hover:text-white">Back to home</Link>
        </p>
      </main>
    </div>
  )
}

// Small helpers so each section looks consistent.
export function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  )
}
