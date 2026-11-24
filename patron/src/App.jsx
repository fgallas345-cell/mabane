import { useEffect, useState } from 'react'
import { Home as HomeIcon, MessageSquareText, Bell, LogOut, ShieldAlert } from 'lucide-react'
import { supabase } from './lib/supabase'
import Login from './screens/Login'
import Home from './screens/Home'
import Questions from './screens/Questions'
import Alerts from './screens/Alerts'

const TABS = [
  { key: 'home', label: 'Accueil', icon: HomeIcon },
  { key: 'assistant', label: 'Questions', icon: MessageSquareText },
  { key: 'alerts', label: 'Alertes', icon: Bell },
]

function Splash() {
  return (
    <div className="h-full flex items-center justify-center bg-navy-900">
      <img src="/logo.png" alt="" className="h-20 w-20 rounded-3xl bg-white object-cover animate-pulse" />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = en cours de chargement
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState('home')
  const [pendingQuestion, setPendingQuestion] = useState(null)
  const [alertCount, setAlertCount] = useState(0)

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

  if (session === undefined || (session && !profile)) return <Splash />
  if (!session) return <Login />

  if (profile.role !== 'admin') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ShieldAlert size={44} className="text-red-500" />
        <h1 className="text-xl font-extrabold">Accès réservé au propriétaire</h1>
        <p className="text-gray-600">Ce compte n'est pas administrateur. Utilisez l'application de la boutique.</p>
        <button className="btn-soft" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} /> Se déconnecter
        </button>
      </div>
    )
  }

  const firstName = String(profile.full_name || session.user.email || '').split(/[\s@]/)[0]
  const ask = (question) => {
    setPendingQuestion(question)
    setTab('assistant')
  }

  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 overflow-y-auto">
        {tab === 'home' && <Home firstName={firstName} onAsk={ask} onOpenAlerts={() => setTab('alerts')} onAlertCount={setAlertCount} alertCount={alertCount} />}
        {tab === 'assistant' && <Questions pendingQuestion={pendingQuestion} onConsumeQuestion={() => setPendingQuestion(null)} />}
        {tab === 'alerts' && <Alerts onAlertCount={setAlertCount} />}
      </main>

      <nav className="safe-bottom bg-white rounded-t-[28px] shadow-[0_-8px_30px_-12px_rgba(7,31,52,0.25)]" aria-label="Navigation">
        <div className="grid grid-cols-3 px-2 pt-2 pb-1.5">
          {TABS.map((t) => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => setTab(t.key)}
                className={`relative flex flex-col items-center gap-1 py-1 text-[13px] font-semibold ${active ? 'text-[#13306f]' : 'text-gray-500'}`}
              >
                <span className={`relative flex h-11 w-[86px] items-center justify-center rounded-full transition-colors ${active ? 'bg-[#13306f] text-white shadow-[0_8px_18px_-8px_rgba(19,48,111,0.8)]' : ''}`}>
                  <Icon size={22} className={active ? 'fill-white/90' : ''} />
                  {t.key === 'alerts' && alertCount > 0 && (
                    <span className="absolute -top-1 left-1/2 ml-1 min-w-[22px] h-[20px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white">
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </span>
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
