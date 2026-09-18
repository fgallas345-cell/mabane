import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import { useLowStock } from '../hooks/useDashboard'
import { useProducts } from '../hooks/useProducts'
import { useClients } from '../hooks/useEntities'
import { ROLE_LABELS, SHOP } from '../lib/constants'

export default function Topbar({ onMenuClick }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const searchRef = useRef(null)

  const { data: lowStockData } = useLowStock()
  const { data: products = [] } = useProducts()
  const { data: clients = [] } = useClients()

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const matchedProducts = search
    ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : []
  const matchedClients = search
    ? clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : []

  const lowStock = lowStockData || []

  return (
    <header className="h-16 bg-white dark:bg-darkcard border-b border-gray-200 dark:border-gray-700/60 flex items-center justify-between px-4 lg:px-6 gap-4 sticky top-0 z-20">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button className="lg:hidden p-2 text-gray-500" onClick={onMenuClick}>
          <Menu size={22} />
        </button>

        <div className="hidden sm:flex items-center gap-2">
          <img src="/mabane.png" alt="Logo Mabane" className="h-8 w-8 rounded-lg object-cover" />
          <div className="hidden md:block">
            <p className="text-sm font-semibold">{SHOP.name}</p>
          </div>
        </div>

        <div className="relative flex-1 max-w-md" ref={searchRef}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher un produit, un client..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
          />
          {showResults && search && (matchedProducts.length > 0 || matchedClients.length > 0) && (
            <div className="absolute mt-1 w-full card p-2 max-h-80 overflow-y-auto z-50">
              {matchedProducts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 px-2 py-1">Produits</p>
                  {matchedProducts.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => {
                        navigate('/produits')
                        setShowResults(false)
                        setSearch('')
                      }}
                    >
                      {p.name} <span className="text-gray-400">— Stock: {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
              {matchedClients.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 px-2 py-1">Clients</p>
                  {matchedClients.map((c) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => {
                        navigate('/clients')
                        setShowResults(false)
                        setSearch('')
                      }}
                    >
                      {c.name} <span className="text-gray-400">— {c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <div className="relative">
          <button
            className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => setShowNotifs((s) => !s)}
          >
            <Bell size={18} />
            {lowStock.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                {lowStock.length}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 mt-2 w-72 card p-3 z-50">
              <p className="text-sm font-semibold mb-2">Notifications</p>
              {lowStock.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune alerte pour le moment.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lowStock.map((p) => (
                    <div key={p.id} className="text-sm p-2 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      ⚠️ Stock faible : <strong>{p.name}</strong> ({p.stock} restant)
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setShowUserMenu((s) => !s)}
          >
            <div className="h-8 w-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-semibold">
              {profile?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium leading-tight">{profile?.full_name || 'Utilisateur'}</p>
              <p className="text-xs text-gray-400 leading-tight">{ROLE_LABELS[profile?.role] || ''}</p>
            </div>
          </button>
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 card p-2 z-50">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                onClick={() => {
                  navigate('/parametres')
                  setShowUserMenu(false)
                }}
              >
                <UserIcon size={16} /> Mon profil
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                onClick={signOut}
              >
                <LogOut size={16} /> Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
