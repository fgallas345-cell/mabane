import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const label = theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2.5 rounded-xl text-brand-900 dark:text-gray-200 hover:bg-white dark:hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
      title={label}
      aria-label={label}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
