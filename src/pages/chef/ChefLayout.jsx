import { Outlet, NavLink } from 'react-router-dom'
import { ChefHat, LogOut, Utensils, ClipboardList } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { CAFE } from '../../lib/format'
import HeaderLeft from '../../components/HeaderLeft'

const tabs = [
  { to: '/chef', end: true, icon: Utensils, label: 'Orders' },
  { to: '/chef/supplies', icon: ClipboardList, label: 'Supplies' },
]

export default function ChefLayout() {
  const { signOut } = useAuth()
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cafe-line bg-cafe-bg/95 px-4 py-3 backdrop-blur">
        <HeaderLeft homePath="/chef" tabs={tabs} brand={
          <div className="flex items-center gap-2">
            <ChefHat className="text-cafe-accent" size={22} />
            <div>
              <p className="text-xs text-cafe-muted">Kitchen</p>
              <h1 className="text-lg font-black leading-none text-cafe-accent">{CAFE.name}</h1>
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
