import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  MapPin, Phone, Clock, Navigation, UtensilsCrossed, Coffee, Star,
  Bike, Flame, Wallet, MessageCircle, ArrowRight,
} from 'lucide-react'
import { getMenu, priceLabel, getSettings } from '../lib/db'
import { useAuth } from '../context/AuthContext'
import { CAFE, openStatus } from '../lib/format'

// A few dishes to feature on the home page (highlights only).
const FEATURE_NAMES = ['Veg Momos', 'Butter Chicken', 'Paneer Pizza', 'Chicken Fried Rice', 'Kadhai Paneer', 'Veg Manchow']

const FEATURES = [
  { icon: Flame, title: 'Made to order', text: 'Cooked fresh when you order, never sitting around.' },
  { icon: Bike, title: 'Hot delivery', text: `Delivered within ${CAFE.deliveryRadiusKm} km of the cafe.` },
  { icon: Wallet, title: 'Cash or UPI', text: 'Pay the way you like, on delivery.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const [highlights, setHighlights] = useState([])
  const [closedDates, setClosedDates] = useState([])
  const status = openStatus(closedDates)
  const open = status.open

  useEffect(() => {
    getMenu().then((m) => {
      const picks = FEATURE_NAMES.map((n) => m.find((x) => x.name === n)).filter(Boolean)
      setHighlights(picks.length ? picks : m.slice(0, 6))
    }).catch(() => {})
    getSettings().then((s) => setClosedDates(s.closed_dates || [])).catch(() => {})
  }, [])

  const goOrder = () => navigate(user ? (role === 'customer' ? '/app' : '/login') : '/login')
  const waLink = `https://wa.me/${CAFE.phone.replace('+', '')}?text=${encodeURIComponent('Hi Mocka Cafe, I would like to place an order.')}`

  return (
    <div className="min-h-full">
      {/* top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cafe-line bg-cafe-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Mocka Cafe logo" className="h-8 w-8" />
          <span className="font-display text-lg font-extrabold text-cafe-accent">{CAFE.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/login')} className="rounded-xl border border-cafe-line px-3 py-2 text-sm font-semibold transition hover:border-cafe-accent/60">Log in</button>
          <button onClick={() => navigate('/signup')} className="rounded-xl bg-cafe-accent px-3 py-2 text-sm font-bold text-black transition hover:bg-cafe-accent-dark">Sign up</button>
        </div>
      </header>

      {/* hero with banner + overlay */}
      <section className="relative">
        <div className="relative h-[58vh] min-h-[380px] w-full overflow-hidden">
          <img src="/banner.png" alt="A spread of food at Mocka Cafe" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-cafe-bg via-cafe-bg/70 to-cafe-bg/20" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-7">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${open ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {open ? `Open now · ${CAFE.hours}` : status.reason}
            </span>
            <h1 className="mt-3 font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-white">
              {CAFE.name}
            </h1>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/80">
              North Indian, Chinese, Momos and Pizza, fresh, hearty and made to order in {CAFE.city}.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={goOrder} className="inline-flex items-center gap-2 rounded-xl bg-cafe-accent px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition hover:bg-cafe-accent-dark active:scale-[.98]">
                Order online <ArrowRight size={17} />
              </button>
              <a href={`tel:${CAFE.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-black/30 px-6 py-3 font-semibold text-white backdrop-blur transition hover:border-white/50">
                <Phone size={16} /> Call us
              </a>
            </div>
          </div>
        </div>
        {/* cuisine chips */}
        <div className="flex flex-wrap gap-2 px-5 pt-5">
          {CAFE.cuisines.map((c) => (
            <span key={c} className="rounded-full border border-cafe-line bg-cafe-card px-3 py-1.5 text-xs font-medium text-cafe-muted">{c}</span>
          ))}
        </div>
      </section>

      {/* why us */}
      <section className="grid grid-cols-1 gap-3 px-5 py-8 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-cafe-line bg-cafe-card p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cafe-accent/15 text-cafe-accent">
              <Icon size={20} />
            </div>
            <p className="mt-3 font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-cafe-muted">{text}</p>
          </div>
        ))}
      </section>

      {/* highlights */}
      <section className="px-5 py-4">
        <div className="mb-4 flex items-center gap-2">
          <UtensilsCrossed size={18} className="text-cafe-accent" />
          <h2 className="text-xl font-bold">Popular picks</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {highlights.map((m) => (
            <div key={m.id} className="group overflow-hidden rounded-2xl border border-cafe-line bg-cafe-card transition hover:border-cafe-accent/50">
              <div className="flex h-28 items-center justify-center bg-cafe-bg">
                {m.image_url
                  ? <img src={m.image_url} alt={m.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                  : <Coffee size={28} className="text-cafe-muted" />}
              </div>
              <div className="p-3">
                <p className="font-semibold leading-snug">{m.name}</p>
                <p className="mt-1 text-sm font-bold text-cafe-accent">{priceLabel(m)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 text-center">
          <button onClick={goOrder} className="inline-flex items-center gap-2 rounded-xl bg-cafe-accent px-6 py-3 font-bold text-black transition hover:bg-cafe-accent-dark active:scale-[.98]">
            See full menu <ArrowRight size={16} />
          </button>
          <p className="mt-2 text-sm text-cafe-muted">Log in to see the full menu and order.</p>
        </div>
      </section>

      {/* about */}
      <section className="px-5 py-8">
        <div className="rounded-2xl border border-cafe-line bg-gradient-to-br from-cafe-card to-cafe-bg p-5">
          <h2 className="text-lg font-bold">About {CAFE.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-cafe-muted">
            A cosy neighbourhood cafe in {CAFE.city} serving comforting North Indian thalis, sizzling Chinese,
            crispy momos and cheesy pizzas. Dine in, take away, or get it delivered hot to your door.
            {' '}{CAFE.tagline}.
          </p>
          <div className="mt-3 flex items-center gap-1 text-cafe-accent">
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} fill="currentColor" />)}
            <span className="ml-1 text-xs text-cafe-muted">Loved by our regulars</span>
          </div>
        </div>
      </section>

      {/* hours + location */}
      <section className="px-5 py-4">
        <h2 className="mb-4 text-xl font-bold">Visit us</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl border border-cafe-line bg-cafe-card p-4">
            <MapPin size={18} className="mt-0.5 shrink-0 text-cafe-accent" />
            <div>
              <p className="font-semibold">Location</p>
              <p className="text-sm text-cafe-muted">{CAFE.address}</p>
              <p className="mt-1 text-xs text-cafe-muted">Plus code: {CAFE.plusCode}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-cafe-line bg-cafe-card p-4">
            <Clock size={18} className="mt-0.5 shrink-0 text-cafe-accent" />
            <div><p className="font-semibold">Hours</p><p className="text-sm text-cafe-muted">{CAFE.hours}</p></div>
          </div>
          <a href={`tel:${CAFE.phone}`} className="flex items-start gap-3 rounded-2xl border border-cafe-line bg-cafe-card p-4 transition hover:border-cafe-accent/50">
            <Phone size={18} className="mt-0.5 shrink-0 text-cafe-accent" />
            <div><p className="font-semibold">Phone</p><p className="text-sm text-cafe-muted">{CAFE.phoneDisplay}</p></div>
          </a>
          <div className="overflow-hidden rounded-2xl border border-cafe-line">
            <iframe title="Map to Mocka Cafe" src={CAFE.mapEmbed} className="h-56 w-full" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <a href={CAFE.mapsUrl} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-cafe-accent py-3 font-bold text-black transition hover:bg-cafe-accent-dark">
              <Navigation size={16} /> Get directions
            </a>
            <a href={waLink} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-3 font-semibold text-emerald-300 transition hover:bg-emerald-500/20">
              <MessageCircle size={16} /> Order on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <footer className="mt-4 border-t border-cafe-line px-5 py-8 text-center text-sm text-cafe-muted">
        <p className="font-display font-extrabold text-cafe-accent">{CAFE.name}</p>
        <p className="mt-1">{CAFE.city} · {CAFE.phoneDisplay}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
          <Link to="/terms" className="hover:text-white">Terms of service</Link>
          <span className="text-cafe-line">|</span>
          <Link to="/privacy" className="hover:text-white">Privacy policy</Link>
          <span className="text-cafe-line">|</span>
          <button onClick={() => navigate('/login')} className="hover:text-white">Staff &amp; owner login</button>
        </div>
        <p className="mt-4 text-xs">© {new Date().getFullYear()} {CAFE.name}. {CAFE.tagline}.</p>
      </footer>
    </div>
  )
}
