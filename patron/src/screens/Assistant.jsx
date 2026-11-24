import { useEffect, useRef, useState } from 'react'
import { Send, Mic, MicOff, Sparkles, RotateCcw, AlertCircle } from 'lucide-react'
import { callPatron, longDate } from '../lib/api'
import RichText from '../lib/RichText'

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

export default function Assistant({ pendingQuestion, onConsumeQuestion }) {
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
      <header className="safe-top bg-white border-b border-gray-200/80 px-4">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-navy-700 text-white flex items-center justify-center"><Sparkles size={20} /></span>
            <div>
              <h1 className="font-extrabold leading-tight">Assistant</h1>
              <p className="text-xs text-gray-500">Réponses tirées des chiffres de la boutique</p>
            </div>
          </div>
          {!empty && (
            <button type="button" onClick={reset} disabled={busy} className="btn-soft !px-3 !py-2 text-xs">
              <RotateCcw size={15} /> Nouvelle
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {empty && (
          <div className="pt-6 text-center">
            <span className="mx-auto h-16 w-16 rounded-3xl bg-gradient-to-br from-navy-600 to-navy-800 text-white flex items-center justify-center shadow-lg">
              <Sparkles size={30} />
            </span>
            <p className="mt-4 text-lg font-extrabold">Posez votre question</p>
            <p className="text-sm text-gray-500 mt-1 px-6">Ventes, bénéfice, dettes, stock, clients, factures… écrivez ou dictez.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium shadow-card active:bg-blue-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.bubbles.map((b, i) =>
          b.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-navy-700 text-white px-4 py-2.5 text-[15px]">{b.text}</p>
            </div>
          ) : b.role === 'assistant' ? (
            <div key={i} className="flex justify-start">
              <div className="max-w-[92%] rounded-3xl rounded-bl-lg bg-white border border-gray-200/80 shadow-card px-4 py-3 text-[15px] leading-relaxed">
                <RichText text={b.text} />
              </div>
            </div>
          ) : b.role === 'error' ? (
            <div key={i} className="flex justify-start">
              <p className="max-w-[92%] rounded-3xl rounded-bl-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm flex gap-2">
                <AlertCircle size={17} className="shrink-0 mt-0.5" /> {b.text}
              </p>
            </div>
          ) : (
            <p key={i} className="text-center text-xs text-gray-500">{b.text}</p>
          )
        )}

        {busy && (
          <div className="flex justify-start">
            <div className="rounded-3xl rounded-bl-lg bg-white border border-gray-200/80 px-4 py-3 flex items-center gap-1.5" aria-label="L'assistant réfléchit">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-2 w-2 rounded-full bg-navy-500 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
              ))}
              <span className="ml-2 text-xs text-gray-500">Je consulte les chiffres…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
        className="bg-white border-t border-gray-200/80 px-3 py-2.5 flex items-end gap-2"
      >
        {SpeechRecognition && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? 'Arrêter la dictée' : 'Dicter la question'}
            className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-navy-700'}`}
          >
            {listening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        )}
        <textarea
          rows={1}
          className="input !py-3 resize-none max-h-32"
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
        <button type="submit" disabled={busy || !input.trim()} aria-label="Envoyer" className="h-12 w-12 shrink-0 rounded-2xl bg-accent-500 text-navy-900 flex items-center justify-center disabled:opacity-40">
          <Send size={20} />
        </button>
      </form>
    </div>
  )
}
