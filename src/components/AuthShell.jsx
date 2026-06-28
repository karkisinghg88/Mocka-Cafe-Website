import { CAFE } from '../lib/format'

export default function AuthShell({ children }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-cafe-card border border-cafe-line">
          <img src="/coffee.svg" alt="" className="h-10 w-10" />
        </div>
        <h1 className="text-3xl font-black tracking-tight text-cafe-accent">{CAFE.name}</h1>
        <p className="mt-1 text-sm text-cafe-muted">{CAFE.tagline}</p>
      </div>
      {children}
    </div>
  )
}
