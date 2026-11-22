// Restaure une sauvegarde (créée par export-data.mjs) dans un NOUVEAU projet Supabase.
//
// Prérequis : dans le nouveau projet, avoir exécuté supabase/schema.sql (SQL Editor).
// Usage :     npm run restore -- backup/mabane-AAAA-MM-JJ_HHhMM
//             (URL et clé service_role du NOUVEAU projet demandées, ou NEW_SUPABASE_URL / NEW_SERVICE_ROLE_KEY)
//
// La clé service_role (Project Settings > API) contourne la RLS : elle n'est utilisée qu'ici,
// sur votre PC, et n'est jamais enregistrée.
//
// Peut être relancé sans créer de doublons (upsert sur l'identifiant de chaque ligne).

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { TABLES, ask, log, fail } from './lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const BATCH = 500
const BUCKET = 'product-images'
// Colonnes qui pointent vers un utilisateur : réécrites si l'identifiant du compte change
const USER_COLUMNS = ['user_id', 'created_by', 'cancelled_by']

// --- Dossier de sauvegarde ---
let dir = process.argv[2]
if (!dir) {
  const backups = existsSync(join(root, 'backup')) ? readdirSync(join(root, 'backup')).filter((d) => d.startsWith('mabane-')).sort() : []
  if (!backups.length) fail('Aucune sauvegarde trouvée dans backup/. Lancez d’abord : npm run backup')
  dir = join(root, 'backup', backups[backups.length - 1])
}
dir = resolve(root, dir)
if (!existsSync(join(dir, 'manifest.json'))) fail(`Sauvegarde invalide (manifest.json absent) : ${dir}`)
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
const load = (table) => (existsSync(join(dir, `${table}.json`)) ? JSON.parse(readFileSync(join(dir, `${table}.json`), 'utf8')) : [])

log(`\n📥 Restauration de la sauvegarde du ${new Date(manifest.exported_at).toLocaleString('fr-FR')}`)
log(`   Source : ${manifest.source}\n`)

// --- Nouveau projet ---
const url = (process.env.NEW_SUPABASE_URL || (await ask('URL du NOUVEAU projet (https://xxxx.supabase.co) : '))).replace(/\/$/, '')
if (!/^https?:\/\/.+/.test(url)) fail('URL invalide.')
if (url === manifest.source) fail('C’est l’URL de l’ANCIEN projet. Indiquez celle du nouveau.')
const serviceKey = process.env.NEW_SERVICE_ROLE_KEY || (await ask('Clé service_role du nouveau projet : ', { hidden: true }))
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

// Le schéma doit être installé (la table client_deposits n'existe que dans la dernière version)
{
  const { error } = await db.from('client_deposits').select('id').limit(1)
  if (error) fail(`Le schéma n'est pas installé dans le nouveau projet (${error.message}).\n   Exécutez d'abord supabase/schema.sql dans le SQL Editor du nouveau projet.`)
  const { count } = await db.from('products').select('id', { count: 'exact', head: true })
  if (count > 0) {
    const ok = process.env.CONFIRM_OVERWRITE === '1' ? 'oui' : await ask(`⚠ Le nouveau projet contient déjà ${count} produit(s). Continuer (les lignes de même identifiant seront écrasées) ? (oui/non) : `)
    if (!/^o(ui)?$/i.test(ok)) fail('Restauration annulée.')
  }
}

const report = { errors: [] }

// --- 1. Comptes utilisateurs ---
// Les mots de passe ne sont pas récupérables : chaque compte reçoit un mot de passe provisoire.
const userMap = new Map() // ancien id -> nouvel id
const accounts = []
const backupUsers = load('users').sort((a, b) => (a.role === 'admin' ? -1 : 0) - (b.role === 'admin' ? -1 : 0))

async function findAuthUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data.users.length) return null
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found
  }
  return null
}

log(`👤 Comptes utilisateurs (${backupUsers.length})`)
for (const u of backupUsers) {
  const password = randomBytes(9).toString('base64url')
  let newId = null
  let created = false
  let { data, error } = await db.auth.admin.createUser({
    id: u.id, // même identifiant que dans l'ancienne base quand c'est possible
    email: u.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, phone: u.phone },
  })
  if (error && /id/i.test(error.message) && !/already/i.test(error.message)) {
    ;({ data, error } = await db.auth.admin.createUser({ email: u.email, password, email_confirm: true, user_metadata: { full_name: u.full_name } }))
  }
  if (!error) {
    newId = data.user.id
    created = true
  } else if (/already|registered|exists/i.test(error.message)) {
    newId = (await findAuthUserByEmail(u.email))?.id || null
    // RESET_PASSWORDS=1 : redonne un mot de passe provisoire (utile si un premier passage a été interrompu)
    if (newId && process.env.RESET_PASSWORDS === '1') {
      const { error: pwError } = await db.auth.admin.updateUserById(newId, { password })
      if (!pwError) created = true
    }
  } else {
    report.errors.push({ table: 'users', id: u.id, email: u.email, error: error.message })
  }
  if (!newId) {
    log(`  ⚠ ${u.email} : ${error?.message || 'compte introuvable'}`)
    continue
  }
  userMap.set(u.id, newId)
  const { error: profileError } = await db.from('users').update({ full_name: u.full_name, phone: u.phone, role: u.role }).eq('id', newId)
  if (profileError) report.errors.push({ table: 'users', email: u.email, error: profileError.message })
  accounts.push({ email: u.email, nom: u.full_name, role: u.role, mot_de_passe: created ? password : '(compte déjà existant, mot de passe inchangé)' })
  log(`  ✔ ${u.email} (${u.role})${created ? '' : ' — existait déjà'}`)
}

