# Cahier des charges — « AKA SAKHINE Gestion »
## Application de gestion pour AKA SAKHINE — Quincaillerie · Alimentation (Diouroup, Sénégal)

**Version** : 2.1 — 18 septembre 2026
**Objet** : spécification complète permettant de construire l'application de gestion d'**AKA SAKHINE** (catalogue, stock, ventes/facturation, achats, finances, tableau de bord), à l'identique de l'application de référence « Quincaillerie Mabane – Gestion », adaptée à l'identité et aux deux secteurs d'activité de la boutique (quincaillerie, alimentation).
**Application de référence** : ce dépôt (`src/`, `supabase/schema.sql`). En cas de doute sur un comportement non décrit ici, le code de référence fait foi.
**Documents sources** : carnet de factures papier actuel (§ 15.3) et bannière publicitaire de la boutique (§ 14, § 15).

**Organisation du document** : la partie A (§ 1 à 13) décrit le socle commun ; la partie B (§ 14 à 20) décrit tout ce qui est propre à AKA SAKHINE : identité, charte graphique, facture, adaptations fonctionnelles, données initiales, éléments à fournir. **En cas de conflit, la partie B prévaut.**

---

# PARTIE A — SOCLE FONCTIONNEL ET TECHNIQUE

## 1. Présentation

### 1.1 Contexte
Une boutique de détail tenue par un gérant et quelques employés. Les ventes se font au comptoir, parfois à crédit ou avec avance, parfois avec livraison en plusieurs fois (chantiers). Les clients demandent des devis, des factures et des reçus, envoyés par WhatsApp. La connexion internet est mobile et parfois lente. AKA SAKHINE ajoute à la quincaillerie un rayon **alimentation** — voir partie B.

### 1.2 Objectifs
1. Tenir un **stock exact** en permanence, chaque variation étant tracée par un mouvement.
2. Vendre vite au comptoir (« petite vente » en 3 clics) et facturer proprement (devis → facture → livraisons → paiements → reçus).
3. Gérer les **achats fournisseurs** et les dettes (clients et fournisseurs).
4. Donner au gérant des **chiffres fiables** : ventes du jour, recettes, marge, bénéfice, ruptures.
5. Produire des **documents PDF** au format de la boutique et les envoyer par **WhatsApp**.
6. Fonctionner sur **téléphone, tablette et ordinateur**, en clair et en sombre.

### 1.3 Hors périmètre
Comptabilité générale, TVA, multi-boutiques, caisse enregistreuse physique, code-barres, mode hors-ligne complet, application mobile native.

---

## 2. Utilisateurs et rôles

Trois rôles, stockés dans `users.role` : `admin`, `caissier`, `employe`.

| Fonction | admin | caissier | employe |
|---|:-:|:-:|:-:|
| Se connecter, voir le tableau de bord | ✔ | ✔ | ✔ |
| Produits, catégories, clients, fournisseurs : créer / modifier | ✔ | ✔ | ✔ |
| Produits, catégories, clients, fournisseurs : **supprimer** | ✔ | – | – |
| Ventes : créer facture / devis, encaisser un paiement, créer un bon de livraison, confirmer un devis, PDF, WhatsApp | ✔ | ✔ | ✔ |
| Ventes : **modifier**, **annuler** (facture ou devis), supprimer une facture annulée | ✔ | – | – |
| Petites ventes : créer, modifier | ✔ | ✔ | ✔ |
| Petites ventes : **annuler/supprimer** | ✔ | – | – |
| Achats : créer, payer | ✔ | ✔ | ✔ |
| Achats : **modifier**, **annuler**, supprimer un achat annulé | ✔ | – | – |
| Stock : entrée / sortie manuelle | ✔ | ✔ | ✔ |
| Stock : corriger / supprimer un mouvement **manuel** | ✔ | – | – |
| Dépenses : créer / modifier | ✔ | ✔ | ✔ |
| Dépenses : supprimer | ✔ | – | – |
| Paramètres boutique : modifier | ✔ | – | – |
| Utilisateurs : créer, supprimer, changer le rôle | ✔ | – | – |

Règles :
- Il n'existe **aucune page d'inscription**. Les comptes sont créés par un admin (page Utilisateurs) ou depuis le dashboard Supabase.
- Le **premier** compte créé devient `admin` automatiquement ; les suivants sont `employe` jusqu'à promotion par un admin. Le rôle éventuellement transmis à l'inscription est **ignoré** par le serveur.
- Un admin ne peut ni se rétrograder lui-même ni supprimer son propre compte ; le dernier admin ne peut pas être supprimé ou rétrogradé.
- Ces droits sont appliqués **côté serveur** (RLS + contrôles dans les RPC). L'interface ne fait que masquer les boutons.

---

## 3. Architecture technique

### 3.1 Stack imposée
| Couche | Technologie | Version mini |
|---|---|---|
| Frontend | React + Vite, JavaScript (JSX) | React 19, Vite 8 |
| Style | Tailwind CSS, mode sombre par classe `dark` | 3.4 |
| Données côté client | TanStack React Query | 5 |
| Routage | react-router-dom | 7 |
| Icônes | lucide-react | — |
| Graphiques | recharts | 3 |
| PDF | jspdf (polices TrueType embarquées) | 4 |
| Excel | SheetJS (distribution officielle `cdn.sheetjs.com`) | 0.20 |
| Backend | Supabase : PostgreSQL, Auth (email/mot de passe), Storage, Edge Functions (Deno) | — |
| Qualité | oxlint, Vitest, GitHub Actions | — |

### 3.2 Principes
1. **Toute écriture qui touche plusieurs tables ou le stock passe par une fonction PostgreSQL (RPC)** `security definer`, transactionnelle, avec verrous `for update`. Le frontend n'écrit jamais directement dans `sales`, `sale_items`, `purchases`, `purchase_items`, `stock_movements`, `payments`, `deliveries`.
2. Les écritures simples (CRUD produits, clients, fournisseurs, catégories, dépenses, paramètres) passent par l'API REST Supabase, protégées par RLS.
3. **Chaque variation de stock crée un mouvement** (`stock_movements`). Le champ `stock` d'un produit n'est jamais modifié directement après création.
4. Les documents copient les libellés au moment de l'opération (`product_name`, `supplier_name`) : supprimer un produit ou un fournisseur ne casse pas l'historique.
5. Les montants sont en **FCFA entiers** à l'affichage (`numeric(12,2)` en base), format `1 234 567 FCFA`.
6. L'auteur d'une opération est **toujours** `auth.uid()` côté serveur, jamais une valeur envoyée par le client.

