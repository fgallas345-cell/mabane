import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

export function useSales() {
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, clients(id, name, phone), sale_items(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useSale(saleId) {
  return useQuery({
    queryKey: ['sales', saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*, clients(id, name, phone), sale_items(*)')
        .eq('id', saleId)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ clientId, userId, discount, items, amountPaid }) => {
      const { data, error } = await supabase.rpc('create_sale', {
        p_client_id: clientId || null,
        p_user_id: userId || null,
        p_discount: discount || 0,
        p_items: items,
        p_amount_paid: amountPaid === undefined || amountPaid === null ? null : amountPaid,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Vente créée avec succès.')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la création de la vente.')
    },
  })
}

export function useAddSalePayment() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ saleId, amount }) => {
      const { data, error } = await supabase.rpc('add_sale_payment', {
        p_sale_id: saleId,
        p_amount: amount,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Paiement ajouté avec succès.')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de l’ajout du paiement.')
    },
  })
}

export function useCancelSale() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ saleId, userId }) => {
      const { error } = await supabase.rpc('cancel_sale', {
        p_sale_id: saleId,
        p_user_id: userId || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Vente annulée avec succès.')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de l’annulation de la vente.')
    },
  })
}

export function useStockMovements() {
  return useQuery({
    queryKey: ['stock_movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*, products(id, name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
  })
}

export function useAddStockEntry() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ productId, quantity, reason, userId }) => {
      const { error } = await supabase.rpc('add_stock_entry', {
        p_product_id: productId,
        p_quantity: quantity,
        p_reason: reason,
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Stock mis à jour avec succès.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour du stock.')
    },
  })
}

export function useUpdateStockMovement() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ movementId, productId, type, quantity, reason, userId }) => {
      const { error } = await supabase.rpc('update_stock_movement', {
        p_movement_id: movementId,
        p_product_id: productId,
        p_quantity: quantity,
        p_reason: reason,
        p_type: type,
        p_user_id: userId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Mouvement de stock mis à jour.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour du mouvement de stock.')
    },
  })
}

export function useDeleteStockMovement() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (movementId) => {
      const { error } = await supabase.rpc('delete_stock_movement', {
        p_movement_id: movementId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Mouvement de stock supprimé.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la suppression du mouvement de stock.')
    },
  })
}

export function useUpdateSale() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ saleId, clientId, discount }) => {
      const { data, error } = await supabase
        .from('sales')
        .update({ client_id: clientId || null, discount: discount || 0 })
        .eq('id', saleId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Facture mise à jour avec succès.')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour de la facture.')
    },
  })
}

export function useUpdateSaleItems() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ saleId, items }) => {
      const { data, error } = await supabase.rpc('update_sale_items', {
        p_sale_id: saleId,
        p_items: items,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Articles de facture mis à jour.')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour des articles de facture.')
    },
  })
}

export function useDeleteSale() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (saleId) => {
      const { error } = await supabase.from('sales').delete().eq('id', saleId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Facture supprimée avec succès.')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la suppression de la facture.')
    },
  })
}
