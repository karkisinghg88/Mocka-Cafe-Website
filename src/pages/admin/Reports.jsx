import { useCallback, useEffect, useState } from 'react'
import {
  TrendingUp, TrendingDown, Flame, Coins, Snail, AlertTriangle,
  PackageX, ChevronDown, Lightbulb, Clock, ShoppingBasket, Trash2, Heart, ArrowUpNarrowWide, ShoppingCart,
  Banknote, QrCode, Download, Plus, Flame as Fuel, Receipt, Star, Sparkles,
  Users, Pencil, Check, Mail, Wand2, FlaskConical, Bike,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  getShopkeepers, getSettings, getExpenses, addExpense, deleteExpense,
  getStaffSalaries, addStaffSalary, updateStaffSalary, deleteStaffSalary, getAllRecipes,
  applyRecipeFix, emailMonthlyReport, getStaffByRole,
} from '../../lib/db'
import { generateAiReport } from '../../lib/ai'
import { rupees, todayISO, cycleRange } from '../../lib/format'
import { Card, Spinner, Badge, Button } from '../../components/ui'
import RestockModal from '../../components/RestockModal'

const hourLabel = (h) => { const ap = h < 12 ? 'AM' : 'PM'; const hr = h % 12 || 12; return `${hr} ${ap}` }

