import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

export function usePurchases() {
  return useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, suppliers(id, name, phone), purchase_items(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function usePurchase(purchaseId) {
  return useQuery({
    queryKey: ['purchases', purchaseId],
    enabled: !!purchaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('*, suppliers(id, name, phone), purchase_items(*)')
        .eq('id', purchaseId)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useCreatePurchase() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ supplierId, userId, amountPaid, notes, items }) => {
      const { data, error } = await supabase.rpc('create_purchase', {
        p_supplier_id: supplierId,
        p_user_id: userId || null,
        p_amount_paid: amountPaid || 0,
        p_notes: notes || null,
        p_items: items,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Achat enregistré avec succès.')
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de l’enregistrement de l’achat.')
    },
  })
}

export function useAddPurchasePayment() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ purchaseId, amount }) => {
      const { data, error } = await supabase.rpc('add_purchase_payment', {
        p_purchase_id: purchaseId,
        p_amount: amount,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Paiement ajouté avec succès.')
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de l’ajout du paiement.')
    },
  })
}

export function useCancelPurchase() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ purchaseId, userId }) => {
      const { error } = await supabase.rpc('cancel_purchase', {
        p_purchase_id: purchaseId,
        p_user_id: userId || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Achat annulé avec succès.')
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de l’annulation de l’achat.')
    },
  })
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ purchaseId, supplierId, notes }) => {
      const { data, error } = await supabase
        .from('purchases')
        .update({ supplier_id: supplierId || null, notes: notes || null })
        .eq('id', purchaseId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Achat mis à jour avec succès.')
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour de l’achat.')
    },
  })
}

export function useUpdatePurchaseItems() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ purchaseId, items }) => {
      const { data, error } = await supabase.rpc('update_purchase_items', {
        p_purchase_id: purchaseId,
        p_items: items,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Articles d’achat mis à jour.')
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour des articles d’achat.')
    },
  })
}

export function useDeletePurchase() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (purchaseId) => {
      const { error } = await supabase.from('purchases').delete().eq('id', purchaseId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Achat supprimé avec succès.')
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la suppression de l’achat.')
    },
  })
}
