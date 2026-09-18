import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

// Les comptes sont créés / supprimés par l'Edge Function `manage-users`
// (clé service_role côté serveur, appelant vérifié admin).
async function callManageUsers(body) {
  const { data, error } = await supabase.functions.invoke('manage-users', { body })
  if (error) {
    // supabase-js masque le corps de la réponse en cas de statut d'erreur : on le relit
    let message = error.message
    try {
      const payload = await error.context?.json?.()
      if (payload?.error) message = payload.error
    } catch {
      // corps illisible : on garde le message générique
    }
    throw new Error(message || 'Erreur lors de l’appel à manage-users.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ email, password, fullName, role }) =>
      callManageUsers({ action: 'create', email, password, full_name: fullName, role }),
    onSuccess: () => {
      toast.success('Compte créé avec succès.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => toast.error(error?.message || 'Erreur lors de la création du compte.'),
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: (userId) => callManageUsers({ action: 'delete', user_id: userId }),
    onSuccess: () => {
      toast.success('Compte supprimé.')
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error) => toast.error(error?.message || 'Erreur lors de la suppression du compte.'),
  })
}
