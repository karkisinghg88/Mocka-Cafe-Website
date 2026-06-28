import { createClient } from '@supabase/supabase-js'
import { createMockClient } from './mockSupabase'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)
// When no real backend is set up yet, run a self-contained demo in the browser.
export const isDemo = !isSupabaseConfigured

if (isDemo) {
  console.info('[Mocka Cafe] Running in DEMO mode (in-browser sample data). Add .env to connect real Supabase.')
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : createMockClient()
