import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'

/**
 * Generic hook factory to read/write a Supabase table with React Query.
 * @param {string} table - table name
 * @param {string} selectQuery - columns / relations to select
 * @param {object} options - { orderBy, ascending, filters }
 */
export function useSupabaseTable(table, selectQuery = '*', options = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { orderBy = 'created_at', ascending = false } = options

  const listQuery = useQuery({
    queryKey: [table, selectQuery, orderBy, ascending],
    queryFn: async () => {
      let query = supabase.from(table).select(selectQuery).order(orderBy, { ascending })
      const { data, error } = await query
      if (error) throw error
      return data
    },
   onError: (error) => {
      toast.error(error?.message || `Erreur lors du chargement des ${table}.`)
    },
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [table] })

  const createItem = useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from(table).insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Enregistrement créé avec succès.')
      invalidate()
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la création de l’enregistrement.')
    },
  })

  const updateItem = useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Enregistrement mis à jour avec succès.')
      invalidate()
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la mise à jour de l’enregistrement.')
    },
  })

  const deleteItem = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: () => {
      toast.success('Suppression effectuée.')
      invalidate()
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de la suppression de l’enregistrement.')
    },
  })

  return { ...listQuery, createItem, updateItem, deleteItem, invalidate }
}