### 3.3 Structure du projet
```
src/
  main.jsx                 QueryClientProvider, ThemeProvider, AuthProvider, ErrorBoundary
  App.jsx                  routes (pages en React.lazy), ProtectedRoute, Layout
  components/              Layout, Sidebar, Topbar, Modal, ConfirmDialog, StatCard, Pagination,
                           SearchableSelect, ThemeToggle, ProtectedRoute, ErrorBoundary
  context/                 AuthContext (session + profil + rôle), ThemeContext, ToastContext
  hooks/                   useSupabaseTable (CRUD générique), useProducts, useEntities, useSales,
                           usePurchases, useSmallSales, useDashboard, useShopSettings, useUsersAdmin
  lib/                     supabase.js (client), queryClient.js, constants.js (SHOP, rôles, currency)
  pages/                   auth/Login, dashboard, products, categories, stock, clients, suppliers,
                           purchases, sales/{Sales, SmallSales}, expenses/Finances, settings, users
  utils/                   invoicePdf, deliveryPdf, paymentReceiptPdf, pdfFonts, exportExcel,
                           whatsapp, finance (calculs purs testés)
  __tests__/               tests unitaires Vitest
public/fonts/              NotoSans-Regular.ttf, NotoSans-Bold.ttf
supabase/
  schema.sql               schéma complet, idempotent (tables, RPC, RLS, triggers, bucket, seed)
  functions/manage-users   Edge Function : création / suppression de comptes (service_role)
  functions/send-whatsapp  Edge Function optionnelle : API Meta WhatsApp Cloud
.github/workflows/ci.yml   lint + tests + build
```

---

## 4. Modèle de données (PostgreSQL, schéma `public`)

Toutes les clés primaires sont des `uuid` (`uuid_generate_v4()`), toutes les tables ont `created_at timestamptz default now()`.

### 4.1 Référentiels
| Table | Colonnes | Contraintes |
|---|---|---|
| `users` | `id` (= `auth.users.id`, cascade), `full_name`, `email` (unique), `role`, `phone` | `role in ('admin','caissier','employe')` |
| `categories` | `name` (unique), `description` | seed : Ciment, Fer, Électricité, Plomberie, Divers |
| `products` | `name`, `category_id` (FK set null), `purchase_price`, `sale_price`, `stock int`, `alert_threshold int`, `image_url`, `unit` (défaut `unité`), `updated_at` | prix ≥ 0, stock ≥ 0, seuil ≥ 0 |
| `clients` | `name`, `phone` (obligatoire, numéro WhatsApp), `address` | |
| `suppliers` | `name`, `contact_person`, `phone`, `email`, `address`, `payment_terms`, `products_supplied`, `notes` | |
| `supplier_products` | `supplier_id`, `product_id` | unique (supplier, product), cascade |
| `shop_settings` | `id boolean = true` (ligne unique), `name`, `owner`, `address`, `activities` (texte, séparé par virgules), `phone1..3`, `low_stock_default_threshold int` (5), `updated_at` | `check (id)` |

### 4.2 Ventes
| Table | Colonnes | Contraintes |
|---|---|---|
| `sales` | `invoice_number` (unique, `FAC-AAAA-0001`), `client_id` (nullable = client comptoir), `user_id`, `subtotal`, `discount`, `total`, `amount_paid`, `status`, `delivery_status`, `quote_status`, `payment_method`, `receipt_number`, `last_payment_at`, `updated_at` | `status in ('payee','partielle','credit','annulee')` · `delivery_status in ('en_attente','partielle','livree')` · `quote_status in ('draft','confirmed','cancelled')` · `payment_method in ('especes','mobile_money','virement','cheque','carte')` · `0 ≤ discount ≤ subtotal` · `0 ≤ amount_paid ≤ total` |
| `sale_items` | `sale_id` (cascade), `product_id` (set null), `product_name`, `quantity`, `purchase_price` (copie du catalogue), `unit_price`, `line_total` | quantité > 0, prix ≥ 0 |
| `payments` | `sale_id` (cascade), `amount`, `method`, `reference`, `notes`, `created_by` | |
| `deliveries` | `sale_id` (cascade), `delivery_number` (unique, `BL-AAAA-0001`), `notes`, `created_by` | |
| `delivery_items` | `delivery_id` (cascade), `sale_item_id` (cascade), `product_id`, `quantity_delivered` | > 0 |
| `small_sales` | `user_id`, `notes`, `subtotal`, `discount`, `total` | pas de numéro, pas de client |
| `small_sale_items` | `small_sale_id` (cascade), `product_id`, `product_name`, `quantity`, `purchase_price`, `unit_price`, `line_total` | |

### 4.3 Achats, stock, finances
| Table | Colonnes | Contraintes |
|---|---|---|
| `purchases` | `purchase_number` (unique, `ACH-AAAA-0001`), `supplier_id` (set null), `supplier_name` (copie), `user_id`, `subtotal`, `total`, `amount_paid`, `status`, `notes` | `status in ('payee','partielle','credit','annulee')` · `0 ≤ amount_paid ≤ total` |
| `purchase_items` | `purchase_id` (cascade), `product_id`, `product_name`, `quantity`, `unit_cost`, `line_total` | |
| `stock_movements` | `product_id` (cascade), `type`, `quantity`, `reason`, `user_id` | `type in ('entree','sortie')`, quantité > 0 |
| `expenses` | `label`, `amount`, `category`, `user_id` | montant ≥ 0 |

### 4.4 Index
`products(category_id)`, `suppliers(name)`, `supplier_products(supplier_id)`, `(product_id)`, `purchases(supplier_id)`, `(status)`, `purchase_items(purchase_id)`, `(product_id)`, `payments(sale_id)`, `(created_at)`, `deliveries(sale_id)`, `delivery_items(delivery_id)`, `(sale_item_id)`, `stock_movements(product_id)`, `small_sales(user_id)`, `(created_at)`, `small_sale_items(small_sale_id)`, `(product_id)`.

### 4.5 Triggers
- `on_auth_user_created` (after insert on `auth.users`) → crée le profil `users` : `full_name` depuis les metadata ou l'email ; rôle `admin` si la table est vide, sinon `employe` (metadata ignorées).
- `set_updated_at` (before update) sur `products`, `sales`, `shop_settings`.

### 4.6 Storage
Bucket public `product-images` : lecture publique, écriture/suppression réservées aux utilisateurs connectés. Fichiers JPG/PNG/WebP ≤ 2 Mo, nommés `<timestamp>-<aléa>.<ext>`. L'ancienne image est supprimée quand un produit change d'image ou est supprimé.

---

## 5. Règles métier

### 5.1 Numérotation
| Document | Format | Génération |
|---|---|---|
| Facture / devis | `FAC-AAAA-0001` | `max` de l'année + 1, sous verrou consultatif `pg_advisory_xact_lock` |
| Achat | `ACH-AAAA-0001` | idem |
| Bon de livraison | `BL-AAAA-0001` | idem |
| Reçu de paiement | `REC-AAAA-000001` | séquence `receipt_number_seq` |

Un devis reçoit son numéro `FAC-…` dès sa création (il le conserve à la confirmation).

### 5.2 Statuts d'une vente
- **Paiement** (`status`) : calculé à chaque écriture : `payee` si `amount_paid ≥ total > 0`, `partielle` si `0 < amount_paid < total`, sinon `credit`. `annulee` est terminal.
- **Livraison** (`delivery_status`) : `livree` pour une vente immédiate ; `en_attente` pour une vente échelonnée ou un devis ; `partielle` puis `livree` au fil des bons de livraison (comparaison Σ livré / Σ commandé).
- **Devis** (`quote_status`) : `draft` (devis) → `confirmed` (facture) ou `cancelled`.

