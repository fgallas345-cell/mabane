// supabase/functions/send-whatsapp/index.ts
//
// FONCTION EDGE OPTIONNELLE — Envoi WhatsApp 100% automatique côté serveur
// via l'API Meta WhatsApp Cloud (sans clic utilisateur, sans exposer de clé API au navigateur).
//
// Déploiement :
//   supabase functions deploy send-whatsapp
//   supabase secrets set WHATSAPP_TOKEN=xxxx WHATSAPP_PHONE_ID=xxxx
//   supabase secrets set ALLOWED_ORIGIN=https://votre-domaine.com   (optionnel, sinon *)
//
// Appel depuis le frontend (utilisateur connecté obligatoire) :
//   await supabase.functions.invoke('send-whatsapp', { body: { phone, message } })
//
// Prérequis : un compte Meta for Developers avec un numéro WhatsApp Business configuré.
// Documentation : https://developers.facebook.com/docs/whatsapp/cloud-api

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID')

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  // Seul un utilisateur connecté de l'application peut envoyer des messages
  // depuis le numéro de la boutique (sinon la fonction devient un relais de spam).
  const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user }, error: authError } = await callerClient.auth.getUser()
  if (authError || !user) return json({ error: 'Non authentifié' }, 401)

  try {
    const { phone, message } = await req.json()

    if (typeof phone !== 'string' || !/^\d{8,15}$/.test(phone) || typeof message !== 'string' || !message.trim()) {
      return json({ error: 'phone (chiffres uniquement) et message requis' }, 400)
    }

    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
      return json({ error: 'WHATSAPP_TOKEN / WHATSAPP_PHONE_ID non configurés côté serveur' }, 500)
    }

    const response = await fetch(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message.slice(0, 4096) },
      }),
    })

    const result = await response.json()
    return json(result, response.ok ? 200 : 502)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
