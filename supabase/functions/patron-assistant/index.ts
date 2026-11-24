// supabase/functions/patron-assistant/index.ts
//
// Service de l'application mobile « Mabane Patron » (réservée aux administrateurs).
// Toutes les lectures se font avec le jeton de l'appelant (RLS appliquée) et sont en
// LECTURE SEULE : cette fonction ne crée, ne modifie et ne supprime jamais rien.
//
// Actions (POST, corps JSON) :
//   { action: 'kpis' }                       → chiffres de l'écran d'accueil
//   { action: 'alertes' }                    → stock faible, dettes, factures impayées anciennes
//   { action: 'chat', messages: [...] }      → assistant IA (Claude) avec outils de lecture
//
// Déploiement :
//   supabase functions deploy patron-assistant
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont injectées automatiquement)
// Optionnel : supabase secrets set ALLOWED_ORIGIN=https://mabane-patron.vercel.app

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const MODEL = 'claude-opus-5-5'
const MAX_TOOL_ROUNDS = 8
const MAX_HISTORY_MESSAGES = 80

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// ---------------------------------------------------------------------------
// Utilitaires de dates (Dakar = UTC+0, pas d'heure d'été)
// ---------------------------------------------------------------------------
const DAY = 86_400_000
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))

/** « AAAA-MM-JJ » inclusifs → bornes [début, fin[ en ISO */
function range(du?: string, au?: string) {
  const today = startOfDay(new Date())
  const from = du && /^\d{4}-\d{2}-\d{2}$/.test(du) ? new Date(`${du}T00:00:00Z`) : today
  const toDay = au && /^\d{4}-\d{2}-\d{2}$/.test(au) ? new Date(`${au}T00:00:00Z`) : today
  return { from: from.toISOString(), to: new Date(toDay.getTime() + DAY).toISOString(), du: isoDay(from), au: isoDay(toDay) }
}

const n = (v: unknown) => Number(v ?? 0) || 0
const round = (v: number) => Math.round(v)

