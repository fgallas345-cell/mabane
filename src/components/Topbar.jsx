import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, LogOut, Settings as SettingsIcon, AlertTriangle, CalendarDays, ChevronDown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import { useLowStock } from '../hooks/useDashboard'
import { useProducts } from '../hooks/useProducts'
import { useClients } from '../hooks/useEntities'
import { useClickOutside } from '../hooks/useClickOutside'
import { ROLE_LABELS, displayName } from '../lib/constants'

const iconBtn =
  'relative p-2.5 rounded-xl text-brand-900 dark:text-gray-200 hover:bg-white dark:hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

// « lundi 23 novembre 2026 » → « Lundi 23 Novembre 2026 »
const todayLabel = () =>
  new Date()
    .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())

export default function Topbar({ onMenuClick }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const searchRef = useRef(null)
  const searchInputRef = useRef(null)
  const notifRef = useRef(null)
  const userRef = useRef(null)

  const closeResults = useCallback(() => setShowResults(false), [])
  const closeNotifs = useCallback(() => setShowNotifs(false), [])
  const closeUser = useCallback(() => setShowUserMenu(false), [])
  useClickOutside(searchRef, closeResults, showResults)
  useClickOutside(notifRef, closeNotifs, showNotifs)
  useClickOutside(userRef, closeUser, showUserMenu)

  // Ctrl + K (ou Cmd + K) : place le curseur dans la recherche globale
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const { data: lowStockData } = useLowStock()
  const { data: products = [] } = useProducts()
  const { data: clients = [] } = useClients()

  const term = search.trim().toLowerCase()
  const matchedProducts = term ? products.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 5) : []
  const matchedClients = term ? clients.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 5) : []
  const lowStock = lowStockData || []

  // Ouvre la page avec la recherche déjà remplie (?q=...)
  const goTo = (path, name) => {
    navigate(`${path}?q=${encodeURIComponent(name)}`)
    setShowResults(false)
    setSearch('')
  }

  const resultBtn = 'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-white/[0.06]'

  return (
    <header className="h-[84px] bg-[#f3f6fb]/85 backdrop-blur dark:bg-darkbg/85 flex items-center justify-between px-4 lg:px-8 gap-3 sticky top-0 z-20">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button type="button" aria-label="Ouvrir le menu" className={`lg:hidden ${iconBtn}`} onClick={onMenuClick}>
          <Menu size={22} />
        </button>

        <div className="relative flex-1 max-w-xl" ref={searchRef}>
          <Search size={19} className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-900 dark:text-gray-300" />
          <kbd className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 rounded-md bg-gray-100 dark:bg-white/10 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 pointer-events-none">
            Ctrl + K
          </kbd>
          <input
            ref={searchInputRef}
            className="w-full rounded-full bg-white dark:bg-darkcard border border-gray-200/70 dark:border-white/[0.06] shadow-card pl-12 pr-4 md:pr-24 py-3 text-sm outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 transition-colors"
            placeholder="Rechercher un produit, un client…"
            aria-label="Recherche globale"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
          />
          {showResults && term && (
            <div className="absolute mt-2 w-full card p-2 max-h-80 overflow-y-auto z-50 animate-fade-in">
              {matchedProducts.length === 0 && matchedClients.length === 0 && (
                <p className="px-2 py-2 text-sm text-gray-400">Aucun résultat pour « {search} »</p>
              )}
              {matchedProducts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 px-2 py-1">Produits</p>
                  {matchedProducts.map((p) => (
                    <button key={p.id} type="button" className={resultBtn} onClick={() => goTo('/produits', p.name)}>
                      {p.name} <span className="text-gray-400">— Stock : {p.stock}</span>
                    </button>
                  ))}
                </div>
              )}
              {matchedClients.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 px-2 py-1">Clients</p>
                  {matchedClients.map((c) => (
                    <button key={c.id} type="button" className={resultBtn} onClick={() => goTo('/clients', c.name)}>
                      {c.name} <span className="text-gray-400">— {c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <p className="hidden xl:flex items-center gap-2 pr-4 mr-1 border-r border-gray-300/70 dark:border-white/10 text-sm font-medium text-brand-900 dark:text-gray-200">
          <CalendarDays size={18} /> {todayLabel()}
        </p>
        <ThemeToggle />

        <div className="relative" ref={notifRef}>
          <button
            type="button"
            aria-label={`Notifications (${lowStock.length})`}
            className={iconBtn}
            onClick={() => setShowNotifs((s) => !s)}
          >
            <Bell size={21} />
            {lowStock.length > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 ring-2 ring-[#f3f6fb] dark:ring-darkbg text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                {lowStock.length}
              </span>
            )}
          </button>
          {showNotifs && (
            <div className="absolute right-0 mt-2 w-72 card p-3 z-50 animate-fade-in">
              <p className="text-sm font-semibold mb-2">Notifications</p>
              {lowStock.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune alerte pour le moment.</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {lowStock.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        navigate('/stock')
                        setShowNotifs(false)
                      }}
                      className="w-full flex items-start gap-2 text-left text-sm p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/20"
                    >
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>
                        Stock faible : <strong>{p.name}</strong> ({p.stock} restant)
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative ml-1" ref={userRef}>
          <button
            type="button"
            aria-label="Menu utilisateur"
            className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-full hover:bg-white dark:hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            onClick={() => setShowUserMenu((s) => !s)}
            title={ROLE_LABELS[profile?.role] || ''}
          >
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-white flex items-center justify-center text-base font-bold shadow-sm">
              {displayName(profile?.full_name, 'U')[0].toUpperCase()}
            </div>
            <p className="hidden sm:block text-sm font-semibold text-brand-900 dark:text-gray-100">{displayName(profile?.full_name)}</p>
            <ChevronDown size={16} className="hidden sm:block text-brand-900 dark:text-gray-300" />
          </button>
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 card p-1.5 z-50 animate-fade-in">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06]"
                onClick={() => {
                  navigate('/parametres')
                  setShowUserMenu(false)
                }}
              >
                <SettingsIcon size={16} /> Mon profil
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
        </div>
      </div>
    </header>
  )
}
