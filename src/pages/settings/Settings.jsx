import { useEffect, useState } from 'react'
import { Moon, Sun, Store, Phone, MapPin, User, Pencil, Save, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { ROLE_LABELS } from '../../lib/constants'
import { useShopSettings, useUpdateShopSettings, DEFAULT_SHOP_SETTINGS } from '../../hooks/useShopSettings'

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
        low_stock_default_threshold: Number(form.low_stock_default_threshold) || 5,
      })
      setEditingShop(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    }
  }

  const phones = [shop.phone1, shop.phone2, shop.phone3].filter(Boolean)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Votre profil et les préférences de l'application</p>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold flex items-center gap-2"><User size={18} /> Mon profil</h3>
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

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold">Apparence</h3>
        <div className="flex gap-3">
          <button
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
              theme === 'light' ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => setTheme('light')}
          >
            <Sun size={20} />
            <span className="text-sm font-medium">Mode clair</span>
          </button>
          <button
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
              theme === 'dark' ? 'border-brand-600 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 dark:border-gray-700'
            }`}
            onClick={() => setTheme('dark')}
          >
            <Moon size={20} />
            <span className="text-sm font-medium">Mode sombre</span>
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Store size={18} /> Informations de la quincaillerie</h3>
          {isAdmin && !editingShop && (
            <button className="btn-secondary !py-1.5 !px-3" onClick={openEdit}>
              <Pencil size={14} /> Modifier
            </button>
          )}
        </div>

        {saved && (
          <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2">
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
            {!isAdmin && (
              <p className="text-xs text-gray-400 pt-1">Seul un administrateur peut modifier ces informations.</p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            <div className="flex justify-end gap-2 pt-1">
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
    </div>
  )
}
