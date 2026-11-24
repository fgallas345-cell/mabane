import { Fragment } from 'react'
import { BarChart3 } from 'lucide-react'

const bold = (line) =>
  line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-extrabold">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  )

/**
 * Mise en forme des réponses :
 * - 1re ligne entièrement en gras → titre avec icône
 * - « - … » → puce orange ; « --- » → séparateur ; ligne finissant par « : » → sous-titre
 * - **…** → gras
 */
export default function RichText({ text }) {
  const lines = String(text).split('\n')
  let titleDone = false
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-1" />
        if (!titleDone && /^\*\*[^*]+\*\*.?$/.test(trimmed)) {
          titleDone = true
          return (
            <p key={i} className="flex items-center gap-2.5 pb-1 text-[16px] font-extrabold text-navy-900">
              <span className="h-9 w-9 shrink-0 rounded-xl bg-blue-50 text-[#1d4fb8] flex items-center justify-center"><BarChart3 size={18} /></span>
              <span>{trimmed.replace(/\*\*/g, '')}</span>
            </p>
          )
        }
        titleDone = true
        if (trimmed === '---') return <hr key={i} className="border-gray-200 my-2" />
        if (/^[-•*]\s+/.test(trimmed)) {
          return (
            <p key={i} className="flex gap-2.5 text-navy-900">
              <span className="mt-[9px] h-2 w-2 shrink-0 rounded-full bg-accent-500" />
              <span>{bold(trimmed.replace(/^[-•*]\s+/, ''))}</span>
            </p>
          )
        }
        if (/^#{1,6}\s+/.test(trimmed) || /:\s*$/.test(trimmed)) {
          return <p key={i} className="pt-1 font-extrabold text-navy-900">{bold(trimmed.replace(/^#{1,6}\s+/, ''))}</p>
        }
        return <p key={i} className="text-navy-900">{bold(trimmed)}</p>
      })}
    </div>
  )
}
