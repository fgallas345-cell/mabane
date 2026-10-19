import { useEffect } from 'react'

// Appelle onOutside quand on clique en dehors de l'élément (ou qu'on appuie sur Échap).
export function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside()
    }
    const onKey = (e) => e.key === 'Escape' && onOutside()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, onOutside, active])
}