export default function Reports() {
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [restock, setRestock] = useState(null)
  const [ai, setAi] = useState({ text: '', loading: false, error: '' })
  const [email, setEmail] = useState({ loading: false, msg: '', error: '' })

  const sendEmail = async () => {
    setEmail({ loading: true, msg: '', error: '' })
    try { const r = await emailMonthlyReport(month); setEmail({ loading: false, msg: `Sent to ${r?.emailed || 'owner'}.`, error: '' }) }
    catch (e) { setEmail({ loading: false, msg: '', error: e.message }) }
  }

  const runAi = async () => {
    setAi({ text: '', loading: true, error: '' })
    try { setAi({ text: await generateAiReport(data), loading: false, error: '' }) }
    catch (e) { setAi({ text: '', loading: false, error: e.message }) }
  }

  const run = useCallback(async () => {
    const settings = await getSettings()
    const cycleDay = Number(settings.report_cycle_day || 1)
    const { start, end, label } = cycleRange(month, cycleDay)
    const [{ data: orders }, { data: purchases }, { data: inventory }, { data: procured }, shopkeepers, expenses, staffSalaries, recipesMap, riders] = await Promise.all([
      supabase.from('orders')
        .select('total, delivery_charge, type, business_date, created_at, payment_method, cash_amount, upi_amount, rating, rider_id, left_cafe_at, reached_at, back_at_cafe_at, paid_at, order_items(menu_item_id, name_snapshot, price_snapshot, quantity, cost_snapshot, is_available)')
        .gte('business_date', start).lte('business_date', end)
        .or('payment_status.eq.received,status.eq.paid,status.eq.delivered'),
      supabase.from('inventory_purchases').select('item_id, qty, total_cost, purchased_on').gte('purchased_on', start).lte('purchased_on', end),
      supabase.from('inventory_items').select('*').order('current_qty'),
      supabase.from('purchase_items').select('shopkeeper_id, qty, unit_price, payment_method').eq('status', 'purchased').gte('business_date', start).lte('business_date', end),
      getShopkeepers(),
      getExpenses(start, end),
      getStaffSalaries(),
      getAllRecipes(),
      getStaffByRole('rider'),
    ])
    const impliedUse = {} // inventory_item_id -> qty the recipes say sales should have used

    const today = todayISO()
    let sales = 0, cogs = 0, salesToday = 0, cashTotal = 0, upiTotal = 0, plates = 0
    const byProduct = {}
    const hours = Array(24).fill(0)

    ;(orders || []).forEach((o) => {
      sales += Number(o.total)
      if (o.business_date === today) salesToday += Number(o.total)
      if (o.created_at) hours[new Date(o.created_at).getHours()] += Number(o.total)

      // Cash vs UPI. Older/simple orders that weren't split-tracked fall back to method.
      let c = Number(o.cash_amount) || 0, u = Number(o.upi_amount) || 0
      if (c + u === 0) { if (o.payment_method === 'upi') u = Number(o.total); else c = Number(o.total) }
      cashTotal += c; upiTotal += u
      ;(o.order_items || []).forEach((it) => {
        if (it.is_available === false) return
        plates += Number(it.quantity) || 0
        const rev = Number(it.price_snapshot) * it.quantity
        const cost = Number(it.cost_snapshot) * it.quantity
        cogs += cost
        const p = (byProduct[it.name_snapshot] ||= { units: 0, revenue: 0, cost: 0, ratingSum: 0, ratingCount: 0 })
        p.units += it.quantity; p.revenue += rev; p.cost += cost
        if (o.rating) { p.ratingSum += Number(o.rating); p.ratingCount += 1 }
        // What the recipes say this sale should have consumed (for the recipe check).
        const rec = recipesMap[it.menu_item_id]
        if (rec) rec.forEach((ri) => { impliedUse[ri.inventory_item_id] = (impliedUse[ri.inventory_item_id] || 0) + Number(ri.qty) * it.quantity })
      })
    })

    const products = Object.entries(byProduct).map(([name, v]) => ({
      name, units: v.units, revenue: v.revenue, cost: v.cost,
      profit: v.revenue - v.cost, margin: v.revenue ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
      noRecipe: v.cost === 0,
      avgRating: v.ratingCount ? v.ratingSum / v.ratingCount : null, ratingCount: v.ratingCount,
    })).sort((a, b) => b.revenue - a.revenue)

    const rated = products.filter((p) => p.avgRating != null)
    const avgFoodRating = rated.length ? rated.reduce((s, p) => s + p.avgRating, 0) / rated.length : null
    const lowRated = [...rated].sort((a, b) => a.avgRating - b.avgRating).slice(0, 3)
    const topRated = [...rated].sort((a, b) => b.avgRating - a.avgRating).slice(0, 3)

    const orderCount = (orders || []).length
    const lowStock = (inventory || [])
      .filter((i) => Number(i.low_stock_threshold) > 0 && Number(i.current_qty) <= Number(i.low_stock_threshold))
      .sort((a, b) => (a.current_qty / (a.low_stock_threshold || 1)) - (b.current_qty / (b.low_stock_threshold || 1)))

    // ---- Procurement insight: frequency + spend + shelf life ----
    const invMap = Object.fromEntries((inventory || []).map((i) => [i.id, i]))
    const buys = {}
    ;(purchases || []).forEach((p) => {
      const inv = invMap[p.item_id]; if (!inv) return
      const b = (buys[p.item_id] ||= { name: inv.name, unit: inv.unit, shelf: Number(inv.shelf_life_days), qty: 0, spend: 0, times: 0 })
      b.qty += Number(p.qty); b.spend += Number(p.total_cost); b.times += 1
    })
    const procurement = Object.values(buys).sort((a, b) => b.spend - a.spend)
    const bulkCandidates = procurement.filter((p) => p.times >= 2 && (p.shelf === 0 || p.shelf >= 7))
    const dailyItems = procurement.filter((p) => p.shelf === 1)
    const shopMap = Object.fromEntries((shopkeepers || []).map((s) => [s.id, s.shop_name || s.full_name]))
    const byShopSpend = {}
    ;(procured || []).forEach((p) => {
      const name = shopMap[p.shopkeeper_id] || 'Direct store'
      byShopSpend[name] = (byShopSpend[name] || 0) + Number(p.qty) * Number(p.unit_price)
    })
    const shopSpend = Object.entries(byShopSpend).map(([name, spend]) => ({ name, spend })).sort((a, b) => b.spend - a.spend)

    // ---- Recipe check / auto-calibration: recipe-implied usage vs real purchases ----
    const checkIds = new Set([...Object.keys(impliedUse), ...Object.keys(buys)])
    const recipeCheck = [...checkIds].map((id) => {
      const inv = invMap[id]
      const implied = impliedUse[id] || 0
      const purchased = buys[id]?.qty || 0
      const unitCost = Number(inv?.unit_cost || 0)
      const variance = purchased - implied
      const ratio = implied > 0 ? purchased / implied : null
      let hint
      if (implied === 0 && purchased > 0) hint = 'no recipe uses this yet'
      else if (ratio != null && ratio >= 1.3) hint = 'using more than recipes say'
      else if (ratio != null && ratio <= 0.7) hint = 'bought more than used'
      else hint = 'aligned'
      return {
        id, name: inv?.name || buys[id]?.name || 'Item', unit: inv?.unit || buys[id]?.unit || '',
        implied, purchased, variance, ratio, hint, valueImpact: Math.abs(variance) * unitCost,
      }
    }).filter((r) => r.implied > 0 || r.purchased > 0)
      .sort((a, b) => b.valueImpact - a.valueImpact)

    // ---- Rider delivery times (recorded by riders for each delivery) ----
    const riderNameMap = Object.fromEntries((riders || []).map((r) => [r.id, r.full_name || 'Rider']))
    const riderAgg = {}
    ;(orders || []).forEach((o) => {
      if (!o.rider_id) return
      const a = (riderAgg[o.rider_id] ||= { name: riderNameMap[o.rider_id] || 'Rider', count: 0, reachSum: 0, reachN: 0, roundSum: 0, roundN: 0 })
      a.count++
      const reach = (o.left_cafe_at && o.reached_at) ? (new Date(o.reached_at) - new Date(o.left_cafe_at)) / 60000 : null
      const round = (o.left_cafe_at && o.back_at_cafe_at) ? (new Date(o.back_at_cafe_at) - new Date(o.left_cafe_at)) / 60000 : null
      if (reach != null && reach >= 0) { a.reachSum += reach; a.reachN++ }
      if (round != null && round >= 0) { a.roundSum += round; a.roundN++ }
    })
    const deliveries = Object.values(riderAgg).map((a) => ({
      name: a.name, count: a.count,
      avgReach: a.reachN ? Math.round(a.reachSum / a.reachN) : null,
      avgRound: a.roundN ? Math.round(a.roundSum / a.roundN) : null,
    })).sort((x, y) => y.count - x.count)

    // ---- Expenses + net profit (rent/electricity logged per cycle, with dates) ----
    const ofType = (t) => (expenses || []).filter((e) => e.type === t)
    const sum = (list) => list.reduce((s, e) => s + Number(e.amount), 0)
    const rentList = ofType('rent'), elecList = ofType('electricity'), cylinderList = ofType('cylinder')
    const salaryList = ofType('salary'), otherList = ofType('other')
    const rent = sum(rentList), electricity = sum(elecList), cylinderTotal = sum(cylinderList)
    const salaryTotal = sum(salaryList), otherTotal = sum(otherList)
    const grossProfit = sales - cogs
    const totalExpenses = rent + electricity + cylinderTotal + salaryTotal + otherTotal
    const netProfit = grossProfit - totalExpenses

    // Gas/cylinder costing: spread cylinder spend over plates sold this cycle.
    // Cylinders stay counted once (as an expense); this is a per-plate insight
    // that gets more accurate as more cylinders are logged.
    const cylinderCount = cylinderList.reduce((s, e) => s + (Number(e.qty) || 1), 0)
    const gasPerPlate = plates > 0 ? cylinderTotal / plates : 0
    const cylDates = cylinderList.map((e) => e.expense_date).sort()
    let cylinderDaysEach = 0
    if (cylDates.length >= 2) {
      const gaps = []
      for (let i = 1; i < cylDates.length; i++) gaps.push((new Date(cylDates[i]) - new Date(cylDates[i - 1])) / 86400000)
      cylinderDaysEach = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    }

    const costed = products.filter((p) => !p.noRecipe)
    setData({
      periodLabel: label, start, end,
      avgFoodRating, lowRated, topRated, ratedCount: rated.length,
      rent, electricity, rentList, elecList, cylinderList, salaryList, otherList,
      cylinderTotal, salaryTotal, otherTotal, totalExpenses, netProfit,
      staffSalaries, plates, gasPerPlate, cylinderCount, cylinderDaysEach, recipeCheck, deliveries,
      procurement, bulkCandidates, dailyItems, shopSpend,
      sales, cogs, grossProfit, salesToday, orderCount,
      cashTotal, upiTotal,
      products, lowStock, hours,
      purchaseTotal: (purchases || []).reduce((s, p) => s + Number(p.total_cost), 0),
      aov: orderCount ? sales / orderCount : 0,
      bestSeller: [...products].sort((a, b) => b.units - a.units)[0],
      slowMover: [...products].sort((a, b) => a.units - b.units)[0],
      topProfit: [...products].sort((a, b) => b.profit - a.profit)[0],
      losers: products.filter((p) => p.profit < 0 || (!p.noRecipe && p.margin < 15)),
      highMargin: [...costed].sort((a, b) => b.margin - a.margin).slice(0, 3),
      lowMargin: [...costed].sort((a, b) => a.margin - b.margin).slice(0, 3),
    })
    setLoading(false)
  }, [month])

  useEffect(() => { setLoading(true); run() }, [run])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Reports</h2>
          {data && <p className="text-xs text-cafe-muted">Cycle: {data.periodLabel}</p>}
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="rounded-xl bg-cafe-card border border-cafe-line px-3 py-2 text-sm" />
      </div>

      {loading || !data ? <Spinner /> : (
        <>
          <Card className={`p-5 ${data.netProfit >= 0 ? 'border-emerald-600/40' : 'border-red-600/40'}`}>
            <p className="text-xs uppercase tracking-wide text-cafe-muted">Net profit / loss</p>
            <p className={`mt-1 text-4xl font-black ${data.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.netProfit < 0 ? '-' : ''}{rupees(Math.abs(data.netProfit))}
            </p>
            <div className="mt-3 space-y-1 border-t border-cafe-line pt-3 text-sm">
              <Line label="Sales" value={rupees(data.sales)} />
              <Line label="Less cost of goods" value={rupees(data.cogs)} red />
              <Line label="Less expenses (rent, bills, gas, salaries)" value={rupees(data.totalExpenses)} red />
              <div className="flex justify-between border-t border-cafe-line pt-1 font-bold">
                <span>Net</span><span className={data.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{rupees(data.netProfit)}</span>
              </div>
              {data.gasPerPlate > 0 && (
                <p className="pt-1 text-[11px] text-cafe-muted">
                  Gas: {data.cylinderCount} cylinder{data.cylinderCount === 1 ? '' : 's'} this cycle, about {rupees(data.gasPerPlate)} per plate
                  {data.cylinderDaysEach > 0 && `, one cylinder lasts roughly ${data.cylinderDaysEach} days`}.
                </p>
              )}
            </div>
          </Card>

          {/* AI report */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-semibold"><Sparkles size={16} className="text-cafe-accent" /> AI report</p>
              <Button className="px-3 py-2" disabled={ai.loading} onClick={runAi}>{ai.loading ? 'Thinking…' : 'Generate'}</Button>
            </div>
            {ai.error && <p className="mt-2 text-sm text-red-400">{ai.error}</p>}
            {ai.text && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-cafe-muted">{ai.text}</p>}
            {!ai.text && !ai.error && <p className="mt-2 text-xs text-cafe-muted">Get an AI written summary and suggestions for this cycle. Add your Gemini key in Settings first.</p>}
          </Card>

          {/* Email report */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold"><Mail size={16} className="text-cafe-accent" /> Email this report</p>
              <Button className="px-3 py-2" disabled={email.loading} onClick={sendEmail}>{email.loading ? 'Sending…' : 'Email to owner'}</Button>
            </div>
            {email.error && <p className="mt-2 text-sm text-red-400">{email.error}</p>}
            {email.msg && <p className="mt-2 text-sm text-emerald-400">{email.msg}</p>}
            {!email.msg && !email.error && <p className="mt-2 text-xs text-cafe-muted">Sends the AI summary and month numbers to the owner. This also runs automatically every month.</p>}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <p className="text-xs text-cafe-muted">Sales today</p>
              <p className="mt-1 text-2xl font-black text-cafe-accent">{rupees(data.salesToday)}</p>
            </Card>
            <button onClick={() => downloadReport(data, month)}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-cafe-line bg-cafe-card p-4 text-cafe-accent">
              <Download size={22} /><span className="text-sm font-semibold">Download report</span>
            </button>
          </div>

          {/* Cash vs UPI */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-emerald-400"><Banknote size={16} /><span className="text-xs text-cafe-muted">Cash collected</span></div>
              <p className="mt-1 text-xl font-black">{rupees(data.cashTotal)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-blue-400"><QrCode size={16} /><span className="text-xs text-cafe-muted">UPI collected</span></div>
              <p className="mt-1 text-xl font-black">{rupees(data.upiTotal)}</p>
            </Card>
          </div>

          {/* EXPENSES */}
          <ExpensesSection data={data} onReload={run} />

          {/* SALARIES & LABOUR */}
          <SalariesSection data={data} onReload={run} />

          {/* LOW IN STOCK */}
          <LowStockSection items={data.lowStock} onRestock={setRestock} />

          {/* Insights */}
          {data.products.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Insight icon={Flame} color="text-orange-400" label="Best seller" value={data.bestSeller?.name} sub={`${data.bestSeller?.units} sold`} />
              <Insight icon={Coins} color="text-emerald-400" label="Most profit" value={data.topProfit?.name} sub={rupees(data.topProfit?.profit || 0)} />
              <Insight icon={Snail} color="text-blue-400" label="Slowest mover" value={data.slowMover?.name} sub={`${data.slowMover?.units} sold`} />
              <Insight icon={AlertTriangle} color="text-red-400" label="Needs attention"
                value={data.losers.length ? data.losers[0].name : 'All healthy 🎉'} sub={data.losers.length ? `${data.losers.length} low margin` : ''} />
            </div>
          )}

          {/* Product breakdown */}
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold">Product performance ({data.products.length})</p>
            {data.products.length === 0 ? (
              <p className="text-sm text-cafe-muted">No sales yet this month.</p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 border-b border-cafe-line pb-2 text-[11px] uppercase text-cafe-muted">
                  <span className="flex-1">Item</span><span className="w-10 text-right">Qty</span><span className="w-20 text-right">Sales</span><span className="w-20 text-right">Profit</span>
                </div>
                {data.products.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="w-10 text-right text-cafe-muted">{p.units}</span>
                    <span className="w-20 text-right">{rupees(p.revenue)}</span>
                    <span className={`w-20 text-right font-semibold ${p.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{rupees(p.profit)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* FOOD QUALITY (customer ratings) */}
          {data.avgFoodRating != null && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><Star size={16} className="text-cafe-accent" /> Food quality</p>
                <p className="text-sm"><span className="text-lg font-black text-cafe-accent">{data.avgFoodRating.toFixed(1)}</span><span className="text-cafe-muted">/5 · {data.ratedCount} rated</span></p>
              </div>
              {data.lowRated.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="text-xs text-red-400">Lowest rated, look into these:</p>
                  {data.lowRated.map((p) => (
                    <div key={p.name} className="flex justify-between py-0.5">
                      <span>{p.name}</span><span className="text-cafe-muted">{p.avgRating.toFixed(1)} ★ ({p.ratingCount})</span>
                    </div>
                  ))}
                </div>
              )}
              {data.topRated.length > 0 && (
                <p className="mt-2 text-xs text-emerald-400">Best loved: {data.topRated.map((p) => `${p.name} (${p.avgRating.toFixed(1)}★)`).join(', ')}</p>
              )}
            </Card>
          )}

          {/* PROCUREMENT */}
          <ProcurementSection data={data} />

          {/* RECIPE CHECK / AUTO-CALIBRATION */}
          <RecipeCheckSection data={data} onReload={run} />

          {/* RIDER DELIVERY TIMES */}
          <DeliveriesSection data={data} />

          {/* SUGGESTIONS */}
          <SuggestionsSection data={data} />
        </>
      )}

      {restock && <RestockModal item={restock} onClose={() => setRestock(null)} onDone={run} />}
    </div>
  )
}

