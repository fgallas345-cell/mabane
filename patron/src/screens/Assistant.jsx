import { useEffect, useRef, useState } from 'react'
import { Send, Mic, MicOff, Sparkles, RotateCcw, ChevronLeft } from 'lucide-react'
import { callPatron, longDate } from '../lib/api'
import RichText from '../lib/RichText'
import { ScreenHeader, HeaderIcon, ErrorBox, TypingDots } from '../components/ui'

const SUGGESTIONS = [
  "Combien j'ai vendu aujourd'hui ?",
  "Compare aujourd'hui avec hier",
  'Qui me doit le plus ?',
  'Quels produits dois-je commander ?',
  'Mon bénéfice ce mois-ci ?',
  'Les meilleures ventes de la semaine',
  'Combien je dois à mes fournisseurs ?',
  'Mes dépenses du mois',
]

// L'API impose de renvoyer l'historique tel quel : au-delà, on repart d'une nouvelle conversation
const MAX_HISTORY = 70
const STORAGE_KEY = 'mabane-patron-chat'

function loadSaved() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
    if (saved && Array.isArray(saved.api) && Array.isArray(saved.bubbles)) return saved
  } catch {
    /* stockage indisponible (navigation privée…) */
  }
  return { api: [], bubbles: [] }
}

export default function Assistant({ pendingQuestion, onConsumeQuestion, onBack }) {
  const [state, setState] = useState(loadSaved) // api : historique exact renvoyé par le serveur ; bubbles : affichage
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const endRef = useRef(null)
  const recognitionRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* ignoré */
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [state, busy])

  const ask = async (question) => {
    const text = question.trim()
    if (!text || busy) return
    setInput('')
    let { api, bubbles } = stateRef.current
    if (api.length >= MAX_HISTORY) {
      api = []
      bubbles = [{ role: 'info', text: 'Nouvelle conversation (la précédente était trop longue).' }]
    }
    // La date du jour est donnée dans la question (et non dans les consignes fixes du serveur)
    const userMessage = { role: 'user', content: `[Date du jour : ${longDate()} — ${new Date().toISOString().slice(0, 10)}]\n${text}` }
    const nextBubbles = [...bubbles, { role: 'user', text }]
    setState({ api, bubbles: nextBubbles })
    setBusy(true)
    try {
      const res = await callPatron('chat', { messages: [...api, userMessage] })
      setState({ api: res.messages, bubbles: [...nextBubbles, { role: 'assistant', text: res.answer }] })
    } catch (e) {
      // L'historique de l'API reste inchangé : la question pourra être reposée
      setState({ api, bubbles: [...nextBubbles, { role: 'error', text: e.message }] })
    } finally {
      setBusy(false)
    }
  }

  // Question venant de l'accueil
  useEffect(() => {
    if (pendingQuestion) {
      ask(pendingQuestion)
      onConsumeQuestion?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion])

  const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  const toggleVoice = () => {
    if (!SpeechRecognition) return
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'fr-FR'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ')
      setInput(transcript)
      if (e.results[e.results.length - 1].isFinal) ask(transcript)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  const reset = () => setState({ api: [], bubbles: [] })
  const empty = state.bubbles.length === 0

  return (
    <div className="h-full flex flex-col">
      <ScreenHeader
        visual={<HeaderIcon icon={Sparkles} />}
        title="Assistant"
        subtitle="Réponses tirées des chiffres de la boutique"
        actions={
          <>
            {!empty && (
              <button type="button" onClick={reset} disabled={busy} aria-label="Nouvelle conversation" className="header-btn">
                <RotateCcw size={18} />
              </button>
            )}
            {onBack && (
              <button type="button" onClick={onBack} aria-label="Retour aux questions toutes prêtes" className="header-btn">
                <ChevronLeft size={20} />
              </button>
            )}
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4 -mt-3 space-y-3 relative">
        {empty && (
          <div className="card p-5 text-center">
            <span className="mx-auto icon-chip h-14 w-14 bg-blue-100 text-navy-500">
              <Sparkles size={26} />
            </span>
            <p className="mt-3 text-lg title-sm">Posez votre question</p>
            <p className="text-sm text-gray-500 mt-1">Ventes, bénéfice, dettes, stock, clients, factures… écrivez ou dictez.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((q) => (
                <button key={q} type="button" onClick={() => ask(q)} className="chip">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.bubbles.map((b, i) =>
          b.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-navy-700 text-white px-4 py-2.5 text-[15px] shadow-pill">{b.text}</p>
            </div>
          ) : b.role === 'assistant' ? (
            <div key={i} className="card px-5 py-4 text-[15px] leading-relaxed">
              <RichText text={b.text} />
            </div>
          ) : b.role === 'error' ? (
            <ErrorBox key={i} message={b.text} />
          ) : (
            <p key={i} className="text-center text-xs text-gray-500">{b.text}</p>
          )
        )}

        {busy && <TypingDots label="Je consulte les chiffres…" />}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        className="bg-white border-t border-gray-100 px-3 py-2.5 flex items-end gap-2"
      >
        {SpeechRecognition && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? 'Arrêter la dictée' : 'Dicter la question'}
            className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center transition ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-navy-700'}`}
          >
            {listening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        )}
        <textarea
          rows={1}
          className="input !rounded-3xl resize-none max-h-32"
          placeholder={listening ? 'Je vous écoute…' : 'Votre question…'}
          aria-label="Votre question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(input)
            }
          }}
        />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Envoyer" className="round-btn">
          <Send size={20} />
        </button>
      </form>
    </div>
  )
}
