# Cahier des Charges — Application de Gestion de Quincaillerie

## 1. Contexte & objectif

Construire une **application web de gestion complète d’une quincaillerie** (point de vente matériel, construction, électricité, plomberie).

L’application doit permettre de :
- Gérer le **catalogue produits / fournisseurs / clients**.
- Effectuer des **entrées / sorties de stock** (achats fournisseurs, ventes, petites ventes rapides).
- Gérer la **facturation** (devis, factures immédiates, livraisons échelonnées, paiements par tranches, remçus de paiement).
- Produire des **PDF de factures, bons de livraison, reçus de paiement** et des **exports Excel**.
- Envoyer les documents par **WhatsApp**.
- Assurer un **tableau de bord** avec indicateurs clés.
- Contrôler l’accès via **RBAC** (admin / caissier / employé).

---

## 2. Périmètre fonctionnel

### 2.1 Modules

| Module | Fonctionnalités clés |
|---|---|
| **Dashboard** | Ventes du jour, recettes mensuelles, ruptures de stock, top produits, dette clients. |
| **Catalogue produits** | CRUD produits (nom, SKU, prix d’achat/vente, stock, seuil d’alerte, photo), catégorisation, recherche. |
| **Catégories** | CRUD catégories avec description. |
| **Clients / Fournisseurs** | CRUD (nom, téléphone, email, adresse). |
| **Achats fournisseurs** | CRUD achats + lignes ; entrée de stock automatique ; mise à jour du prix d’achat catalogue ; paiement partiel ; PDF bon de commande ; envoi WhatsApp. |
| **Ventes** | Devis (brouillon), factures immédiates, livraisons échelonnées, paiements par tranches, PDF facture / BL / reçu, envoi WhatsApp, envoi SMS optionnel. |
| **Petites ventes rapides** | Vente sans facture, stock décrémenté, annulation + restitution automatique. |
| **Stock** | Mouvements (entrée / sortie), historique, corrections (édition / suppression), seuil d’alerte. |
| **Finances** | Recettes, dépenses, bénéfice ; export Excel. |
| **Paramètres** | Infos boutique (nom, gérant, adresse, activités, téléphones), seuil stock défaut, thème clair/sombre. |
| **Utilisateurs** | RBAC — admin crée / édite / supprime les comptes ; caissier / employé avec permissions limitées. |
| **Auth** | Login / Register (création du premier admin par trigger) ; session persistante. |

---

## 3. Architecture technique

### 3.1 Stack
```
Frontend :   React 19 + Vite 8
UI         : Tailwind CSS 3
État serveur : TanStack React Query 5
Backend BaaS : Supabase (PostgreSQL 15, Auth, Storage, Edge Functions)
PDF          : jsPDF (client-side)
Excel        : SheetJS (xlsx)
WhatsApp     : Web Share API (fallback wa.me)
Lint         : oxlint
```

### 3.2 Structure du projet
```
src/
  assets/          logo / médias
  components/      Layout, Sidebar, Topbar, Modal, ConfirmDialog,
                   Pagination, StatCard, ThemeToggle, SearchableSelect, ProtectedRoute
  context/         AuthContext, ThemeContext, ToastContext
  hooks/           useSupabaseTable (générique), useSales, useSmallSales,
                   usePurchases, useProducts, useEntities, useDashboard,
                   useShopSettings, useSalePayments
  lib/             supabase.js (client), constants.js (SHOP, ROLES, currency, WHATSAPP_MESSAGE)
  pages/           auth/{Login,Register}, dashboard, products, categories,
                   stock, clients, suppliers, purchases, sales/{Sales,SmallSales},
                   expenses/Finances, settings, users/UsersAdmin
  utils/           invoicePdf.js, deliveryPdf.js, paymentReceiptPdf.js,
                   whatsapp.js, exportExcel.js
supabase/
  schema.sql       modèle de données + RPC + RLS + triggers + seed
  functions/
    send-whatsapp/ fonction Edge optionnelle (API Meta WhatsApp Cloud)
public/
  fonts/           NotoSans-Regular.woff2, NotoSans-Bold.woff2 (pour les PDFs)
```

---

## 4. Spécifications fonctionnelles détaillées

