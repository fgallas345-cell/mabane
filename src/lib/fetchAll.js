// PostgREST plafonne chaque réponse (1000 lignes par défaut) : au-delà, les données
// seraient tronquées sans erreur. fetchAll relit la requête page par page.
const PAGE_SIZE = 1000

/**
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} buildQuery
 *   fonction qui renvoie une NOUVELLE requête (select + filtres + order) à chaque appel
 */
export async function fetchAll(buildQuery) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}