### 5.3 Effet des opérations sur le stock
| Opération | Stock | Mouvement créé (`reason`) |
|---|---|---|
| Vente immédiate | − quantité de chaque ligne | `Vente FAC-…` (sortie) |
| Vente échelonnée / devis | aucun | — |
| Bon de livraison | − quantité livrée | `Livraison BL-…` (sortie) |
| Confirmation d'un devis | aucun (la facture est `en_attente`, à livrer par BL) | — |
| Annulation d'une facture | + ce qui est réellement sorti : tout si `livree`, Σ livré si `partielle`, rien si `en_attente` | `Annulation vente FAC-… - produit` (entrée) |
| Annulation d'un devis | aucun | — |
| Modification des lignes d'une facture | autorisée **uniquement** s'il n'existe aucun BL : si `livree` immédiate, restitue les anciennes lignes puis sort les nouvelles ; si devis ou `en_attente`, aucun mouvement | `Rectification facture FAC-…` / `Vente rectifiée FAC-…` |
| Petite vente | − quantité | `Petite vente rapide` (sortie) |
| Modification / annulation d'une petite vente | restitue puis re-sort / restitue | `Rectification petite vente …`, `Annulation petite vente …` |
| Achat fournisseur | + quantité ; `products.purchase_price` ← dernier `unit_cost` | `Achat ACH-… — fournisseur` (entrée) |
| Annulation / modification d'un achat | − quantité (refus si stock insuffisant) | `Annulation achat ACH-…`, `Rectification achat ACH-…` |
| Entrée/sortie manuelle | ± quantité | motif saisi (`Réapprovisionnement` par défaut) |
| Correction d'un mouvement manuel | annule l'ancien delta, applique le nouveau | le mouvement est mis à jour |

Contrôles :
- Toute sortie vérifie `stock ≥ quantité` sous verrou, sinon erreur « Stock insuffisant pour le produit X (disponible : N) ».
- Le stock ne peut jamais devenir négatif (contrainte + contrôles RPC).
- Les mouvements dont le motif commence par `Vente `, `Achat `, `Livraison `, `Annulation `, `Confirmation devis `, `Petite vente`, `Rectification `, `Vente rectifiée `, `Achat rectifié ` sont **système** : ni modifiables ni supprimables.

### 5.4 Paiements
- À la création d'une facture : montant payé = total par défaut ; option « paiement partiel / crédit » avec montant libre ∈ [0, total]. Un client nommé est **obligatoire** dès que la vente n'est pas intégralement payée.
- Chaque paiement (initial ou ultérieur) crée une ligne `payments`, un `receipt_number`, met à jour `amount_paid`, `status`, `payment_method`, `last_payment_at`.
- Un paiement ne peut pas dépasser le reste dû ; impossible sur une facture annulée.
- Modifier une facture ne peut pas amener `total` sous `amount_paid`.
- Achats : même logique (`add_purchase_payment`), sans reçu.

### 5.5 Devis
- Créé avec `quote_status = 'draft'`, `amount_paid = 0`, `status = 'credit'`, `delivery_status = 'en_attente'`. N'affecte ni le stock ni le chiffre d'affaires.
- Confirmer → `confirmed`, statut de paiement recalculé, livraison via BL. Annuler → `cancelled` (admin).
- Un devis ne peut pas recevoir de BL ni de paiement tant qu'il n'est pas confirmé.

### 5.6 Indicateurs financiers (définitions)
- **Vente comptée** : `status ≠ 'annulee'` et `quote_status ≠ 'draft'`.
- **Recettes (Finances)** : Σ `total` des ventes comptées + Σ `total` des petites ventes (montant facturé, toutes périodes).
- **Revenus du mois (Dashboard)** : Σ `amount_paid` des ventes comptées du mois + Σ `total` des petites ventes du mois (montant encaissé).
- **Marge brute** : Σ (`unit_price` − `purchase_price`) × `quantity` sur les lignes, − remise de la vente. `purchase_price` de la ligne est figé au moment de la vente (copie du catalogue).
- **Bénéfice** : marge brute − dépenses.
- **Dette clients** : Σ (`total` − `amount_paid`) des ventes comptées. **Dette fournisseurs** : idem sur les achats non annulés.
- **Produit en alerte** : `stock ≤ alert_threshold`.

---

## 6. Fonctions RPC (PostgreSQL, `security definer`, `set search_path = public`)

Toutes sont accordées au rôle `authenticated`, lèvent des exceptions en français lisibles par l'utilisateur, et verrouillent (`for update`) les lignes qu'elles modifient.

