import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Store, UserPlus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { SHOP } from '../../lib/constants'

export default function Register() {
  const { signUp } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signUp(email, password, fullName, 'admin')
    setLoading(false)
    if (error) {
      setError(error.message)
      toast.error(error.message)
    } else {
      setSuccess(true)
      toast.success('Compte créé avec succès !')
      setTimeout(() => navigate('/login'), 2500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-darkbg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-brand-600 text-white mb-3">
            <Store size={28} />
          </div>
          <h1 className="text-xl font-bold">{SHOP.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Créez le compte administrateur principal
          </p>
        </div>

        {success ? (
          <div className="card p-6 text-center space-y-2">
            <p className="text-emerald-600 font-medium">✅ Compte créé avec succès !</p>
            <p className="text-sm text-gray-500">Redirection vers la connexion...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-4">
            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
            )}
            <div>
              <label className="label">Nom complet</label>
              <input required className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Mamadou Faye" />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <input type="password" required minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 caractères" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              <UserPlus size={16} />
              {loading ? 'Création...' : 'Créer le compte'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              ⚠️ N'utilisez cette page qu'une seule fois pour créer le premier administrateur. Les autres comptes (caissiers, employés) doivent être créés par l'administrateur depuis la page « Utilisateurs ».
            </p>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
