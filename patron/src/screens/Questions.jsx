import { useEffect, useRef, useState } from 'react'
import { Search, User, FileText, RotateCcw, Sparkles, ChevronRight, MessageSquareText } from 'lucide-react'
import { QUESTIONS, chercherClient, chercherFacture } from '../lib/answers'
import RichText from '../lib/RichText'
import Assistant from './Assistant'
import { ScreenHeader, Logo, ErrorBox, TypingDots } from '../components/ui'

// L'assistant IA (questions libres) est payant : il n'apparaît que si VITE_ASSISTANT_IA=true
const IA_ENABLED = import.meta.env.VITE_ASSISTANT_IA === 'true'

const SEARCH_MODES = [
  { key: 'client', label: 'Un client', icon: User },
  { key: 'facture', label: 'Une facture', icon: FileText },
]

export default function Questions({ pendingQuestion, onConsumeQuestion }) {
  const [thread, setThread] = useState([]) // { role: 'user' | 'answer' | 'error', text, icon? }
  const [busy, setBusy] = useState(false)
  const [searchMode, setSearchMode] = useState('client')
  const [search, setSearch] = useState('')
  const [iaOpen, setIaOpen] = useState(false)
  const endRef = useRef(null)

  // La page défile jusqu'à la dernière question posée : sa réponse apparaît juste dessous
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

  if (iaOpen) return <Assistant onBack={() => setIaOpen(false)} />

  return (
    <div className="pb-6 min-h-full">
      <ScreenHeader
        visual={<Logo />}
        title="Questions"
        subtitle="Posez une question : réponse immédiate"
        actions={
          thread.length > 0 && (
            <button type="button" onClick={() => setThread([])} disabled={busy} className="btn !px-4 !py-2 border border-white/40 bg-white/10 text-white">
              <RotateCcw size={15} /> Effacer
            </button>
          )
        }
      />

      <div className="px-4 -mt-3 space-y-4 relative">
        {/* Recherche client / facture */}
        <form onSubmit={submitSearch} className="card p-3 space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1">
            {SEARCH_MODES.map((m) => {
              const active = searchMode === m.key
              const Icon = m.icon
              return (
                <button key={m.key} type="button" onClick={() => setSearchMode(m.key)} className={active ? 'pill-on' : 'pill text-navy-900'}>
                  <Icon size={17} className={active ? 'fill-white/90' : ''} /> {m.label}
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
            <button type="submit" disabled={busy || !search.trim()} aria-label="Rechercher" className="round-btn">
              <Search size={21} />
            </button>
          </div>
        </form>

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
                className="card relative p-4 pr-8 text-left active:scale-[0.98] transition disabled:opacity-60 min-h-[104px] flex flex-col justify-between"
              >
                <Icon size={26} className="text-navy-500" strokeWidth={2.2} />
                <span className="mt-2 text-[14px] font-medium leading-snug text-navy-900">{q.label}</span>
                <ChevronRight size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-navy-500" />
              </button>
            )
          })}
        </div>

        {/* Questions posées et réponses */}
        {thread.map((b, i) => {
          if (b.role === 'user') {
            const Icon = b.icon || MessageSquareText
            return (
              <div key={i} ref={i === lastUser ? endRef : undefined} className="flex justify-center pt-1 scroll-mt-4">
                <p className="btn-primary !px-6 text-[15px] cursor-default">
                  <Icon size={19} /> {b.text}
                </p>
              </div>
            )
          }
          if (b.role === 'answer') {
            return (
              <div key={i} className="card px-5 py-4 text-[15px] leading-relaxed">
                <RichText text={b.text} />
              </div>
            )
          }
          return <ErrorBox key={i} message={b.text} />
        })}
        {busy && <TypingDots />}

        {IA_ENABLED && (
          <button type="button" onClick={() => setIaOpen(true)} className="btn-soft w-full">
            <Sparkles size={18} className="text-accent-500" /> Poser une question libre (assistant IA)
          </button>
        )}
      </div>
    </div>
  )
}