function Line({ label, value, red }) {
  return (
    <div className="flex justify-between">
      <span className="text-cafe-muted">{label}</span>
      <span className={red ? 'text-red-300' : ''}>{value}</span>
    </div>
  )
}

function ExpensesSection({ data, onReload }) {
  const [open, setOpen] = useState(false)
  const remove = async (id) => { await deleteExpense(id); onReload() }
  const dDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2"><Receipt size={18} className="text-cafe-accent" /><span className="font-bold">Expenses</span>
          <Badge className="bg-red-500/15 text-red-400">{rupees(data.totalExpenses)}</Badge></span>
        <ChevronDown size={18} className={`text-cafe-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-cafe-line p-4 text-sm">
          <p className="text-xs text-cafe-muted">Add this cycle's bills with their payment date. Amounts can differ every month.</p>

          <ExpenseGroup title="Shop rent" type="rent" list={data.rentList} start={data.start}
            onReload={onReload} onRemove={remove} dDate={dDate} />
          <ExpenseGroup title="Electricity bill" type="electricity" list={data.elecList} start={data.start}
            onReload={onReload} onRemove={remove} dDate={dDate} />
          <ExpenseGroup title="Gas cylinders" type="cylinder" list={data.cylinderList} start={data.start} withQty
            onReload={onReload} onRemove={remove} dDate={dDate} />
          <ExpenseGroup title="Salaries & labour" type="salary" list={data.salaryList} start={data.start} withLabel
            onReload={onReload} onRemove={remove} dDate={dDate} />
          <ExpenseGroup title="Other expenses" type="other" list={data.otherList} start={data.start} withLabel
            onReload={onReload} onRemove={remove} dDate={dDate} />

          <div className="flex justify-between border-t border-cafe-line pt-2 font-bold">
            <span>Total expenses</span><span className="text-red-400">{rupees(data.totalExpenses)}</span>
          </div>
        </div>
      )}
    </Card>
  )
}

function ExpenseGroup({ title, type, list, start, withQty, withLabel, onReload, onRemove, dDate }) {
  const [f, setF] = useState({ label: '', qty: '', amount: '', date: start })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const add = async () => {
    if (!f.amount) return
    await addExpense({ type, label: withLabel ? (f.label || 'Other') : title, qty: f.qty || 1, amount: f.amount, date: f.date || start })
    setF({ label: '', qty: '', amount: '', date: start }); onReload()
  }
  return (
    <div>
      <p className="mb-1 font-semibold">{title}</p>
      {list.map((e) => (
        <div key={e.id} className="flex items-center justify-between py-0.5">
          <span className="text-cafe-muted">{withLabel ? e.label : withQty ? `${e.qty} cyl` : ''}{(withLabel || withQty) ? ' · ' : ''}{dDate(e.expense_date)}</span>
          <span className="flex items-center gap-2">{rupees(e.amount)}<button onClick={() => onRemove(e.id)} className="text-cafe-muted hover:text-red-400"><Trash2 size={14} /></button></span>
        </div>
      ))}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        {withLabel && <input placeholder="what for" value={f.label} onChange={set('label')} className="min-w-0 flex-1 rounded-lg bg-cafe-bg border border-cafe-line px-2 py-1.5" />}
        {withQty && <input type="number" min="1" placeholder="qty" value={f.qty} onChange={set('qty')} className="w-14 rounded-lg bg-cafe-bg border border-cafe-line px-2 py-1.5" />}
        <input type="number" min="0" placeholder="₹ amount" value={f.amount} onChange={set('amount')} className="w-24 rounded-lg bg-cafe-bg border border-cafe-line px-2 py-1.5" />
        <input type="date" value={f.date} onChange={set('date')} className="rounded-lg bg-cafe-bg border border-cafe-line px-2 py-1.5 text-xs" />
        <Button className="px-3 py-1.5" onClick={add}><Plus size={14} /></Button>
      </div>
    </div>
  )
}

function SalariesSection({ data, onReload }) {
  const [open, setOpen] = useState(false)
  const [add, setAdd] = useState({ name: '', role: 'chef', monthly_amount: '' })
  const [editId, setEditId] = useState(null)
  const [editAmt, setEditAmt] = useState('')
  const [helper, setHelper] = useState({ name: '', amount: '', date: data.start })
  const setA = (k) => (e) => setAdd((x) => ({ ...x, [k]: e.target.value }))
  const setH = (k) => (e) => setHelper((x) => ({ ...x, [k]: e.target.value }))

  // Has this staff member's monthly salary already been posted this cycle?
  const paidThisCycle = (name) => (data.salaryList || []).some((e) => e.label === name && e.note === 'monthly')

  const addStaff = async () => {
    if (!add.name.trim()) return
    await addStaffSalary(add); setAdd({ name: '', role: 'chef', monthly_amount: '' }); onReload()
  }
  const saveAmt = async (id) => { await updateStaffSalary(id, { monthly_amount: Number(editAmt) || 0 }); setEditId(null); onReload() }
  const removeStaff = async (id) => { if (confirm('Remove from payroll? Past salary entries stay in expenses.')) { await deleteStaffSalary(id); onReload() } }
  const pay = async (s) => {
    await addExpense({ type: 'salary', label: s.name, amount: s.monthly_amount, date: data.start, note: 'monthly' })
    onReload()
  }
  const payAll = async () => {
    for (const s of data.staffSalaries.filter((x) => x.active && !paidThisCycle(x.name) && Number(x.monthly_amount) > 0)) {
      await addExpense({ type: 'salary', label: s.name, amount: s.monthly_amount, date: data.start, note: 'monthly' })
    }
    onReload()
  }
  const addHelper = async () => {
    if (!helper.name.trim() || !helper.amount) return
    await addExpense({ type: 'salary', label: helper.name.trim(), amount: helper.amount, date: helper.date || data.start, note: 'one-day' })
    setHelper({ name: '', amount: '', date: data.start }); onReload()
  }

  const roster = data.staffSalaries || []
  const remaining = roster.filter((s) => s.active && !paidThisCycle(s.name) && Number(s.monthly_amount) > 0)

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2"><Users size={18} className="text-cafe-accent" /><span className="font-bold">Salaries &amp; labour</span>
          <Badge className="bg-red-500/15 text-red-400">{rupees(data.salaryTotal)}</Badge></span>
        <ChevronDown size={18} className={`text-cafe-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-cafe-line p-4 text-sm">
          <p className="text-xs text-cafe-muted">Set each chef's monthly pay once, then tap Pay to add it to this cycle ({data.periodLabel}). Use One day helper for one off labour.</p>

          {/* Roster */}
          <div className="space-y-2">
            {roster.length === 0 && <p className="text-cafe-muted">No staff on payroll yet. Add your chefs below.</p>}
            {roster.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-xl bg-cafe-bg p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name} <span className="text-xs font-normal text-cafe-muted">{s.role}</span></p>
                  {editId === s.id ? (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-xs text-cafe-muted">₹</span>
                      <input type="number" min="0" value={editAmt} onChange={(e) => setEditAmt(e.target.value)}
                        className="w-24 rounded-lg bg-cafe-card border border-cafe-line px-2 py-1 text-sm" />
                      <button onClick={() => saveAmt(s.id)} className="text-emerald-400"><Check size={16} /></button>
                    </div>
                  ) : (
                    <p className="text-xs text-cafe-muted">{rupees(s.monthly_amount)}/month
                      <button onClick={() => { setEditId(s.id); setEditAmt(String(s.monthly_amount)) }} className="ml-2 text-cafe-muted hover:text-white"><Pencil size={12} className="inline" /></button>
                    </p>
                  )}
                </div>
                {paidThisCycle(s.name)
                  ? <span className="flex items-center gap-1 text-xs text-emerald-400"><Check size={14} /> Paid</span>
                  : <Button className="px-3 py-1.5" onClick={() => pay(s)} disabled={!Number(s.monthly_amount)}>Pay</Button>}
                <button onClick={() => removeStaff(s.id)} className="text-cafe-muted hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
            {remaining.length > 1 && (
              <Button variant="ghost" className="w-full" onClick={payAll}>Pay all remaining ({rupees(remaining.reduce((s, x) => s + Number(x.monthly_amount), 0))})</Button>
            )}
          </div>

          {/* Add to payroll */}
          <div className="rounded-xl border border-cafe-line bg-cafe-bg p-3">
            <p className="mb-2 font-semibold">Add staff to payroll</p>
            <div className="flex flex-wrap items-center gap-2">
              <input placeholder="Name" value={add.name} onChange={setA('name')} className="min-w-0 flex-1 rounded-lg bg-cafe-card border border-cafe-line px-2 py-1.5" />
              <select value={add.role} onChange={setA('role')} className="rounded-lg bg-cafe-card border border-cafe-line px-2 py-1.5 text-sm">
                <option value="chef">chef</option><option value="helper">helper</option><option value="rider">rider</option><option value="cleaner">cleaner</option><option value="other">other</option>
              </select>
              <input type="number" min="0" placeholder="₹/month" value={add.monthly_amount} onChange={setA('monthly_amount')} className="w-24 rounded-lg bg-cafe-card border border-cafe-line px-2 py-1.5" />
              <Button className="px-3 py-1.5" onClick={addStaff}><Plus size={14} /></Button>
            </div>
          </div>

          {/* One day helper */}
          <div className="rounded-xl border border-cafe-line bg-cafe-bg p-3">
            <p className="mb-2 font-semibold">One day helper / extra labour</p>
            <div className="flex flex-wrap items-center gap-2">
              <input placeholder="Name" value={helper.name} onChange={setH('name')} className="min-w-0 flex-1 rounded-lg bg-cafe-card border border-cafe-line px-2 py-1.5" />
              <input type="number" min="0" placeholder="₹ paid" value={helper.amount} onChange={setH('amount')} className="w-24 rounded-lg bg-cafe-card border border-cafe-line px-2 py-1.5" />
              <input type="date" value={helper.date} onChange={setH('date')} className="rounded-lg bg-cafe-card border border-cafe-line px-2 py-1.5 text-xs" />
              <Button className="px-3 py-1.5" onClick={addHelper}><Plus size={14} /></Button>
            </div>
          </div>

          <div className="flex justify-between border-t border-cafe-line pt-2 font-bold">
            <span>Salaries this cycle</span><span className="text-red-400">{rupees(data.salaryTotal)}</span>
          </div>
        </div>
      )}
    </Card>
  )
}

