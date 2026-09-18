import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// Filet de sécurité global : évite l'écran blanc si un composant lève une exception.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erreur non gérée dans l’interface', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-darkbg px-4">
        <div className="card p-6 max-w-md w-full text-center space-y-4">
          <div className="inline-flex p-3 rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle size={28} />
          </div>
          <h1 className="text-lg font-semibold">Une erreur est survenue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 break-words">
            {this.state.error?.message || 'Erreur inconnue.'}
          </p>
          <button className="btn-primary w-full" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Recharger la page
          </button>
        </div>
      </div>
    )
  }
}
