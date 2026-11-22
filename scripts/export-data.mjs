// Sauvegarde COMPLÈTE des données de l'ancien projet Supabase, sans accès au tableau de bord :
// le script se connecte avec un compte de l'application (de préférence admin) et la clé du .env,
// puis lit toutes les tables (la RLS autorise la lecture à tout utilisateur connecté)
// et télécharge les photos des produits.
//
// Usage :   npm run backup
// Option :  MABANE_EMAIL / MABANE_PASSWORD en variables d'environnement (sinon demandés)
//
// Résultat : backup/mabane-AAAA-MM-JJ_HHhMM/  (un fichier JSON par table + images/ + manifest.json)

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { TABLES, readEnvFile, ask, log, fail } from './lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...readEnvFile(join(root, '.env')), ...process.env }
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey) fail('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY introuvables dans .env')

const PAGE = 1000
const BUCKET = 'product-images'

log(`\n📦 Sauvegarde des données de ${url}\n`)
log('Connectez-vous avec un compte de l’application Mabane (de préférence administrateur).')
const email = env.MABANE_EMAIL || (await ask('Email : '))
const password = env.MABANE_PASSWORD || (await ask('Mot de passe : ', { hidden: true }))

const supabase = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: true } })
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password })
if (authError) fail(`Connexion refusée : ${authError.message}`)

const { data: me } = await supabase.from('users').select('full_name, role').eq('id', auth.user.id).maybeSingle()
log(`✔ Connecté : ${me?.full_name || email} (${me?.role || 'rôle inconnu'})\n`)

const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
const dir = join(root, 'backup', `mabane-${stamp}`)
mkdirSync(join(dir, 'images'), { recursive: true })

/** Lit une table entière, page par page (PostgREST plafonne à 1000 lignes par réponse) */
async function readTable(table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) return { error }
    rows.push(...data)
    if (data.length < PAGE) return { rows }
  }
}

const manifest = { source: url, exported_at: new Date().toISOString(), exported_by: email, tables: {}, images: [] }
let total = 0

for (const table of TABLES) {
  const { rows, error } = await readTable(table)
  if (error) {
    // client_deposits n'existe pas sur une base qui n'a pas reçu la dernière version du schéma
    const missing = /does not exist|Could not find the table|schema cache/i.test(error.message)
    manifest.tables[table] = { count: 0, skipped: missing ? 'table absente' : error.message }
    log(`${missing ? '–' : '⚠'} ${table.padEnd(18)} ${missing ? 'absente (normal sur une ancienne base)' : 'ERREUR : ' + error.message}`)
    continue
  }
  writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2))
  manifest.tables[table] = { count: rows.length }
  total += rows.length
  log(`✔ ${table.padEnd(18)} ${String(rows.length).padStart(6)} ligne(s)`)
}

// Photos des produits (bucket public) : on garde une copie locale de chaque fichier référencé
const products = (await readTable('products')).rows || []
const marker = `/object/public/${BUCKET}/`
const imageUrls = [...new Set(products.map((p) => p.image_url).filter((u) => u && u.includes(marker)))]
if (imageUrls.length) log(`\n🖼  Téléchargement de ${imageUrls.length} photo(s) de produits...`)
for (const imageUrl of imageUrls) {
  const name = decodeURIComponent(imageUrl.slice(imageUrl.indexOf(marker) + marker.length))
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    writeFileSync(join(dir, 'images', name.replace(/[\\/]/g, '_')), Buffer.from(await res.arrayBuffer()))
    manifest.images.push({ name, url: imageUrl, content_type: res.headers.get('content-type') })
  } catch (err) {
    log(`⚠ photo non récupérée (${name}) : ${err.message}`)
  }
}

writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
await supabase.auth.signOut()

const errors = Object.entries(manifest.tables).filter(([, t]) => t.skipped && t.skipped !== 'table absente')
log(`\n✅ Sauvegarde terminée : ${total} ligne(s), ${manifest.images.length} photo(s)`)
log(`   Dossier : ${dir}`)
if (errors.length) log(`⚠ ${errors.length} table(s) non lue(s) : ${errors.map(([t]) => t).join(', ')}`)
if (me?.role !== 'admin') log('ℹ Compte non administrateur : toutes les tables restent lisibles, la sauvegarde est complète.')
log('\n⚠ Ce dossier contient les données de vos clients : ne le partagez pas et gardez-en une copie (clé USB, Drive).\n')
