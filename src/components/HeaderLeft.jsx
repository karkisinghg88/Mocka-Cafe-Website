import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Shows the brand on the section's home tab, and a back button (with the tab
// name) on any other tab/page, so the user can always go back. When an admin is
// previewing another role's screens, the home tab shows "Back to admin".
export default function HeaderLeft({ homePath, tabs = [], brand }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { role } = useAuth()

  const BackBtn = ({ to, label }) => (
    <button onClick={() => (to ? navigate(to) : navigate(-1))}
      className="-ml-2 flex items-center gap-1 rounded-lg p-1.5 text-cafe-accent" aria-label="Back">
      <ChevronLeft size={22} />
      <span className="text-base font-bold">{label}</span>
    </button>
  )

  if (pathname === homePath) {
    // Admin viewing a staff/customer screen: give them a way back to the panel.
    if (role === 'admin') return <BackBtn to="/admin" label="Back to admin" />
    return brand
  }
  const title = tabs.find((t) => t.to === pathname)?.label || 'Back'
  return <BackBtn label={title} />
}
