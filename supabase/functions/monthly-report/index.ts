// Mocka Cafe — monthly report email (Supabase Edge Function)
//
// Builds the month's numbers, asks Gemini for a plain-language summary, and
// emails it to the owner via Brevo. Triggered two ways:
//   1) Scheduled monthly by pg_cron (see supabase/18_monthly_email.sql), which
//      calls this with the service-role key -> emails the cycle that just ended.
//   2) The "Email me this report" button in Reports, which sends the signed-in
//      owner's token and a { month } -> emails that month.
//
// Deploy:  supabase functions deploy monthly-report --project-ref <ref>
// Secrets: supabase secrets set BREVO_API_KEY=... REPORT_FROM=you@verified.dom REPORT_TO=karkisinghg88@gmail.com
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || ''
const REPORT_TO = Deno.env.get('REPORT_TO') || 'karkisinghg88@gmail.com'
const REPORT_FROM = Deno.env.get('REPORT_FROM') || REPORT_TO

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const rupees = (n: number) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')

function cycleRange(ym: string, cycleDay: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = Math.min(Math.max(1, cycleDay || 1), 28)
  const start = new Date(Date.UTC(y, m - 1, d))
  const nextStart = new Date(Date.UTC(y, m, d))
  const end = new Date(nextStart); end.setUTCDate(end.getUTCDate() - 1)
  const iso = (dt: Date) => dt.toISOString().slice(0, 10)
  const lbl = (dt: Date) => `${dt.getUTCDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getUTCMonth()]}`
  return { start: iso(start), end: iso(end), label: `${lbl(start)} to ${lbl(nextStart)}` }
}

