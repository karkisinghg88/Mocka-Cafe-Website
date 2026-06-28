import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Home, ReceiptText, Bike, UtensilsCrossed, Boxes, BarChart3, Settings, LogOut, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { CAFE } from '../../lib/format'

const tabs = [
  { to: '/admin', end: true, icon: Home, label: 'Home' },
  { to: '/admin/billing', icon: ReceiptText, label: 'Billing' },
  { to: '/admin/delivery', icon: Bike, label: 'Delivery' },
  { to: '/admin/menu', icon: UtensilsCrossed, label: 'Menu' },
  { to: '/admin/inventory', icon: Boxes, label: 'Stock' },
  { to: '/admin/reports', icon: BarChart3, label: 'Reports' },
]

const TITLES = {
  '/admin/billing': 'Billing', '/admin/delivery': 'Delivery', '/admin/menu': 'Menu',
  '/admin/inventory': 'Inventory', '/admin/reports': 'Reports', '/admin/settings': 'Settings',
  '/admin/purchasing': 'Buy list', '/admin/staff': 'Staff & accounts',
}

export default function AdminLayout() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isHome = pathname === '/admin'

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cafe-line bg-cafe-bg/95 px-4 py-3 backdrop-blur">
        {isHome ? (
          <div>
            <p className="text-xs text-cafe-muted">Owner panel</p>
            <h1 className="text-lg font-black leading-none text-cafe-accent">{CAFE.name}</h1>
          </div>
        ) : (
          <button onClick={() => navigate(-1)} className="-ml-2 flex items-center gap-1 rounded-lg p-1.5 text-cafe-accent" aria-label="Back">
            <ChevronLeft size={22} />
            <span className="text-base font-bold">{TITLES[pathname] || 'Back'}</span>
          </button>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => navigate('/admin/settings')}
            className="rounded-full p-2 text-cafe-muted hover:text-white" aria-label="Settings">
            <Settings size={20} />
          </button>
          <button onClick={() => signOut()}
            className="rounded-full p-2 text-cafe-muted hover:text-white" aria-label="Sign out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl border-t border-cafe-line bg-cafe-bg/95 backdrop-blur safe-bottom">
        <div className="grid grid-cols-6">
          {tabs.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
                  isActive ? 'text-cafe-accent' : 'text-cafe-muted'
                }`}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
