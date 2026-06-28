import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Spinner } from './components/ui'
import DemoBanner from './components/DemoBanner'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'

// Admin
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminMenu from './pages/admin/Menu'
import AdminBilling from './pages/admin/Billing'
import AdminInventory from './pages/admin/Inventory'
import AdminDelivery from './pages/admin/Delivery'
import AdminReports from './pages/admin/Reports'
import AdminSettings from './pages/admin/Settings'
import AdminPurchasing from './pages/admin/Purchasing'
import AdminStaff from './pages/admin/Staff'

// Chef
import ChefLayout from './pages/chef/ChefLayout'
import ChefOrders from './pages/chef/ChefOrders'
import ChefSupplies from './pages/chef/ChefSupplies'

// Shopkeeper
import ShopLayout from './pages/shop/ShopLayout'
import ShopToday from './pages/shop/ShopToday'
import ShopHistory from './pages/shop/ShopHistory'

// Rider
import RiderLayout from './pages/rider/RiderLayout'
import RiderActive from './pages/rider/RiderActive'
import RiderHistory from './pages/rider/RiderHistory'

// Customer
import CustomerLayout from './pages/customer/CustomerLayout'
import CustomerMenu from './pages/customer/Menu'
import CustomerCart from './pages/customer/Cart'
import CustomerOrders from './pages/customer/Orders'

function ProtectedRoute({ allow, children }) {
  const { loading, user, role } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (!role) return <Spinner />
  if (allow && !allow.includes(role)) return <Navigate to={homeFor(role)} replace />
  return children
}

function homeFor(role) {
  if (role === 'admin') return '/admin'
  if (role === 'chef') return '/chef'
  if (role === 'shopkeeper') return '/shop'
  if (role === 'rider') return '/rider'
  return '/app'
}

export default function App() {
  const { loading, user, role } = useAuth()

  if (loading) return <Spinner />

  // Signed in but the profile/role hasn't resolved yet: wait, so we don't
  // bounce an admin to the customer home for a split second.
  const redirectOrWait = (el) => (user ? (role ? <Navigate to={homeFor(role)} replace /> : <Spinner />) : el)

  return (
    <>
    <DemoBanner />
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/login" element={redirectOrWait(<Login />)} />
      <Route path="/signup" element={redirectOrWait(<Signup />)} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute allow={['admin']}><AdminLayout /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="menu" element={<AdminMenu />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="inventory" element={<AdminInventory />} />
        <Route path="delivery" element={<AdminDelivery />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="purchasing" element={<AdminPurchasing />} />
        <Route path="staff" element={<AdminStaff />} />
      </Route>

      {/* Chef */}
      <Route path="/chef" element={<ProtectedRoute allow={['chef', 'admin']}><ChefLayout /></ProtectedRoute>}>
        <Route index element={<ChefOrders />} />
        <Route path="supplies" element={<ChefSupplies />} />
      </Route>

      {/* Shopkeeper */}
      <Route path="/shop" element={<ProtectedRoute allow={['shopkeeper', 'admin']}><ShopLayout /></ProtectedRoute>}>
        <Route index element={<ShopToday />} />
        <Route path="history" element={<ShopHistory />} />
      </Route>

      {/* Rider */}
      <Route path="/rider" element={<ProtectedRoute allow={['rider', 'admin']}><RiderLayout /></ProtectedRoute>}>
        <Route index element={<RiderActive />} />
        <Route path="history" element={<RiderHistory />} />
      </Route>

      {/* Customer */}
      <Route path="/app" element={<ProtectedRoute allow={['customer', 'admin']}><CustomerLayout /></ProtectedRoute>}>
        <Route index element={<CustomerMenu />} />
        <Route path="cart" element={<CustomerCart />} />
        <Route path="orders" element={<CustomerOrders />} />
      </Route>

      <Route path="*" element={<Navigate to={user && role ? homeFor(role) : '/'} replace />} />
    </Routes>
    </>
  )
}
