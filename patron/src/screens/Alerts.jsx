import { useCallback, useEffect, useState } from 'react'
import { Box, HandCoins, Clock, Phone, MessageCircle, RefreshCw, Bell, Users, FileWarning } from 'lucide-react'
import { callPatron, fcfa } from '../lib/api'
import { ScreenHeader, HeaderIcon, ErrorBox, Empty } from '../components/ui'

const TABS = [
  { key: 'stock', label: 'Stock', icon: Box },
  { key: 'dettes', label: 'Dettes', icon: HandCoins },
  { key: 'anciennes', label: '+30 jours', icon: Clock },
]

/** Numéro sénégalais au format international pour WhatsApp (77 123 45 67 → 221771234567) */
const waNumber = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return null
  return digits.length === 9 ? `221${digits}` : digits
}

const frDate = (d) => new Date(d).toLocaleDateString('fr-FR')

function ContactButtons({ phone }) {
  const wa = waNumber(phone)
  if (!phone) return null
  return (
    <span className="flex gap-2 shrink-0">
      <a href={`tel:${phone}`} aria-label="Appeler" className="icon-chip h-11 w-11 bg-blue-50 text-navy-500 active:scale-95 transition">
        <Phone size={19} className="fill-navy-500" />
      </a>
      {wa && (
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="Écrire sur WhatsApp" className="icon-chip h-11 w-11 bg-emerald-50 text-emerald-600 active:scale-95 transition">
          <MessageCircle size={20} />
        </a>
      )}
    </span>
  )
}

/** Ligne : nom en gras, détail gris, montant rouge éventuel, actions à droite */
function Row({ title, detail, amount, upper = true, right }) {
  return (
    <li className="row-card px-4 py-3 flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-extrabold truncate text-navy-900 ${upper ? 'uppercase' : ''}`}>{title}</span>
        <span className="block text-sm text-gray-500 truncate">{detail}</span>
        {amount != null && <span className="block text-[15px] amount-red">{fcfa(amount)}</span>}
      </span>
      {right}
    </li>
  )
}

export default function Alerts({ onAlertCount }) {
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
  const lateTotal = data ? data.factures_anciennes.reduce((s, f) => s + f.reste, 0) : 0

  return (
    <div className="pb-6 min-h-full">
      <ScreenHeader
        visual={<HeaderIcon icon={Bell} />}
        title="Alertes"
        subtitle="Ce qui demande votre attention"
        actions={
          <button type="button" aria-label="Actualiser" onClick={load} className="header-btn">
            <RefreshCw size={19} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      <div className="px-4 -mt-3 space-y-3 relative">
        {/* Onglets en pastilles avec compteurs */}
        <div role="tablist" aria-label="Type d'alerte" className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => {
            const active = tab === t.key
            const Icon = t.icon
            return (
              <button key={t.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)} className={active ? 'pill-on' : 'pill-off'}>
                <Icon size={17} /> {t.label}
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-white/20' : 'bg-gray-100'}`}>{counts[t.key]}</span>
              </button>
            )
          })}
        </div>

        {error && <ErrorBox message={error} onRetry={load} />}
        {loading && !data && Array.from({ length: 6 }).map((_, i) => <div key={i} className="row-card h-16 animate-pulse" />)}

        {data && tab === 'stock' && (
          data.stock.length === 0 ? (
            <Empty>Aucun produit sous son seuil d'alerte. 👍</Empty>
          ) : (
            <ul className="space-y-2">
              {data.stock.map((p) => (
                <Row
                  key={p.produit}
                  title={p.produit}
                  detail={`Seuil d'alerte : ${p.seuil} ${p.unite || ''}`}
                  right={
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${p.stock <= 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-800'}`}>
                      {p.stock <= 0 ? 'Rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`}
                    </span>
                  }
                />
              ))}
            </ul>
          )
        )}

        {data && tab === 'dettes' && (
          <>
            <div className="hero p-5">
              <p className="text-sm text-white/85">Total dû par les clients</p>
              <p className="text-[28px] font-extrabold tabular-nums leading-tight">{fcfa(data.dette_totale)}</p>
              <Users size={44} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/90 fill-white/90" />
            </div>
            {data.dettes.length === 0 ? (
              <Empty>Aucune dette client. 👍</Empty>
            ) : (
              <ul className="space-y-2">
                {data.dettes.map((c) => (
                  <Row
                    key={c.client + c.plus_ancienne}
                    title={c.client}
                    detail={`${c.factures} facture${c.factures > 1 ? 's' : ''} : depuis le ${frDate(c.plus_ancienne)}`}
                    amount={c.reste}
                    right={<ContactButtons phone={c.telephone} />}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {data && tab === 'anciennes' && (
          data.factures_anciennes.length === 0 ? (
            <Empty>Aucune facture impayée depuis plus de 30 jours. 👍</Empty>
          ) : (
            <>
              <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                <span className="icon-chip h-11 w-11 bg-amber-100 text-amber-600"><FileWarning size={22} /></span>
                <p className="text-sm text-amber-900">
                  <strong>{data.factures_anciennes.length} facture{data.factures_anciennes.length > 1 ? 's' : ''}</strong> impayée{data.factures_anciennes.length > 1 ? 's' : ''} depuis plus de 30 jours : <strong>{fcfa(lateTotal)}</strong>
                </p>
              </div>
              <ul className="space-y-2">
                {data.factures_anciennes.map((f) => (
                  <Row
                    key={f.numero}
                    upper={false}
                    title={f.numero}
                    detail={`${f.client.toUpperCase()} · ${frDate(f.date)}`}
                    amount={f.reste}
                    right={<ContactButtons phone={f.telephone} />}
                  />
                ))}
              </ul>
            </>
          )
        )}
      </div>
    </div>
  )
}
