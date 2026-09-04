import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

export function useSmallSales() {
  return useQuery({
    queryKey: ['small_sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('small_sales')
        .select('*, users(id, full_name), small_sale_items(*)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateSmallSale() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ userId, notes, discount, items }) => {
      const { data, error } = await supabase.rpc('create_small_sale', {
        p_user_id: userId || null,
        p_notes: notes || null,
        p_discount: discount || 0,
        p_items: items,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Petite vente enregistrée avec succès.')
      queryClient.invalidateQueries({ queryKey: ['small_sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de l’enregistrement de la petite vente.')
    },
  })
}

export function useUpdateSmallSale() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ saleId, notes, discount, items }) => {
      const { data, error } = await supabase.rpc('update_small_sale', {
        p_sale_id: saleId,
        p_notes: notes || null,
        p_discount: discount || 0,
        p_items: items,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Petite vente modifiée avec succès.')
      queryClient.invalidateQueries({ queryKey: ['small_sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour de la petite vente.')
    },
  })
}

export function useDeleteSmallSale() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (saleId) => {
      const { error } = await supabase.rpc('cancel_small_sale', {
        p_sale_id: saleId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Petite vente annulée et supprimée.')
      queryClient.invalidateQueries({ queryKey: ['small_sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la suppression de la petite vente.')
    },
  })
}
