import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'

// Dépôts clients : argent confié par un client, utilisé plus tard pour acheter ou retiré.
// Toutes les écritures passent par des RPC (solde contrôlé et verrouillé côté base).

/** Solde de chaque client ayant un historique : Map client_id → { balance, last_operation_at, operations } */
export function useDepositBalances() {
  return useQuery({
    queryKey: ['client_deposits', 'balances'],
    queryFn: async () => {
      const rows = await fetchAll(() =>
        supabase.from('client_deposit_balances').select('*').order('client_id')
      )
      return new Map(
        rows.map((r) => [
          r.client_id,
          { balance: Number(r.balance || 0), lastOperationAt: r.last_operation_at, operations: Number(r.operations || 0) },
        ])
      )
    },
  })
}

/** Historique complet d'un client, du plus ancien au plus récent (comme le carnet) */
export function useClientDepositHistory(clientId) {
  return useQuery({
    queryKey: ['client_deposits', 'history', clientId],
    enabled: Boolean(clientId),
    queryFn: () =>
      fetchAll(() =>
        supabase
          .from('client_deposits')
          .select('*, sales(invoice_number)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
      ),
  })
}

/** Opérations depuis une date (statistiques du mois) */
export function useDepositOperationsSince(since) {
  return useQuery({
    queryKey: ['client_deposits', 'since', since],
    queryFn: () =>
      fetchAll(() =>
        supabase
          .from('client_deposits')
          .select('id, type, amount, created_at')
          .gte('created_at', since)
          .order('created_at')
          .order('id')
      ),
  })
}

function invalidateDeposits(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['client_deposits'] })
}

function useDepositMutation(rpc, successMessage, errorMessage) {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ clientId, amount, method, notes }) => {
      const { data, error } = await supabase.rpc(rpc, {
        p_client_id: clientId,
        p_amount: amount,
        p_method: method || 'especes',
        p_notes: notes || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success(successMessage)
      invalidateDeposits(queryClient)
    },
    onError: (error) => toast.error(error?.message || errorMessage),
  })
}

export function useAddClientDeposit() {
  return useDepositMutation('add_client_deposit', 'Dépôt enregistré.', 'Erreur lors de l’enregistrement du dépôt.')
}

export function useWithdrawClientDeposit() {
  return useDepositMutation('withdraw_client_deposit', 'Retrait enregistré.', 'Erreur lors de l’enregistrement du retrait.')
}

/** Admin : annule un dépôt / retrait saisi par erreur (ajoute une ligne de correction) */
export function useReverseClientDeposit() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ entryId, reason }) => {
      const { data, error } = await supabase.rpc('reverse_client_deposit', {
        p_entry_id: entryId,
        p_reason: reason || null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Opération annulée (ligne de correction ajoutée).')
      invalidateDeposits(queryClient)
    },
    onError: (error) => toast.error(error?.message || 'Erreur lors de l’annulation de l’opération.'),
  })
}
