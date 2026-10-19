import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700/60">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Page {currentPage} sur {totalPages}
      </p>
      <div className="inline-flex items-center divide-x divide-gray-200 dark:divide-gray-700/60 rounded-lg border border-gray-200 dark:border-gray-700/60 overflow-hidden">
        <button
          type="button"
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Page précédente"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Page suivante"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
