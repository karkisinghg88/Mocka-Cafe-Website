// Money + label helpers used across the app.

export function rupees(amount) {
  const n = Number(amount || 0)
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export const CAFE = {
  name: 'Mocka Cafe',
  tagline: 'Stay where your heart belongs to',
  city: 'Najafgarh, Delhi',
  address: 'Plot No 9, Ph 1, opposite Bani Camp, Jai Vihar, Najafgarh, Delhi 110043, India',
  plusCode: 'J2M3+F4 Delhi, India',
  phone: '+918954312812',
  phoneDisplay: '+91 89543 12812',
  cuisines: ['North Indian', 'Chinese', 'Momos', 'Pizza', 'Fast Food'],
  hours: '11:00 AM to 10:00 PM (daily)',
  lat: 28.633687,          // decoded from Plus code J2M3+F4 Delhi
  lng: 77.002813,
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=28.633687,77.002813',
  mapEmbed: 'https://maps.google.com/maps?q=28.633687,77.002813&z=16&output=embed',
  instagram: '',
  openHour: 11,            // 11:00 AM IST
  closeHour: 22,           // 10:00 PM IST
  deliveryRadiusKm: 2,     // only deliver within 2 km of the cafe
}

// "Now" as an India (IST, UTC+5:30) wall-clock Date, regardless of device
// timezone, so getHours/getDay/getDate read IST values.
function istNow() {
  return new Date(Date.now() + (330 + new Date().getTimezoneOffset()) * 60000)
}
export function istHour() { return istNow().getHours() }
export function istDay() { return istNow().getDay() }   // 0 Sun, 1 Mon, 2 Tue ... 6 Sat
export function istTodayISO() {
  const d = istNow()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The cafe is closed every Tuesday, by default. (Tuesday = day 2.)
export const WEEKLY_OFF = 2

// Parse the owner's saved closed dates (a JSON array of 'YYYY-MM-DD' strings).
export function parseClosedDates(value) {
  if (!value) return []
  try {
    const arr = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(arr)) return []
    return arr.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  } catch { return [] }
}

// Whether the cafe is open right now, with a friendly reason when it is not.
// closedDates: array of 'YYYY-MM-DD' the owner marked closed (holidays/offs).
export function openStatus(closedDates = []) {
  if (istDay() === WEEKLY_OFF) return { open: false, reason: 'We are closed on Tuesdays.' }
  if (parseClosedDates(closedDates).includes(istTodayISO()))
    return { open: false, reason: 'We are closed today.' }
  const h = istHour()
  if (h < CAFE.openHour || h >= CAFE.closeHour) return { open: false, reason: `We are open ${CAFE.hours}.` }
  return { open: true, reason: '' }
}

export function isOpenNow(closedDates = []) {
  return openStatus(closedDates).open
}

// Distance in km between two lat/lng points (haversine).
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Human labels for the order status flow.
export const STATUS_LABELS = {
  pending: 'Pending approval',
  rejected: 'Rejected',
  accepted: 'Accepted',
  requoted: 'Needs your confirmation',
  sent_to_chef: 'Sent to kitchen',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  reached: 'Rider reached',
  delivered: 'Delivered',
  done: 'Completed',
  paid: 'Paid',
}

export const STATUS_COLORS = {
  pending: 'bg-yellow-500/15 text-yellow-400',
  rejected: 'bg-red-500/15 text-red-400',
  accepted: 'bg-blue-500/15 text-blue-400',
  requoted: 'bg-yellow-500/15 text-yellow-400',
  sent_to_chef: 'bg-blue-500/15 text-blue-400',
  preparing: 'bg-blue-500/15 text-blue-400',
  ready: 'bg-emerald-500/15 text-emerald-400',
  out_for_delivery: 'bg-purple-500/15 text-purple-400',
  reached: 'bg-purple-500/15 text-purple-400',
  delivered: 'bg-emerald-500/15 text-emerald-400',
  done: 'bg-emerald-500/15 text-emerald-400',
  paid: 'bg-cafe-accent/20 text-cafe-accent',
}

// Report cycle period: from cycleDay of the reference month up to (not incl.)
// cycleDay of the next month. cycleDay = 1 → a full calendar month, e.g.
// "1 Jan → 1 Feb" (data counted: 1 to 31 Jan).
export function cycleRange(ym, cycleDay = 1) {
  const [y, m] = ym.split('-').map(Number)
  const d = Math.min(Math.max(1, Number(cycleDay) || 1), 28)
  const startD = new Date(y, m - 1, d)
  const nextStartD = new Date(y, m, d)        // same day, next month
  const endD = new Date(nextStartD); endD.setDate(endD.getDate() - 1)  // inclusive filter end
  const iso = (dt) => { const off = dt.getTimezoneOffset(); return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 10) }
  const lbl = (dt) => dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return { start: iso(startD), end: iso(endD), label: `${lbl(startD)} → ${lbl(nextStartD)}` }
}

export function todayISO() {
  // Local business date (YYYY-MM-DD).
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}
