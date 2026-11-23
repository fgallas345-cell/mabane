import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { fetchAll } from '../lib/fetchAll'
import { computeReport } from '../utils/reports'

/** Rapport d'activité sur [from, to[ (dates JS) */
export function useReport(from, to) {
  return useQuery({
    queryKey: ['reports', from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const f = from.toISOString()
      const t = to.toISOString()
      const [sales, smallSales, payments, expenses, products, categories, users] = await Promise.all([
        fetchAll(() =>
          supabase
            .from('sales')
            .select('id, created_at, total, discount, amount_paid, client_id, user_id, clients(name), sale_items(product_id, product_name, quantity, unit_price, purchase_price, line_total)')
            .gte('created_at', f)
            .lt('created_at', t)
            .neq('status', 'annulee')
            .eq('quote_status', 'confirmed')
            .order('id')
        ),
        fetchAll(() =>
          supabase
            .from('small_sales')
            .select('id, created_at, total, discount, user_id, small_sale_items(product_id, product_name, quantity, unit_price, purchase_price, line_total)')
            .gte('created_at', f)
            .lt('created_at', t)
            .is('cancelled_at', null)
            .order('id')
        ),
        fetchAll(() => supabase.from('payments').select('id, amount, method').gte('created_at', f).lt('created_at', t).order('id')),
        fetchAll(() => supabase.from('expenses').select('id, amount, category').gte('created_at', f).lt('created_at', t).order('id')),
        fetchAll(() => supabase.from('products').select('id, category_id').order('id')),
        fetchAll(() => supabase.from('categories').select('id, name').order('id')),
        fetchAll(() => supabase.from('users').select('id, full_name').order('id')),
      ])
      return computeReport({ sales, smallSales, payments, expenses, products, categories, users, from, to })
    },
    staleTime: 60 * 1000,
  })
}
