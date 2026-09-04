import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabase'
import { SHOP, syncShopSettings } from '../lib/constants'

// Valeurs de repli tant que les paramètres n'ont pas encore été chargés depuis la base
export const DEFAULT_SHOP_SETTINGS = {
  name: SHOP.name,
  owner: SHOP.owner,
  address: SHOP.address,
  location: SHOP.location,
  activities: SHOP.activities,
  phone1: SHOP.phones[0] || '',
  phone2: SHOP.phones[1] || '',
  phone3: SHOP.phones[2] || '',
  low_stock_default_threshold: 5,
}

export function useShopSettings() {
  return useQuery({
    queryKey: ['shop_settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shop_settings').select('*').eq('id', true).maybeSingle()
      if (error) throw error
      syncShopSettings(data)
      return data || DEFAULT_SHOP_SETTINGS
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateShopSettings() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('shop_settings')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', true)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      syncShopSettings(data)
      queryClient.setQueryData(['shop_settings'], data)
      toast.success('Paramètres enregistrés avec succès.')
    },
    onError: (error) => {
      toast.error(error?.message || 'Erreur lors de l’enregistrement des paramètres.')
    },
  })
}
