import { useEffect, useState, useMemo, useRef } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'

const defaultOptionLabel = (option) => option.label
const defaultSearchText = (option) => option.searchText || option.label

/**
 * Liste déroulante avec recherche.
 * - flèches ↑ ↓ pour parcourir, Entrée pour choisir, Échap pour fermer
 * - clearOnSelect : le champ se vide après le choix (ajout rapide de produits à un panier)
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  getOptionLabel = defaultOptionLabel,
  getSearchText = defaultSearchText,
  emptyMessage = 'Aucun résultat',
  clearOnSelect = false,
  autoFocus = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapperRef = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const skipOpenOnFocus = useRef(false)

  // Focus automatique : curseur prêt dans le champ, mais la liste ne s'ouvre qu'au premier
  // caractère tapé (elle ne masque pas l'écran). Pas de focus auto sur écran tactile (clavier).
  useEffect(() => {
    if (!autoFocus) return
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
    if (touch) return
    skipOpenOnFocus.current = true
    inputRef.current?.focus()
  }, [autoFocus])

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
    // tous les mots saisis doivent apparaître (« ciment 50 » trouve « Ciment CPJ 50kg »)
    const words = normalizedQuery.split(/\s+/)
    return options.filter((option) => {
      const text = getSearchText(option).toLowerCase()
      return words.every((word) => text.includes(word))
    })
  }, [getOptionLabel, getSearchText, normalizedQuery, options, query, selectedOption])

  const visibleOptions = filteredOptions.slice(0, 80)

  useEffect(() => {
    // surligne la première option disponible quand la liste change
    const first = visibleOptions.findIndex((option) => !option.disabled)
    setActiveIndex(first === -1 ? 0 : first)
  }, [normalizedQuery, open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const handleSelect = (option) => {
    if (option.disabled) return
    onChange(option.value)
    setQuery(clearOnSelect ? '' : getOptionLabel(option))
    setOpen(false)
  }

  const move = (step) => {
    if (visibleOptions.length === 0) return
    let i = activeIndex
    for (let n = 0; n < visibleOptions.length; n++) {
      i = (i + step + visibleOptions.length) % visibleOptions.length
      if (!visibleOptions[i].disabled) break
    }
    setActiveIndex(i)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-900/70 dark:text-gray-400 pointer-events-none" />
      <input
        type="text"
        className="input pl-10 pr-10"
        value={query}
        placeholder={placeholder}
        ref={inputRef}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        onFocus={(e) => {
          if (skipOpenOnFocus.current) skipOpenOnFocus.current = false
          else setOpen(true)
          e.target.select()
        }}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            if (open) e.stopPropagation() // ferme la liste sans fermer la fenêtre
            setOpen(false)
            return
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) setOpen(true)
            else move(e.key === 'ArrowDown' ? 1 : -1)
            return
          }
          if (e.key !== 'Enter' || !open) return

          e.preventDefault()
          const option = visibleOptions[activeIndex]
          if (option && !option.disabled) handleSelect(option)
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        onClick={() => setOpen((current) => !current)}
        aria-label="Afficher la liste"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-darkcard shadow-lift animate-fade-in">
          <div className="max-h-64 overflow-y-auto p-1.5" ref={listRef} role="listbox">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">{emptyMessage}</p>
            ) : (
              visibleOptions.map((option, index) => (
                <button
                  key={option.value || 'empty-option'}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  data-active={index === activeIndex}
                  disabled={option.disabled}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-45 ${
                    index === activeIndex ? 'bg-blue-50 dark:bg-blue-500/15' : 'hover:bg-gray-50 dark:hover:bg-white/[0.06]'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                  onClick={() => handleSelect(option)}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-[#1d4fb8] dark:text-blue-300">
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
