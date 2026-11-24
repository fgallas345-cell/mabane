import { useEffect, useRef, useState } from 'react'
import { MessageSquareText, Search, User, FileText, RotateCcw, AlertCircle, Sparkles, ChevronLeft } from 'lucide-react'
import { QUESTIONS, chercherClient, chercherFacture } from '../lib/answers'
import RichText from '../lib/RichText'
import Assistant from './Assistant'

// L'assistant IA (questions libres) est payant : il n'apparaît que si VITE_ASSISTANT_IA=true
const IA_ENABLED = import.meta.env.VITE_ASSISTANT_IA === 'true'

export default function Questions({ pendingQuestion, onConsumeQuestion }) {
  const [thread, setThread] = useState([]) // { role: 'user' | 'answer' | 'error', text }
  const [busy, setBusy] = useState(false)
  const [searchMode, setSearchMode] = useState('client')
  const [search, setSearch] = useState('')
  const [iaOpen, setIaOpen] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (thread.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [thread, busy])

  const run = async (label, fn) => {
    if (busy) return
    setThread((t) => [...t, { role: 'user', text: label }])
    setBusy(true)
    try {
      const text = await fn()
      setThread((t) => [...t, { role: 'answer', text }])
    } catch (e) {
      setThread((t) => [...t, { role: 'error', text: e.message }])
    } finally {
      setBusy(false)
    }
  }

  const ask = (label) => {
    const q = QUESTIONS.find((x) => x.label === label)
    if (q) run(q.label, q.run)
  }

  // Question choisie depuis l'accueil ou les alertes
  useEffect(() => {
    if (pendingQuestion) {
      ask(pendingQuestion)
      onConsumeQuestion?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion])

  const submitSearch = (e) => {
    e.preventDefault()
    const value = search.trim()
    if (!value) return
    setSearch('')
    if (searchMode === 'client') run(`Client : ${value}`, () => chercherClient(value))
    else run(`Facture : ${value}`, () => chercherFacture(value))
  }

  if (iaOpen) {
    return (
      <div className="h-full flex flex-col">
        <button type="button" onClick={() => setIaOpen(false)} className="safe-top bg-white px-4 pt-3 text-sm font-semibold text-navy-500 flex items-center gap-1">
          <ChevronLeft size={16} /> Questions toutes prêtes
        </button>
        <div className="flex-1 min-h-0">
          <Assistant />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6">
      <header className="safe-top bg-white border-b border-gray-200/80 px-4">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-navy-700 text-white flex items-center justify-center"><MessageSquareText size={20} /></span>
            <div>
              <h1 className="font-extrabold leading-tight">Questions</h1>
              <p className="text-xs text-gray-500">Touchez une question : réponse immédiate</p>
            </div>
          </div>
          {thread.length > 0 && (
            <button type="button" onClick={() => setThread([])} disabled={busy} className="btn-soft !px-3 !py-2 text-xs">
              <RotateCcw size={15} /> Effacer
            </button>
          )}
        </div>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Questions toutes prêtes */}
        <div className="grid grid-cols-2 gap-2">
          {QUESTIONS.map((q) => (
            <button
              key={q.label}
              type="button"
              disabled={busy}
              onClick={() => run(q.label, q.run)}
              className="card px-3 py-3 text-left text-sm font-semibold leading-snug active:scale-[0.98] active:bg-blue-50 transition disabled:opacity-60"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Recherche client / facture */}
        <form onSubmit={submitSearch} className="card p-3 space-y-2">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1">
            {[
              { key: 'client', label: 'Un client', icon: User },
              { key: 'facture', label: 'Une facture', icon: FileText },
            ].map((m) => {
              const active = searchMode === m.key
              const Icon = m.icon
              return (
                <button key={m.key} type="button" onClick={() => setSearchMode(m.key)} className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold ${active ? 'bg-navy-700 text-white' : 'text-navy-900'}`}>
                  <Icon size={15} /> {m.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder={searchMode === 'client' ? 'Nom du client…' : 'Numéro, ex. 0254'}
              aria-label={searchMode === 'client' ? 'Nom du client' : 'Numéro de facture'}
              inputMode={searchMode === 'facture' ? 'numeric' : 'text'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" disabled={busy || !search.trim()} aria-label="Rechercher" className="h-12 w-12 shrink-0 rounded-2xl bg-accent-500 text-navy-900 flex items-center justify-center disabled:opacity-40">
              <Search size={20} />
            </button>
          </div>
        </form>

        {/* Réponses */}
        {thread.map((b, i) =>
          b.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-navy-700 text-white px-4 py-2.5 text-[15px]">{b.text}</p>
            </div>
          ) : b.role === 'answer' ? (
            <div key={i} className="rounded-3xl rounded-bl-lg bg-white border border-gray-200/80 shadow-card px-4 py-3 text-[15px] leading-relaxed">
              <RichText text={b.text} />
            </div>
          ) : (
            <p key={i} className="rounded-3xl rounded-bl-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex gap-2">
              <AlertCircle size={17} className="shrink-0 mt-0.5" /> {b.text}
            </p>
          )
        )}
        {busy && (
          <div className="rounded-3xl rounded-bl-lg bg-white border border-gray-200/80 px-4 py-3 flex items-center gap-1.5 w-fit" aria-label="Calcul en cours">
            {[0, 1, 2].map((d) => (
              <span key={d} className="h-2 w-2 rounded-full bg-navy-500 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
            ))}
            <span className="ml-2 text-xs text-gray-500">Je calcule…</span>
          </div>
        )}
        <div ref={endRef} />

        {IA_ENABLED && (
          <button type="button" onClick={() => setIaOpen(true)} className="btn-soft w-full">
            <Sparkles size={18} className="text-accent-500" /> Poser une question libre (assistant IA)
          </button>
        )}
      </div>
    </div>
  )
}