### 4.1 Gestion des ventes (Sales.jsx)
- **Création** :
  - Panier produit (Recherche + qty) ; calcul automatique du total, remise, TVA intégrée.
  - Modes : *facture immédiate*, *devis (brouillon)*, *livraison échelonnée*.
  - Option **vente à crédit / avance** : cocher “avance” → saisir le montant versé → le solde reste dû.
  - À la création avec avance → génération **automatique** d’un reçu de paiement PDF + proposition d’envoi WhatsApp.
- **Paiement partiel** :
  - Bouton “Enregistrer un paiement” → modale → montant, mode (espèces / mobile money / virement / chèque / carte), référence, note.
  - Après paiement → génération **automatique** du reçu + bouton téléchargement / envoi WhatsApp.
  - Historique des paiements visible dans la modale détail.
- **Actions** (selon rôle) :
  - Modifier client / remise / lignes (RPC `update_sale_items` — stock ajusté atomiquement).
  - Annuler (RPC `cancel_sale` — restitution intelligente du stock selon `delivery_status`).
  - Confirmer un devis (RPC `confirm_quote`).
  - Gérer les livraisons (RPC `create_delivery`).
  - Télécharger PDF / envoyer WhatsApp.

### 4.2 Petites ventes rapides (SmallSales.jsx)
- Vente sans facture ; saisie libre produit / qty / prix de vente.
- Stock décrémenté ; mouvement `sortie` enregistré.
- Suppression → RPC `cancel_small_sale` (restitution stock automatique).
- Historique dans le tableau.

### 4.3 Achats fournisseurs (Purchases.jsx)
- CRUD achats + lignes.
- RPC `create_purchase` : incrémente le stock, met à jour le `purchase_price` catalogue.
- Paiement partiel fournisseur (`add_purchase_payment`).
- PDF bon de commande ; export.

### 4.4 Stock (Stock.jsx)
- Liste des mouvements (entrée / sortie) avec signe (+ / -), produit, raison, date, utilisateur.
- Correction d’un mouvement → RPC `update_stock_movement` (ajuste le stock différenciablement).
- Suppression → RPC `delete_stock_movement` (restitution ou rétablissement selon le type).

### 4.5 Dashboard (Dashboard.jsx)
- Indicateurs en temps réel (React Query, auto-refresh 60s).
- Graphiques ventes / recettes / dépenses.
- Top produits, ruptures, dette clients.

### 4.6 Finances (Finances.jsx)
- Vue agrégée recettes (ventes) / dépenses (sorties, achats).
- Marge par produit.
- Export Excel.

---

## 5. Spécifications techniques

### 5.1 Modèle de données clé (PostgreSQL)

```sql
-- clients / fournisseurs
CREATE TABLE clients  (id uuid pk, name, phone1..3, email, address, payment_terms, products_supplied, notes, created_at);
CREATE TABLE suppliers(id uuid pk, name, phone1..3, email, address, payment_terms, products_supplied, notes, created_at);

-- catalogue
CREATE TABLE categories   (id uuid pk, name, description);
CREATE TABLE products      (id uuid pk, name, category_id, sku, sale_price, purchase_price, stock, alert_threshold, unit, ...);
CREATE TABLE supplier_products (supplier_id, product_id, supplier_sku, supplier_price);  -- relation N:N

-- mouvements
CREATE TABLE stock_movements(id uuid pk, product_id, type CHECK(entree/sortie), quantity, reason, user_id, created_at);

-- ventes / petites ventes
CREATE TABLE sales        (id uuid pk, invoice_number, client_id, user_id, status CHECK(...), delivery_status, quote_status, subtotal, discount, total, amount_paid, payment_method, receipt_number, last_payment_at, created_at);
CREATE TABLE sale_items   (id uuid pk, sale_id, product_id, product_name, quantity, purchase_price, unit_price, line_total);
CREATE TABLE small_sales  (id uuid pk, user_id, notes, subtotal, discount, total, created_at);
CREATE TABLE small_sale_items(id uuid pk, small_sale_id, product_id, product_name, quantity, purchase_price, unit_price, line_total);

-- paiements (reçus)
CREATE TABLE payments (id uuid pk, sale_id, amount, method, reference, notes, created_by, created_at);

-- achats / livraisons / finances
CREATE TABLE purchases        (id uuid pk, purchase_number, supplier_id, ...amount_paid, status, ...);
CREATE TABLE purchase_items   (id uuid pk, purchase_id, product_id, ...);
CREATE TABLE deliveries       (id uuid pk, sale_id, delivery_number, ...);
CREATE TABLE delivery_items   (id uuid pk, delivery_id, sale_item_id, quantity_delivered);
CREATE TABLE expenses         (id uuid pk, category, amount, ...);
CREATE TABLE shop_settings    (singleton, name, owner, address, activities, phone1..3, low_stock_default_threshold, updated_at);
```

