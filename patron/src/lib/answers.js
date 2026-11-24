// Questions toutes prêtes (gratuites, sans IA) : chaque question appelle un ou plusieurs
// calculs de lecture de la fonction serveur, puis la réponse est rédigée ici.
import { ShoppingCart, BarChart3, CalendarDays, CalendarCheck, HelpCircle, Box, TrendingUp, PackageCheck, Coins, Handshake } from 'lucide-react'
import { callPatron, fcfa, pct } from './api'

const DAY = 86_400_000
const iso = (d) => d.toISOString().slice(0, 10) // Dakar = UTC
const today = () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))
const addDays = (d, n) => new Date(d.getTime() + n * DAY)
const monday = (d) => addDays(d, -((d.getUTCDay() + 6) % 7))
const monthStart = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
const frDate = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

const outil = (name, input = {}) => callPatron('outil', { name, input })

function evolution(cur, prev) {
  const p = pct(cur, prev)
  if (p == null) return ''
  const diff = cur - prev
  return ` (${diff >= 0 ? '+' : '−'}${fcfa(Math.abs(diff))}, ${p >= 0 ? '+' : ''}${p} %)`
}

function lignesResume(r) {
  return [
    `- Chiffre d'affaires : **${fcfa(r.chiffre_affaires)}**`,
    `- Factures : ${r.factures.nombre} (${fcfa(r.factures.montant)}) · Caisse rapide : ${r.caisse_rapide.nombre} (${fcfa(r.caisse_rapide.montant)})`,
    `- Encaissé : **${fcfa(r.encaisse)}**`,
  ]
}

async function comparer(titre, cur, prev, labelCur, labelPrev) {
  const [a, b] = await Promise.all([outil('resume_periode', cur), outil('resume_periode', prev)])
  return [
    `**${titre}**`,
    `${labelCur} : **${fcfa(a.chiffre_affaires)}** de ventes${evolution(a.chiffre_affaires, b.chiffre_affaires)}`,
    ...lignesResume(a),
    '',
    `${labelPrev} : **${fcfa(b.chiffre_affaires)}** de ventes · encaissé ${fcfa(b.encaisse)}`,
  ].join('\n')
}

