// SheetJS (~400 Ko) n'est chargé qu'au premier export

async function downloadWorkbook(rows, sheetName, fileName) {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, fileName)
}

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
  await downloadWorkbook(rows, 'Ventes', `ventes-mabane-${Date.now()}.xlsx`)
}

export async function exportProductsToExcel(products) {
  const rows = products.map((p) => ({
    Produit: p.name,
    Catégorie: p.categories?.name || '',
    Fournisseurs: (p.supplier_products || []).map((item) => item.suppliers?.name).filter(Boolean).join(', '),
    'Prix achat': p.purchase_price,
    'Prix vente': p.sale_price,
    Stock: p.stock,
    'Seuil alerte': p.alert_threshold,
  }))
  await downloadWorkbook(rows, 'Stock', `stock-mabane-${Date.now()}.xlsx`)
}

export async function exportExpensesToExcel(expenses) {
  const rows = expenses.map((e) => ({
    Libellé: e.label,
    Catégorie: e.category || '',
    Montant: e.amount,
    Date: new Date(e.created_at).toLocaleString('fr-FR'),
  }))
  await downloadWorkbook(rows, 'Dépenses', `depenses-mabane-${Date.now()}.xlsx`)
}
