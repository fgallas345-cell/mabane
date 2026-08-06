import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Zap,
  Boxes,
  Users,
  Truck,
  PackagePlus,
  Wallet,
  Settings,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/ventes', label: 'Ventes / Facturation', icon: ShoppingCart },
  { to: '/petites-ventes', label: 'Petites ventes', icon: Zap },
  { to: '/produits', label: 'Produits', icon: Package },
  { to: '/categories', label: 'Catégories', icon: Tags },
  { to: '/stock', label: 'Stock', icon: Boxes },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/fournisseurs', label: 'Fournisseurs', icon: Truck },
  { to: '/achats', label: 'Achats fournisseurs', icon: PackagePlus },
  { to: '/finances', label: 'Finances', icon: Wallet },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
]

export default function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth()

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-darkcard border-r border-gray-200 dark:border-gray-700/60 flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200 dark:border-gray-700/60">
          <div className="flex items-center gap-3">
            <img src="/mabane.png" alt="Logo Mabane" className="h-10 w-10 rounded-lg object-cover" />
            <div>
              <p className="font-bold text-sm leading-tight">Quincaillerie</p>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold leading-tight">MABANE</p>
            </div>
          </div>
          <button className="lg:hidden p-1 text-gray-400" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/utilisateurs"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              <Users size={18} />
              Utilisateurs
            </NavLink>
          )}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700/60 text-xs text-gray-400">
          <p>Diouroup – Sénégal</p>
          <p className="mt-0.5">© {new Date().getFullYear()} Momo Faye</p>
        </div>
      </aside>
    </>
  )
}
