import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Skyline, Logo, ErrorBox } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (authError) setError('Email ou mot de passe incorrect.')
  }

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-br from-navy-500 via-navy-600 to-navy-800 text-white safe-top">
      <div className="relative flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-8 text-center overflow-hidden">
        <Skyline className="pointer-events-none absolute right-0 bottom-0 h-44 w-72" />
        <Logo className="h-24 w-24" />
        <p className="relative mt-4 text-[26px] font-extrabold tracking-tight">
          Mabane <span className="text-accent-400">Patron</span>
        </p>
        <p className="relative text-sm text-white/75 mt-1">Les chiffres de votre boutique, où que vous soyez.</p>
      </div>

      <form onSubmit={submit} className="safe-bottom bg-page text-navy-900 rounded-t-[32px] px-5 pt-7 pb-8 space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold">Bonjour <span aria-hidden="true">👋</span></h1>
          <p className="text-sm text-gray-500 mt-0.5">Connectez-vous avec votre compte administrateur.</p>
        </div>
        {error && <ErrorBox message={error} />}
        <div className="relative">
          <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="email"
            autoComplete="username"
            required
            className="input pl-12"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="relative">
          <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="input pl-12 pr-14"
            placeholder="Mot de passe"
            aria-label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="mini-btn absolute right-2.5 top-1/2 -translate-y-1/2 !h-9 !w-9"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        <button type="submit" disabled={loading} className="btn-cta w-full !py-3.5 text-base">
          <LogIn size={18} /> {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="text-xs text-center text-gray-500">Mêmes email et mot de passe que dans l'application de la boutique.</p>
      </form>
    </div>
  )
}