/** Lecture paginée (PostgREST limite à 1000 lignes par requête) */
// deno-lint-ignore no-explicit-any
async function fetchAll(build: () => any): Promise<any[]> {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

// ---------------------------------------------------------------------------
// Calculs (mêmes règles que l'application : factures confirmées et non annulées)
// ---------------------------------------------------------------------------
async function resumePeriode(db: SupabaseClient, du?: string, au?: string) {
  const r = range(du, au)
  const [sales, smallSales, payments, expenses] = await Promise.all([
    fetchAll(() =>
      db.from('sales')
        .select('id, total, discount, created_at, sale_items(quantity, unit_price, purchase_price)')
        .gte('created_at', r.from).lt('created_at', r.to)
        .neq('status', 'annulee').eq('quote_status', 'confirmed').order('id'),
    ),
    fetchAll(() =>
      db.from('small_sales')
        .select('id, total, discount, created_at, small_sale_items(quantity, unit_price, purchase_price)')
        .gte('created_at', r.from).lt('created_at', r.to)
        .is('cancelled_at', null).order('id'),
    ),
    fetchAll(() => db.from('payments').select('amount, method').gte('created_at', r.from).lt('created_at', r.to).order('id')),
    fetchAll(() => db.from('expenses').select('amount').gte('created_at', r.from).lt('created_at', r.to).order('id')),
  ])
  const margin = (items: { quantity: number; unit_price: number; purchase_price: number }[]) =>
    (items ?? []).reduce((s, it) => s + (n(it.unit_price) - n(it.purchase_price)) * n(it.quantity), 0)
  const factures = sales.reduce((s, x) => s + n(x.total), 0)
  const caisse = smallSales.reduce((s, x) => s + n(x.total), 0)
  const encaisseFactures = payments.reduce((s, p) => s + n(p.amount), 0)
  const remises = sales.reduce((s, x) => s + n(x.discount), 0) + smallSales.reduce((s, x) => s + n(x.discount), 0)
  const margeBrute =
    sales.reduce((s, x) => s + margin(x.sale_items), 0) + smallSales.reduce((s, x) => s + margin(x.small_sale_items), 0) - remises
  const depenses = expenses.reduce((s, e) => s + n(e.amount), 0)
  const parMode: Record<string, number> = {}
  payments.forEach((p) => (parMode[p.method] = (parMode[p.method] ?? 0) + n(p.amount)))
  return {
    periode: { du: r.du, au: r.au },
    chiffre_affaires: round(factures + caisse),
    factures: { nombre: sales.length, montant: round(factures) },
    caisse_rapide: { nombre: smallSales.length, montant: round(caisse) },
    encaisse: round(encaisseFactures + caisse),
    encaisse_par_mode_factures: Object.fromEntries(Object.entries(parMode).map(([k, v]) => [k, round(v)])),
    remises: round(remises),
    marge_brute: round(margeBrute),
    depenses: round(depenses),
    benefice: round(margeBrute - depenses),
    devise: 'FCFA',
  }
}

async function dettesClients(db: SupabaseClient, limite = 20) {
  const open = await fetchAll(() =>
    db.from('sales')
      .select('invoice_number, total, amount_paid, created_at, client_id, clients(name, phone)')
      .in('status', ['credit', 'partielle']).eq('quote_status', 'confirmed').order('id'),
  )
  const byClient = new Map<string, { client: string; telephone: string | null; reste: number; factures: number; plus_ancienne: string }>()
  let total = 0
  for (const s of open) {
    const due = Math.max(0, n(s.total) - n(s.amount_paid))
    if (due <= 0) continue
    total += due
    const key = s.client_id ?? 'comptoir'
    const cur = byClient.get(key) ?? { client: s.clients?.name ?? 'Client comptoir', telephone: s.clients?.phone ?? null, reste: 0, factures: 0, plus_ancienne: s.created_at }
    cur.reste += due
    cur.factures += 1
    if (s.created_at < cur.plus_ancienne) cur.plus_ancienne = s.created_at
    byClient.set(key, cur)
  }
  const liste = [...byClient.values()].sort((a, b) => b.reste - a.reste)
  return {
    total_du: round(total),
    nombre_clients: liste.length,
    clients: liste.slice(0, Math.min(50, Math.max(1, limite))).map((c) => ({ ...c, reste: round(c.reste), plus_ancienne: c.plus_ancienne.slice(0, 10) })),
    devise: 'FCFA',
  }
}

async function stock(db: SupabaseClient, filtre = 'faible', recherche = '') {
  let q = db.from('products').select('name, stock, alert_threshold, sale_price, purchase_price, unit').order('name')
  if (filtre === 'recherche' && recherche) q = q.ilike('name', `%${recherche}%`)
  const rows = await fetchAll(() => q)
  const list = rows.filter((p) =>
    filtre === 'rupture' ? n(p.stock) <= 0 : filtre === 'faible' ? n(p.stock) <= n(p.alert_threshold) : true,
  )
  return {
    filtre,
    nombre: list.length,
    valeur_stock_achat_catalogue: filtre === 'tout' ? round(rows.reduce((s, p) => s + Math.max(0, n(p.stock)) * n(p.purchase_price), 0)) : undefined,
    produits: list
      .sort((a, b) => n(a.stock) - n(b.stock))
      .slice(0, 60)
      .map((p) => ({ produit: p.name, stock: n(p.stock), seuil: n(p.alert_threshold), unite: p.unit, prix_vente: n(p.sale_price) })),
  }
}

async function meilleuresVentes(db: SupabaseClient, du?: string, au?: string, limite = 10) {
  const r = range(du, au)
  const [items, smallItems] = await Promise.all([
    fetchAll(() =>
      db.from('sale_items')
        .select('product_name, quantity, line_total, unit_price, purchase_price, sales!inner(created_at, status, quote_status)')
        .gte('sales.created_at', r.from).lt('sales.created_at', r.to)
        .neq('sales.status', 'annulee').eq('sales.quote_status', 'confirmed').order('id'),
    ),
    fetchAll(() =>
      db.from('small_sale_items')
        .select('product_name, quantity, line_total, unit_price, purchase_price, small_sales!inner(created_at, cancelled_at)')
        .gte('small_sales.created_at', r.from).lt('small_sales.created_at', r.to)
        .is('small_sales.cancelled_at', null).order('id'),
    ),
  ])
  const map = new Map<string, { produit: string; quantite: number; chiffre_affaires: number; marge: number }>()
  for (const it of [...items, ...smallItems]) {
    const cur = map.get(it.product_name) ?? { produit: it.product_name, quantite: 0, chiffre_affaires: 0, marge: 0 }
    cur.quantite += n(it.quantity)
    cur.chiffre_affaires += n(it.line_total)
    cur.marge += (n(it.unit_price) - n(it.purchase_price)) * n(it.quantity)
    map.set(it.product_name, cur)
  }
  return {
    periode: { du: r.du, au: r.au },
    produits: [...map.values()]
      .sort((a, b) => b.chiffre_affaires - a.chiffre_affaires)
      .slice(0, Math.min(30, Math.max(1, limite)))
      .map((p) => ({ ...p, chiffre_affaires: round(p.chiffre_affaires), marge: round(p.marge) })),
    devise: 'FCFA',
  }
}

async function chercherClient(db: SupabaseClient, nom: string) {
  const { data: clients, error } = await db.from('clients').select('id, name, phone, address').ilike('name', `%${nom}%`).limit(5)
  if (error) throw new Error(error.message)
  const out = []
  for (const c of clients ?? []) {
    const [sales, deposits] = await Promise.all([
      fetchAll(() =>
        db.from('sales').select('invoice_number, total, amount_paid, status, quote_status, created_at')
          .eq('client_id', c.id).order('created_at', { ascending: false }),
      ),
      db.from('client_deposits').select('balance_after').eq('client_id', c.id).order('created_at', { ascending: false }).limit(1),
    ])
    const counted = sales.filter((s) => s.status !== 'annulee' && s.quote_status === 'confirmed')
    out.push({
      client: c.name,
      telephone: c.phone,
      adresse: c.address,
      nombre_factures: counted.length,
      total_achats: round(counted.reduce((s, x) => s + n(x.total), 0)),
      reste_du: round(counted.reduce((s, x) => s + Math.max(0, n(x.total) - n(x.amount_paid)), 0)),
      solde_depot: round(n(deposits.data?.[0]?.balance_after)),
      dernieres_factures: sales.slice(0, 8).map((s) => ({
        numero: s.invoice_number,
        date: String(s.created_at).slice(0, 10),
        total: round(n(s.total)),
        paye: round(n(s.amount_paid)),
        statut: s.status === 'annulee' ? 'annulée' : s.quote_status === 'draft' ? 'devis' : s.status,
      })),
    })
  }
  return { resultats: out, devise: 'FCFA' }
}

async function chercherFacture(db: SupabaseClient, numero: string) {
  const { data, error } = await db.from('sales')
    .select('id, invoice_number, total, discount, amount_paid, status, quote_status, delivery_status, created_at, clients(name, phone), sale_items(product_name, quantity, unit_price, line_total)')
    .ilike('invoice_number', `%${numero}%`).order('created_at', { ascending: false }).limit(3)
  if (error) throw new Error(error.message)
  const out = []
  for (const s of data ?? []) {
    const { data: pays } = await db.from('payments').select('amount, method, created_at').eq('sale_id', s.id).order('created_at')
    out.push({
      numero: s.invoice_number,
      date: String(s.created_at).slice(0, 10),
      client: s.clients?.name ?? 'Client comptoir',
      statut: s.status === 'annulee' ? 'annulée' : s.quote_status === 'draft' ? 'devis' : s.status,
      livraison: s.delivery_status,
      total: round(n(s.total)),
      remise: round(n(s.discount)),
      paye: round(n(s.amount_paid)),
      reste: round(Math.max(0, n(s.total) - n(s.amount_paid))),
      articles: (s.sale_items ?? []).map((it: { product_name: string; quantity: number; unit_price: number; line_total: number }) => ({
        produit: it.product_name, quantite: n(it.quantity), prix_unitaire: round(n(it.unit_price)), total: round(n(it.line_total)),
      })),
      paiements: (pays ?? []).map((p) => ({ date: String(p.created_at).slice(0, 10), montant: round(n(p.amount)), mode: p.method })),
    })
  }
  return { resultats: out, devise: 'FCFA' }
}

async function depenses(db: SupabaseClient, du?: string, au?: string) {
  const r = range(du, au)
  const rows = await fetchAll(() =>
    db.from('expenses').select('label, amount, category, created_at').gte('created_at', r.from).lt('created_at', r.to).order('created_at'),
  )
  const parCategorie: Record<string, number> = {}
  rows.forEach((e) => (parCategorie[e.category || 'Sans catégorie'] = (parCategorie[e.category || 'Sans catégorie'] ?? 0) + n(e.amount)))
  return {
    periode: { du: r.du, au: r.au },
    total: round(rows.reduce((s, e) => s + n(e.amount), 0)),
    par_categorie: Object.fromEntries(Object.entries(parCategorie).map(([k, v]) => [k, round(v)])),
    plus_grosses: [...rows].sort((a, b) => n(b.amount) - n(a.amount)).slice(0, 10)
      .map((e) => ({ libelle: e.label, montant: round(n(e.amount)), categorie: e.category, date: String(e.created_at).slice(0, 10) })),
    devise: 'FCFA',
  }
}

async function achatsFournisseurs(db: SupabaseClient, du?: string, au?: string) {
  const r = range(du, au)
  const [periode, ouverts] = await Promise.all([
    fetchAll(() => db.from('purchases').select('total, supplier_name, created_at').gte('created_at', r.from).lt('created_at', r.to).neq('status', 'annulee').order('id')),
    fetchAll(() => db.from('purchases').select('purchase_number, total, amount_paid, supplier_name, created_at').in('status', ['credit', 'partielle']).order('id')),
  ])
  const parFournisseur: Record<string, number> = {}
  periode.forEach((p) => (parFournisseur[p.supplier_name] = (parFournisseur[p.supplier_name] ?? 0) + n(p.total)))
  return {
    periode: { du: r.du, au: r.au },
    total_achats: round(periode.reduce((s, p) => s + n(p.total), 0)),
    nombre_achats: periode.length,
    par_fournisseur: Object.fromEntries(Object.entries(parFournisseur).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, round(v)])),
    dette_fournisseurs: round(ouverts.reduce((s, p) => s + Math.max(0, n(p.total) - n(p.amount_paid)), 0)),
    achats_a_regler: ouverts.map((p) => ({
      numero: p.purchase_number, fournisseur: p.supplier_name, date: String(p.created_at).slice(0, 10),
      reste: round(Math.max(0, n(p.total) - n(p.amount_paid))),
    })).sort((a, b) => b.reste - a.reste).slice(0, 20),
    devise: 'FCFA',
  }
}