| Fonction | Paramètres | Comportement | Restriction |
|---|---|---|---|
| `create_sale` | `p_client_id, p_user_id, p_discount, p_items jsonb, p_amount_paid, p_delivery_mode ('immediate'\|'staged'), p_quote_status ('confirmed'\|'draft')` | Valide lignes/remise/paiement, numérote, insère vente + lignes (prix d'achat lu du catalogue) + paiement initial + mouvements de stock (si immédiate et confirmée). Retourne la vente. | — |
| `update_sale_items` | `p_sale_id, p_items, p_discount, p_client_id, p_keep_client` | Remplace les lignes, la remise et le client ; recalcule sous-total/total/statut ; gère le stock selon §5.3 ; refuse si BL existant ou si `amount_paid > nouveau total`. | admin |
| `add_sale_payment` | `p_sale_id, p_amount, p_method, p_reference, p_notes` | Paiement partiel + reçu. | — |
| `confirm_quote` / `cancel_quote` | `p_sale_id, p_user_id` | Voir §5.5. | cancel : admin |
| `cancel_sale` | `p_sale_id, p_user_id` | Annulation + restitution selon §5.3. | admin |
| `create_delivery` | `p_sale_id, p_items [{sale_item_id, quantity_delivered}], p_notes` | Numérote, vérifie reste à livrer et stock, sort le stock, met à jour `delivery_status`. Refuse devis et factures annulées. | — |
| `create_small_sale` / `update_small_sale` / `cancel_small_sale` | `p_items, p_user_id, p_notes, p_discount` / `p_sale_id, …` / `p_sale_id` | Petite vente atomique ; annulation = restitution + suppression. | cancel : admin |
| `create_purchase` | `p_supplier_id, p_user_id, p_amount_paid, p_notes, p_items [{product_id, product_name, quantity, unit_cost}]` | Numérote, insère, entre le stock, met à jour le prix d'achat catalogue. | — |
| `update_purchase_items` | `p_purchase_id, p_items` | Reverse puis réapplique ; refuse si stock insuffisant ou total < payé. | admin |
| `add_purchase_payment` | `p_purchase_id, p_amount` | Paiement fournisseur. | — |
| `cancel_purchase` | `p_purchase_id, p_user_id` | Retire le stock (refus si déjà vendu). | admin |
| `add_stock_entry` | `p_product_id, p_quantity, p_reason, p_user_id` | Entrée manuelle. | — |
| `update_stock_movement` / `delete_stock_movement` | `p_movement_id, p_product_id, p_quantity, p_reason, p_type, p_user_id` / `p_movement_id` | Correction d'un mouvement **manuel**, stock recalculé, jamais négatif. | admin |
| `next_invoice_number`, `next_purchase_number`, `next_delivery_number`, `next_receipt_number` | — | Numérotation §5.1. | interne |
| `is_admin()` | — | `true` si `auth.uid()` a le rôle admin. | — |
| `is_system_stock_movement(reason)` | — | Détection des mouvements système. | — |

Le paramètre `p_user_id` est conservé pour compatibilité mais remplacé en interne par `auth.uid()`.

---

## 7. Sécurité

### 7.1 Authentification
Supabase Auth, email + mot de passe, session persistante avec rafraîchissement automatique. Inscriptions publiques **désactivées** dans le projet Supabase.

### 7.2 Row Level Security (activée sur toutes les tables)
| Table(s) | select | insert | update | delete |
|---|---|---|---|---|
| `users` | authentifié (annuaire de l'équipe) | admin | admin | admin |
| `categories`, `products`, `clients`, `suppliers`, `purchases`, `expenses` | authentifié | authentifié | authentifié | admin |
| `supplier_products` | authentifié | authentifié | authentifié | authentifié |
| `sales` | authentifié | authentifié | admin | admin |
| `sale_items`, `purchase_items`, `payments`, `deliveries`, `delivery_items`, `stock_movements`, `small_sale_items` | authentifié | authentifié | — (RPC) | — (RPC) |
| `small_sales` | authentifié | authentifié | — (RPC) | admin |
| `shop_settings` | public | — | admin | — |

### 7.3 Edge Functions
- `manage-users` : `POST {action:'create', email, password, full_name, role}` / `{action:'delete', user_id}`. Vérifie le JWT de l'appelant, puis son rôle admin via la clé `service_role` ; crée le compte confirmé (`auth.admin.createUser`) et applique le rôle ; refuse l'auto-suppression et la suppression du dernier admin.
- `send-whatsapp` (optionnelle) : `POST {phone, message}` → API Meta Cloud. Appelant authentifié obligatoire, numéro validé `^\d{8,15}$`, `ALLOWED_ORIGIN` configurable.

### 7.4 Secrets
`.env` (jamais commité) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `service_role`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` uniquement en secrets Supabase. `node_modules/` et `dist/` hors git ; `package-lock.json` versionné.

---

## 8. Spécifications fonctionnelles par écran

### 8.0 Éléments communs
- **Layout** : barre latérale (fixe ≥ 1024 px, tiroir sur mobile) avec logo, nom de la boutique (depuis les paramètres), navigation, lien Utilisateurs (admin), profil ; barre supérieure avec bouton menu (mobile), recherche globale (produits + clients, 5 résultats chacun, clic → page concernée), cloche de stock faible (badge = nombre de produits en alerte, liste déroulante), bascule clair/sombre, menu utilisateur (nom, rôle, déconnexion).
- **Listes** : recherche instantanée (remet à la page 1), pagination 10 lignes, tableau sur desktop / cartes sur mobile, actions par icônes avec `title`, état vide illustré, état de chargement.
- **Formulaires** : modales (`role="dialog"`, Échap, focus piégé), validation côté client puis message d'erreur serveur affiché tel quel ; toasts (succès vert, erreur rouge, 4 s, fermables) pour chaque mutation ; boutons désactivés pendant l'envoi.
- **Confirmation** avant toute annulation/suppression (message explicite sur l'effet sur le stock).
- **Erreurs** : un `ErrorBoundary` global affiche un écran « Une erreur est survenue » + bouton Recharger ; les échecs de chargement remontent en toast ; le Dashboard propose « Réessayer ».
- **Thème** : préférence système par défaut, mémorisée dans `localStorage` (`mabane-theme`).
- **Badges de statut** : Payé (vert), Partiel (ambre), À crédit (rouge), Annulée (gris) ; En attente (gris), Partiellement livrée (ambre), Livrée (vert) ; Devis (violet), Confirmé (vert), Annulé (gris).

### 8.1 Connexion (`/login`)
Logo, nom de la boutique, email, mot de passe (œil afficher/masquer), bouton « Se connecter ». Erreur générique « Email ou mot de passe incorrect ». Redirection vers `/` si déjà connecté ; toute route protégée renvoie vers `/login`.

### 8.2 Tableau de bord (`/`)
Salutation avec le prénom. Quatre cartes : **Ventes du jour** (nombre factures + petites ventes, montant encaissé), **Revenus du mois**, **Bénéfice réel du mois** (marge − dépenses, vert/rouge), **Produits en rupture** (nombre en alerte / total).
Blocs : « Revenus, dépenses & bénéfice » (barres : revenus, marge, dépenses, bénéfice), « Santé du stock » (donut ok / en alerte), « Alertes de stock » (liste triée par stock croissant, seuil, unité), « Top produits (ce mois) » (barres horizontales, 6 max, quantité + CA, factures + petites ventes confondues). Rafraîchissement automatique toutes les 60 s.

### 8.3 Ventes / Facturation (`/ventes`)
- En-tête : total de la **dette clients**, boutons « Nouveau devis » et « Nouvelle facture ». Recherche par n° facture, nom ou téléphone client.
- **Nouvelle facture / devis** (modale large) : client (sélecteur recherchable, « Client comptoir » par défaut, création rapide impossible ici), ajout de produits par sélecteur recherchable (nom, prix, stock), panier avec quantité éditable (min 1, contrôle du stock sauf devis), prix unitaire pré-rempli modifiable, suppression de ligne ; remise (≤ sous-total) ; mode de livraison « Immédiate » / « Échelonnée » ; case « Paiement partiel / crédit » → montant payé (client obligatoire) ; récapitulatif sous-total / remise / total / payé / reste. Après création avec avance : proposition de télécharger / envoyer le **reçu**.
- **Liste** : date relative (Aujourd'hui/Hier), avatar initiales client, n°, montant, encaissé / reste, badges statut × 3, actions :
  - devis : Voir, Confirmer, Annuler (admin) ;
  - facture : Voir, PDF, WhatsApp (désactivé sans téléphone), Livraisons (si non livrée), Payer (si reste > 0), Annuler (admin), Modifier (admin, masqué si livraison partielle), Supprimer (admin, factures annulées seulement).
- **Détail** : client, date, lignes, totaux, historique des paiements (reçu, mode, montant, date, bouton reçu PDF), boutons PDF / WhatsApp / Payer / Livraisons.
- **Paiement** : montant (≤ reste dû), mode (espèces, mobile money, virement, chèque, carte), référence, note → reçu proposé (PDF / WhatsApp).
- **Livraisons** : liste des BL existants (n°, date, lignes, PDF) ; « Nouveau bon » : pour chaque ligne, quantité à livrer (≤ reste), notes.
- **Modifier la facture** (admin) : client, remise, lignes (ajout, quantité, prix, suppression, au moins une ligne) ; contrôle du stock disponible = stock actuel + quantités de la facture d'origine (ventes immédiates) ; refus si le total passe sous l'encaissé.

### 8.4 Petites ventes (`/petites-ventes`)
Page « caisse » en deux colonnes. Gauche : en-tête avec statistiques du jour (montant, nombre, ticket moyen) ; sélecteur recherchable + **grille de 8 produits rapides** (en stock) ajoutables en un clic ; panier avec stepper −/+, prix unitaire éditable, sous-total par ligne, remise, **total à encaisser** mis en évidence, notes, bouton « Encaisser » ; message de succès. Droite : cartes statistiques + historique récent (vendeur, lignes, total, boutons Modifier, Supprimer (admin)). Modale de modification avec le même panier.

### 8.5 Produits (`/produits`)
Recherche, filtre catégorie, export Excel (Produit, Catégorie, Fournisseurs, Prix achat, Prix vente, Stock, Seuil), « Nouveau produit ». Liste : image (ou icône), nom, catégorie (badge coloré), prix achat / vente + **pilule de marge %**, stock (badge rouge si ≤ seuil), unité, fournisseurs liés, actions Voir / Modifier / Supprimer (admin).
Formulaire : nom, catégorie, prix d'achat, prix de vente, **stock initial** (en lecture seule à la modification — corriger via Stock), seuil d'alerte (pré-rempli avec le seuil par défaut des paramètres), unité, image (JPG/PNG/WebP ≤ 2 Mo, aperçu). Détail : fiche + **historique d'achats par fournisseur** (dernier prix, date, quantité totale).

### 8.6 Catégories (`/categories`)
CRUD nom (unique) + description, nombre de produits par catégorie, suppression admin (produits passent « sans catégorie »).

### 8.7 Stock (`/stock`)
Bouton « Entrée / Sortie » (produit, type, quantité, motif). Liste des mouvements (200 derniers) : type avec signe ±, produit, quantité, motif, utilisateur, date ; recherche par produit/motif. Actions Voir, Modifier, Supprimer **uniquement** pour l'admin et les mouvements manuels ; les mouvements système affichent une explication.

### 8.8 Clients (`/clients`)
CRUD nom, téléphone WhatsApp (obligatoire), adresse. Liste avec total acheté, nombre de factures, **dette** ; action « Historique des achats » (liste des factures du client avec statut et reste dû, paiement possible depuis l'historique). Suppression admin (les factures conservent le client à `null`).

### 8.9 Fournisseurs (`/fournisseurs`)
CRUD nom, responsable, téléphone, email (validé), adresse, produits fournis (texte) + **cases à cocher des produits du catalogue** (`supplier_products`), conditions de paiement, notes. Liste avec total des achats et **dette fournisseur** ; détail avec historique des achats et bouton « Payer » (paiement fournisseur).

### 8.10 Achats fournisseurs (`/achats`)
« Nouvel achat » : fournisseur (obligatoire), produits (coût unitaire pré-rempli avec le prix d'achat catalogue, modifiable), quantité, montant payé (≤ total), notes. Liste : n° `ACH-…`, fournisseur, total, payé / reste, statut, actions Voir, Payer, Modifier (admin), Annuler (admin), Supprimer (admin, annulés). Détail avec lignes et paiements.

### 8.11 Finances (`/finances`)
Cartes **Recettes totales**, **Dépenses totales**, **Bénéfice réel** (définitions §5.6). Export Excel des ventes (N°, Client, Téléphone, Sous-total, Remise, Total, Encaissé, Reste dû, Statut, Date) et des dépenses. CRUD dépenses (libellé, montant, catégorie libre) avec recherche, détail, suppression admin.

### 8.12 Paramètres (`/parametres`)
Profil (nom, email, rôle), thème. Bloc **Boutique** (admin) : nom, gérant, adresse, activités (séparées par virgules), téléphones 1-3, seuil d'alerte par défaut. Les valeurs alimentent immédiatement le logo/nom de l'interface, la page de connexion et les PDF.

### 8.13 Utilisateurs (`/utilisateurs`, admin)
Liste (nom, email, rôle modifiable par liste déroulante, badge « Vous »), recherche, « Nouveau compte » (nom, email, mot de passe ≥ 6, rôle) via `manage-users`, suppression (confirmation) sauf soi-même, détail.

---

## 9. Documents et envois

### 9.1 PDF (jspdf, police NotoSans TTF chargée à la demande, repli Helvetica)
> Pour AKA SAKHINE, la mise en page exacte (reproduction du carnet papier) est définie en **§ 15.3**, qui prévaut sur les généralités ci-dessous.
Format **ticket 120 mm de large**, hauteur calculée selon le contenu, marges 5 mm, cadre noir. Tous partagent l'en-tête : nom de la boutique (gras, centré), gérant, activités (3 lignes), adresse, téléphones ; « Date : jj/mm/aaaa ».
- **Facture / Devis** : titre `FACTURE` (ou `DEVIS`, mention `BROUILLON`), n°, « Client : », mention « DOIT », état de livraison si non livrée, tableau QTE / DESIGNATION / P. UNIT. / PRIX TOTAL, remise éventuelle, **MONTANT TOTAL**, ligne « Arrêtée à présente facture à la somme de ______ », zone signature.
- **Bon de livraison** : titre `BON DE LIVRAISON`, n° `BL-…`, « Client : », « Facture : FAC-… », tableau des quantités livrées, total, signature.
- **Reçu de paiement** : titre `REÇU DE PAIEMENT`, n° `REC-…`, facture, date, client, mode, référence, **MONTANT PAYÉ**, total facture, reste, note, « Merci pour votre confiance. ».
Nom de fichier = numéro du document. Chaque générateur expose `download…PDF()` et `get…PDFBlob()`.

### 9.2 WhatsApp
`sendInvoiceViaWhatsApp(sale)` et `sendReceiptViaWhatsApp(receipt)` : numéro normalisé (`77 845 28 72` → `221778452872`, `00`/`+` acceptés, valeurs non numériques rejetées) ; sur mobile, partage du PDF via `navigator.share` (fichiers) ; sinon ouverture de `https://wa.me/<numéro>?text=<message>`. Message facture : « Bonjour {client}, voici votre facture N°{n°} de la {boutique} d'un montant de {total} FCFA. Merci pour votre confiance 🙏 ». Boutons désactivés sans téléphone.

### 9.3 Excel
SheetJS, une feuille par export, en-têtes en français, montants numériques, fichier `ventes-<boutique>-<timestamp>.xlsx` etc. Les exports respectent le même périmètre que les totaux affichés.

---

## 10. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Responsive | Mobile (≥ 360 px), tablette, desktop ; tableaux → cartes sous 768 px ; barre latérale en tiroir sous 1024 px |
| Performance | Pages en `React.lazy` ; jspdf, SheetJS, recharts hors du bundle initial (bundle initial ≤ 500 Ko brut / 150 Ko gzip) ; logo ≤ 60 Ko ; police d'interface servie localement (pas de Google Fonts) ; `staleTime` 30 s, `retry` 1 ; la cloche de stock faible utilise une requête légère dédiée |
| Accessibilité | Modales `role="dialog"`/`aria-modal`, Échap, focus piégé et restitué, boutons icône avec `title`/`aria-label`, contrastes en clair et sombre |
| Robustesse | Aucune écriture multi-tables côté client ; toutes les erreurs serveur affichées ; `ErrorBoundary` |
| Données | Aucun `drop table`/`delete` dans le script de schéma ; script rejouable (idempotent) sur une base existante |
| Langue | Interface, messages d'erreur et documents en français |
| Navigateurs | Chrome/Edge/Firefox/Safari des 2 dernières années, Android Chrome, iOS Safari |

---

## 11. Qualité et livraison

- `npm run lint` (oxlint : catégorie `correctness` en erreur, `no-unused-vars`), `npm test` (Vitest : marges, dette, normalisation téléphone, format monétaire — 100 % des fonctions de `utils/finance.js` et `normalizePhone`), `npm run build` doivent passer ; workflow GitHub Actions exécutant les trois sur chaque push/PR.
- Aucun `console.log` en production (seuls `warn`/`error` tolérés), pas de code mort, pas de secret dans le code.
- Retours (encodages) : fichiers UTF-8.

### 11.1 Livrables
1. Code source (dépôt git, sans `node_modules`, `.env.example` avec placeholders).
2. `supabase/schema.sql` unique et idempotent + Edge Functions.
3. `README.md` : installation, création des comptes, déploiement des fonctions, WhatsApp.
4. Rapport de tests (lint/tests/build verts) et captures des écrans principaux (clair + sombre, mobile + desktop).

### 11.2 Procédure d'installation attendue
1. Créer un projet Supabase ; exécuter `schema.sql` ; désactiver les inscriptions publiques.
2. Créer le premier compte (dashboard Auth) → admin automatique.
3. `supabase functions deploy manage-users` (+ `send-whatsapp` si souhaité).
4. `.env` avec URL + clé anon ; `npm install` ; `npm run dev` / `npm run build` → hébergement statique (Vercel, Netlify…).

---

## 12. Critères d'acceptation (scénarios de recette)

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | Créer un produit (stock 10), vendre 3 en petite vente, 2 en facture immédiate | Stock = 5 ; 2 mouvements `sortie` ; dashboard du jour = 2 ventes, montant encaissé exact |
| 2 | Facture échelonnée de 10 unités, BL de 4 puis de 6 | Stock −4 puis −6 ; statut livraison `partielle` puis `livree` ; 2 BL numérotés `BL-…` |
| 3 | Annuler la facture du scénario 2 après le premier BL | Stock +4 seulement ; statut `annulee` ; mouvement « Annulation vente » |
| 4 | Devis 5 unités → confirmer → BL 5 | Aucun mouvement à la création ni à la confirmation ; −5 au BL ; le devis est exclu des recettes tant qu'il est `draft` |
| 5 | Facture 100 000 avec avance 30 000 sans client | Refus « Sélectionnez un client » ; avec client : statut `partielle`, reçu `REC-…`, dette client 70 000 |
| 6 | Payer 80 000 sur le reste de 70 000 | Refus « dépasse le solde restant dû » |
| 7 | Admin modifie la remise d'une facture payée pour faire passer le total sous l'encaissé | Refus explicite ; sinon `total`, `status` et dette recalculés |
| 8 | Employé tente d'annuler une facture / supprimer une petite vente / modifier un mouvement « Vente FAC-… » via l'API | Erreur serveur « Seul un administrateur… » / « mouvement généré par un document » |
| 9 | Inscription via l'API avec `role: 'admin'` dans les metadata | Compte créé `employe` (ou refusé si inscriptions désactivées) |
| 10 | Achat de 20 unités à 500, puis annulation après en avoir vendu 5 | Refus « déjà vendu ou stock a changé » |
| 11 | Générer facture, BL et reçu en PDF ; envoyer la facture par WhatsApp à un client avec numéro `77 123 45 67` | PDF au format §9.1 avec accents corrects ; lien `wa.me/221771234567` |
| 12 | Couper le réseau puis ouvrir le tableau de bord | Message d'erreur + « Réessayer », pas d'écran blanc |
| 13 | Rejouer `schema.sql` sur la base remplie | Aucune erreur, aucune donnée perdue |
| 14 | `npm run lint && npm test && npm run build` | Tous verts, bundle initial dans la limite §10 |

---

## 13. Glossaire
- **Petite vente** : vente comptoir sans facture ni client, décrémentant le stock.
- **Facture immédiate** : vente confirmée dont la marchandise part tout de suite.
- **Facture échelonnée** : vente confirmée livrée en un ou plusieurs bons de livraison.
- **Devis (brouillon)** : proposition sans effet sur le stock ni les recettes, transformable en facture.
- **Mouvement système** : mouvement de stock généré par un document ; non modifiable à la main.
- **Client comptoir** : vente sans client identifié (paiement intégral obligatoire).
- **Reste dû / dette** : `total − amount_paid`.
- **Secteur** : l'un des deux pôles d'AKA SAKHINE (Quincaillerie, Alimentation) ; chaque catégorie appartient à un secteur.

---

# PARTIE B — SPÉCIFICITÉS AKA SAKHINE

## 14. Identité de la boutique

Les valeurs ci-dessous sont **les données initiales** de `shop_settings` (§ 18) et doivent apparaître telles quelles sur les documents, la page de connexion et l'interface. Elles restent modifiables par l'admin dans Paramètres.

| Élément | Valeur (issue de la bannière et du carnet de factures) |
|---|---|
| Nom commercial | **AKA SAKHINE** |
| Sigle / logo | **AS** (lettres blanches et rouges sur un pique vert, cercle cerclé de rouge) — version carnet : cercle bleu « A.S » |
| Slogan (sérère) | **O kiin o pogoom** |
| Accroche | Ensemble pour un quotidien meilleur ! |
| Sous-titre d'activité | QUINCAILLERIE – ALIMENTATION (le carnet actuel mentionne « et services » : les activités de multiservice sont **hors périmètre** de l'application et ne figurent pas sur les documents) |
| Secteurs | **Quincaillerie** · **Alimentation** |
| Gérant | **PASCAL NDOUR** |
| Adresse | Diouroup marché, 100 m face de la mairie — Diouroup (Sénégal) |
| Téléphones | (+221) 77 356 41 18 · 77 724 67 88 · 77 885 30 17 · 77 161 41 16 |
| Horaires | 8h à 22h, 7j/7 |
| NINEA | 007261423 |
| Moyens de paiement acceptés | Espèces, Orange Money, Wave (modes de règlement d'une vente — le service de transfert d'argent lui-même est hors périmètre) |
| Pays / devise / langue | Sénégal · FCFA · français (interface), sérère (slogan uniquement) |

Offre affichée sur la bannière (sert de base aux catégories initiales, § 18) :
- **Quincaillerie** : matériaux, outils, peinture, électricité, plomberie, jardinage, et bien d'autres.
- **Alimentation** : riz, huile, oignons, lait, vinaigre, moutarde, mayonnaise, et bien d'autres.
- *(Le pôle « Service » de la bannière — transfert d'argent, achat de crédit, livraison, réparation — n'est pas géré par l'application.)*

---

## 15. Charte graphique

### 15.1 Couleurs
Extraites de la bannière (valeurs hexadécimales de référence ; le fournisseur du logo vectoriel peut communiquer les valeurs Pantone exactes, à utiliser en priorité).

| Rôle | Nom | Hex | Usage |
|---|---|---|---|
| Primaire | Vert AKA | `#0E8A3E` | Boutons principaux, liens, élément actif du menu, secteur Alimentation, courbes « revenus » |
| Primaire foncé | Vert profond | `#0A6B30` | Survol des boutons, en-têtes de tableau sombres, bas de page |
| Secondaire | Rouge SAKHINE | `#E3161B` | Titre « SAKHINE », secteur Quincaillerie, alertes de stock, dettes, actions destructives (annuler, supprimer) |
| Accent | Jaune soleil | `#FFC20E` | Badges d'attention (paiement partiel, devis), pictogrammes horaires/téléphone, mises en avant |
| Neutre foncé | Noir charbon | `#1B1B1B` | Texte principal, slogan |
| Neutre clair | Blanc | `#FFFFFF` | Fonds, texte sur aplats colorés |
| Gris interface | Gris 50 → 900 (Tailwind `gray`) | — | Fonds secondaires, bordures, texte atténué |
| Carnet | Bleu facture | `#1F7AC0` | **Uniquement** pour la facture PDF (§ 15.3), pour rester identique au carnet papier |
| Carnet | Rouge tampon | `#D3232A` | Numéro de facture sur le PDF (imite le tampon numéroteur rouge du carnet) |

Règles :
- Le **vert** est la couleur d'action ; le **rouge** est réservé aux alertes et aux actions irréversibles pour ne pas banaliser le signal. Ne jamais mettre du texte rouge sur fond vert ni l'inverse (contraste insuffisant, dyschromatopsie) ; séparer par du blanc comme sur la bannière.
- Statuts : Payé = vert, Partiel = jaune/ambre, À crédit = rouge, Annulé = gris, Devis = violet `#7C3AED` (couleur hors charte, volontairement neutre).
- **Secteurs** : chaque secteur a sa couleur (Quincaillerie rouge, Alimentation vert) reprise dans les badges de catégorie, le filtre Produits et la grille de produits rapides des petites ventes.
- **Mode sombre** : fond `#0F172A`, cartes `#1E293B` ; le vert passe à `#22B35B` et le rouge à `#F0464B` pour garder un contraste AA (≥ 4,5:1) sur fond sombre. Le jaune reste `#FFC20E`.
- Contraste AA minimal partout ; le vert `#0E8A3E` sur blanc et le blanc sur `#0E8A3E` / `#E3161B` / `#1B1B1B` sont conformes.

Implémentation Tailwind (`tailwind.config.js`) : `brand` = déclinaison du vert (50 → 900, 600 = `#0E8A3E`), `accent` = rouge, `sun` = jaune, `sector.quincaillerie` / `sector.alimentation`. Tout composant utilise ces tokens, jamais de couleur en dur.

### 15.2 Logo et typographie
- **Logo** : pique (♠) vert à contour rouge dans un cercle blanc cerclé de rouge, lettres « AS » (A rouge, S blanc ombré) au centre, petit « AS » gris en haut. Fourni en SVG (§ 19). Déclinaisons à générer : couleur sur blanc, monochrome blanc (mode sombre / fond vert), monochrome noir (impression), favicon 32/180/512 px, icône d'application 512 px (PWA).
- Zone de protection : ½ diamètre du cercle tout autour ; taille minimale 24 px à l'écran, 12 mm à l'impression.
- **Nom** : « AKA » en vert, « SAKHINE » en rouge, capitales, police grasse extra-condensée à empattement nul avec léger italique (type *Montserrat ExtraBold Italic* / *Kanit Bold*). Le slogan « O kiin o pogoom » en italique script noire (type *Pacifico* ou *Lobster*). Ces deux polices ne servent **que** pour le bloc logo (page de connexion, en-tête de la barre latérale) et sont fournies en fichiers locaux (pas de Google Fonts en ligne).
- **Interface** : *Inter* (400/500/600/700, servie localement). Titres 600, corps 400/500, chiffres en `tabular-nums` dans les tableaux et cartes.
- **PDF** : *Noto Sans* Regular/Bold TrueType (accents garantis). Le nom de la boutique sur les PDF est composé en Noto Sans Bold capitales, **contour** épais imitant le lettrage du carnet (voir § 15.3).

### 15.3 La facture — reproduction du carnet papier
Le PDF de facture doit reproduire le carnet actuel (photo fournie) pour que les clients retrouvent le même document. Format ticket **120 mm de large**, hauteur adaptée au contenu, tout en **bleu facture** `#1F7AC0` sur blanc, cadre et filets en pointillés/hachures fines comme sur le carnet.

Ordre et contenu, de haut en bas :
1. **En-tête** : à gauche, logo circulaire « A.S » (version monochrome bleue) ; à droite sur toute la largeur restante, « **AKA SAKHINE** » en capitales contournées dans un cadre à double filet ; dessous « QUINCAILLERIE – ALIMENTATION » en capitales grasses.
2. Ligne « **Gérant :** PASCAL NDOUR » (nom en capitales contournées, encadrée).
3. Ligne « **Adresse :** Diouroup – (Sénégal) ».
4. Ligne « **Tél :** (+221) 77 356 41 18 // 77 724 67 88 // 77 885 30 17 // 77 161 41 16 » (séparateur `//`, grasse).
5. Bande date/titre/numéro : « **Date :** jj / mm / aaaa » à gauche (pointillés sous chaque partie) ; « **FACTURE** » au centre en lettrage tramé encadré (« **DEVIS** » + mention « BROUILLON » pour un devis) ; « **N°** 000528 » à droite, chiffres sur **6 positions** en **rouge tampon** `#D3232A`.
6. Ligne « **Client :** ………… **Doit** » (nom du client sur pointillés, « Doit » aligné à droite ; « Client comptoir » si aucun client).
7. **Tableau** à quatre colonnes, en-tête tramé : **QTE** (≈ 12 %) · **DESIGNATION** (≈ 48 %) · **P. UNIT.** (≈ 20 %) · **P. TOTAL** (≈ 20 %) ; lignes séparées par des filets fins ; quantité centrée, désignation à gauche, prix à droite ; unité affichée après la quantité si différente de « unité » (ex. `2 kg`, `5 L`).
8. Pied du tableau : « Remise » (si > 0), « **MONTANT TOTAL** » sur une ligne pleine, puis « Payé » et « **Reste à payer** » (si non soldée), mention de l'état de livraison si non livrée.
9. « Arrêtée la présente facture à la somme de : ………… » (montant en toutes lettres généré automatiquement, ex. *quarante-cinq mille francs CFA*).
10. Pied de page : « NINEA : 007261423 · Ouvert de 8h à 22h · Paiement : espèces, Orange Money, Wave » en petit, puis zone « Signature » à droite, et le slogan « O kiin o pogoom » centré en italique.

Le **bon de livraison** et le **reçu de paiement** reprennent le même en-tête (points 1 à 4) et le même style bleu ; leurs titres sont « BON DE LIVRAISON » et « REÇU DE PAIEMENT », numéros `BL-…` et `REC-…` en rouge tampon. Contenus : voir § 9.1.

### 15.4 Application de la charte dans l'interface
- **Page de connexion** : fond blanc (ou charbon en sombre), logo AS 96 px, « AKA SAKHINE » bicolore, slogan dessous, sous-titre « Quincaillerie · Alimentation », formulaire dans une carte, bouton vert « Se connecter ». Sous la carte : adresse, horaires et téléphones en gris, drapeau du Sénégal en petit (facultatif).
- **Barre latérale** : bloc logo (logo 40 px + « AKA » vert / « SAKHINE » rouge sur deux lignes), élément actif sur fond vert 10 % avec barre verte à gauche, icônes lucide.
- **Barre supérieure** : nom de la boutique, cloche avec badge **rouge** pour les alertes de stock.
- **Cartes de statistiques** : icône dans une pastille de la couleur du rôle (revenus vert, dépenses rouge, alertes jaune, produits gris), chiffres en `tabular-nums`.
- **Tableau de bord** : palette des graphiques = vert (revenus/marge), rouge (dépenses), jaune (bénéfice si positif → vert, si négatif → rouge), gris pour le fond des donuts ; barres du top produits colorées par **secteur**.
- **Petites ventes** : la grille de produits rapides est groupée par secteur avec un liseré de la couleur du secteur ; le total à encaisser est sur fond vert, en blanc, très grand.
- **Boutons** : primaire vert plein / blanc ; secondaire blanc bordé gris ; danger rouge plein ; succès (WhatsApp, encaisser) vert plein avec icône. Coins arrondis 12 px (cartes 16 px), ombres légères.
- **Onglet navigateur** : `<title>` « AKA SAKHINE – Gestion », `theme-color` `#0E8A3E`, favicon logo.

---

## 16. Adaptations fonctionnelles pour les trois secteurs

Le socle (partie A) est conçu pour une quincaillerie. AKA SAKHINE vend aussi de l'alimentation ; les adaptations suivantes sont **obligatoires**.

### 16.1 Secteurs et catégories
- Nouvelle colonne `categories.sector text not null default 'quincaillerie' check (sector in ('quincaillerie','alimentation'))`.
- Page Catégories : champ « Secteur » (liste), badge coloré par secteur, filtre par secteur. Page Produits : filtre par secteur **et** par catégorie ; badge de catégorie dans la couleur du secteur.
- Tableau de bord : nouvelle carte ou graphique « **Ventes par secteur (ce mois)** » (donut vert/rouge, montant et part en %). Finances : recettes et marge ventilées par secteur.

### 16.2 Unités et quantités (alimentation)
- Unités proposées par défaut : `unité`, `kg`, `g`, `L`, `sachet`, `bidon`, `carton`, `sac`, `paquet`, `bouteille`, `m`, `botte`. Liste modifiable dans Paramètres.
- La quantité accepte **jusqu'à 3 décimales** pour les unités de poids/volume (`quantity numeric(12,3)` sur `sale_items`, `small_sale_items`, `purchase_items`, `stock_movements`, `products.stock numeric(12,3)`) ; saisie avec pas 0,5 / 0,25 selon l'unité ; affichage sans décimales inutiles (`2 kg`, `1,5 kg`).
- Facultatif (à activer plus tard) : date de péremption sur les lots d'achat et alerte « expire dans 30 jours ».

### 16.3 Paramètres étendus
`shop_settings` reçoit : `phone4`, `ninea`, `opening_hours` (texte, « 8h à 22h »), `slogan`, `tagline` (accroche), `payment_methods_label` (« Espèces, Orange Money, Wave »), `units` (liste). Tous éditables dans Paramètres (admin) et utilisés par les PDF (§ 15.3), la page de connexion et le message WhatsApp.

### 16.4 Paiements
- Modes de paiement : `especes`, `orange_money`, `wave`, `virement`, `cheque`, `carte` (remplace `mobile_money` par les deux opérateurs réellement utilisés). Sur le reçu et la liste des paiements, Orange Money et Wave sont affichés avec leur nom exact.
- Message WhatsApp : « Bonjour {client}, voici votre facture N°{n°} de AKA SAKHINE d'un montant de {total} FCFA. Merci pour votre confiance 🙏 — O kiin o pogoom ».

### 16.5 Horaires
Le tableau de bord affiche discrètement « Ouvert aujourd'hui de 8h à 22h » (valeur des paramètres). Aucun blocage de saisie hors horaires.

---

## 17. Écrans : ajustements par rapport à la partie A

| Écran | Ajustement |
|---|---|
| Connexion | Bloc identité complet (§ 15.4), sous-titre deux secteurs |
| Tableau de bord | + donut « Ventes par secteur », ligne horaires |
| Produits | Filtre secteur, unités étendues, quantité décimale |
| Catégories | Champ Secteur, couleur par secteur |
| Petites ventes | Grille rapide groupée par secteur ; quantité décimale pour les unités de poids/volume |
| Ventes | Quantité décimale ; modes de paiement Orange Money / Wave |
| Stock | Quantités décimales |
| Finances | Recettes/marge par secteur ; export Excel avec colonne Secteur |
| Paramètres | Champs § 16.3, gestion des unités |

---

## 18. Données initiales (seed de `schema.sql`)

**`shop_settings`** : `name = 'AKA SAKHINE'`, `owner = 'PASCAL NDOUR'`, `address = 'Diouroup marché, 100 m face de la mairie - Diouroup (Sénégal)'`, `activities = 'Quincaillerie, Alimentation'`, `phone1..4 = '+221 77 356 41 18', '+221 77 724 67 88', '+221 77 885 30 17', '+221 77 161 41 16'`, `ninea = '007261423'`, `opening_hours = '8h à 22h'`, `slogan = 'O kiin o pogoom'`, `tagline = 'Ensemble pour un quotidien meilleur !'`, `payment_methods_label = 'Espèces, Orange Money, Wave'`, `low_stock_default_threshold = 5`.

**`categories`** (`name`, `sector`) :
- Quincaillerie : Matériaux (ciment, fer, sable…), Outils, Peinture, Électricité, Plomberie, Jardinage, Divers quincaillerie.
- Alimentation : Riz, Huile, Légumes (oignons, pommes de terre…), Produits laitiers, Condiments (vinaigre, moutarde, mayonnaise…), Épicerie, Boissons.


Aucune autre donnée (produits, clients, fournisseurs) n'est pré-remplie ; une **importation Excel** (modèle fourni : Nom, Catégorie, Unité, Prix achat, Prix vente, Stock initial, Seuil) est à prévoir pour le catalogue de départ (page Produits → « Importer »).

---

## 19. Éléments à fournir par le client (AKA SAKHINE)

| Élément | Format | Usage |
|---|---|---|
| Logo AS | SVG vectoriel (ou PNG ≥ 1024 px fond transparent) | Interface, PDF, favicon, icône PWA |
| Polices du bloc logo | fichiers `.woff2`/`.ttf` licenciés | Page de connexion, barre latérale |
| Photo nette du carnet de factures | JPG | Validation visuelle du PDF (§ 15.3) |
| Liste initiale du catalogue | Excel selon modèle | Importation |
| Liste des employés et rôles | texte | Création des comptes |
| Numéros WhatsApp Business à utiliser | texte | Envoi des documents |
| Accès Supabase (projet créé au nom du client) et nom de domaine | — | Déploiement |

Validation : une maquette de la page de connexion, du tableau de bord (clair + sombre, mobile + desktop) et un PDF de facture d'exemple sont soumis au gérant **avant** le développement des autres écrans ; son accord écrit sur ces trois éléments vaut validation de la charte.

---

## 20. Critères d'acceptation complémentaires (partie B)

| # | Scénario | Résultat attendu |
|---|---|---|
| B1 | Vendre 1,5 kg d'oignons (stock 10 kg) | Stock 8,5 kg ; facture affiche `1,5 kg` ; PDF idem |
| B2 | Filtrer les produits par secteur « Alimentation » | Seules les catégories du secteur ; badges verts |
| B3 | Générer la facture PDF d'une vente à crédit | Mise en page conforme au carnet (§ 15.3) : en-tête, Gérant, Tél avec `//`, N° rouge sur 6 chiffres, Client/Doit, tableau QTE/DESIGNATION/P. UNIT./P. TOTAL, montant en lettres, NINEA en pied |
| B4 | Paiement en Orange Money puis reçu | Mode « Orange Money » sur le reçu et dans l'historique |
| B5 | Modifier le slogan dans Paramètres | Page de connexion, barre latérale et PDF mis à jour sans redéploiement |
| B6 | Contraste | Tous les textes de l'interface passent AA (vérification automatique axe/Lighthouse ≥ 90 en accessibilité) |
