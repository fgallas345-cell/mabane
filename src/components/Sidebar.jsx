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
  ShieldCheck,
  PiggyBank,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { SHOP } from '../lib/constants'

// Navigation regroupée par activité : on trouve plus vite ce qu'on cherche
const navGroups = [
  {
    items: [{ to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Vente',
    items: [
      { to: '/ventes', label: 'Ventes / Facturation', icon: ShoppingCart },
      { to: '/petites-ventes', label: 'Petites ventes', icon: Zap },
      { to: '/clients', label: 'Clients', icon: Users },
      { to: '/depots', label: 'Dépôts clients', icon: PiggyBank },
    ],
  },
  {
    title: 'Stock & achats',
    items: [
      { to: '/produits', label: 'Produits', icon: Package },
      { to: '/categories', label: 'Catégories', icon: Tags },
      { to: '/stock', label: 'Stock', icon: Boxes },
      { to: '/achats', label: 'Achats fournisseurs', icon: PackagePlus },
      { to: '/fournisseurs', label: 'Fournisseurs', icon: Truck },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { to: '/finances', label: 'Finances', icon: Wallet },
      { to: '/parametres', label: 'Paramètres', icon: Settings },
    ],
  },
]

const adminGroup = {
  title: 'Administration',
  items: [{ to: '/utilisateurs', label: 'Utilisateurs', icon: ShieldCheck }],
}

function NavItem({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth()
  // "QUINCAILLERIE MABANE" → "Quincaillerie" / "MABANE"
  const [shopFirst, ...shopOthers] = SHOP.name.split(' ')
  const shopFirstWord = shopFirst.charAt(0) + shopFirst.slice(1).toLowerCase()
  const shopRest = shopOthers.join(' ')
  const groups = isAdmin ? [...navGroups, adminGroup] : navGroups

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden animate-fade-in" onClick={onClose} />}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-darkcard border-r border-gray-200 dark:border-gray-700/60 flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-200 dark:border-gray-700/60">
          <div className="flex items-center gap-3">
            <img src="/mabane.png" alt="Logo Mabane" className="h-9 w-9 rounded-lg object-cover" />
            <div>
              <p className="font-semibold text-sm leading-tight">{shopFirstWord}</p>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-semibold leading-tight">{shopRest}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer le menu"
            className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5" aria-label="Navigation principale">
          {groups.map((group, i) => (
            <div key={group.title || i}>
              {group.title && (
                <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.to} {...item} onClick={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700/60 text-xs text-gray-400">
          <p>Diouroup – Sénégal</p>
          <p className="mt-0.5">© {new Date().getFullYear()} Momo Faye</p>
        </div>
      </aside>
    </>
  )
}
