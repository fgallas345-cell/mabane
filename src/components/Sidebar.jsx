import { useCallback, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutGrid,
  Zap,
  Package,
  Tags,
  ShoppingCart,
  Boxes,
  Users,
  Truck,
  PackagePlus,
  Wallet,
  Settings,
  ShieldCheck,
  PiggyBank,
  ClipboardCheck,
  BarChart3,
  X,
  ChevronDown,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useClickOutside } from '../hooks/useClickOutside'
import { SHOP, ROLE_LABELS, displayName } from '../lib/constants'

// Navigation regroupée par activité : on trouve plus vite ce qu'on cherche
const navGroups = [
  {
    items: [{ to: '/', label: 'Tableau de bord', icon: LayoutGrid, end: true }],
  },
  {
    title: 'Vente',
    items: [
      { to: '/petites-ventes', label: 'Caisse rapide', icon: Zap },
      { to: '/ventes', label: 'Factures & devis', icon: ShoppingCart },
      { to: '/clients', label: 'Clients', icon: Users },
      { to: '/depots', label: 'Dépôts clients', icon: PiggyBank },
    ],
  },
  {
    title: 'Stock & achats',
    items: [
      { to: '/produits', label: 'Produits', icon: Package },
      { to: '/categories', label: 'Catégories', icon: Tags },
      { to: '/stock', label: 'Mouvements de stock', icon: Boxes },
      { to: '/inventaire', label: 'Inventaire', icon: ClipboardCheck },
      { to: '/achats', label: 'Achats fournisseurs', icon: PackagePlus },
      { to: '/fournisseurs', label: 'Fournisseurs', icon: Truck },
    ],
  },
  {
    title: 'Gestion',
    items: [
      { to: '/rapports', label: 'Rapports', icon: BarChart3 },
      { to: '/finances', label: 'Finances & dépenses', icon: Wallet },
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
        `group flex items-center gap-3.5 rounded-2xl px-4 py-2.5 text-[14.5px] font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 ${
          isActive
            ? 'bg-gradient-to-r from-[#1d4fb8] to-[#1a46a3] text-white font-semibold shadow-[0_8px_20px_-8px_rgba(29,79,184,0.8)]'
            : 'text-white/85 hover:bg-white/[0.07] hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={19} strokeWidth={isActive ? 2.4 : 2} className={isActive ? 'text-accent-400' : 'text-white/80 group-hover:text-white'} />
          {label}
        </>
      )}
    </NavLink>
  )
}

/** Vague décorative du bas de la barre latérale (reprend le dégradé de la charte) */
function SidebarWaves() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-72 w-full" viewBox="0 0 264 288" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sb-wave-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e4572" stopOpacity="0.0" />
          <stop offset="1" stopColor="#1e4572" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="sb-wave-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b5c94" stopOpacity="0.0" />
          <stop offset="1" stopColor="#2b5c94" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path d="M0 120 C 70 70, 150 170, 264 90 L264 288 L0 288 Z" fill="url(#sb-wave-a)" />
      <path d="M0 190 C 90 140, 170 230, 264 160 L264 288 L0 288 Z" fill="url(#sb-wave-b)" />
    </svg>
  )
}

function UserCard({ onNavigate }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useClickOutside(ref, close, open)
  const name = displayName(profile?.full_name)

  return (
    <div className="relative m-3" ref={ref}>
      {open && (
        <div className="absolute bottom-full mb-2 inset-x-0 rounded-2xl bg-white dark:bg-darkcard text-gray-800 dark:text-gray-100 shadow-lift p-1.5 animate-fade-in">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06]"
            onClick={() => {
              navigate('/parametres')
              close()
              onNavigate?.()
            }}
          >
            <Settings size={16} /> Mon profil
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            onClick={signOut}
          >
            <LogOut size={16} /> Déconnexion
          </button>
        </div>
      )}
      <button
        type="button"
        aria-label="Menu du compte"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 rounded-2xl bg-white/[0.07] hover:bg-white/[0.1] px-3 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
      >
        <span className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white flex items-center justify-center font-bold">
          {name[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white truncate">{name}</span>
          <span className="block text-xs text-white/60 truncate">{ROLE_LABELS[profile?.role] || ''}</span>
        </span>
        <ChevronDown size={16} className={`text-white/70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
  )
}

export default function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  // "QUINCAILLERIE MABANE" → "MABANE" en titre, "QUINCAILLERIE" en sous-titre
  const words = SHOP.name.split(' ')
  const title = words.length > 1 ? words.slice(1).join(' ') : SHOP.name
  const subtitle = words.length > 1 ? words[0] : 'Gestion'
  const groups = isAdmin ? [...navGroups, adminGroup] : navGroups

  return (
    <>
      {open && <div className="fixed inset-0 bg-brand-950/60 z-30 lg:hidden animate-fade-in" onClick={onClose} />}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[264px] overflow-hidden bg-gradient-to-b from-[#071f34] via-[#0a2440] to-[#0d2b4f] text-white flex flex-col transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <SidebarWaves />

        <div className="relative flex items-center justify-between px-5 h-[92px]">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/mabane.png" alt="Logo Mabane" className="h-12 w-12 rounded-2xl bg-white object-cover shadow-lift" />
            <div className="min-w-0">
              <p className="font-extrabold text-[19px] tracking-tight leading-tight truncate">{title}</p>
              <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-accent-400 leading-tight truncate">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fermer le menu"
            className="lg:hidden p-1.5 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="relative px-4 pb-3">
          <button
            type="button"
            className="btn-accent w-full !rounded-2xl py-3.5 text-[15px] shadow-[0_10px_24px_-8px_rgba(243,158,38,0.6)]"
            onClick={() => {
              navigate('/petites-ventes')
              onClose?.()
            }}
          >
            <Zap size={18} className="fill-current" /> Vendre maintenant
          </button>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3.5 pt-2 pb-4 space-y-5" aria-label="Navigation principale">
          {groups.map((group, i) => (
            <div key={group.title || i}>
              {group.title && (
                <p className="px-4 mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-white/70">{group.title}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItem key={item.to} {...item} onClick={onClose} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative">
          <UserCard onNavigate={onClose} />
        </div>
      </aside>
    </>
  )
}
