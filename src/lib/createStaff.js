import { createClient } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'

// Lets the owner create a staff login (chef / shopkeeper / rider) from inside the
// app WITHOUT logging themselves out, and stores the credentials in the staff
// vault so the owner can re-share the password later (PIN gated in the UI).
const KEYS = { shopkeeper: '0707', chef: '0506', rider: '0808' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function adminCreateStaff({ email, password, fullName, role, shopName = '' }) {
  const key = KEYS[role]
  const meta = { full_name: fullName, requested_role: role, signup_key: key, shop_name: shopName }
  let userId

  if (!isSupabaseConfigured) {
    userId = crypto.randomUUID()
    await supabase.from('auth_users').insert({ id: userId, email, password, meta: { ...meta, role } })
    await supabase.from('profiles').insert({ id: userId, full_name: fullName, role, shop_name: shopName })
  } else {
    const url = import.meta.env.VITE_SUPABASE_URL
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
    const tmp = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-staff-create' },
    })
    const { data, error } = await tmp.auth.signUp({ email, password, options: { data: meta } })
    if (error) throw error
    userId = data.user?.id
    if (!userId) throw new Error('Could not create the account.')
  }

  // Save to the vault. The profile row is created by a DB trigger; retry briefly
  // in case it has not committed yet so the password is never lost.
  const row = { user_id: userId, role, full_name: fullName, email, password }
  let lastErr
  for (let i = 0; i < 4; i++) {
    const { error } = await supabase.from('staff_credentials').insert(row)
    if (!error) { lastErr = null; break }
    lastErr = error
    await sleep(600)
  }
  if (lastErr) throw new Error('Login was created but saving the password failed: ' + lastErr.message)

  return { userId }
}
