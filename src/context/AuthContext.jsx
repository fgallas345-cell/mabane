import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { syncShopSettings } from '../lib/constants'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (!error) setProfile(data)
  }

  useEffect(() => {
    // Charge les infos de la boutique (nom, adresse, téléphones...) une fois au démarrage,
    // avant même la connexion, pour que Login/Register/PDF affichent les valeurs à jour.
    supabase
      .from('shop_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle()
      .then(({ data }) => syncShopSettings(data))
      .catch(() => {})

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      loadProfile(session?.user?.id).finally(() => setLoading(false))
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      loadProfile(session?.user?.id)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signUp = async (email, password, fullName, role = 'employe') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.role === 'admin'
  const isCaissier = profile?.role === 'caissier'

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user, profile, loading, signIn, signUp, signOut, isAdmin, isCaissier }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
