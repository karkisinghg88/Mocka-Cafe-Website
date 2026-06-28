import { CAFE } from '../lib/format'

export default function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <h1 className="text-2xl font-bold text-cafe-accent">{CAFE.name}</h1>
      <p className="mt-1 text-cafe-muted">Almost ready, one setup step left.</p>

      <div className="mt-6 rounded-2xl border border-cafe-line bg-cafe-card p-5 text-sm leading-relaxed">
        <p className="font-semibold text-white">Connect Supabase</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-cafe-muted">
          <li>Create a free project at <span className="text-cafe-accent">supabase.com</span>.</li>
          <li>Run the SQL in <code className="text-white">supabase/schema.sql</code> (SQL Editor).</li>
          <li>Copy <code className="text-white">.env.example</code> to <code className="text-white">.env</code>.</li>
          <li>Paste your Project URL and anon key, then restart <code className="text-white">npm run dev</code>.</li>
        </ol>
        <p className="mt-4 text-xs text-cafe-muted">
          Full step-by-step instructions are in <code className="text-white">README.md</code>.
        </p>
      </div>
    </div>
  )
}
