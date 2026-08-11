import { useEffect, useState, useMemo, useRef } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'

const defaultOptionLabel = (option) => option.label
const defaultSearchText = (option) => option.searchText || option.label

export default function SearchableSelect({ value, onChange, options, placeholder, getOptionLabel = defaultOptionLabel, getSearchText = defaultSearchText, emptyMessage = 'Aucun résultat' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef(null)

  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value])

  useEffect(() => {
    setQuery(selectedOption ? getOptionLabel(selectedOption) : '')
  }, [selectedOption, getOptionLabel])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery || (selectedOption && query === getOptionLabel(selectedOption))) return options
    return options.filter((option) => getSearchText(option).toLowerCase().includes(normalizedQuery))
  }, [getOptionLabel, getSearchText, normalizedQuery, options, query, selectedOption])

  const visibleOptions = filteredOptions.slice(0, 80)

  const handleSelect = (option) => {
    if (option.disabled) return
    onChange(option.value)
    setQuery(getOptionLabel(option))
    setOpen(false)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        className="input pl-9 pr-9"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false)
            return
          }
          if (e.key !== 'Enter' || !open) return

          e.preventDefault()
          const firstAvailableOption = visibleOptions.find((option) => !option.disabled)
          if (firstAvailableOption) handleSelect(firstAvailableOption)
        }}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        onClick={() => setOpen((current) => !current)}
        aria-label="Afficher la liste"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">{emptyMessage}</p>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.value || 'empty-option'}
                  type="button"
                  disabled={option.disabled}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-45"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(option)}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-brand-600">
                    {option.value === value && <Check size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">{option.content || getOptionLabel(option)}</span>
                </button>
              ))
            )}
            {filteredOptions.length > visibleOptions.length && (
              <p className="px-3 py-2 text-xs text-gray-400">Affinez la recherche pour voir plus de résultats.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
