import { useState } from 'react'
import { isDemo } from '../lib/supabase'

export default function DemoBanner() {
  const [hidden, setHidden] = useState(false)
  if (!isDemo || hidden) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-cafe-accent/15 px-3 py-1.5 text-center text-[11px] text-cafe-accent">
      <span>Demo mode, sample data, no setup needed. Connect Supabase to go live.</span>
      <button onClick={() => setHidden(true)} className="font-bold">✕</button>
    </div>
  )
}
