import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Dashboard from './pages/dashboard/Dashboard'
import Products from './pages/products/Products'
import Categories from './pages/categories/Categories'
import Clients from './pages/clients/Clients'
import Suppliers from './pages/suppliers/Suppliers'
import Purchases from './pages/purchases/Purchases'
import Sales from './pages/sales/Sales'
import SmallSales from './pages/sales/SmallSales'
import Stock from './pages/stock/Stock'
import Finances from './pages/expenses/Finances'
import Settings from './pages/settings/Settings'
import UsersAdmin from './pages/users/UsersAdmin'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

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
      </ToastProvider>
    </BrowserRouter>
  )
}