### 5.2 RPC critiques (atomicité + verrous)
| RPC | Utilité | Verrou |
|---|---|---|
| `create_sale` | vente + stock + numéro facture | `pg_advisory_xact_lock` + `FOR UPDATE` produits |
| `create_small_sale` | petite vente rapide + stock | `FOR UPDATE` |
| `confirm_quote` | transformation devis → facture | `FOR UPDATE` |
| `create_delivery` | bon de livraison échelonnée | `FOR UPDATE` |
| `create_purchase` | achat + stock + prix d’achat | `FOR UPDATE` |
| `add_sale_payment` | paiement partiel + reçu | `FOR UPDATE` vente + insertion `payments` |
| `cancel_sale` | annulation + restitution stock | `FOR UPDATE` |
| `update_sale_items` | édition lignes + stock ajusté | `FOR UPDATE` |
| `update_purchase_items` | édition lignes achat + stock | `FOR UPDATE` |
| `update_stock_movement` / `delete_stock_movement` | correction manuelle | `FOR UPDATE` |

### 5.3 Sécurité
- **RLS** sur toutes les tables : un utilisateur ne voit/modifie que ce qui lui est autorisé.
  - `users` : admin = CRUD complet ; `auth.uid() = id and role = 'employe'` pour la mise à jour du profil soi-même.
  - `sales`, `small_sales`, etc. : lecture authentifiée ; écriture authentifiée ; suppression réservée à l’admin.
- **RBAC** : rôles `admin`, `caissier`, `employe` dans `users.role`.
- **Trigger `handle_new_user`** : premier utilisateur → admin ; suivants → `employe` (ignorant tout `role = admin` passé par `raw_user_meta_data` pour éviter l’escalade).
- **`.gitignore`** : `.env`, `node_modules/`, `dist/`. La clé anon Supabase ne doit jamais être commitée.

### 5.4 PDFs
- `generateInvoicePDF(sale)` → facture complète (devis / facture / brouillon).
- `generateDeliveryPDF(delivery, sale)` → bon de livraison.
- `generatePaymentReceiptPDF(receipt)` → reçu de paiement (n° reçu, montant payé, reste à payer, mode).
- Fonts NotoSans embarquées (`public/fonts/*.woff2`).

### 5.5 WhatsApp
- `sendInvoiceViaWhatsApp(sale)` : génère le blob PDF → `navigator.share` (fallback `wa.me` pré-rempli).
- `sendReceiptViaWhatsApp(receipt)` : même principe pour les reçus.
- Fonction Edge optionnelle `send-whatsapp` via l’API Meta Cloud (clé token serveur).

---

## 6. Flux clés

### 6.1 Création d’une vente avec avance
```
Sales.jsx → createSale RPC (amountPaid = avance)
  → création sale + ligne payments (avance initiale) + stock décrément
  → modal "Reçu de paiement" → downloadPaymentReceiptPDF / sendReceiptViaWhatsApp
```

### 6.2 Paiement partiel d’une facture existante
```
Sales.jsx → add_sale_payment RPC (amount, method, reference)
  → update sales.amount_paid + insert payments row + numéro reçu
  → modal "Reçu de paiement" → download / WhatsApp
```

### 6.3 Annulation d’une vente
```
Sales.jsx → cancel_sale RPC
  → restitution stock intelligente selon delivery_status :
     en_attente → 0 (pas de restitution)
     livree → qty complète
     partielle → qty - qty_livrée
```

---

## 7. Contraintes & bonnes pratiques
- Toutes les RPCs sont **idempotentes** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, `DROP IF EXISTS`).
- Les numéros de facture / BL / reçu utilisent des séquences + verrous préventifs pour éviter les collisions.
- Le `purchase_price` du catalogue est toujours lu côté RPC (fallback du frontend).
- Les mouvements de stock sont **toujours créés** pour chaque entrée/sortie (traçabilité complète).
- Pas de code mort, pas de TODOs laissés dans le code.
- Lint (`npm run lint`) + build (`npm run build`) doivent passer sans erreurs.

---

*Ce document est le CDP de référence pour le développeur chargé de construire une application de gestion de quincaillerie fonctionnellement identique à l’application Quincaillerie Mabane.*
