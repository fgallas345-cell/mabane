import { createClient } from '@supabase/supabase-js'

// Même projet Supabase que l'application de la boutique (mêmes variables d'environnement)
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Variables VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes (fichier .env du dossier patron).')
}

export const supabase = createClient(url || '', anonKey || '', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mabane-patron-auth' },
})
