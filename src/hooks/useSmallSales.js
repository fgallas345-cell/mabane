import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
      queryClient.invalidateQueries({ queryKey: ['small_sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateSmallSale() {
  const queryClient = useQueryClient()
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
      queryClient.invalidateQueries({ queryKey: ['small_sales'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteSmallSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (saleId) => {
      const { error } = await supabase.from('small_sales').delete().eq('id', saleId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['small_sales'] })
    },
  })
}
