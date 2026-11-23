import { useEffect, useState } from 'react'
import PageHeader from '../../components/PageHeader'
import { Moon, Sun, Store, Phone, MapPin, User, Pencil, Save, X, KeyRound, Settings as SettingsIcon, SlidersHorizontal, Palette } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { ROLE_LABELS } from '../../lib/constants'
import { useShopSettings, useUpdateShopSettings, DEFAULT_SHOP_SETTINGS } from '../../hooks/useShopSettings'
import SignatureCard from './SignatureCard'

// Chaque utilisateur change lui-même son mot de passe (ex. mot de passe provisoire reçu de l'admin)
function PasswordCard() {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('8 caractères minimum.')
    if (password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.')
    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) return setError(updateError.message)
    setPassword('')
    setConfirm('')
    toast.success('Mot de passe modifié.')
  }

  return (
    <form onSubmit={handleSubmit} className="panel p-5 space-y-4">
      <h3 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50"><span className="h-8 w-8 rounded-full bg-[#1d4fb8] text-white flex items-center justify-center"><KeyRound size={16} /></span> Changer mon mot de passe</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="new-password">Nouveau mot de passe</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} required className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 caractères" />
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">Confirmer</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : 'Changer le mot de passe'}</button>
      </div>
    </form>
  )
}

export default function Settings() {
  const { profile, user, isAdmin } = useAuth()
  const { theme, setTheme } = useTheme()
  const { data: shop = DEFAULT_SHOP_SETTINGS, isLoading } = useShopSettings()
  const updateShop = useUpdateShopSettings()

  const [editingShop, setEditingShop] = useState(false)
  const [form, setForm] = useState(DEFAULT_SHOP_SETTINGS)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (shop) setForm(shop)
  }, [shop])

  const openEdit = () => {
    setForm(shop)
    setError('')
    setSaved(false)
    setEditingShop(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await updateShop.mutateAsync({
        name: form.name,
        owner: form.owner,
        address: form.address,
        activities: form.activities || null,
        phone1: form.phone1 || null,
        phone2: form.phone2 || null,
        phone3: form.phone3 || null,
        phone4: form.phone4 || null,
        ninea: form.ninea?.trim() || null,
        opening_hours: form.opening_hours?.trim() || null,
        low_stock_default_threshold: Number(form.low_stock_default_threshold) || 5,
      })
      setEditingShop(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const phones = [shop.phone1, shop.phone2, shop.phone3, shop.phone4].filter(Boolean)

  return (
    <div className="space-y-6">
      <PageHeader icon={SettingsIcon} badge={SlidersHorizontal} title="Paramètres" subtitle="Votre profil, la sécurité et les informations de la boutique" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
      <div className="panel p-5 space-y-4">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50"><span className="h-8 w-8 rounded-full bg-[#1d4fb8] text-white flex items-center justify-center"><User size={16} /></span> Mon profil</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Nom</p>
            <p className="font-medium">{profile?.full_name}</p>
          </div>
          <div>
            <p className="text-gray-400">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-gray-400">Rôle</p>
            <p className="font-medium">{ROLE_LABELS[profile?.role] || '—'}</p>
          </div>
        </div>
      </div>

      <PasswordCard />

      <div className="panel p-5 space-y-4">
        <h3 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50"><span className="h-8 w-8 rounded-full bg-[#1d4fb8] text-white flex items-center justify-center"><Palette size={16} /></span> Apparence</h3>
        <div className="flex gap-3">
          <button
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
              theme === 'light' ? 'border-[#1d4fb8] bg-blue-50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-white/10'
            }`}
            onClick={() => setTheme('light')}
          >
            <Sun size={20} />
            <span className="text-sm font-medium">Mode clair</span>
          </button>
          <button
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
              theme === 'dark' ? 'border-[#1d4fb8] bg-blue-50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-white/10'
            }`}
            onClick={() => setTheme('dark')}
          >
            <Moon size={20} />
            <span className="text-sm font-medium">Mode sombre</span>
          </button>
        </div>
      </div>

        </div>
        <div className="space-y-6">
      <div className="panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50"><span className="h-8 w-8 rounded-full bg-[#1d4fb8] text-white flex items-center justify-center"><Store size={16} /></span> Informations de la quincaillerie</h3>
          {isAdmin && !editingShop && (
            <button className="btn-secondary !py-1.5 !px-3" onClick={openEdit}>
              <Pencil size={14} /> Modifier
            </button>
          )}
        </div>

        {saved && (
          <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl px-3 py-2">
            Informations mises à jour avec succès.
          </div>
        )}

        {!editingShop ? (
          <div className="text-sm space-y-1.5 text-gray-600 dark:text-gray-300">
            <p className="font-semibold text-base">{isLoading ? '...' : shop.name}</p>
            <p>Gérant : {shop.owner}</p>
            <p className="flex items-center gap-1.5"><MapPin size={14} /> {shop.address}</p>
            {shop.activities && <p className="text-xs text-gray-500 dark:text-gray-400">{shop.activities}</p>}
            {phones.map((p) => (
              <p key={p} className="flex items-center gap-1.5"><Phone size={14} /> {p}</p>
            ))}
            {shop.ninea && <p>NINEA : {shop.ninea}</p>}
            {shop.opening_hours && <p>Horaires : {shop.opening_hours}</p>}
            {!isAdmin && (
              <p className="text-xs text-gray-400 pt-1">Seul un administrateur peut modifier ces informations.</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}
            <div>
              <label className="label">Nom de la boutique</label>
              <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Gérant</label>
              <input required className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input required className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="label">Activités / Secteurs d'activité</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Ex: Quincaillerie, Ciment & Fer, Matériel Electrique, Plomberie"
                value={form.activities || (Array.isArray(shop.activities) ? shop.activities.join(', ') : shop.activities || '')}
                onChange={(e) => setForm({ ...form, activities: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Téléphone 1</label>
                <input className="input" value={form.phone1 || ''} onChange={(e) => setForm({ ...form, phone1: e.target.value })} />
              </div>
              <div>
                <label className="label">Téléphone 2</label>
                <input className="input" value={form.phone2 || ''} onChange={(e) => setForm({ ...form, phone2: e.target.value })} />
              </div>
              <div>
                <label className="label">Téléphone 3</label>
                <input className="input" value={form.phone3 || ''} onChange={(e) => setForm({ ...form, phone3: e.target.value })} />
              </div>
              <div>
                <label className="label">Téléphone 4</label>
                <input className="input" value={form.phone4 || ''} onChange={(e) => setForm({ ...form, phone4: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="shop-ninea">NINEA <span className="text-gray-400 font-normal">(imprimé sur les factures)</span></label>
                <input id="shop-ninea" className="input" value={form.ninea || ''} onChange={(e) => setForm({ ...form, ninea: e.target.value })} placeholder="Ex. 007261423" />
              </div>
              <div>
                <label className="label" htmlFor="shop-hours">Horaires d'ouverture</label>
                <input id="shop-hours" className="input" value={form.opening_hours || ''} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder="Ex. 8h à 20h, du lundi au samedi" />
              </div>
            </div>
            <div>
              <label className="label">Seuil d'alerte stock par défaut (nouveaux produits)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={form.low_stock_default_threshold}
                onChange={(e) => setForm({ ...form, low_stock_default_threshold: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
              <button type="button" className="btn-secondary" onClick={() => setEditingShop(false)}>
                <X size={15} /> Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={updateShop.isPending}>
                <Save size={15} /> {updateShop.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </div>

      {isAdmin && <SignatureCard />}
        </div>
      </div>
    </div>
  )
}
