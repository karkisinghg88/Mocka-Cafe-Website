import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { todayISO } from '../lib/format'

// Loads today's orders (with their items) and keeps them live via Realtime.
// Pass a `filter` fn to narrow which orders you care about.
export function useOrders({ types = null } = {}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    let q = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('business_date', todayISO())
      .order('daily_number', { ascending: true })
    if (types) q = q.in('type', types)
    const { data } = await q
    setOrders(data || [])
    setLoading(false)
  }, [types])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  return { orders, loading, reload: load }
}
