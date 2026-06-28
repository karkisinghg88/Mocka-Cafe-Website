import { Outlet, NavLink } from 'react-router-dom'
import { UtensilsCrossed, ShoppingBag, ClipboardList, LogOut, Phone } from 'lucide-react'
import { CartProvider, useCart } from '../../context/CartContext'
import { useAuth } from '../../context/AuthContext'
import { CAFE } from '../../lib/format'
import HeaderLeft from '../../components/HeaderLeft'

function CartBadge() {
  const { count } = useCart()
  if (!count) return null
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cafe-accent px-1 text-[10px] font-bold text-black">
      {count}
    </span>
  )
}

const tabs = [
  { to: '/app', end: true, icon: UtensilsCrossed, label: 'Menu' },
  { to: '/app/cart', icon: ShoppingBag, label: 'Cart', cart: true },
  { to: '/app/orders', icon: ClipboardList, label: 'Orders' },
]

export default function CustomerLayout() {
  const { signOut } = useAuth()
  return (
    <CartProvider>
      <div className="mx-auto flex min-h-full max-w-2xl flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cafe-line bg-cafe-bg/95 px-4 py-3 backdrop-blur">
          <HeaderLeft homePath="/app" tabs={tabs} brand={
            <div className="flex items-center gap-2">
              <img src="/coffee.svg" alt="" className="h-8 w-8" />
              <h1 className="text-lg font-black text-cafe-accent">{CAFE.name}</h1>
            </div>
          } />
          <div className="flex items-center gap-1">
            <a href={`tel:${CAFE.phone}`} className="rounded-full p-2 text-cafe-muted hover:text-white"><Phone size={20} /></a>
            <button onClick={signOut} className="rounded-full p-2 text-cafe-muted hover:text-white"><LogOut size={20} /></button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4"><Outlet /></main>

        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl border-t border-cafe-line bg-cafe-bg/95 backdrop-blur safe-bottom">
          <div className="grid grid-cols-3">
            {tabs.map(({ to, end, icon: Icon, label, cart }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-cafe-accent' : 'text-cafe-muted'}`}>
                <span className="relative"><Icon size={22} />{cart && <CartBadge />}</span>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </CartProvider>
  )
}
