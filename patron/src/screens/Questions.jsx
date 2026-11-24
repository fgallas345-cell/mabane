import { useEffect, useRef, useState } from 'react'
import { Search, User, FileText, RotateCcw, AlertCircle, Sparkles, ChevronLeft, ChevronRight, MessageSquareText } from 'lucide-react'
import { QUESTIONS, chercherClient, chercherFacture } from '../lib/answers'
import RichText from '../lib/RichText'
import Assistant from './Assistant'

// L'assistant IA (questions libres) est payant : il n'apparaît que si VITE_ASSISTANT_IA=true
const IA_ENABLED = import.meta.env.VITE_ASSISTANT_IA === 'true'

/** En-tête marine avec bas en vague */
function Header({ onClear, canClear, busy }) {
  return (
    <header className="safe-top relative bg-gradient-to-br from-[#1d4fb8] via-[#163f9a] to-[#0d2b6b] text-white px-5 pb-10">
      <div className="relative flex items-center gap-3 pt-5">
        <img src="/logo.png" alt="Logo Mabane" className="h-14 w-14 shrink-0 rounded-full bg-white object-cover ring-4 ring-white/20" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold leading-tight">Questions</h1>
          <p className="text-sm text-white/75 leading-snug">Posez une question : réponse immédiate</p>
        </div>
        {canClear && (
          <button type="button" onClick={onClear} disabled={busy} className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-50">
            <RotateCcw size={15} /> Effacer
          </button>
        )}
      </div>
      <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-8 w-full" aria-hidden="true">
        <path d="M0 40 L0 22 C 90 4, 200 34, 300 16 S 380 8, 400 14 L400 40 Z" fill="#f3f6fb" />
      </svg>
    </header>
  )
}