const mapUser = (id) => (id ? userMap.get(id) || null : id)

// --- 2. Photos des produits ---
const imageMap = new Map() // ancienne URL -> nouvelle URL
if (manifest.images?.length) log(`\n🖼  Photos des produits (${manifest.images.length})`)
for (const img of manifest.images || []) {
  const file = join(dir, 'images', img.name.replace(/[\\/]/g, '_'))
  if (!existsSync(file)) continue
  const { error } = await db.storage.from(BUCKET).upload(img.name, readFileSync(file), { contentType: img.content_type || undefined, upsert: true })
  if (error) {
    report.errors.push({ table: 'storage', name: img.name, error: error.message })
    continue
  }
  imageMap.set(img.url, db.storage.from(BUCKET).getPublicUrl(img.name).data.publicUrl)
}
if (manifest.images?.length) log(`  ✔ ${imageMap.size} photo(s) copiée(s)`)

// --- 3. Données ---
/** Upsert par lots ; retire les colonnes inconnues du nouveau schéma ; en cas d'échec d'un lot, ligne par ligne */
async function upsertRows(table, rows) {
  const dropped = new Set()
  const clean = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !dropped.has(k)))
  const send = async (chunk) => {
    for (;;) {
      const { error } = await db.from(table).upsert(chunk.map(clean), { onConflict: 'id' })
      if (!error) return null
      const col = error.message.match(/Could not find the '([^']+)' column/)?.[1]
      if (col && !dropped.has(col)) {
        dropped.add(col)
        continue
      }
      return error
    }
  }
  let ok = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const error = await send(chunk)
    if (!error) {
      ok += chunk.length
      continue
    }
    for (const row of chunk) {
      const rowError = await send([row])
      if (rowError) report.errors.push({ table, id: row.id, error: rowError.message })
      else ok += 1
    }
  }
  if (dropped.size) log(`    (colonnes ignorées, absentes du nouveau schéma : ${[...dropped].join(', ')})`)
  return ok
}

log('\n🗄  Données')
let restored = 0
for (const table of TABLES) {
  if (table === 'users') continue
  let rows = load(table)
  if (!rows.length) continue

  rows = rows.map((r) => {
    const out = { ...r }
    for (const c of USER_COLUMNS) if (c in out) out[c] = mapUser(out[c])
    if (table === 'products' && out.image_url && imageMap.has(out.image_url)) out.image_url = imageMap.get(out.image_url)
    return out
  })

  const ok = await upsertRows(table, rows)
  restored += ok
  log(`  ${ok === rows.length ? '✔' : '⚠'} ${table.padEnd(18)} ${ok}/${rows.length}`)

  // Le trigger « Stock initial » crée un mouvement à chaque produit inséré : l'historique
  // d'origine est restauré juste après, on supprime donc ces mouvements automatiques.
  if (table === 'products') {
    const original = new Set(load('stock_movements').map((m) => m.id))
    const { data: autoMoves } = await db.from('stock_movements').select('id').eq('reason', 'Stock initial')
    const extra = (autoMoves || []).map((m) => m.id).filter((id) => !original.has(id))
    for (let i = 0; i < extra.length; i += BATCH) await db.from('stock_movements').delete().in('id', extra.slice(i, i + BATCH))
  }
}

// --- Rapport ---
const accountsFile = join(dir, 'COMPTES-MOTS-DE-PASSE-PROVISOIRES.txt')
writeFileSync(
  accountsFile,
  [`Comptes recréés dans ${url} — mots de passe PROVISOIRES à changer à la première connexion.`, '', ...accounts.map((a) => `${a.nom} <${a.email}> [${a.role}] : ${a.mot_de_passe}`)].join('\n')
)
if (report.errors.length) writeFileSync(join(dir, 'import-erreurs.json'), JSON.stringify(report.errors, null, 2))

log(`\n${report.errors.length ? '⚠' : '✅'} Restauration terminée : ${restored} ligne(s), ${accounts.length} compte(s), ${imageMap.size} photo(s)`)
log(`   Mots de passe provisoires : ${accountsFile}`)
if (report.errors.length) log(`   ${report.errors.length} erreur(s) détaillée(s) dans : ${join(dir, 'import-erreurs.json')}`)
log(`
Dernière étape, dans le SQL Editor du NOUVEAU projet (numérotation des reçus) :

  select setval('public.receipt_number_seq',
    coalesce((select max(substring(receipt_number from '[0-9]+$')::int) from public.sales), 0) + 1, false);
`)
