import { Fragment } from 'react'

/** Mise en forme légère des réponses : listes « - » et gras **…** */
export default function RichText({ text }) {
  const lines = String(text).split('\n')
  const bold = (line) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
    )
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-1" />
        if (/^[-•*]\s+/.test(trimmed)) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-accent-500 font-bold">•</span>
              <span>{bold(trimmed.replace(/^[-•*]\s+/, ''))}</span>
            </p>
          )
        }
        if (/^#{1,6}\s+/.test(trimmed)) return <p key={i} className="font-bold">{bold(trimmed.replace(/^#{1,6}\s+/, ''))}</p>
        return <p key={i}>{bold(trimmed)}</p>
      })}
    </div>
  )
}