export default function Questions({ pendingQuestion, onConsumeQuestion }) {
  const [thread, setThread] = useState([]) // { role: 'user' | 'answer' | 'error', text, icon? }
  const [busy, setBusy] = useState(false)
  const [searchMode, setSearchMode] = useState('client')
  const [search, setSearch] = useState('')
  const [iaOpen, setIaOpen] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (thread.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [thread, busy])

  const run = async (label, fn, icon) => {
    if (busy) return
    setThread((t) => [...t, { role: 'user', text: label, icon }])
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
    if (q) run(q.label, q.run, q.icon)
  }

  // Question choisie depuis l'accueil
  useEffect(() => {
    if (pendingQuestion) {
      ask(pendingQuestion)
      onConsumeQuestion?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion])

  const lastUser = thread.map((t) => t.role).lastIndexOf('user')

  const submitSearch = (e) => {
    e.preventDefault()
    const value = search.trim()
    if (!value) return
    setSearch('')
    if (searchMode === 'client') run(`Client : ${value}`, () => chercherClient(value), User)
    else run(`Facture : ${value}`, () => chercherFacture(value), FileText)
  }

  if (iaOpen) {
    return (
      <div className="h-full flex flex-col">
        <button type="button" onClick={() => setIaOpen(false)} className="safe-top bg-white px-4 pt-3 text-sm font-semibold text-[#1d4fb8] flex items-center gap-1">
          <ChevronLeft size={16} /> Questions toutes prêtes
        </button>
        <div className="flex-1 min-h-0">
          <Assistant />
        </div>
      </div>
    )
  }

  return (
    <div className="pb-6 min-h-full">
      <Header onClear={() => setThread([])} canClear={thread.length > 0} busy={busy} />

      <div className="px-4 -mt-3 space-y-4 relative">
        {/* Questions toutes prêtes */}
        <div className="grid grid-cols-2 gap-3">
          {QUESTIONS.map((q) => {
            const Icon = q.icon || MessageSquareText
            return (
              <button
                key={q.label}
                type="button"
                disabled={busy}
                onClick={() => run(q.label, q.run, q.icon)}
                className="relative bg-white rounded-3xl p-4 pr-8 text-left shadow-[0_6px_20px_-10px_rgba(7,31,52,0.25)] border border-gray-100 active:scale-[0.98] transition disabled:opacity-60 min-h-[104px] flex flex-col justify-between"
              >
                <Icon size={26} className="text-[#1d4fb8]" strokeWidth={2.2} />
                <span className="mt-2 text-[14px] font-medium leading-snug text-navy-900">{q.label}</span>
                <ChevronRight size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1d4fb8]" />
              </button>
            )
          })}
        </div>

        {/* Recherche client / facture */}
        <form onSubmit={submitSearch} className="bg-white rounded-3xl p-3 space-y-3 shadow-[0_6px_20px_-10px_rgba(7,31,52,0.25)] border border-gray-100">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1">
            {[
              { key: 'client', label: 'Un client', icon: User },
              { key: 'facture', label: 'Une facture', icon: FileText },
            ].map((m) => {
              const active = searchMode === m.key
              const Icon = m.icon
              return (
                <button key={m.key} type="button" onClick={() => setSearchMode(m.key)} className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-colors ${active ? 'bg-[#13306f] text-white shadow-sm' : 'text-navy-900'}`}>
                  <Icon size={17} className={active ? 'fill-white/90' : ''} /> {m.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              className="w-full rounded-full border border-gray-200 bg-white px-5 py-3 text-[15px] text-navy-900 outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
              placeholder={searchMode === 'client' ? 'Nom du client…' : 'Numéro, ex. 0254'}
              aria-label={searchMode === 'client' ? 'Nom du client' : 'Numéro de facture'}
              inputMode={searchMode === 'facture' ? 'numeric' : 'text'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" disabled={busy || !search.trim()} aria-label="Rechercher" className="h-12 w-12 shrink-0 rounded-full bg-[#13306f] text-white flex items-center justify-center shadow-[0_8px_18px_-8px_rgba(19,48,111,0.8)] disabled:opacity-50">
              <Search size={21} />
            </button>
          </div>
        </form>

        {/* Questions posées et réponses */}
        {thread.map((b, i) => {
          if (b.role === 'user') {
            // La page défile jusqu'à la dernière question posée : sa réponse apparaît juste dessous
            const Icon = b.icon || MessageSquareText
            return (
              <div key={i} ref={i === lastUser ? endRef : undefined} className="flex justify-center pt-1 scroll-mt-4">
                <p className="inline-flex items-center gap-2.5 rounded-full bg-[#13306f] text-white px-6 py-3 text-[15px] font-semibold shadow-[0_8px_18px_-8px_rgba(19,48,111,0.8)]">
                  <Icon size={19} /> {b.text}
                </p>
              </div>
            )
          }
          if (b.role === 'answer') {
            return (
              <div key={i} className="bg-white rounded-3xl px-5 py-4 text-[15px] leading-relaxed shadow-[0_6px_20px_-10px_rgba(7,31,52,0.25)] border border-gray-100">
                <RichText text={b.text} />
              </div>
            )
          }
          return (
            <p key={i} className="rounded-3xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex gap-2">
              <AlertCircle size={17} className="shrink-0 mt-0.5" /> {b.text}
            </p>
          )
        })}
        {busy && (
          <div className="bg-white rounded-3xl px-5 py-4 flex items-center gap-1.5 w-fit border border-gray-100" aria-label="Calcul en cours">
            {[0, 1, 2].map((d) => (
              <span key={d} className="h-2 w-2 rounded-full bg-[#1d4fb8] animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
            ))}
            <span className="ml-2 text-xs text-gray-500">Je calcule…</span>
          </div>
        )}

        {IA_ENABLED && (
          <button type="button" onClick={() => setIaOpen(true)} className="btn-soft w-full">
            <Sparkles size={18} className="text-accent-500" /> Poser une question libre (assistant IA)
          </button>
        )}
      </div>
    </div>
  )
}