// The cycle that has most recently finished (for the scheduled run).
function lastCompletedYm(cycleDay: number): string {
  const now = new Date()
  let y = now.getUTCFullYear(), m = now.getUTCMonth() // current open cycle start month
  if (now.getUTCDate() < cycleDay) { m -= 1; if (m < 0) { m = 11; y-- } }
  // last completed cycle started one month before the current open cycle
  m -= 1; if (m < 0) { m = 11; y-- }
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // ---- auth: allow the cron (service key) or the signed-in admin ----
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim()
    let allowed = token && token === SERVICE
    if (!allowed && token) {
      const asUser = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: { user } } = await asUser.auth.getUser()
      if (user) {
        const { data: p } = await asUser.from('profiles').select('role').eq('id', user.id).single()
        allowed = p?.role === 'admin'
      }
    }
    if (!allowed) return json({ error: 'Not allowed.' }, 401)

    const body = await req.json().catch(() => ({}))
    const db = createClient(URL, SERVICE)

    // ---- settings + cycle ----
    const { data: settingsRows } = await db.from('settings').select('*')
    const settings: Record<string, string> = {}
    ;(settingsRows || []).forEach((r: any) => { settings[r.key] = r.value })
    const cycleDay = Number(settings.report_cycle_day || 1)
    const ym = body.month || lastCompletedYm(cycleDay)
    const { start, end, label } = cycleRange(ym, cycleDay)

    // ---- data ----
    const [{ data: orders }, { data: purchases }, { data: inventory }, { data: expenses }, { data: salaries }, { data: recipes }] = await Promise.all([
      db.from('orders')
        .select('total, business_date, payment_method, cash_amount, upi_amount, rating, order_items(menu_item_id, name_snapshot, price_snapshot, quantity, cost_snapshot, is_available)')
        .gte('business_date', start).lte('business_date', end)
        .or('payment_status.eq.received,status.eq.paid,status.eq.delivered'),
      db.from('inventory_purchases').select('item_id, qty, total_cost').gte('purchased_on', start).lte('purchased_on', end),
      db.from('inventory_items').select('id, name, unit, unit_cost'),
      db.from('expenses').select('type, amount').gte('expense_date', start).lte('expense_date', end),
      db.from('staff_salaries').select('name'),
      db.from('recipe_items').select('menu_item_id, inventory_item_id, qty'),
    ])

    const invMap: Record<string, any> = Object.fromEntries((inventory || []).map((i: any) => [i.id, i]))
    const recipeMap: Record<string, any[]> = {}
    ;(recipes || []).forEach((r: any) => { (recipeMap[r.menu_item_id] ||= []).push(r) })

    let sales = 0, cogs = 0, cash = 0, upi = 0, plates = 0
    const byProduct: Record<string, any> = {}
    const impliedUse: Record<string, number> = {}
    ;(orders || []).forEach((o: any) => {
      sales += Number(o.total)
      let c = Number(o.cash_amount) || 0, u = Number(o.upi_amount) || 0
      if (c + u === 0) { if (o.payment_method === 'upi') u = Number(o.total); else c = Number(o.total) }
      cash += c; upi += u
      ;(o.order_items || []).forEach((it: any) => {
        if (it.is_available === false) return
        plates += Number(it.quantity) || 0
        cogs += Number(it.cost_snapshot) * it.quantity
        const p = (byProduct[it.name_snapshot] ||= { units: 0, revenue: 0 })
        p.units += it.quantity; p.revenue += Number(it.price_snapshot) * it.quantity
        const rec = recipeMap[it.menu_item_id]
        if (rec) rec.forEach((ri: any) => { impliedUse[ri.inventory_item_id] = (impliedUse[ri.inventory_item_id] || 0) + Number(ri.qty) * it.quantity })
      })
    })

    const sumType = (t: string) => (expenses || []).filter((e: any) => e.type === t).reduce((s: number, e: any) => s + Number(e.amount), 0)
    const rent = sumType('rent'), electricity = sumType('electricity'), cylinders = sumType('cylinder')
    const salaryTotal = sumType('salary'), other = sumType('other')
    const totalExpenses = rent + electricity + cylinders + salaryTotal + other
    const netProfit = sales - cogs - totalExpenses
    const gasPerPlate = plates > 0 ? cylinders / plates : 0

    const purchasedQty: Record<string, number> = {}
    ;(purchases || []).forEach((p: any) => { purchasedQty[p.item_id] = (purchasedQty[p.item_id] || 0) + Number(p.qty) })
    const recipeCheck = Object.keys({ ...impliedUse, ...purchasedQty }).map((id) => {
      const implied = impliedUse[id] || 0, bought = purchasedQty[id] || 0
      const ratio = implied > 0 ? bought / implied : null
      let note = 'aligned'
      if (implied === 0 && bought > 0) note = 'no recipe uses this yet'
      else if (ratio && ratio >= 1.3) note = 'using more than recipes say'
      else if (ratio && ratio <= 0.7) note = 'bought more than used'
      return { name: invMap[id]?.name || 'Item', unit: invMap[id]?.unit || '', implied, bought, note }
    }).filter((r) => r.note !== 'aligned').slice(0, 10)

    const products = Object.entries(byProduct).map(([name, v]: any) => ({ name, units: v.units, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 8)

    // ---- AI summary (Gemini key from settings) ----
    let aiText = ''
    const key = (settings.gemini_key || '').trim()
    if (key) {
      const summary = {
        period: label, sales, cost_of_goods: cogs, net_profit: netProfit,
        expenses: { rent, electricity, cylinders, salaries: salaryTotal, other, total: totalExpenses },
        plates_sold: plates, gas_cost_per_plate: gasPerPlate, cash_collected: cash, upi_collected: upi,
        orders: (orders || []).length, top_products: products,
        recipe_check: recipeCheck.map((r) => ({ item: r.name, unit: r.unit, used_by_recipes: +r.implied.toFixed(2), actually_bought: +r.bought.toFixed(2), note: r.note })),
      }
      const prompt = `You are the business analyst for Mocka Cafe in Najafgarh, Delhi. Using ONLY the data below for ${label}, write a friendly owner report. Cover profit or loss headline, what sold well, items to watch, a recipe check paragraph (where actually_bought is much higher than used_by_recipes, the recipe likely uses more or there is waste, suggest raising that ingredient; where lower, it may be overbought, name items), and 3 actions for next month. Under 280 words, short paragraphs, simple language. Do not use any dash characters. Data (JSON): ${JSON.stringify(summary)}`
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        })
        const j = await r.json()
        aiText = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
      } catch (_) { aiText = '' }
    }

    // ---- email HTML ----
    const row = (a: string, b: string) => `<tr><td style="padding:4px 0;color:#555">${a}</td><td style="padding:4px 0;text-align:right;font-weight:600">${b}</td></tr>`
    const prodRows = products.map((p) => `<tr><td style="padding:2px 0">${p.name}</td><td style="text-align:right">${p.units}</td><td style="text-align:right">${rupees(p.revenue)}</td></tr>`).join('')
    const checkRows = recipeCheck.map((r) => `<tr><td style="padding:2px 0">${r.name}</td><td style="text-align:right">${r.implied.toFixed(2)} ${r.unit}</td><td style="text-align:right">${r.bought.toFixed(2)} ${r.unit}</td><td style="text-align:right;color:#b8651b">${r.note}</td></tr>`).join('')
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#222">
        <h2 style="color:#e08a2b;margin:0">Mocka Cafe — Monthly report</h2>
        <p style="color:#777;margin:4px 0 16px">${label}</p>
        <div style="background:#faf7f2;border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:16px">
          <p style="margin:0;color:#777;font-size:13px">Net ${netProfit >= 0 ? 'profit' : 'loss'}</p>
          <p style="margin:4px 0;font-size:28px;font-weight:800;color:${netProfit >= 0 ? '#188a4a' : '#c0392b'}">${rupees(Math.abs(netProfit))}</p>
          <table style="width:100%;font-size:14px;border-top:1px solid #eee;margin-top:8px">
            ${row('Sales', rupees(sales))}
            ${row('Cost of goods', rupees(cogs))}
            ${row('Rent', rupees(rent))}
            ${row('Electricity', rupees(electricity))}
            ${row('Gas cylinders', rupees(cylinders))}
            ${row('Salaries &amp; labour', rupees(salaryTotal))}
            ${row('Other', rupees(other))}
            ${row('Cash collected', rupees(cash))}
            ${row('UPI collected', rupees(upi))}
            ${row('Plates sold', String(plates))}
            ${row('Gas per plate', rupees(gasPerPlate))}
          </table>
        </div>
        ${aiText ? `<div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:16px"><h3 style="margin:0 0 8px">AI summary</h3><div style="white-space:pre-line;font-size:14px;line-height:1.6;color:#333">${aiText.replace(/</g, '&lt;')}</div></div>` : ''}
        <h3 style="margin:16px 0 6px">Top products</h3>
        <table style="width:100%;font-size:13px"><tr style="color:#999"><td>Item</td><td style="text-align:right">Qty</td><td style="text-align:right">Sales</td></tr>${prodRows}</table>
        ${checkRows ? `<h3 style="margin:16px 0 6px">Recipe check</h3><table style="width:100%;font-size:13px"><tr style="color:#999"><td>Raw item</td><td style="text-align:right">Used</td><td style="text-align:right">Bought</td><td style="text-align:right">Note</td></tr>${checkRows}</table>` : ''}
        <p style="color:#999;font-size:12px;margin-top:24px">Sent automatically by your Mocka Cafe app.</p>
      </div>`

    // ---- send via Brevo ----
    if (!BREVO_API_KEY) return json({ ok: false, error: 'BREVO_API_KEY not set', preview: { netProfit, sales, label } }, 200)
    const send = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: 'Mocka Cafe', email: REPORT_FROM },
        to: [{ email: REPORT_TO }],
        subject: `Mocka Cafe report — ${label} — Net ${netProfit >= 0 ? 'profit' : 'loss'} ${rupees(Math.abs(netProfit))}`,
        htmlContent: html,
      }),
    })
    if (!send.ok) return json({ ok: false, error: 'Email failed: ' + (await send.text()) }, 200)
    return json({ ok: true, emailed: REPORT_TO, period: label, netProfit })
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500)
  }
})
