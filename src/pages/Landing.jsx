import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Phone, Clock, Navigation, UtensilsCrossed, Coffee, Star } from 'lucide-react'
import { getMenu, priceLabel } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { CAFE } from '../lib/format'

// A few dishes to feature on the home page (highlights only).
const FEATURE_NAMES = ['Veg Momos', 'Butter Chicken', 'Paneer Pizza', 'Chicken Fried Rice', 'Kadhai Paneer', 'Veg Manchow']

export default function Landing() {
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const [highlights, setHighlights] = useState([])

  useEffect(() => {
    getMenu().then((m) => {
      const picks = FEATURE_NAMES.map((n) => m.find((x) => x.name === n)).filter(Boolean)
      setHighlights(picks.length ? picks : m.slice(0, 6))
    }).catch(() => {})
  }, [])

  const goOrder = () => navigate(user ? (role === 'customer' ? '/app' : '/login') : '/login')

  return (
    <div className="min-h-full">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cafe-line bg-cafe-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/coffee.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-black text-cafe-accent">{CAFE.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/login')} className="rounded-xl border border-cafe-line px-3 py-2 text-sm font-semibold">Log in</button>
          <button onClick={() => navigate('/signup')} className="rounded-xl bg-cafe-accent px-3 py-2 text-sm font-bold text-black">Sign up</button>
        </div>
      </header>

      {/* banner */}
      <div className="px-4 pt-4">
        <img src="/banner.png" alt="Mocka Cafe" className="w-full rounded-2xl border border-cafe-line" />
      </div>

      {/* hero */}
      <section className="relative overflow-hidden px-5 py-12 text-center">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cafe-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-cafe-accent/10 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cafe-muted">{CAFE.tagline}</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight text-cafe-accent">{CAFE.name}</h1>
        <p className="mx-auto mt-3 max-w-md text-cafe-muted">
          North Indian, Chinese, Momos &amp; Pizza, fresh, hearty and made to order in {CAFE.city}.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {CAFE.cuisines.map((c) => (
            <span key={c} className="rounded-full border border-cafe-line bg-cafe-card px-3 py-1 text-xs text-cafe-muted">{c}</span>
          ))}
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button onClick={goOrder} className="rounded-xl bg-cafe-accent px-6 py-3 font-bold text-black">Order online</button>
          <a href={`tel:${CAFE.phone}`} className="flex items-center gap-2 rounded-xl border border-cafe-line px-6 py-3 font-semibold"><Phone size={16} /> Call us</a>
        </div>
      </section>

      {/* highlights */}
      <section className="px-5 py-8">
        <div className="mb-4 flex items-center gap-2">
          <UtensilsCrossed size={18} className="text-cafe-accent" />
          <h2 className="text-xl font-bold">Popular picks</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {highlights.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-2xl border border-cafe-line bg-cafe-card">
              <div className="flex h-24 items-center justify-center bg-cafe-bg">
                {m.image_url ? <img src={m.image_url} alt="" className="h-full w-full object-cover" /> : <Coffee size={28} className="text-cafe-muted" />}
              </div>
              <div className="p-3">
                <p className="font-semibold leading-snug">{m.name}</p>
                <p className="mt-1 text-sm font-bold text-cafe-accent">{priceLabel(m)}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-cafe-muted">Log in to see the full menu and order.</p>
        <div className="mt-3 text-center">
          <button onClick={goOrder} className="rounded-xl bg-cafe-accent px-6 py-3 font-bold text-black">See full menu</button>
        </div>
      </section>

      {/* about */}
      <section className="px-5 py-8">
        <div className="rounded-2xl border border-cafe-line bg-cafe-card p-5">
          <h2 className="text-lg font-bold">About {CAFE.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-cafe-muted">
            A cosy neighbourhood cafe in {CAFE.city} serving comforting North Indian thalis, sizzling Chinese,
            crispy momos and cheesy pizzas. Dine in, take away, or get it delivered hot to your door.
            {' '}{CAFE.tagline.toLowerCase()}.
          </p>
          <div className="mt-3 flex items-center gap-1 text-cafe-accent">
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} fill="currentColor" />)}
            <span className="ml-1 text-xs text-cafe-muted">Loved by our regulars</span>
          </div>
        </div>
      </section>

      {/* hours + location */}
      <section className="px-5 py-8">
        <h2 className="mb-4 text-xl font-bold">Visit us</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-cafe-line bg-cafe-card p-4">
            <MapPin size={18} className="mt-0.5 text-cafe-accent" />
            <div>
              <p className="font-semibold">Location</p>
              <p className="text-sm text-cafe-muted">{CAFE.address}</p>
              <p className="mt-1 text-xs text-cafe-muted">Plus code: {CAFE.plusCode}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-cafe-line bg-cafe-card p-4">
            <Clock size={18} className="mt-0.5 text-cafe-accent" />
            <div><p className="font-semibold">Hours</p><p className="text-sm text-cafe-muted">{CAFE.hours}</p></div>
          </div>
          <a href={`tel:${CAFE.phone}`} className="flex items-start gap-3 rounded-2xl border border-cafe-line bg-cafe-card p-4">
            <Phone size={18} className="mt-0.5 text-cafe-accent" />
            <div><p className="font-semibold">Phone</p><p className="text-sm text-cafe-muted">{CAFE.phoneDisplay}</p></div>
          </a>
          <div className="overflow-hidden rounded-2xl border border-cafe-line">
            <iframe title="map" src={CAFE.mapEmbed} className="h-56 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
          <a href={CAFE.mapsUrl} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-cafe-accent py-3 font-bold text-black">
            <Navigation size={16} /> Get directions
          </a>
        </div>
      </section>

      <footer className="border-t border-cafe-line px-5 py-8 text-center text-sm text-cafe-muted">
        <p className="font-black text-cafe-accent">{CAFE.name}</p>
        <p className="mt-1">{CAFE.city} · {CAFE.phoneDisplay}</p>
        <p className="mt-3 text-xs">© {new Date().getFullYear()} {CAFE.name}. {CAFE.tagline}.</p>
        <button onClick={() => navigate('/login')} className="mt-3 text-xs text-cafe-muted underline">Staff &amp; owner login</button>
      </footer>
    </div>
  )
}
