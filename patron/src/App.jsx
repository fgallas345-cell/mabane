import { useEffect, useRef, useState } from 'react'
import { Home as HomeIcon, MessageSquareText, Bell, LogOut, ShieldAlert } from 'lucide-react'
import { supabase } from './lib/supabase'
import Login from './screens/Login'
import Home from './screens/Home'
import Questions from './screens/Questions'
import Alerts from './screens/Alerts'
import BottomNav from './components/BottomNav'
import { Skyline, Logo } from './components/ui'

const TABS = [
  { key: 'home', label: 'Accueil', icon: HomeIcon },
  { key: 'assistant', label: 'Questions', icon: MessageSquareText },
  { key: 'alerts', label: 'Alertes', icon: Bell },
]

/**
 * Cadre de l'application : hauteur exacte de l'écran (100dvh), jamais de défilement horizontal.
 * Sur tablette / ordinateur, l'application reste une colonne de téléphone centrée.
 */
function AppFrame({ children }) {
  return (
    <div className="app-backdrop">
      <div className="app-frame">{children}</div>
    </div>
  )
}

function Splash() {
  return (
    <div className="relative h-full flex flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-br from-navy-500 via-navy-600 to-navy-800 text-white">
      <Skyline className="pointer-events-none absolute right-0 bottom-0 h-44 w-72" />
      <Logo className="h-24 w-24 animate-pulse" />
      <p className="text-[22px] font-extrabold">Mabane <span className="text-accent-400">Patron</span></p>
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="h-full flex items-center justify-center px-5">
      <div className="card w-full p-6 text-center space-y-3">
        <span className="mx-auto icon-chip h-16 w-16 bg-red-100 text-red-600">
          <ShieldAlert size={32} />
        </span>
        <h1 className="text-xl font-extrabold text-navy-900">Accès réservé au propriétaire</h1>
        <p className="text-sm text-gray-600">Ce compte n'est pas administrateur. Utilisez l'application de la boutique.</p>
        <button className="btn-primary w-full" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} /> Se déconnecter
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = en cours de chargement
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('home')
  const [pendingQuestion, setPendingQuestion] = useState(null)
  const [alertCount, setAlertCount] = useState(0)
  const mainRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Profil (rôle) : l'application est réservée au propriétaire (compte administrateur)
  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return
    }
    supabase
      .from('users')
      .select('full_name, role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data || { role: null }))
  }, [session])

  // Chaque changement d'onglet repart du haut de l'écran, comme dans une application native
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [tab])

  let content
  if (session === undefined || (session && !profile)) content = <Splash />
  else if (!session) content = <div className="h-full overflow-y-auto overscroll-contain"><Login /></div>
  else if (profile.role !== 'admin') content = <AccessDenied />

  if (content) return <AppFrame>{content}</AppFrame>

  const firstName = String(profile.full_name || session.user.email || '').split(/[\s@]/)[0]
  const ask = (question) => {
    setPendingQuestion(question)
    setTab('assistant')
  }

  return (
    <AppFrame>
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
        {tab === 'home' && <Home firstName={firstName} onAsk={ask} onOpenAlerts={() => setTab('alerts')} onAlertCount={setAlertCount} alertCount={alertCount} />}
        {tab === 'assistant' && <Questions pendingQuestion={pendingQuestion} onConsumeQuestion={() => setPendingQuestion(null)} />}
        {tab === 'alerts' && <Alerts onAlertCount={setAlertCount} />}
      </main>
      <BottomNav tabs={TABS} active={tab} onChange={setTab} badges={{ alerts: alertCount }} />
    </AppFrame>
  )
}
