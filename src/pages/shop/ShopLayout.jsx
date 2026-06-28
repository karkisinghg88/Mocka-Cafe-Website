import { Outlet, NavLink } from 'react-router-dom'
import { Store, LogOut, ClipboardList, History } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { CAFE } from '../../lib/format'
import HeaderLeft from '../../components/HeaderLeft'

const tabs = [
  { to: '/shop', end: true, icon: ClipboardList, label: "Today's list" },
  { to: '/shop/history', icon: History, label: 'History' },
]

export default function ShopLayout() {
  const { signOut, profile } = useAuth()
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cafe-line bg-cafe-bg/95 px-4 py-3 backdrop-blur">
        <HeaderLeft homePath="/shop" tabs={tabs} brand={
          <div className="flex items-center gap-2">
            <Store className="text-cafe-accent" size={22} />
            <div>
              <p className="text-xs text-cafe-muted">Supplier for {CAFE.name}</p>
              <h1 className="text-lg font-black leading-none text-cafe-accent">{profile?.shop_name || profile?.full_name || 'My Shop'}</h1>
            </div>
          </div>
        } />
        <button onClick={signOut} className="rounded-full p-2 text-cafe-muted hover:text-white"><LogOut size={20} /></button>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4"><Outlet /></main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl border-t border-cafe-line bg-cafe-bg/95 backdrop-blur safe-bottom">
        <div className="grid grid-cols-2">
          {tabs.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-cafe-accent' : 'text-cafe-muted'}`}>
              <Icon size={22} /> {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
