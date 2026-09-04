export const SHOP = {
  name: 'QUINCAILLERIE MABANE',
  owner: 'MAMADOU FAYE Alias MOMO FAYE',
  address: 'DIOUROUP - SENEGAL',
  location: 'DIOUROUP - SENEGAL',
  activities: 'Quincaillerie, matériaux de construction, électricité, plomberie',
  phones: ['+221 77 845 28 72', '+221 78 213 33 12', '+221 77 979 20 90'],
}

// Met à jour l'objet SHOP en place (même référence partagée partout : invoicePdf.js,
// Login/Register, etc. voient donc immédiatement les valeurs enregistrées en base
// depuis la page Paramètres, sans avoir à modifier chaque point d'import).
export function syncShopSettings(settings) {
  if (!settings) return
  if (settings.name) SHOP.name = settings.name
  if (settings.owner) SHOP.owner = settings.owner
  if (settings.address) {
    SHOP.address = settings.address
    SHOP.location = settings.address
  }
  if (settings.activities) SHOP.activities = settings.activities
  const phones = [settings.phone1, settings.phone2, settings.phone3].filter(Boolean)
  if (phones.length) SHOP.phones = phones
}

export const ROLES = {
  ADMIN: 'admin',
  CAISSIER: 'caissier',
  EMPLOYE: 'employe',
}

export const ROLE_LABELS = {
  admin: 'Administrateur',
  caissier: 'Caissier',
  employe: 'Employé',
}

export const STOCK_MOVEMENT_TYPES = {
  ENTREE: 'entree',
  SORTIE: 'sortie',
}

export const WHATSAPP_MESSAGE = (clientName, invoiceNumber, total) =>
  `Bonjour ${clientName || ''}, voici votre facture N°${invoiceNumber} de la Quincaillerie Mabane d'un montant de ${total} FCFA. Merci pour votre confiance 🙏`

export const currency = (value) => {
  const n = Number(value || 0)
  // Use regular space instead of narrow/no-break spaces that some PDF fonts may render incorrectly
  const formatted = n
    .toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    .replace(/\u202F|\u00A0/g, ' ')
  return formatted + ' FCFA'
}
