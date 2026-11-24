import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'

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
    <div className="min-h-full flex flex-col bg-gradient-to-b from-[#071f34] via-[#0a2440] to-[#0d2b4f] text-white safe-top">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-10 pb-6 text-center">
        <img src="/logo.png" alt="Logo Mabane" className="h-20 w-20 rounded-3xl bg-white object-cover shadow-lg" />
        <p className="mt-4 text-2xl font-extrabold tracking-tight">Mabane Patron</p>
        <p className="text-sm text-white/70 mt-1">Les chiffres de votre boutique, où que vous soyez.</p>
      </div>

      <form onSubmit={submit} className="safe-bottom bg-[#f3f6fb] text-navy-900 rounded-t-[32px] px-5 pt-7 pb-8 space-y-4">
        <h1 className="text-2xl font-extrabold">Bonjour 👋</h1>
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="relative">
          <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="email"
            autoComplete="username"
            required
            className="input pl-11"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="relative">
          <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="input pl-11 pr-12"
            placeholder="Mot de passe"
            aria-label="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400"
            onClick={() => setShow((s) => !s)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button type="submit" disabled={loading} className="btn-cta w-full !py-3.5 text-base">
          <LogIn size={18} /> {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        <p className="text-xs text-center text-gray-500">Réservé au propriétaire : utilisez votre compte administrateur de la boutique.</p>
      </form>
    </div>
  )
}
