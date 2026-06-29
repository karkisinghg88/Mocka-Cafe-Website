import { getSettings } from './db'
import { CAFE } from './format'

// Generates a written report + suggestions from the period data using Gemini.
// The key is stored in Settings (admin only). For the daily 5 AM auto run this
// same logic moves into a scheduled server function.
export async function generateAiReport(data) {
  const settings = await getSettings()
  const key = (settings.gemini_key || '').trim()
  if (!key) throw new Error('Add your Gemini API key in Settings first.')

  const summary = {
    period: data.periodLabel,
    sales: data.sales, cost_of_goods: data.cogs, gross_profit: data.grossProfit,
    expenses: { rent: data.rent, electricity: data.electricity, cylinders: data.cylinderTotal, salaries: data.salaryTotal, other: data.otherTotal, total: data.totalExpenses },
    plates_sold: data.plates, gas_cost_per_plate: data.gasPerPlate,
    net_profit: data.netProfit,
    cash_collected: data.cashTotal, upi_collected: data.upiTotal,
    orders: data.orderCount, average_order_value: Math.round(data.aov),
    avg_food_rating: data.avgFoodRating,
    low_rated_items: (data.lowRated || []).map((p) => ({ name: p.name, rating: Number(p.avgRating?.toFixed(1)) })),
    top_products: data.products.slice(0, 8).map((p) => ({ name: p.name, sold: p.units, sales: p.revenue, profit: p.profit, margin: Math.round(p.margin) })),
    busiest_hours: data.hours.map((t, h) => ({ hour: h, sales: t })).filter((x) => x.sales > 0),
    purchases: (data.procurement || []).map((p) => ({ name: p.name, times: p.times, spent: p.spend })),
    recipe_check: (data.recipeCheck || []).filter((r) => r.hint !== 'aligned').slice(0, 10)
      .map((r) => ({ item: r.name, unit: r.unit, used_by_recipes: Number(Number(r.implied).toFixed(2)), actually_bought: Number(Number(r.purchased).toFixed(2)), note: r.hint })),
  }

  const prompt = `You are the business analyst for ${CAFE.name}, a multi cuisine cafe in ${CAFE.city}.
Using ONLY the data below for the period ${data.periodLabel}, write a clear, friendly report for the owner.
Cover: a one line headline on profit or loss, what sold well and made the most money, items losing money or low margin,
food quality from ratings (call out low rated items to fix), busiest and slowest hours with a staffing or offer tip,
purchasing or stock advice, and 3 concrete actions for next month to grow profit.
Also add a short "Recipe check" paragraph using recipe_check: where actually_bought is much higher than used_by_recipes,
say that recipe likely uses more than recorded or there is waste, and suggest raising that ingredient in the recipe; where
it is much lower, the item may be overbought. Be specific with item names.
Keep it under 280 words, use short paragraphs and simple language. Do not use any dash characters.
Data (JSON): ${JSON.stringify(summary)}`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error?.message || 'AI request failed.')
  return j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No response from AI.'
}

// Suggest a starter per-plate recipe for a dish, choosing only from the cafe's
// own inventory items. Returns [{ name, qty, unit }]; the caller maps names to
// inventory rows and lets the owner review before saving.
export async function suggestRecipe(dishName, inventoryItems) {
  const settings = await getSettings()
  const key = (settings.gemini_key || '').trim()
  if (!key) throw new Error('Add your Gemini API key in Settings first.')
  if (!inventoryItems || inventoryItems.length === 0) throw new Error('Add your raw items in Inventory first.')

  const names = inventoryItems.map((i) => `${i.name} (${i.unit})`).join(', ')
  const prompt = `You are a chef costing a dish for an Indian cafe named ${CAFE.name}.
Estimate the raw ingredients used to make ONE plate (one serving) of "${dishName}".
Choose ONLY from this inventory list and use the exact names: ${names}.
Return STRICT JSON only (no extra text): an array like
[{"name":"Maida","qty":0.18,"unit":"kg"},{"name":"Salt","qty":3,"unit":"g"}].
Use each item's shown unit where sensible; small spices can be in g. Do not invent items not in the list. Keep quantities realistic for a single plate.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${encodeURIComponent(key)}`
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error?.message || 'AI request failed.')
  const text = j.candidates?.[0]?.content?.parts?.[0]?.text || '[]'
  let arr
  try { arr = JSON.parse(text) } catch { const m = text.match(/\[[\s\S]*\]/); arr = m ? JSON.parse(m[0]) : [] }
  return Array.isArray(arr) ? arr : []
}
