import { supabase } from './supabase'

/**
 * Appelle la fonction serveur « patron-assistant » (lecture seule, réservée à l'administrateur).
 * Renvoie le JSON de la réponse, ou lève une erreur avec un message lisible.
 */
export async function callPatron(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('patron-assistant', { body: { action, ...payload } })
  if (error) {
    let message = error.message
    try {
      const body = await error.context?.json?.()
      if (body?.error) message = body.error
    } catch {
      /* corps illisible : on garde le message générique */
    }
    if (/Failed to send a request|FunctionsFetchError/i.test(message)) {
      message = 'Connexion impossible : vérifiez votre réseau.'
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export const fcfa = (v) => `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(v) || 0)).replace(/ | /g, ' ')} FCFA`

export const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : null)

/** « lundi 24 novembre 2026 » */
export const longDate = (d = new Date()) =>
  d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
