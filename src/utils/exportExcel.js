// SheetJS (~400 Ko) n'est chargé qu'au premier export

const today = () => new Date().toISOString().slice(0, 10)

async function downloadWorkbook(rows, sheetName, fileName) {
  await downloadWorkbookSheets([{ name: sheetName, rows }], fileName)
}

/** Classeur à plusieurs onglets : sheets = [{ name, rows }] (rows = objets, une clé par colonne) */
export async function downloadWorkbookSheets(sheets, fileName) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()
  sheets.forEach(({ name, rows }) => {
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'Aucune donnée' }])
    // Largeur de colonne adaptée au contenu (lisible sans retouche dans Excel)
    const headers = Object.keys(rows[0] || {})
    worksheet['!cols'] = headers.map((h) => ({
      wch: Math.min(48, Math.max(h.length, ...rows.map((r) => String(r[h] ?? '').length)) + 2),
    }))
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31))
  })
  XLSX.writeFile(workbook, fileName)
}

export const todayStamp = today

export async function exportSalesToExcel(sales) {
  const rows = sales.map((s) => ({
    'N° Facture': s.invoice_number,
    Client: s.clients?.name || 'Client comptoir',
    Téléphone: s.clients?.phone || '',
    'Sous-total': Number(s.subtotal),
    Remise: Number(s.discount),
    Total: Number(s.total),
    Encaissé: Number(s.amount_paid),
    'Reste dû': Number(s.total) - Number(s.amount_paid),
    Statut: { payee: 'Payée', partielle: 'Partielle', credit: 'À crédit', annulee: 'Annulée' }[s.status] || s.status,
    Date: new Date(s.created_at).toLocaleString('fr-FR'),
  }))
  await downloadWorkbook(rows, 'Ventes', `ventes-mabane-${today()}.xlsx`)
}

export async function exportProductsToExcel(products) {
  // Mêmes colonnes que le modèle d'import : on peut exporter, corriger dans Excel puis réimporter
  const rows = products.map((p) => ({
    Nom: p.name,
    Catégorie: p.categories?.name || '',
    Unité: p.unit || 'unité',
    'Prix achat': Number(p.purchase_price),
    'Prix vente': Number(p.sale_price),
    Stock: Number(p.stock),
    Seuil: Number(p.alert_threshold),
    Fournisseurs: (p.supplier_products || []).map((item) => item.suppliers?.name).filter(Boolean).join(', '),
  }))
  await downloadWorkbook(rows, 'Stock', `stock-mabane-${today()}.xlsx`)
}

export async function exportExpensesToExcel(expenses) {
  const rows = expenses.map((e) => ({
    Libellé: e.label,
    Catégorie: e.category || '',
    Montant: e.amount,
    Date: new Date(e.created_at).toLocaleString('fr-FR'),
  }))
  await downloadWorkbook(rows, 'Dépenses', `depenses-mabane-${today()}.xlsx`)
}