export const QUESTIONS = [
  {
    label: "Ventes d'aujourd'hui vs hier",
    icon: ShoppingCart,
    run: () => {
      const t = today()
      return comparer("Aujourd'hui comparé à hier", { du: iso(t), au: iso(t) }, { du: iso(addDays(t, -1)), au: iso(addDays(t, -1)) }, "Aujourd'hui", 'Hier')
    },
  },
  {
    label: 'Cette semaine vs la semaine dernière',
    icon: BarChart3,
    run: () => {
      const t = today()
      const m = monday(t)
      const days = Math.round((t - m) / DAY)
      return comparer(
        'Cette semaine (du lundi à aujourd’hui)',
        { du: iso(m), au: iso(t) },
        { du: iso(addDays(m, -7)), au: iso(addDays(m, -7 + days)) },
        'Cette semaine',
        'Même période la semaine dernière'
      )
    },
  },
  {
    label: 'Bénéfice du mois',
    icon: CalendarDays,
    run: async () => {
      const t = today()
      const r = await outil('resume_periode', { du: iso(monthStart(t)), au: iso(t) })
      return [
        `**Bénéfice du mois : ${fcfa(r.benefice)}**`,
        `- Chiffre d'affaires : ${fcfa(r.chiffre_affaires)}`,
        `- Marge brute : **${fcfa(r.marge_brute)}** (après ${fcfa(r.remises)} de remises)`,
        `- Dépenses : ${fcfa(r.depenses)}`,
        `- Encaissé : ${fcfa(r.encaisse)}`,
        '',
        'Bénéfice = marge brute − dépenses.',
      ].join('\n')
    },
  },
  {
    label: 'Ce mois vs le mois dernier',
    icon: CalendarCheck,
    run: () => {
      const t = today()
      const ms = monthStart(t)
      const prevStart = new Date(Date.UTC(ms.getUTCFullYear(), ms.getUTCMonth() - 1, 1))
      // Même quantième le mois dernier (borné à la fin du mois dernier)
      const prevEnd = new Date(Math.min(Date.UTC(prevStart.getUTCFullYear(), prevStart.getUTCMonth(), t.getUTCDate()), addDays(ms, -1).getTime()))
      return comparer('Ce mois comparé au mois dernier (au même jour)', { du: iso(ms), au: iso(t) }, { du: iso(prevStart), au: iso(prevEnd) }, 'Ce mois', 'Le mois dernier')
    },
  },
  {
    label: 'Qui me doit de l’argent ?',
    icon: HelpCircle,
    run: async () => {
      const r = await outil('dettes_clients', { limite: 20 })
      if (!r.clients.length) return '**Aucune dette client.** Tout le monde a payé. 👍'
      return [
        `**Total dû par les clients : ${fcfa(r.total_du)}** (${r.nombre_clients} client${r.nombre_clients > 1 ? 's' : ''})`,
        ...r.clients.map((c) => `- **${c.client}** : ${fcfa(c.reste)} · ${c.factures} facture${c.factures > 1 ? 's' : ''}, depuis le ${frDate(c.plus_ancienne)}`),
        r.nombre_clients > r.clients.length ? `… et ${r.nombre_clients - r.clients.length} autre(s) dans l'onglet Alertes.` : '',
      ].join('\n')
    },
  },
  {
    label: 'Produits à commander',
    icon: Box,
    run: async () => {
      const r = await outil('stock', { filtre: 'faible', recherche: '' })
      if (!r.produits.length) return '**Aucun produit sous son seuil d’alerte.** 👍'
      const rupture = r.produits.filter((p) => p.stock <= 0)
      return [
        `**${r.nombre} produit${r.nombre > 1 ? 's' : ''} à commander**, dont ${rupture.length} en rupture.`,
        ...r.produits.map((p) => `- **${p.produit}** : ${p.stock <= 0 ? 'rupture' : `${p.stock} restant${p.stock > 1 ? 's' : ''}`} (seuil ${p.seuil})`),
      ].join('\n')
    },
  },
  {
    label: 'Meilleures ventes de la semaine',
    icon: TrendingUp,
    run: async () => {
      const t = today()
      const r = await outil('meilleures_ventes', { du: iso(monday(t)), au: iso(t), limite: 10 })
      if (!r.produits.length) return 'Aucune vente cette semaine pour le moment.'
      return ['**Meilleures ventes de la semaine**', ...r.produits.map((p, i) => `- ${i + 1}. **${p.produit}** : ${fcfa(p.chiffre_affaires)} · ${p.quantite} vendu(s) · marge ${fcfa(p.marge)}`)].join('\n')
    },
  },
  {
    label: 'Meilleures ventes du mois',
    icon: PackageCheck,
    run: async () => {
      const t = today()
      const r = await outil('meilleures_ventes', { du: iso(monthStart(t)), au: iso(t), limite: 10 })
      if (!r.produits.length) return 'Aucune vente ce mois-ci pour le moment.'
      return ['**Meilleures ventes du mois**', ...r.produits.map((p, i) => `- ${i + 1}. **${p.produit}** : ${fcfa(p.chiffre_affaires)} · ${p.quantite} vendu(s) · marge ${fcfa(p.marge)}`)].join('\n')
    },
  },
  {
    label: 'Dépenses du mois',
    icon: Coins,
    run: async () => {
      const t = today()
      const r = await outil('depenses', { du: iso(monthStart(t)), au: iso(t) })
      if (!r.total) return 'Aucune dépense enregistrée ce mois-ci.'
      return [
        `**Dépenses du mois : ${fcfa(r.total)}**`,
        ...Object.entries(r.par_categorie).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k} : **${fcfa(v)}**`),
        '---',
        'Les plus grosses :',
        ...r.plus_grosses.slice(0, 5).map((e) => `- ${e.libelle} : ${fcfa(e.montant)} (${frDate(e.date)})`),
      ].join('\n')
    },
  },
  {
    label: 'Achats et dettes fournisseurs',
    icon: Handshake,
    run: async () => {
      const t = today()
      const r = await outil('achats_fournisseurs', { du: iso(monthStart(t)), au: iso(t) })
      return [
        `**Je dois aux fournisseurs : ${fcfa(r.dette_fournisseurs)}**`,
        ...r.achats_a_regler.slice(0, 10).map((a) => `- ${a.fournisseur} : ${fcfa(a.reste)} (achat ${a.numero} du ${frDate(a.date)})`),
        '',
        `Achats ce mois : **${fcfa(r.total_achats)}** (${r.nombre_achats} achat${r.nombre_achats > 1 ? 's' : ''})`,
        ...Object.entries(r.par_fournisseur).slice(0, 5).map(([k, v]) => `- ${k} : ${fcfa(v)}`),
      ].join('\n')
    },
  },
]

/** Recherche d'un client par nom */
export async function chercherClient(nom) {
  const r = await outil('chercher_client', { nom })
  if (!r.resultats.length) return `Aucun client ne correspond à « ${nom} ».`
  return r.resultats
    .map((c) =>
      [
        `**${c.client}**${c.telephone ? ` · ${c.telephone}` : ''}`,
        `- Achats : **${fcfa(c.total_achats)}** (${c.nombre_factures} facture${c.nombre_factures > 1 ? 's' : ''})`,
        `- Reste à payer : **${fcfa(c.reste_du)}**`,
        c.solde_depot ? `- Argent en dépôt : ${fcfa(c.solde_depot)}` : '',
        c.dernieres_factures.length ? 'Dernières factures :' : '',
        ...c.dernieres_factures.slice(0, 5).map((f) => `- ${f.numero} du ${frDate(f.date)} : ${fcfa(f.total)} (${f.statut}${f.total - f.paye > 0 && f.statut !== 'annulée' && f.statut !== 'devis' ? `, reste ${fcfa(f.total - f.paye)}` : ''})`),
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n')
}

/** Recherche d'une facture par numéro (ou fin de numéro) */
export async function chercherFacture(numero) {
  const r = await outil('chercher_facture', { numero })
  if (!r.resultats.length) return `Aucune facture ne correspond à « ${numero} ».`
  return r.resultats
    .map((f) =>
      [
        `**${f.numero}** · ${frDate(f.date)} · ${f.client}`,
        `- Total : **${fcfa(f.total)}**${f.remise ? ` (remise ${fcfa(f.remise)})` : ''} · payé ${fcfa(f.paye)} · **reste ${fcfa(f.reste)}**`,
        `- Statut : ${f.statut} · livraison : ${f.livraison}`,
        'Articles :',
        ...f.articles.map((a) => `- ${a.produit} : ${a.quantite} × ${fcfa(a.prix_unitaire)} = ${fcfa(a.total)}`),
        f.paiements.length ? 'Paiements :' : '',
        ...f.paiements.map((p) => `- ${frDate(p.date)} : ${fcfa(p.montant)} (${p.mode})`),
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n')
}