// ---------------------------------------------------------------------------
// Outils exposés à Claude (lecture seule)
// ---------------------------------------------------------------------------
const DATE = { type: 'string', description: 'Date au format AAAA-MM-JJ (incluse).' }
const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: 'resume_periode',
    description: "Chiffres d'une période : chiffre d'affaires (factures + caisse rapide), encaissements, marge brute, remises, dépenses et bénéfice réel. Utiliser pour toute question de ventes, d'argent encaissé ou de bénéfice. Pour comparer deux périodes, appeler l'outil deux fois.",
    input_schema: { type: 'object', properties: { du: DATE, au: DATE }, required: ['du', 'au'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'dettes_clients',
    description: 'Ce que les clients doivent encore (factures à crédit ou partiellement payées), classé du plus gros au plus petit, avec le total.',
    input_schema: { type: 'object', properties: { limite: { type: 'integer', description: 'Nombre de clients à lister (1 à 50).' } }, required: ['limite'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'stock',
    description: "État du stock. filtre = 'faible' (sous le seuil d'alerte), 'rupture' (stock à zéro), 'recherche' (par nom, avec le champ recherche) ou 'tout' (inclut la valeur du stock au prix d'achat).",
    input_schema: {
      type: 'object',
      properties: { filtre: { type: 'string', enum: ['faible', 'rupture', 'recherche', 'tout'] }, recherche: { type: 'string', description: 'Texte du nom de produit (vide si non utilisé).' } },
      required: ['filtre', 'recherche'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'meilleures_ventes',
    description: "Produits les plus vendus sur une période (factures + caisse rapide), avec quantités, chiffre d'affaires et marge.",
    input_schema: { type: 'object', properties: { du: DATE, au: DATE, limite: { type: 'integer', description: 'Nombre de produits (1 à 30).' } }, required: ['du', 'au', 'limite'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'chercher_client',
    description: "Fiche d'un client par son nom (ou une partie) : téléphone, total des achats, reste dû, solde de dépôt et dernières factures.",
    input_schema: { type: 'object', properties: { nom: { type: 'string' } }, required: ['nom'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'chercher_facture',
    description: "Détail d'une facture ou d'un devis par son numéro (ex. FAC-2026-0254, ou seulement 0254) : client, articles, paiements, reste.",
    input_schema: { type: 'object', properties: { numero: { type: 'string' } }, required: ['numero'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'depenses',
    description: 'Dépenses de la boutique sur une période : total, répartition par catégorie et plus grosses dépenses.',
    input_schema: { type: 'object', properties: { du: DATE, au: DATE }, required: ['du', 'au'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'achats_fournisseurs',
    description: 'Achats auprès des fournisseurs sur une période et dette actuelle envers les fournisseurs.',
    input_schema: { type: 'object', properties: { du: DATE, au: DATE }, required: ['du', 'au'], additionalProperties: false },
    strict: true,
  },
]

// deno-lint-ignore no-explicit-any
async function runTool(db: SupabaseClient, name: string, input: any) {
  switch (name) {
    case 'resume_periode': return resumePeriode(db, input.du, input.au)
    case 'dettes_clients': return dettesClients(db, input.limite)
    case 'stock': return stock(db, input.filtre, input.recherche)
    case 'meilleures_ventes': return meilleuresVentes(db, input.du, input.au, input.limite)
    case 'chercher_client': return chercherClient(db, String(input.nom ?? ''))
    case 'chercher_facture': return chercherFacture(db, String(input.numero ?? ''))
    case 'depenses': return depenses(db, input.du, input.au)
    case 'achats_fournisseurs': return achatsFournisseurs(db, input.du, input.au)
    default: throw new Error(`Outil inconnu : ${name}`)
  }
}

// Consignes FIXES (aucune date ni donnée variable ici : la date du jour est donnée dans chaque question,
// pour que ce texte reste identique d'une requête à l'autre).
const SYSTEM = `Tu es l'assistant du propriétaire de la Quincaillerie Mabane (Diouroup, Sénégal). Il t'interroge depuis son téléphone sur l'activité de sa boutique.

Règles :
- Réponds toujours en français simple, court et direct : le chiffre clé d'abord, puis 2 à 5 lignes d'explication au maximum.
- Ne donne JAMAIS un chiffre que tu n'as pas obtenu avec un outil. Si une donnée n'existe pas dans les outils, dis-le.
- Montants en FCFA avec des espaces pour les milliers (ex. 1 250 000 FCFA).
- La date du jour est indiquée au début de chaque question : sers-t'en pour « aujourd'hui », « hier », « cette semaine » (du lundi à aujourd'hui), « ce mois », « le mois dernier ».
- Pour une comparaison (ex. aujourd'hui vs hier), appelle l'outil pour chaque période et donne l'écart en FCFA et en %.
- Tu n'as accès qu'en lecture : si on te demande de modifier, créer ou supprimer quelque chose, explique que cela se fait dans l'application de la boutique.
- Mise en forme pour petit écran : phrases courtes, listes avec « - », gras avec **…** pour les chiffres importants. Pas de tableaux.`

async function chat(db: SupabaseClient, history: Anthropic.Beta.BetaMessageParam[]) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error("La clé ANTHROPIC_API_KEY n'est pas configurée (supabase secrets set ANTHROPIC_API_KEY=...).")
  const client = new Anthropic({ apiKey })
  // On ajoute toujours à la fin de l'historique reçu, sans jamais le modifier (exigé pour les blocs de réflexion)
  const messages = [...history]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      tools,
      output_config: { effort: 'medium' },
      // Si le modèle refuse pour une raison de sécurité, l'API relance la même requête sur un modèle de repli
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages,
    })
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'refusal') {
      return { messages, answer: "Je ne peux pas répondre à cette demande. Reformulez votre question sur l'activité de la boutique." }
    }
    if (response.stop_reason === 'pause_turn') continue

    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const answer = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim()
      return { messages, answer: answer || "Je n'ai pas de réponse pour le moment." }
    }

    // Tous les résultats d'outils dans UN seul message utilisateur
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (t) => {
        try {
          return { type: 'tool_result' as const, tool_use_id: t.id, content: JSON.stringify(await runTool(db, t.name, t.input)) }
        } catch (e) {
          return { type: 'tool_result' as const, tool_use_id: t.id, content: `Erreur : ${(e as Error).message}`, is_error: true }
        }
      }),
    )
    messages.push({ role: 'user', content: results })
  }
  return { messages, answer: 'La question demande trop de recherches. Essayez de la préciser (période, client, produit).' }
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Identifier l'appelant avec SON jeton ; toutes les lectures se feront avec ce client (RLS)
  const authHeader = req.headers.get('Authorization') ?? ''
  const db = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: authError } = await db.auth.getUser()
  if (authError || !user) return json({ error: 'Non authentifié' }, 401)

  // 2. Réservé aux administrateurs (vérifié avec la clé service, indépendamment de la RLS)
  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return json({ error: 'Réservé au propriétaire (compte administrateur)' }, 403)

  // deno-lint-ignore no-explicit-any
  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Corps JSON invalide' }, 400)
  }

  try {
    if (body.action === 'kpis') {
      const today = startOfDay(new Date())
      const yesterday = new Date(today.getTime() - DAY)
      const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      const [jour, hier, mois, dettes, faible] = await Promise.all([
        resumePeriode(db, isoDay(today), isoDay(today)),
        resumePeriode(db, isoDay(yesterday), isoDay(yesterday)),
        resumePeriode(db, isoDay(monthStart), isoDay(today)),
        dettesClients(db, 5),
        stock(db, 'faible', ''),
      ])
      return json({
        aujourdhui: jour,
        hier,
        mois,
        dettes: { total_du: dettes.total_du, nombre_clients: dettes.nombre_clients, top: dettes.clients },
        stock: { faible: faible.nombre, rupture: faible.produits.filter((p) => p.stock <= 0).length },
      })
    }

    if (body.action === 'alertes') {
      const [faible, dettes, factures] = await Promise.all([
        stock(db, 'faible', ''),
        dettesClients(db, 15),
        fetchAll(() =>
          db.from('sales').select('invoice_number, total, amount_paid, created_at, clients(name, phone)')
            .in('status', ['credit', 'partielle']).eq('quote_status', 'confirmed')
            .lt('created_at', new Date(Date.now() - 30 * DAY).toISOString()).order('created_at'),
        ),
      ])
      return json({
        stock: faible.produits,
        dettes: dettes.clients,
        dette_totale: dettes.total_du,
        factures_anciennes: factures.map((s) => ({
          numero: s.invoice_number,
          client: s.clients?.name ?? 'Client comptoir',
          telephone: s.clients?.phone ?? null,
          date: String(s.created_at).slice(0, 10),
          reste: round(Math.max(0, n(s.total) - n(s.amount_paid))),
        })),
      })
    }

    if (body.action === 'chat') {
      const history = Array.isArray(body.messages) ? body.messages : []
      if (history.length === 0 || history.length > MAX_HISTORY_MESSAGES) {
        return json({ error: 'Conversation vide ou trop longue : commencez une nouvelle conversation.' }, 400)
      }
      return json(await chat(db, history))
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      const status = e.status ?? 502
      const message =
        status === 401 ? "Clé API Anthropic invalide." :
        status === 429 ? "Trop de questions en même temps : réessayez dans une minute." :
        status >= 500 ? "Le service d'IA est momentanément indisponible : réessayez." :
        `Erreur du service d'IA (${status}).`
      return json({ error: message }, status >= 500 ? 502 : status)
    }
    return json({ error: (e as Error).message || 'Erreur inattendue' }, 500)
  }
})
