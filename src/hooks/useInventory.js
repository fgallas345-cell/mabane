import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'

/** Historique des inventaires validés (le plus récent en premier) */
export function useInventories() {
  return useQuery({
    queryKey: ['inventories'],
    queryFn: () =>
      fetchAll(() =>
        supabase
          .from('inventories')
          .select('*, users!inventories_created_by_fkey(full_name)')
          .order('created_at', { ascending: false })
          .order('id')
      ),
  })
}

/** Lignes d'un inventaire */
export function useInventoryItems(inventoryId) {
  return useQuery({
    queryKey: ['inventories', 'items', inventoryId],
    enabled: Boolean(inventoryId),
    queryFn: () =>
      fetchAll(() =>
        supabase.from('inventory_items').select('*').eq('inventory_id', inventoryId).order('product_name').order('id')
      ),
  })
}

/** Valide un comptage : counts = [{ product_id, counted }] */
export function useApplyInventory() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async ({ counts, notes }) => {
      const { data, error } = await supabase.rpc('apply_inventory', { p_counts: counts, p_notes: notes || null })
      if (error) throw error
      return data
    },
    onSuccess: (inv) => {
      toast.success(`Inventaire ${inv.number} validé : ${inv.gaps_count} écart(s) corrigé(s).`)
      queryClient.invalidateQueries({ queryKey: ['inventories'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (error) => toast.error(error?.message || 'Erreur lors de la validation de l’inventaire.'),
  })
}
