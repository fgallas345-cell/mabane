// supabase/functions/manage-users/index.ts
//
// Création / suppression de comptes par un administrateur.
// La clé service_role reste côté serveur ; l'appelant doit être connecté ET avoir
// le rôle 'admin' dans public.users (vérifié ici, indépendamment de la RLS).
//
// Déploiement :
//   supabase functions deploy manage-users
// (SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont injectées automatiquement)
// Optionnel : supabase secrets set ALLOWED_ORIGIN=https://votre-domaine.com
//
// Appel depuis le frontend :
//   supabase.functions.invoke('manage-users', { body: { action: 'create', email, password, full_name, role } })
//   supabase.functions.invoke('manage-users', { body: { action: 'delete', user_id } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ROLES = ['admin', 'caissier', 'employe']

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Identifier l'appelant avec SON jeton
  const authHeader = req.headers.get('Authorization') ?? ''
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
  if (authError || !caller) return json({ error: 'Non authentifié' }, 401)

  // 2. Vérifier qu'il est admin (lecture avec la clé service pour ignorer la RLS)
  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin.from('users').select('role').eq('id', caller.id).maybeSingle()
  if (profile?.role !== 'admin') return json({ error: 'Réservé aux administrateurs' }, 403)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Corps JSON invalide' }, 400)
  }

  try {
    if (body.action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase()
      const password = String(body.password ?? '')
      const fullName = String(body.full_name ?? '').trim()
      const role = String(body.role ?? 'employe')
      if (!email || !fullName) return json({ error: 'Email et nom complet requis' }, 400)
      if (password.length < 6) return json({ error: 'Mot de passe : 6 caractères minimum' }, 400)
      if (!ALLOWED_ROLES.includes(role)) return json({ error: 'Rôle invalide' }, 400)

      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (error) return json({ error: error.message }, 400)

      // Le trigger a créé le profil en 'employe' : on applique le rôle choisi par l'admin
      const { error: roleError } = await admin.from('users').update({ role }).eq('id', data.user.id)
      if (roleError) return json({ error: roleError.message }, 400)

      return json({ ok: true, user_id: data.user.id })
    }

    if (body.action === 'delete') {
      const userId = String(body.user_id ?? '')
      if (!userId) return json({ error: 'user_id requis' }, 400)
      if (userId === caller.id) return json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, 400)

      // Ne jamais supprimer le dernier administrateur
      const { count } = await admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin')
      const { data: target } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
      if (target?.role === 'admin' && (count ?? 0) <= 1) {
        return json({ error: 'Impossible de supprimer le dernier administrateur' }, 400)
      }

      const { error } = await admin.auth.admin.deleteUser(userId) // cascade sur public.users
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
