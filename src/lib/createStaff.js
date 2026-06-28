import { createClient } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'

// Lets the owner create a staff login (chef / shopkeeper / rider) from inside
// the app WITHOUT logging themselves out, and stores the credentials in the
// staff vault so the owner can re-share the password later (PIN gated in the UI).
//
// SECURITY: there is NO signup key in the website. The new account is created
// as a normal customer, then promoted to the staff role by the admin-only
// server function `admin_set_role`, which only succeeds when the caller is the
// signed-in owner. See supabase/14_security.sql.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function adminCreateStaff({ email, password, fullName, role, shopName = '' }) {
  let userId

  if (!isSupabaseConfigured) {
    // Demo mode (no backend): write straight into the in-browser mock.
    userId = crypto.randomUUID()
    await supabase.from('auth_users').insert({ id: userId, email, password, meta: { full_name: fullName, role, shop_name: shopName } })
    await supabase.from('profiles').insert({ id: userId, full_name: fullName, role, shop_name: shopName })
  } else {
    // Create the login on a throwaway client so the owner stays signed in.
    const url = import.meta.env.VITE_SUPABASE_URL
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
    const tmp = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-staff-create' },
    })
    const meta = { full_name: fullName, phone: '', shop_name: shopName }
    const { data, error } = await tmp.auth.signUp({ email, password, options: { data: meta } })
    if (error) throw error
    userId = data.user?.id
    if (!userId) throw new Error('Could not create the account.')

    // Promote to the staff role using the admin-only function. This runs as the
    // OWNER (the primary, signed-in admin client). Retry briefly in case the
    // profile row from the signup trigger has not committed yet.
    let promoteErr
    for (let i = 0; i < 5; i++) {
      const { error: rpcErr } = await supabase.rpc('admin_set_role', {
        p_user: userId, p_role: role, p_full_name: fullName, p_shop: shopName || null,
      })
      if (!rpcErr) { promoteErr = null; break }
      promoteErr = rpcErr
      await sleep(500)
    }
    if (promoteErr) throw new Error('Account created but assigning the role failed: ' + promoteErr.message)
  }

  // Save to the vault. Retry briefly so the password is never lost.
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
