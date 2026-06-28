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
    expenses: { rent: data.rent, electricity: data.electricity, cylinders: data.cylinderTotal, other: data.otherTotal, total: data.totalExpenses },
    net_profit: data.netProfit,
    cash_collected: data.cashTotal, upi_collected: data.upiTotal,
    orders: data.orderCount, average_order_value: Math.round(data.aov),
    avg_food_rating: data.avgFoodRating,
    low_rated_items: (data.lowRated || []).map((p) => ({ name: p.name, rating: Number(p.avgRating?.toFixed(1)) })),
    top_products: data.products.slice(0, 8).map((p) => ({ name: p.name, sold: p.units, sales: p.revenue, profit: p.profit, margin: Math.round(p.margin) })),
    busiest_hours: data.hours.map((t, h) => ({ hour: h, sales: t })).filter((x) => x.sales > 0),
    purchases: (data.procurement || []).map((p) => ({ name: p.name, times: p.times, spent: p.spend })),
  }

  const prompt = `You are the business analyst for ${CAFE.name}, a multi cuisine cafe in ${CAFE.city}.
Using ONLY the data below for the period ${data.periodLabel}, write a clear, friendly report for the owner.
Cover: a one line headline on profit or loss, what sold well and made the most money, items losing money or low margin,
food quality from ratings (call out low rated items to fix), busiest and slowest hours with a staffing or offer tip,
purchasing or stock advice, and 3 concrete actions for next month to grow profit.
Keep it under 250 words, use short paragraphs and simple language. Do not use any dash characters.
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
