import { QueryCache, QueryClient } from '@tanstack/react-query'

// Pont vers le ToastProvider : React Query est créé hors de l'arbre React,
// le provider enregistre son handler au montage (voir ToastContext).
let toastError = null
export function registerQueryErrorToast(fn) {
  toastError = fn
}

export const queryClient = new QueryClient({
  // Les callbacks onError ont été retirés de useQuery dans React Query v5 :
  // le QueryCache est le seul endroit où intercepter les erreurs de chargement.
  queryCache: new QueryCache({
    onError: (error, query) => {
      const label = Array.isArray(query.queryKey) ? String(query.queryKey[0]) : 'données'
      toastError?.(error?.message || `Erreur lors du chargement des ${label}.`)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
})
