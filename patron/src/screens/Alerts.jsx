import { useCallback, useEffect, useState } from 'react'
import { PackageX, HandCoins, Clock, Phone, MessageCircle, RefreshCw, Sparkles } from 'lucide-react'
import { callPatron, fcfa } from '../lib/api'

const TABS = [
  { key: 'stock', label: 'Stock', icon: PackageX },
  { key: 'dettes', label: 'Dettes', icon: HandCoins },
  { key: 'anciennes', label: '+30 jours', icon: Clock },
]

/** Numéro sénégalais au format international pour WhatsApp (77 123 45 67 → 221771234567) */
const waNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  return digits.length === 9 ? `221${digits}` : digits
}

function ContactButtons({ phone }) {
  const wa = waNumber(phone)
  if (!phone) return null
  return (
    <span className="flex gap-1.5 shrink-0">
      <a href={`tel:${phone}`} aria-label="Appeler" className="h-9 w-9 rounded-xl bg-blue-50 text-navy-500 flex items-center justify-center"><Phone size={16} /></a>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="Écrire sur WhatsApp" className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <MessageCircle size={16} />
        </a>
      )}
    </span>
  )
}

export default function Alerts({ onAsk, onAlertCount }) {
  const [tab, setTab] = useState('stock')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callPatron('alertes')
      setData(res)
      onAlertCount?.(res.stock.length + res.dettes.length)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [onAlertCount])

  useEffect(() => {
    load()
  }, [load])

  const counts = { stock: data?.stock.length ?? 0, dettes: data?.dettes.length ?? 0, anciennes: data?.factures_anciennes.length ?? 0 }

  return (
    <div className="pb-6">
      <header className="safe-top bg-white border-b border-gray-200/80 px-4 sticky top-0 z-10">
        <div className="flex items-center justify-between py-3">
          <div>
            <h1 className="text-xl font-extrabold">Alertes</h1>
            <p className="text-xs text-gray-500">Ce qui demande votre attention</p>
          </div>
          <button type="button" aria-label="Actualiser" onClick={load} className="h-10 w-10 rounded-2xl bg-gray-100 flex items-center justify-center">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-gray-100 p-1 mb-3">
          {TABS.map((t) => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold ${active ? 'bg-navy-700 text-white' : 'text-navy-900'}`}
              >
                <Icon size={15} /> {t.label}
                {counts[t.key] > 0 && <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20' : 'bg-white'}`}>{counts[t.key]}</span>}
              </button>
            )
          })}
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {error && (
          <div className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">
            {error}
            <button type="button" className="block mt-2 font-semibold underline" onClick={load}>Réessayer</button>
          </div>
        )}
        {loading && !data && Array.from({ length: 5 }).map((_, i) => <div key={i} className="card h-16 animate-pulse" />)}

        {data && tab === 'stock' && (
          data.stock.length === 0 ? (
            <p className="card p-6 text-center text-sm text-gray-500">Aucun produit sous son seuil d'alerte. 👍</p>
          ) : (
            <ul className="card divide-y divide-gray-100 overflow-hidden">
              {data.stock.map((p) => (
                <li key={p.produit} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-bold uppercase truncate">{p.produit}</span>
                    <span className="block text-xs text-gray-500">Seuil d'alerte : {p.seuil} {p.unite || ''}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${p.stock <= 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-800'}`}>
                    {p.stock <= 0 ? 'Rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}

        {data && tab === 'dettes' && (
          <>
            <div className="rounded-3xl bg-gradient-to-br from-red-500 to-red-700 text-white p-4">
              <p className="text-sm text-white/80">Total dû par les clients</p>
              <p className="text-2xl font-extrabold tabular-nums">{fcfa(data.dette_totale)}</p>
            </div>
            {data.dettes.length === 0 ? (
              <p className="card p-6 text-center text-sm text-gray-500">Aucune dette client. 👍</p>
            ) : (
              <ul className="card divide-y divide-gray-100 overflow-hidden">
                {data.dettes.map((c) => (
                  <li key={c.client + c.plus_ancienne} className="flex items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold uppercase truncate">{c.client}</span>
                      <span className="block text-xs text-gray-500">{c.factures} facture{c.factures > 1 ? 's' : ''} · depuis le {new Date(c.plus_ancienne).toLocaleDateString('fr-FR')}</span>
                      <span className="block text-sm font-extrabold text-red-600 tabular-nums">{fcfa(c.reste)}</span>
                    </span>
                    <ContactButtons phone={c.telephone} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {data && tab === 'anciennes' && (
          data.factures_anciennes.length === 0 ? (
            <p className="card p-6 text-center text-sm text-gray-500">Aucune facture impayée depuis plus de 30 jours. 👍</p>
          ) : (
            <ul className="card divide-y divide-gray-100 overflow-hidden">
              {data.factures_anciennes.map((f) => (
                <li key={f.numero} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{f.numero}</span>
                    <span className="block text-xs text-gray-500 uppercase truncate">{f.client} · {new Date(f.date).toLocaleDateString('fr-FR')}</span>
                    <span className="block text-sm font-extrabold text-red-600 tabular-nums">{fcfa(f.reste)}</span>
                  </span>
                  <ContactButtons phone={f.telephone} />
                </li>
              ))}
            </ul>
          )
        )}

        <button type="button" onClick={() => onAsk('Fais-moi un point sur les dettes clients et le stock à commander, avec les priorités.')} className="btn-cta w-full">
          <Sparkles size={18} /> Demander un point à l'assistant
        </button>
      </div>
    </div>
  )
}
