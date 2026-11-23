import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Supabase factice : toutes les requêtes renvoient une liste vide
vi.mock('../lib/supabase', () => {
  const result = { data: [], error: null, count: 0 }
  const builder = new Proxy(function () {}, {
    get: (_t, prop) => (prop === 'then' ? (res) => Promise.resolve(result).then(res) : builder),
    apply: () => builder,
  })
  return { supabase: { from: () => builder, rpc: () => builder, auth: { getSession: async () => ({ data: {} }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, storage: { from: () => builder } } }
})
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, profile: { full_name: 'Test Admin', role: 'admin' }, isAdmin: true, signOut() {}, signIn: async () => ({}) }),
}))
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ success() {}, error() {}, info() {} }) }))
vi.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme() {} }) }))

const pages = {
  Dashboard: () => import('../pages/dashboard/Dashboard'),
  Sales: () => import('../pages/sales/Sales'),
  SmallSales: () => import('../pages/sales/SmallSales'),
  Products: () => import('../pages/products/Products'),
  Categories: () => import('../pages/categories/Categories'),
  Stock: () => import('../pages/stock/Stock'),
  Clients: () => import('../pages/clients/Clients'),
  Deposits: () => import('../pages/deposits/Deposits'),
  Inventory: () => import('../pages/inventory/Inventory'),
  Reports: () => import('../pages/reports/Reports'),
  Suppliers: () => import('../pages/suppliers/Suppliers'),
  Purchases: () => import('../pages/purchases/Purchases'),
  Finances: () => import('../pages/expenses/Finances'),
  Settings: () => import('../pages/settings/Settings'),
  UsersAdmin: () => import('../pages/users/UsersAdmin'),
  Login: () => import('../pages/auth/Login'),
  Sidebar: () => import('../components/Sidebar'),
  Topbar: () => import('../components/Topbar'),
}

describe('rendu des pages (smoke test)', () => {
  for (const [name, load] of Object.entries(pages)) {
    it(`${name} se rend sans erreur`, async () => {
      const Page = (await load()).default
      const qc = new QueryClient()
      const html = renderToString(
        <QueryClientProvider client={qc}>
          <MemoryRouter>
            <Page open onClose={() => {}} onMenuClick={() => {}} />
          </MemoryRouter>
        </QueryClientProvider>
      )
      expect(html.length).toBeGreaterThan(50)
    }, 30000)
  }
})
