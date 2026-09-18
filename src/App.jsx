import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/auth/Login'

// Chaque page est chargée à la demande : le bundle initial ne contient que le
// strict nécessaire (Login + Layout), le reste arrive à la première navigation.
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const Products = lazy(() => import('./pages/products/Products'))
const Categories = lazy(() => import('./pages/categories/Categories'))
const Clients = lazy(() => import('./pages/clients/Clients'))
const Suppliers = lazy(() => import('./pages/suppliers/Suppliers'))
const Purchases = lazy(() => import('./pages/purchases/Purchases'))
const Sales = lazy(() => import('./pages/sales/Sales'))
const SmallSales = lazy(() => import('./pages/sales/SmallSales'))
const Stock = lazy(() => import('./pages/stock/Stock'))
const Finances = lazy(() => import('./pages/expenses/Finances'))
const Settings = lazy(() => import('./pages/settings/Settings'))
const UsersAdmin = lazy(() => import('./pages/users/UsersAdmin'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="ventes" element={<Sales />} />
              <Route path="petites-ventes" element={<SmallSales />} />
              <Route path="produits" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="stock" element={<Stock />} />
              <Route path="clients" element={<Clients />} />
              <Route path="fournisseurs" element={<Suppliers />} />
              <Route path="achats" element={<Purchases />} />
              <Route path="finances" element={<Finances />} />
              <Route path="parametres" element={<Settings />} />
              <Route
                path="utilisateurs"
                element={
                  <ProtectedRoute adminOnly>
                    <UsersAdmin />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
  )
}
