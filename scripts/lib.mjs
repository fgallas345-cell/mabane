// Outils communs aux scripts de sauvegarde / restauration (Node 18+).
import { readFileSync, existsSync } from 'node:fs'
import { createInterface } from 'node:readline'

// Tables métier, dans l'ordre où elles doivent être recréées (parents avant enfants)
export const TABLES = [
  'shop_settings',
  'users',
  'categories',
  'products',
  'clients',
  'suppliers',
  'supplier_products',
  'purchases',
  'purchase_items',
  'sales',
  'sale_items',
  'payments',
  'deliveries',
  'delivery_items',
  'stock_movements',
  'expenses',
  'small_sales',
  'small_sale_items',
  'client_deposits',
]

/** Lit un fichier .env simple (CLE=valeur) sans dépendance externe */
export function readEnvFile(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

/** Pose une question dans le terminal ; hidden = la saisie ne s'affiche pas (mot de passe, clé) */
export function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s)
        else rl.output.write('*'.repeat(Math.min(s.length, 1)))
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

export const log = (msg) => console.log(msg)
export const fail = (msg) => {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}
