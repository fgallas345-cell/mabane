import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Numéros affichés : 1 2 3 … 23 (la page courante et ses voisines restent visibles) */
export function pageNumbers(current, total) {
  const set = new Set([1, total, current - 1, current, current + 1])
  if (current <= 3) [2, 3].forEach((n) => set.add(n))
  if (current >= total - 2) [total - 1, total - 2].forEach((n) => set.add(n))
  const pages = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out = []
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push(`gap-${n}`)
    out.push(n)
  })
  return out
}

/**
 * Pagination numérotée. Avec `totalItems` et `pageSize`, affiche « Affichage de 1 à 10 sur N <itemLabel> ».
 */
export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize, itemLabel = 'éléments' }) {
  if (totalPages <= 1 && totalItems == null) return null
  const btn = 'h-9 min-w-9 px-2.5 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const idle = 'border border-gray-200 dark:border-white/10 text-brand-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.06]'
  const summary =
    totalItems != null && pageSize
      ? `Affichage de ${totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} à ${Math.min(currentPage * pageSize, totalItems)} sur ${totalItems} ${itemLabel}`
      : `Page ${currentPage} sur ${totalPages}`

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-white/[0.06]">
      <p className="text-sm text-gray-600 dark:text-gray-400">{summary}</p>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Pagination">
          <button type="button" aria-label="Page précédente" className={`${btn} ${idle}`} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            <ChevronLeft size={16} />
          </button>
          {pageNumbers(currentPage, totalPages).map((n) =>
            typeof n === 'string' ? (
              <span key={n} className="px-1 text-gray-400">…</span>
            ) : (
              <button
                key={n}
                type="button"
                aria-current={n === currentPage ? 'page' : undefined}
                className={`${btn} ${n === currentPage ? 'bg-[#1d4fb8] text-white shadow-sm' : idle}`}
                onClick={() => onPageChange(n)}
              >
                {n}
              </button>
            )
          )}
          <button type="button" aria-label="Page suivante" className={`${btn} ${idle}`} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  )
}