function downloadReport(data, month) {
  const L = []
  L.push(`Mocka Cafe, Report (${data.periodLabel})`)
  L.push('')
  L.push(`Sales,${data.sales}`)
  L.push(`Cost of goods,${data.cogs}`)
  L.push(`Gross profit,${data.grossProfit}`)
  L.push(`Rent,${data.rent}`)
  L.push(`Electricity,${data.electricity}`)
  L.push(`Cylinders,${data.cylinderTotal}`)
  L.push(`Salaries & labour,${data.salaryTotal}`)
  L.push(`Other expenses,${data.otherTotal}`)
  L.push(`Total expenses,${data.totalExpenses}`)
  L.push(`NET PROFIT,${data.netProfit}`)
  L.push(`Plates sold,${data.plates}`)
  L.push(`Gas per plate,${data.gasPerPlate.toFixed(2)}`)
  L.push(`Cash collected,${data.cashTotal}`)
  L.push(`UPI collected,${data.upiTotal}`)
  L.push('')
  L.push('Product,Qty,Sales,Profit')
  data.products.forEach((p) => L.push(`${p.name},${p.units},${p.revenue},${p.profit}`))
  L.push('')
  L.push('Item bought,Times,Spent')
  data.procurement.forEach((p) => L.push(`${p.name},${p.times},${p.spend}`))
  L.push('')
  L.push('Rider,Deliveries,Avg mins to reach,Avg mins round trip')
  ;(data.deliveries || []).forEach((r) => L.push(`${r.name},${r.count},${r.avgReach ?? ''},${r.avgRound ?? ''}`))
  const blob = new Blob([L.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `mocka-report-${month}.csv`
  a.click()
}

function Insight({ icon: Icon, color, label, value, sub }) {
  return (
    <Card className="p-3">
      <div className={`mb-1 flex items-center gap-1.5 ${color}`}><Icon size={15} /><span className="text-[11px] text-cafe-muted">{label}</span></div>
      <p className="truncate font-bold">{value || 'n/a'}</p>
      {sub && <p className="text-xs text-cafe-muted">{sub}</p>}
    </Card>
  )
}

function LowStockSection({ items, onRestock }) {
  const [open, setOpen] = useState(true)
  return (
    <Card className={`overflow-hidden ${items.length ? 'border-red-600/40' : ''}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2">
          <PackageX size={18} className={items.length ? 'text-red-400' : 'text-cafe-muted'} />
          <span className="font-bold">Low in stock</span>
          {items.length > 0 && <Badge className="bg-red-500/15 text-red-400">{items.length}</Badge>}
        </span>
        <ChevronDown size={18} className={`text-cafe-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-cafe-line p-4">
          {items.length === 0 ? (
            <p className="text-sm text-cafe-muted">Everything is well stocked. 🎉 Set a low-stock limit on items in Inventory to get alerts here.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-cafe-muted">Buy these tomorrow morning. Restock an item and it drops off this list.</p>
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-center gap-3 rounded-xl bg-cafe-bg p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{it.name}</p>
                      <p className="text-xs text-red-400">{it.current_qty} {it.unit} left · limit {it.low_stock_threshold} {it.unit}</p>
                    </div>
                    <button onClick={() => onRestock(it)}
                      className="flex items-center gap-1 rounded-lg bg-cafe-accent px-3 py-2 text-sm font-bold text-black">
                      <ShoppingCart size={15} /> Buy
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function ProcurementSection({ data }) {
  const [open, setOpen] = useState(false)
  const totalSpend = data.procurement.reduce((s, p) => s + p.spend, 0)
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2"><ShoppingCart size={18} className="text-cafe-accent" /><span className="font-bold">Purchasing &amp; reorder</span></span>
        <ChevronDown size={18} className={`text-cafe-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-cafe-line p-4">
          {data.procurement.length === 0 ? (
            <p className="text-sm text-cafe-muted">No purchases recorded this month yet. Buy items via the Buy list and they'll show here.</p>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between text-[11px] uppercase text-cafe-muted">
                  <span className="flex-1">Item bought</span><span className="w-12 text-right">×times</span><span className="w-20 text-right">Spent</span>
                </div>
                {data.procurement.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 border-t border-cafe-line py-1.5 text-sm">
                    <span className="min-w-0 flex-1 truncate">{p.name}
                      {p.shelf === 1 && <span className="ml-1 text-[10px] text-blue-400">daily</span>}
                      {p.shelf >= 7 && <span className="ml-1 text-[10px] text-emerald-400">{p.shelf}d</span>}
                    </span>
                    <span className="w-12 text-right text-cafe-muted">{p.times}×</span>
                    <span className="w-20 text-right font-semibold">{rupees(p.spend)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-cafe-line pt-2 text-sm font-bold">
                  <span>Total bought</span><span className="text-cafe-accent">{rupees(totalSpend)}</span>
                </div>
              </div>

              {data.bulkCandidates.length > 0 && (
                <div className="rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-3 text-sm">
                  <p className="mb-1 font-semibold text-emerald-400">Buy these in bulk (long shelf life, bought often)</p>
                  <p className="text-cafe-muted">{data.bulkCandidates.map((p) => p.name).join(', ')}, stocking a month at once saves trips.</p>
                </div>
              )}
              {data.dailyItems.length > 0 && (
                <div className="rounded-xl border border-blue-600/30 bg-blue-500/5 p-3 text-sm">
                  <p className="mb-1 font-semibold text-blue-400">Daily items (don't overstock)</p>
                  <p className="text-cafe-muted">{data.dailyItems.map((p) => p.name).join(', ')}, short shelf life, buy fresh each day.</p>
                </div>
              )}

              {data.shopSpend.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-semibold">Spend by shop</p>
                  {data.shopSpend.map((s) => (
                    <div key={s.name} className="flex justify-between py-1 text-sm">
                      <span className="text-cafe-muted">{s.name}</span><span className="font-semibold">{rupees(s.spend)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function DeliveriesSection({ data }) {
  const [open, setOpen] = useState(false)
  const rows = data.deliveries || []
  const totalDeliveries = rows.reduce((s, r) => s + r.count, 0)
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2"><Bike size={18} className="text-cafe-accent" /><span className="font-bold">Delivery times</span>
          {totalDeliveries > 0 && <Badge className="bg-cafe-accent/15 text-cafe-accent">{totalDeliveries}</Badge>}</span>
        <ChevronDown size={18} className={`text-cafe-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-cafe-line p-4 text-sm">
          <p className="text-xs text-cafe-muted">For each rider this cycle: deliveries done, average time from leaving the cafe to reaching the customer, and the average full round trip back to the cafe.</p>
          {rows.length === 0 ? (
            <p className="text-cafe-muted">No rider deliveries recorded this cycle yet.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-cafe-line pb-1 text-[11px] uppercase text-cafe-muted">
                <span className="flex-1">Rider</span>
                <span className="w-16 text-right">Done</span>
                <span className="w-20 text-right">To reach</span>
                <span className="w-20 text-right">Round trip</span>
              </div>
              {rows.map((r) => (
                <div key={r.name} className="flex items-center gap-2 py-1">
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="w-16 text-right text-cafe-muted">{r.count}</span>
                  <span className="w-20 text-right">{r.avgReach != null ? `${r.avgReach} min` : '—'}</span>
                  <span className="w-20 text-right">{r.avgRound != null ? `${r.avgRound} min` : '—'}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function RecipeCheckSection({ data, onReload }) {
  const [open, setOpen] = useState(false)
  const [fixing, setFixing] = useState(false)
  const rows = data.recipeCheck || []
  const flagged = rows.filter((r) => r.hint !== 'aligned')
  const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  const hintColor = (h) => h === 'aligned' ? 'text-emerald-400' : h === 'no recipe uses this yet' ? 'text-yellow-400' : 'text-orange-400'

  // Items we can auto-fix: a recipe exists (implied > 0) and usage is meaningfully
  // off. Scale by the actual/used ratio, clamped so sparse data can't swing wildly.
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
  const fixable = rows
    .filter((r) => r.ratio != null && (r.ratio >= 1.15 || r.ratio <= 0.85))
    .map((r) => ({ ...r, factor: clamp(r.ratio, 0.5, 2) }))

  const applyFixes = async () => {
    if (!confirm(`Adjust ${fixable.length} ingredient${fixable.length === 1 ? '' : 's'} so your recipes match what you actually used? You can re-edit any recipe in Menu afterwards.`)) return
    setFixing(true)
    try {
      for (const r of fixable) await applyRecipeFix(r.id, r.factor)
      await onReload()
      alert('Recipes updated to match real usage.')
    } catch (e) { alert(e.message) } finally { setFixing(false) }
  }

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2"><FlaskConical size={18} className="text-cafe-accent" /><span className="font-bold">Recipe check (auto-calibration)</span>
          {flagged.length > 0 && <Badge className="bg-orange-500/15 text-orange-400">{flagged.length}</Badge>}</span>
        <ChevronDown size={18} className={`text-cafe-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-cafe-line p-4 text-sm">
          <p className="text-xs text-cafe-muted">
            Compares what your recipes say you used (from sales) against what you actually bought this cycle.
            Big gaps mean a recipe is off, or there is waste / free food. It gets sharper over about a month, and is most
            accurate if you do a stock count now and then.
          </p>
          {rows.length === 0 ? (
            <p className="text-cafe-muted">Not enough data yet. Add recipes to your dishes and record some sales and purchases.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-cafe-line pb-1 text-[11px] uppercase text-cafe-muted">
                <span className="flex-1">Raw item</span>
                <span className="w-16 text-right">Used</span>
                <span className="w-16 text-right">Bought</span>
                <span className="w-24 text-right">Note</span>
              </div>
              {rows.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-1">
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="w-16 text-right text-cafe-muted">{fmt(r.implied)} {r.unit}</span>
                  <span className="w-16 text-right">{fmt(r.purchased)} {r.unit}</span>
                  <span className={`w-24 text-right text-[11px] ${hintColor(r.hint)}`}>{r.hint}</span>
                </div>
              ))}
              {fixable.length > 0 && (
                <div className="border-t border-cafe-line pt-3">
                  <Button className="w-full" disabled={fixing} onClick={applyFixes}>
                    <Wand2 size={15} /> {fixing ? 'Applying…' : `Apply AI fixes to ${fixable.length} ingredient${fixable.length === 1 ? '' : 's'}`}
                  </Button>
                  <p className="mt-1 text-center text-[11px] text-cafe-muted">Scales those recipes to match what you actually used. Good for starting; after a month it stays aligned on its own.</p>
                </div>
              )}
              <p className="border-t border-cafe-line pt-2 text-xs text-cafe-muted">
                Tip: open the AI report above for a plain-language summary and the recipe fixes in words.
              </p>
            </>
          )}
        </div>
      )}
    </Card>
  )
}

function SuggestionsSection({ data }) {
  const [open, setOpen] = useState(false)
  const peakHour = data.hours.indexOf(Math.max(...data.hours))
  const activeHours = data.hours.map((t, h) => ({ h, t })).filter((x) => x.t > 0)
  const slow = activeHours.length ? activeHours.reduce((a, b) => (b.t < a.t ? b : a)) : null
  const maxHour = Math.max(1, ...data.hours)
  const wasteTarget = data.sales * 0.03

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between p-4 text-left">
        <span className="flex items-center gap-2"><Lightbulb size={18} className="text-cafe-accent" /><span className="font-bold">Suggestions for you</span></span>
        <ChevronDown size={18} className={`text-cafe-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-cafe-line p-4">

          {/* Hourly sales */}
          <Tip icon={Clock} color="text-blue-400" title="When you sell most">
            {activeHours.length === 0 ? (
              <p>Not enough sales yet to spot peak hours.</p>
            ) : (
              <>
                <div className="my-2 space-y-1">
                  {activeHours.map(({ h, t }) => (
                    <div key={h} className="flex items-center gap-2">
                      <span className="w-14 text-xs text-cafe-muted">{hourLabel(h)}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded bg-cafe-bg">
                        <div className="h-full rounded bg-cafe-accent" style={{ width: `${(t / maxHour) * 100}%` }} />
                      </div>
                      <span className="w-16 text-right text-xs">{rupees(t)}</span>
                    </div>
                  ))}
                </div>
                <p><b className="text-white">Peak: {hourLabel(peakHour)} to {hourLabel((peakHour + 1) % 24)}.</b> Prep stock and staff before it. {slow && <>Slowest around <b className="text-white">{hourLabel(slow.h)}</b>, run a small offer then to pull people in.</>}</p>
              </>
            )}
          </Tip>

          {/* High margin focus */}
          <Tip icon={ArrowUpNarrowWide} color="text-emerald-400" title="Push your high-margin items">
            {data.highMargin.length === 0 ? (
              <p>Set recipes on your items (Menu → Ingredients used) so I can find your most profitable dishes to promote.</p>
            ) : (
              <>
                <p>Promote profit, not just popularity. Put these at the <b className="text-white">top of your menu</b>:</p>
                <ul className="mt-1 list-disc pl-5">
                  {data.highMargin.map((p) => <li key={p.name}>{p.name}, {p.margin.toFixed(0)}% margin</li>)}
                </ul>
                {data.lowMargin.length > 0 && <p className="mt-1 text-cafe-muted">Go easy on discounting thin-margin items: {data.lowMargin.map((p) => p.name).join(', ')}.</p>}
              </>
            )}
          </Tip>

          {/* AOV / add-ons */}
          <Tip icon={ShoppingBasket} color="text-orange-400" title="Raise the average order">
            <p>Average order is <b className="text-white">{rupees(data.aov)}</b>{data.orderCount ? ` across ${data.orderCount} orders` : ''}.</p>
            <p className="mt-1">Add a one-tap upsell at checkout, rule of thumb: if an order is under ₹300, prompt <i>“Add Fries for ₹70 &amp; save ₹20”</i>.</p>
            <p className="mt-1 text-cafe-muted">Pairing ideas: Burger → Fries + Cold Coffee · Noodles → Momos · Butter Chicken → Butter Naan.</p>
          </Tip>

          {/* Waste */}
          <Tip icon={Trash2} color="text-red-400" title="Cut waste (target under 3%)">
            <p>Most new cafes lose 5 to 15% of profit to waste. Aim to keep it under <b className="text-white">3% of sales, about {rupees(wasteTarget)}/month</b> at your current sales.</p>
            <p className="mt-1 text-cafe-muted">Track daily: veg &amp; chicken discarded, oil replaced, unsold prepared food. Want me to add a simple <b>Waste log</b>? Just ask.</p>
          </Tip>

          {/* Loyalty */}
          <Tip icon={Heart} color="text-pink-400" title="Bring customers back">
            <p>A small loyalty scheme beats expensive ads. e.g. <b className="text-white">5 orders → free mocktail</b>, or <b className="text-white">₹2,000/month → 10% off next time</b>.</p>
            <p className="mt-1 text-cafe-muted">You already capture customer phone numbers, points + last-visit can be added on top. Ask and I'll wire it up.</p>
          </Tip>
        </div>
      )}
    </Card>
  )
}

function Tip({ icon: Icon, color, title, children }) {
  return (
    <div className="rounded-xl border border-cafe-line bg-cafe-bg p-3 text-sm leading-relaxed">
      <p className={`mb-1 flex items-center gap-2 font-semibold ${color}`}><Icon size={16} /> {title}</p>
      <div className="text-cafe-muted [&_b]:font-semibold">{children}</div>
    </div>
  )
}
