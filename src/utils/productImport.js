// Import du catalogue depuis Excel : lecture, reconnaissance des colonnes, validation,
// puis comparaison avec les produits existants (même nom = mise à jour, sinon création).
// Fonctions pures (testées) + écriture Supabase séparée.

/** Minuscules, sans accents ni ponctuation : « Prix d'achat » → « prix d achat » */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Intitulés acceptés pour chaque champ (comparés après normalize)
const COLUMN_ALIASES = {
  name: ['nom', 'produit', 'designation', 'article', 'libelle', 'nom du produit'],
  category: ['categorie', 'famille', 'rayon'],
  unit: ['unite', 'unite de vente', 'u'],
  purchase_price: ['prix achat', 'prix d achat', 'pu achat', 'cout', 'cout d achat', 'achat'],
  sale_price: ['prix vente', 'prix de vente', 'pu vente', 'pu', 'prix', 'vente'],
  stock: ['stock', 'stock initial', 'quantite', 'qte'],
  alert_threshold: ['seuil', 'seuil alerte', 'seuil d alerte', 'alerte', 'stock minimum'],
}

/** Associe chaque champ à l'intitulé de colonne trouvé dans le fichier */
export function mapColumns(headers) {
  const byNorm = new Map(headers.map((h) => [normalize(h), h]))
  const mapping = {}
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const found = aliases.find((a) => byNorm.has(a))
    if (found) mapping[field] = byNorm.get(found)
  }
  return mapping
}

/** « 1 500 », « 1500,50 », « 2 000 F » → nombre ; vide → null ; illisible → NaN */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return value
  const cleaned = String(value).replace(/[^\d,.-]/g, '').replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Analyse les lignes du fichier.
 * @param {object[]} rawRows   lignes lues par SheetJS (clé = intitulé de colonne)
 * @param {object[]} products  catalogue actuel ({ id, name, ... })
 * @returns {{ rows, missingColumns }} rows = [{ line, action: 'create'|'update'|'error', data, errors, existing }]
 */
export function analyzeImport(rawRows, products) {
  const headers = Object.keys(rawRows[0] || {})
  const mapping = mapColumns(headers)
  const missingColumns = ['name', 'sale_price'].filter((f) => !mapping[f])
  if (missingColumns.length) return { rows: [], missingColumns, mapping }

  const existingByName = new Map(products.map((p) => [normalize(p.name), p]))
  const seen = new Set()

  const rows = rawRows
    .map((raw, i) => {
      const get = (field) => (mapping[field] ? raw[mapping[field]] : undefined)
      const name = String(get('name') ?? '').trim()
      const data = {
        name,
        category: String(get('category') ?? '').trim(),
        unit: String(get('unit') ?? '').trim() || 'unité',
        purchase_price: parseNumber(get('purchase_price')),
        sale_price: parseNumber(get('sale_price')),
        stock: parseNumber(get('stock')),
        alert_threshold: parseNumber(get('alert_threshold')),
      }
      const errors = []
      if (!name) return null // ligne vide : ignorée
      if (data.sale_price === null || Number.isNaN(data.sale_price) || data.sale_price < 0) errors.push('prix de vente invalide')
      for (const f of ['purchase_price', 'stock', 'alert_threshold']) {
        if (Number.isNaN(data[f]) || (data[f] !== null && data[f] < 0)) errors.push(`${f === 'stock' ? 'stock' : f === 'alert_threshold' ? 'seuil' : "prix d'achat"} invalide`)
      }
      const key = normalize(name)
      if (seen.has(key)) errors.push('produit en double dans le fichier')
      seen.add(key)
      const existing = existingByName.get(key)
      return { line: i + 2, data, errors, existing, action: errors.length ? 'error' : existing ? 'update' : 'create' }
    })
    .filter(Boolean)

  return { rows, missingColumns: [], mapping }
}

/** Fichier modèle à télécharger */
export async function downloadImportTemplate() {
  const { downloadWorkbookSheets } = await import('./exportExcel')
  await downloadWorkbookSheets(
    [
      {
        name: 'Produits',
        rows: [
          { Nom: 'Ciment CPJ 45 (sac 50 kg)', Catégorie: 'Ciment', Unité: 'sac', 'Prix achat': 4200, 'Prix vente': 4800, Stock: 120, Seuil: 20 },
          { Nom: 'Fer à béton 10 mm', Catégorie: 'Fer', Unité: 'barre', 'Prix achat': 3100, 'Prix vente': 3600, Stock: 300, Seuil: 50 },
          { Nom: 'Câble électrique 2,5 mm²', Catégorie: 'Électricité', Unité: 'm', 'Prix achat': 300, 'Prix vente': 450, Stock: 500, Seuil: 50 },
        ],
      },
    ],
    'modele-import-produits.xlsx'
  )
}

/** Lit la première feuille d'un fichier Excel / CSV choisi par l'utilisateur */
export async function readSpreadsheet(file) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

/**
 * Enregistre l'import : crée les catégories manquantes, met à jour les produits existants
 * (prix, unité, seuil, catégorie — jamais le stock, qui ne bouge que par mouvement),
 * crée les nouveaux (leur stock initial génère un mouvement « Stock initial »).
 */
export async function applyImport(supabase, rows, categories, onProgress) {
  const valid = rows.filter((r) => r.action !== 'error')
  const categoryIds = new Map(categories.map((c) => [normalize(c.name), c.id]))

  const missing = [...new Set(valid.map((r) => r.data.category).filter((c) => c && !categoryIds.has(normalize(c))))]
  if (missing.length) {
    const { data, error } = await supabase.from('categories').insert(missing.map((name) => ({ name }))).select('id, name')
    if (error) throw error
    data.forEach((c) => categoryIds.set(normalize(c.name), c.id))
  }

  const categoryOf = (name) => (name ? categoryIds.get(normalize(name)) || null : undefined)
  let created = 0
  let updated = 0
  const failures = []

  const toCreate = valid.filter((r) => r.action === 'create')
  for (let i = 0; i < toCreate.length; i += 200) {
    const chunk = toCreate.slice(i, i + 200)
    const payload = chunk.map(({ data }) => ({
      name: data.name,
      category_id: categoryOf(data.category) ?? null,
      unit: data.unit,
      purchase_price: data.purchase_price ?? 0,
      sale_price: data.sale_price,
      stock: data.stock ?? 0,
      alert_threshold: data.alert_threshold ?? 5,
    }))
    const { error } = await supabase.from('products').insert(payload)
    if (error) chunk.forEach((r) => failures.push({ line: r.line, name: r.data.name, error: error.message }))
    else created += chunk.length
    onProgress?.(created + updated, valid.length)
  }

  for (const r of valid.filter((row) => row.action === 'update')) {
    const patch = { unit: r.data.unit, sale_price: r.data.sale_price }
    if (r.data.purchase_price !== null) patch.purchase_price = r.data.purchase_price
    if (r.data.alert_threshold !== null) patch.alert_threshold = r.data.alert_threshold
    const cat = categoryOf(r.data.category)
    if (cat !== undefined) patch.category_id = cat
    const { error } = await supabase.from('products').update(patch).eq('id', r.existing.id)
    if (error) failures.push({ line: r.line, name: r.data.name, error: error.message })
    else updated += 1
    onProgress?.(created + updated, valid.length)
  }

  return { created, updated, failures }
}
