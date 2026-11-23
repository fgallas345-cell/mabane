import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, ShieldCheck, BadgeCheck, Wrench, MapPin, Phone, Mail, Lock } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { SHOP } from '../../lib/constants'

const VALUES = [
  { icon: BadgeCheck, label: 'Qualité' },
  { icon: ShieldCheck, label: 'Fiabilité' },
  { icon: Wrench, label: 'Service' },
]

export default function Login() {
  const { signIn } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      const message = 'Email ou mot de passe incorrect.'
      setError(message)
      toast.error(message)
    } else {
      navigate('/')
    }
  }

  const phones = (SHOP.phones || []).filter(Boolean)

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-[#f3f6fb] dark:bg-darkbg">
      {/* Panneau identité (ordinateur / tablette) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#071f34] via-[#0a2440] to-[#0d2b4f] text-white p-12">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-500/10" aria-hidden />
        {/* Vagues décoratives, comme la barre latérale */}
        <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 120 C 160 60, 340 200, 600 90 L600 300 L0 300 Z" fill="#1e4572" opacity="0.45" />
          <path d="M0 200 C 200 140, 380 260, 600 170 L600 300 L0 300 Z" fill="#2b5c94" opacity="0.3" />
        </svg>

        <div className="relative flex items-center gap-4">
          <img src="/mabane.png" alt="" className="h-16 w-16 rounded-2xl bg-white object-cover shadow-lift" />
          <div>
            <p className="text-2xl font-extrabold tracking-tight">{SHOP.name.split(' ').slice(1).join(' ') || SHOP.name}</p>
            <p className="text-sm font-bold uppercase tracking-wide text-accent-400">{SHOP.name.split(' ').length > 1 ? SHOP.name.split(' ')[0] : 'Gestion'}</p>
          </div>
        </div>

        <div className="relative space-y-6 max-w-md">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            Ventes, stock et clients,
            <span className="block text-accent-400">au même endroit.</span>
          </h2>
          <p className="text-white/75 leading-relaxed">
            Factures, petites ventes, livraisons, dettes et dépôts des clients : tout est suivi et à jour, sur ordinateur comme sur téléphone.
          </p>
          <div className="flex flex-wrap gap-2">
            {VALUES.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] ring-1 ring-white/10 px-4 py-2 text-sm font-semibold">
                <Icon size={15} className="text-accent-400" /> {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative space-y-1.5 text-sm text-white/70">
          {(SHOP.address || SHOP.location) && (
            <p className="flex items-center gap-2"><MapPin size={14} /> {SHOP.address || SHOP.location}</p>
          )}
          {phones.length > 0 && (
            <p className="flex items-center gap-2"><Phone size={14} /> {phones.join(' · ')}</p>
          )}
        </div>
      </aside>

      {/* Formulaire */}
      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8 lg:hidden">
            <img src="/mabane.png" alt="Logo Mabane" className="h-20 w-20 rounded-2xl bg-white object-cover mx-auto mb-4 shadow-lift" />
            <p className="text-xl font-extrabold tracking-tight text-brand-900 dark:text-white">{SHOP.name}</p>
          </div>

          <div className="mb-6">
            <h1 className="text-[32px] font-extrabold tracking-tight text-brand-900 dark:text-white">Bonjour <span aria-hidden="true">👋</span></h1>
            <p className="text-[15px] text-gray-600 dark:text-gray-400 mt-1">Connectez-vous pour accéder à la gestion de la boutique.</p>
          </div>

          <form onSubmit={handleSubmit} className="panel p-7 space-y-5 shadow-lift">
            {error && (
              <div role="alert" className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2.5">{error}</div>
            )}
            <div>
              <label htmlFor="login-email" className="label">Email</label>
              <div className="relative">
              <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                autoFocus
                required
                className="input !rounded-2xl !py-3 pl-11"
                placeholder="vous@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              </div>
            </div>
            <div>
              <label htmlFor="login-password" className="label">Mot de passe</label>
              <div className="relative">
                <Lock size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input !rounded-2xl !py-3 pl-11 pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  onClick={() => setShowPassword((s) => !s)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-cta w-full !py-3.5 text-base">
              <LogIn size={18} />
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <p className="text-xs text-center text-gray-400 mt-6">
            Mot de passe oublié ? Demandez à l’administrateur de la boutique.
          </p>
        </div>
      </main>
    </div>
  )
}
