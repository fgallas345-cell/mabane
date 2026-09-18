# Rapport d'audit — Quincaillerie Mabane

**Date** : 18 septembre 2026 (remplace l'audit du 4 septembre 2026)
**Périmètre** : code frontend (React 19 / Vite 8 / React Query 5), schéma et RPC Supabase (`supabase/schema.sql`), dépendances, dépôt git, conformité au `CAHIER_DE_CHARGE.md`.
**Méthode** : lecture statique complète du code, exécution de `npm run lint`, `npm run build`, `npm audit`, inspection de l'historique git.

---

## 0. Correctifs appliqués le 18 septembre 2026

> ⚠️ **`supabase/schema.sql` doit être ré-exécuté dans le SQL Editor** pour que les corrections côté base prennent effet (le script est idempotent). Puis désactiver les inscriptions publiques dans Supabase Auth (voir README §5).

| Réf. | Correctif | Fichiers |
|---|---|---|
| C1 | Trigger `handle_new_user` ignore désormais le rôle envoyé par le client ; route `/register`, page `Register.jsx`, lien Login et `signUp` supprimés ; procédure de création de comptes documentée | `schema.sql`, `App.jsx`, `Login.jsx`, `AuthContext.jsx`, `README.md` |
| C3 | `add column if not exists payment_method` ajouté ; contrainte dupliquée renommée `sales_valid_paid` (le check `amount_paid <= total` existe enfin) | `schema.sql` |
| C4 | `update_sale_items` réécrit : ne touche au stock que pour une facture confirmée livrée immédiatement ; **refuse** toute facture ayant un bon de livraison ; prix d'achat relu du catalogue ; réservé à l'admin | `schema.sql` |
| C5 | `cancel_sale` : pour une livraison partielle, remet en stock les quantités **réellement livrées** | `schema.sql` |
| C6 | Remise et client passés à `update_sale_items` (une seule RPC atomique) ; `total`, `status`, `updated_at` recalculés en base ; vérification `amount_paid ≤ nouveau total` ; `useUpdateSale` supprimé | `schema.sql`, `useSales.js`, `Sales.jsx` |
| H1 | `cancel_small_sale`, `update_stock_movement`, `delete_stock_movement`, `update_purchase_items` : contrôle `is_admin()` ; les mouvements générés par un document (`is_system_stock_movement`) ne sont plus modifiables/supprimables ; UI Stock et Petites ventes alignées | `schema.sql`, `Stock.jsx`, `SmallSales.jsx` |
| H2 | `p_user_id := coalesce(auth.uid(), p_user_id)` dans les 9 RPC concernées ; `create_sale` n'accepte plus le `purchase_price` du client | `schema.sql` |
| H3 | `set search_path = public` sur les 19 fonctions `security definer` | `schema.sql` |
| H6 | `create_delivery` refuse un devis non confirmé | `schema.sql` |
| H7 | Le champ Stock est en lecture seule lors de l'édition d'un produit (mouvement obligatoire via la page Stock) | `Products.jsx` |
| H8 | `update_purchase_items` : message explicite si le nouveau total < montant payé | `schema.sql` |
| H11 | Finances exclut les devis (même périmètre que le Dashboard) ; export Excel des ventes sur le même périmètre, avec colonnes Encaissé / Reste dû / Statut | `Finances.jsx`, `exportExcel.js` |
| L | Message d'annulation adapté aux devis ; commentaire de fin de `schema.sql` et cahier des charges mis à jour | `Sales.jsx`, `schema.sql`, `CAHIER_DE_CHARGE.md` |

### Seconde passe (même jour) — tout le reste sauf C2

| Réf. | Correctif | Fichiers |
|---|---|---|
| H4 | `ErrorBoundary` global ; erreurs de chargement remontées par `QueryCache.onError` → toast (l'`onError` de `useQuery`, ignoré par React Query v5, est retiré) ; Dashboard affiche un état d'erreur + « Réessayer » au lieu de planter | `ErrorBoundary.jsx`, `lib/queryClient.js`, `ToastContext.jsx`, `useSupabaseTable.js`, `Dashboard.jsx`, `main.jsx` |
| H5 | `sendReceiptViaWhatsApp` reçoit `clientPhone` ; `normalizePhone` rejette les valeurs non numériques ; bloc `navigator.share` dédupliqué | `whatsapp.js`, `Sales.jsx` |
| H9 | `npm audit fix` ; `xlsx` remplacé par la distribution SheetJS officielle 0.20.3 ; `jspdf-autotable` (inutilisé) retiré → **0 vulnérabilité** | `package.json` |
| H10 | `node_modules` retiré de l'index git (`git rm -r --cached`, à commiter) ; `package-lock.json` n'est plus ignoré | `.gitignore` |
| M1 | Pages en `React.lazy` ; `jspdf` et `xlsx` importés dynamiquement → bundle initial ≈ 490 Ko (144 Ko gzip) au lieu de 1,79 Mo (520 Ko gzip) | `App.jsx`, `utils/*Pdf.js`, `exportExcel.js` |
| M2 | Logo 968 Ko → 56 Ko (256 px) ; police Inter servie localement (`@fontsource/inter`, sous-ensemble latin) au lieu de Google Fonts | `public/mabane.png`, `main.jsx`, `index.css` |
| M3 | Topbar utilise `useLowStock` (1 requête légère) au lieu des 10 requêtes du dashboard | `useDashboard.js`, `Topbar.jsx` |
| M4 | Chargeur de polices PDF unique (`utils/pdfFonts.js`) ; calculs financiers extraits dans `utils/finance.js` | `utils/*` |
| M5 | Polices **TTF** (jsPDF n'accepte pas le WOFF2) ; fichiers `.woff2` supprimés | `public/fonts/` |
| M6 | `low_stock_default_threshold` utilisé pour les nouveaux produits ; devis annulés via `cancel_quote` (RPC dédiée) ; `delivery_number_seq` supprimée | `Products.jsx`, `Sales.jsx`, `schema.sql` |
| M7 | Page Utilisateurs : création et suppression de comptes via l'Edge Function `manage-users` (clé `service_role` côté serveur, appelant vérifié admin, dernier admin protégé) ; garde-fou contre l'auto-rétrogradation | `supabase/functions/manage-users/`, `useUsersAdmin.js`, `UsersAdmin.jsx` |
| M8 | Modal : `role="dialog"`, `aria-modal`, fermeture Échap, piège de focus, restauration du focus | `Modal.jsx` |
| M9 | `send-whatsapp` : utilisateur connecté obligatoire, numéro validé, `ALLOWED_ORIGIN`, `Deno.serve` | `supabase/functions/send-whatsapp/` |
| M10 | Upload d'image : JPG/PNG/WebP ≤ 2 Mo ; ancienne image supprimée du bucket à la modification et à la suppression du produit | `useProducts.js`, `Products.jsx` |
| M11 | Vitest (12 tests : marges, dette, téléphone, devise), `npm test`, workflow GitHub Actions (lint + tests + build), oxlint avec `correctness`/`no-unused-vars` | `src/__tests__/`, `.github/workflows/ci.yml`, `.oxlintrc.json` |
| L | Recherche Catégories remet la page à 1 ; classe `.checkbox` remplacée ; `SHOP.name` dans Topbar/Sidebar ; contact README dédoublonné ; policy `users` en lecture pour toute l'équipe (colonne « Vendeur » visible) ; trigger `updated_at` sur `products`, `sales`, `shop_settings` | divers |

**Reste uniquement C2, qui demande une action manuelle** :
1. Supabase → *Settings → API* : régénérer les clés (rotation du JWT secret), puis mettre à jour `.env` et l'hébergeur.
2. Si le dépôt GitHub est ou a été public, purger `.env` de l'historique puis forcer le push :
   ```bash
   git filter-repo --path .env --invert-paths
   git push --force --all
   ```
   (opération irréversible pour les autres clones : à faire en connaissance de cause).

**Déploiement à faire après ces correctifs** : ré-exécuter `supabase/schema.sql`, `supabase functions deploy manage-users` (et `send-whatsapp` si utilisée), désactiver les inscriptions publiques, commiter (`node_modules` disparaît du dépôt).

**Données existantes** : si des factures en livraison échelonnée ont déjà été modifiées ou annulées partiellement avant ce correctif, leur stock est faux — un inventaire physique des produits concernés est nécessaire (les mouvements « Rectification facture … » / « Annulation vente … » de la page Stock permettent de les identifier).

---

## 1. Synthèse

L'application est fonctionnellement riche et l'interface est soignée. Mais l'état actuel présente **une faille de sécurité bloquante** (n'importe qui peut se créer un compte administrateur), **un script SQL qui ne s'installe pas sur une base vierge**, et **plusieurs RPC qui corrompent le stock** dans les scénarios de livraison échelonnée. Plusieurs points « corrigés » depuis l'audit précédent ne le sont pas réellement (`onError` sur `useQuery` est ignoré par React Query v5 ; le trigger de rôle a été modifié dans le sens inverse de la spécification).

| Niveau | Nb | Résumé |
|---|---|---|
| 🔴 Critique | 6 | Escalade admin via `/register`, clé Supabase dans l'historique git, `schema.sql` cassé sur base vierge, `update_sale_items` et `cancel_sale` corrompent le stock, `total` non recalculé après modification de remise |
| 🟠 Élevé | 11 | RPC sans contrôle de rôle, `p_user_id`/`purchase_price` fournis par le client, `search_path` non fixé, erreurs de chargement muettes + crash Dashboard, WhatsApp reçu cassé, livraison possible sur un devis, stock modifiable sans mouvement, dépendances vulnérables, `node_modules` versionné, Finances incohérent |
| 🟡 Moyen | 11 | Bundle 1,8 Mo, logo 968 Ko, dashboard rechargé sur toutes les pages, duplication de code, fonts WOFF2 avec jsPDF, réglages morts, page Utilisateurs incomplète, Modal non accessible, Edge function sans auth, upload sans validation, pas de tests/CI |
| 🟢 Faible | 6 | Pagination catégories, classe CSS manquante, textes en dur, exports Excel, commentaires obsolètes, jointure `users` invisible aux non‑admins |

**État par rapport à l'audit précédent** : ✅ corrigés — `.gitignore`, `purchase_price` envoyé, `cancel_small_sale` existe, fichiers SQL annexes marqués historiques, `SHOP.location/activities`, lien Register réactivé. ❌ non corrigés ou régressés — `onError` inefficace, gestion du rôle (régression : escalade), `updated_at` sans trigger, code mort SQL, pas de tests/CI/TS, recherche Catégories, classe `.checkbox`.

---

## 2. 🔴 Critique

### C1. N'importe qui peut créer un compte administrateur
- [src/pages/auth/Register.jsx:118](src/pages/auth/Register.jsx#L118) appelle `signUp(email, password, fullName, 'admin')` ; la route `/register` est publique ([src/App.jsx:26](src/App.jsx#L26)) et liée depuis Login ([src/pages/auth/Login.jsx:87](src/pages/auth/Login.jsx#L87)).
- Le trigger `handle_new_user` ([supabase/schema.sql:1890-1916](supabase/schema.sql#L1890-L1916)) **honore `raw_user_meta_data->>'role'`** : le rôle demandé par le client est appliqué tel quel.
- Même si la page est retirée, la clé anon est dans le bundle : un simple appel `supabase.auth.signUp({ email, password, options: { data: { role: 'admin' } } })` suffit.
- Contredit explicitement `CAHIER_DE_CHARGE.md` §5.3 (« ignorant tout `role = admin` passé par `raw_user_meta_data` pour éviter l'escalade »).

**Correction** : (1) trigger : ignorer le rôle des metadata — premier utilisateur = `admin`, sinon `employe` ; (2) désactiver les inscriptions publiques dans Supabase Auth (*Allow new users to sign up* = off) ; (3) supprimer la route `/register` ; (4) créer les comptes depuis la page Utilisateurs via une Edge Function utilisant la clé `service_role` (`auth.admin.createUser` / `inviteUserByEmail`).

### C2. Clé Supabase et référence projet dans l'historique git
- `git log --all -- .env` : le vrai `.env` (URL + `VITE_SUPABASE_ANON_KEY` du projet `srgwjypfadlzvpubcqzb`) a été commité dans `986615bc` puis retiré dans `9d313ae4`. Il reste dans l'historique poussé sur `github.com/fgallas345-cell/mabane`.
- `.env.example` contient encore l'URL réelle du projet.
- La clé anon est conçue pour être publique, mais combinée à C1 elle donne un accès admin complet à quiconque lit le dépôt.

**Correction** : après C1, régénérer les clés API (Supabase → Settings → API → rotation JWT secret), purger l'historique (`git filter-repo --path .env --invert-paths`) si le dépôt est ou a été public, mettre un placeholder dans `.env.example`.

### C3. `schema.sql` échoue sur une base vierge
- `create table sales` ([supabase/schema.sql:132-146](supabase/schema.sql#L132-L146)) ne définit pas `payment_method`, mais la ligne 154 fait `update public.sales set payment_method = ...` → `ERROR: column "payment_method" does not exist`. Aucun `add column if not exists payment_method` n'existe. Le README (« exécutez tout le contenu de schema.sql ») est donc faux pour toute nouvelle installation.
- La contrainte `sales_valid_amounts` est déclarée deux fois ([supabase/schema.sql:2110](supabase/schema.sql#L2110) et [2140](supabase/schema.sql#L2140)) ; la seconde (`amount_paid <= total`) n'est jamais créée.

**Correction** : ajouter `alter table public.sales add column if not exists payment_method text;` avant la ligne 154 ; renommer la seconde contrainte (`sales_valid_paid`). Tester le script sur un projet Supabase neuf.

### C4. `update_sale_items` corrompt le stock (livraison échelonnée, partielle, devis)
- [supabase/schema.sql:1617-1745](supabase/schema.sql#L1617-L1745) : restaure **la totalité** des anciennes quantités puis décrémente **la totalité** des nouvelles, sans regarder `quote_status` ni `delivery_status`.
  - Facture `en_attente` (rien livré, stock jamais décrémenté) : le stock est gonflé des anciennes lignes puis décrémenté des nouvelles → les livraisons ultérieures décrémentent une seconde fois.
  - Facture `partielle` : seules les quantités livrées avaient quitté le stock ; la RPC en restaure la totalité.
  - Suppression des `sale_items` → cascade sur `delivery_items` : l'historique de livraison disparaît et `delivery_status` n'est pas recalculé.
- Le bouton « Modifier la facture » ([src/pages/sales/Sales.jsx:767](src/pages/sales/Sales.jsx#L767)) est proposé à l'admin sur toute facture non annulée, y compris échelonnée.

**Correction** : interdire la modification des lignes dès qu'une livraison existe ou que `delivery_status <> 'livree'` (ou ne mouvementer que la différence livrée) ; ne rien mouvementer pour un devis.

### C5. `cancel_sale` restaure la mauvaise quantité pour une livraison partielle
- [supabase/schema.sql:1305-1311](supabase/schema.sql#L1305-L1311) : pour `delivery_status = 'partielle'`, la RPC remet en stock `quantity - livré` — quantités qui **n'ont jamais quitté le stock**. Ce qu'il faut restaurer, c'est `livré` (si le client rend la marchandise) ou rien (s'il la garde).

### C6. Modifier la remise d'une facture ne recalcule pas le total
- `handleUpdateSale` ([src/pages/sales/Sales.jsx:343-392](src/pages/sales/Sales.jsx#L343-L392)) enchaîne `update_sale_items` (qui calcule `total` avec **l'ancienne** remise) puis `useUpdateSale` qui met à jour `discount` seul ([src/hooks/useSales.js:228](src/hooks/useSales.js#L228)). `sales.total`, `status` et donc la dette client restent faux. Les deux appels ne sont pas atomiques.

**Correction** : passer `p_discount` et `p_client_id` à `update_sale_items` et tout recalculer dans la RPC ; supprimer `useUpdateSale`.

---

## 3. 🟠 Élevé

### H1. RPC `security definer` sans contrôle de rôle
Toutes sont `grant execute … to authenticated` ; un employé peut donc contourner la RLS et l'UI :
- `cancel_small_sale` ([schema.sql:1580](supabase/schema.sql#L1580)) : aucun check → n'importe qui supprime n'importe quelle petite vente, alors que la policy dit « Admin delete small_sales ». L'UI SmallSales n'est pas non plus gatée par `isAdmin`.
- `update_stock_movement` / `delete_stock_movement` : aucun rôle, et aucune protection des mouvements générés par les ventes/achats/livraisons → un employé peut modifier « Vente FAC‑2026‑0012 » et désynchroniser stock et facture.
- `update_small_sale`, `update_sale_items`, `update_purchase_items`, `confirm_quote`, `create_delivery` : idem.

### H2. Identité et prix fournis par le client
- `p_user_id` est passé depuis le navigateur dans `create_sale`, `cancel_sale`, `add_stock_entry`, `update_stock_movement`, `create_purchase`… → n'importe quel utilisateur peut attribuer ses actions à un autre. Utiliser `auth.uid()` partout (comme le font déjà `add_sale_payment`, `create_delivery`).
- `create_sale` et `update_sale_items` prennent `coalesce(item.purchase_price, catalogue)` : le client peut envoyer un `purchase_price` arbitraire et fausser les marges. `create_small_sale` lit correctement le catalogue — harmoniser.

### H3. `security definer` sans `set search_path`
0 occurrence dans `schema.sql`. Toutes les fonctions `security definer` sont exposées à un détournement de `search_path` (alerte standard du linter Supabase « function_search_path_mutable »). Ajouter `set search_path = public` à chacune.

### H4. Erreurs de chargement silencieuses et crash du Dashboard
- `onError` dans `useQuery` ([src/hooks/useSupabaseTable.js:24](src/hooks/useSupabaseTable.js#L24)) a été **supprimé dans React Query v5** : l'option est ignorée, aucun toast. Utiliser `isError`/`error` dans les composants ou `QueryCache({ onError })` global.
- [src/pages/dashboard/Dashboard.jsx:60](src/pages/dashboard/Dashboard.jsx#L60) accède à `data.totalMonth` dès que `isLoading` est faux : si l'une des 10 requêtes échoue, `data` est `undefined` → TypeError → **écran blanc**. Aucun `ErrorBoundary` dans l'application.

### H5. Envoi du reçu par WhatsApp cassé
[src/utils/whatsapp.js:6](src/utils/whatsapp.js#L6) : `normalizePhone(receipt.clientName)` reçoit le **nom** du client. L'objet reçu construit dans Sales.jsx n'a pas de téléphone → lien `wa.me/221MamadouFaye`.

### H6. Un devis peut être livré avant confirmation
`create_delivery` ne vérifie que `status <> 'annulee'` ; un devis (`quote_status = 'draft'`, `delivery_status = 'en_attente'`) accepte un bon de livraison et décrémente le stock. L'UI cache le bouton, la RPC non.

### H7. Stock modifiable sans mouvement
[src/pages/products/Products.jsx:170-181](src/pages/products/Products.jsx#L170-L181) : l'édition d'un produit écrit `stock` directement (policy update ouverte à tous les rôles). Aucun `stock_movements` créé → contredit §7 du cahier (« mouvements toujours créés »). Retirer `stock` du formulaire d'édition (le garder à la création) ou passer par `add_stock_entry`/une RPC d'ajustement.

### H8. `update_*_items` ignorent `amount_paid`
Réduire une facture/un achat sous le montant déjà payé : `purchases` → erreur de contrainte cryptique ; `sales` → `amount_paid > total` avec `status = 'payee'` (la contrainte n'existe pas, cf. C3).

### H9. Dépendances vulnérables (`npm audit`)
- `react-router-dom` 7.18.1 — **high** (GHSA‑qwww‑vcr4‑c8h2), fix : 7.18.4.
- `xlsx` 0.18.5 — **high** ×2 (prototype pollution, ReDoS), **aucun correctif sur npm** (paquet abandonné). Remplacer par `exceljs` ou la distribution SheetJS CDN.
- `dompurify` (via jspdf) — moderate, `npm audit fix`.

### H10. `node_modules` versionné
24 234 fichiers de `node_modules/` sont trackés (le `.gitignore` est arrivé après) ; `.git` pèse 65 Mo et `git status` est pollué. `git rm -r --cached node_modules && git commit`.

### H11. Finances incohérent avec le Dashboard
[src/pages/expenses/Finances.jsx:100](src/pages/expenses/Finances.jsx#L100) exclut les annulées mais **inclut les devis** (`quote_status = 'draft'`) dans le CA et la marge. Le Dashboard les exclut. De plus le Dashboard compte `amount_paid` (encaissé) là où Finances compte `total` (facturé) : deux « chiffres d'affaires » différents sans le dire.

---

## 4. 🟡 Moyen

| # | Constat | Référence |
|---|---|---|
| M1 | Bundle unique de **1,79 Mo** (520 Ko gzip) : jspdf, html2canvas, xlsx, recharts chargés au démarrage. Aucun `import()` dynamique. | `npm run build` |
| M2 | `public/mabane.png` = **968 Ko** pour un logo affiché en 32–48 px (favicon, sidebar, login). Redimensionner (< 20 Ko). Police Inter chargée depuis Google Fonts → dépendance réseau externe à chaque chargement. | [src/index.css:1](src/index.css#L1) |
| M3 | `useDashboard` (10 requêtes, tables entières `products`, `sale_items` du mois…) est monté dans **Topbar** donc sur toutes les pages, avec `refetchInterval: 60000`. Tous les hooks (`useSales`, `useProducts`, `usePurchases`) chargent la table complète sans limite ni pagination serveur. | [src/components/Topbar.jsx:20](src/components/Topbar.jsx#L20) |
| M4 | Duplication : chargeur de polices PDF copié dans 3 fichiers (~80 lignes ×3, avec 3 états `_fontEmbedded` distincts) ; `ActionButton`, `hashString`, `CategoryBadge`, `formatRelativeDate` réécrits dans 4–5 pages. | `src/utils/*Pdf.js`, `src/pages/*` |
| M5 | jsPDF n'accepte que du **TTF** ; les fichiers embarqués sont en **WOFF2**. Le code accepte l'en‑tête `wOF2` puis passe à jsPDF qui ne sait pas le décoder → repli probable sur Helvetica sans avertissement clair. À vérifier en générant un PDF ; sinon convertir en TTF. | [src/utils/invoicePdf.js:19](src/utils/invoicePdf.js#L19) |
| M6 | Réglages/code morts : `low_stock_default_threshold` sauvegardé mais jamais lu (Products force 5) ; `useCancelQuote` inutilisé (le devis est annulé via `cancel_sale` avec le message « quantités remises en stock ») ; `delivery_number_seq` créée et inutilisée ; commentaire final de `schema.sql` obsolète. | [src/pages/products/Products.jsx:45](src/pages/products/Products.jsx#L45) |
| M7 | Page Utilisateurs : ne permet **que** de changer le rôle. README et cahier annoncent création/suppression par l'admin. L'admin peut se rétrograder lui‑même sans confirmation. | [src/pages/users/UsersAdmin.jsx](src/pages/users/UsersAdmin.jsx) |
| M8 | `Modal` : pas de `role="dialog"`, `aria-modal`, fermeture Échap, ni piège de focus. | [src/components/Modal.jsx](src/components/Modal.jsx) |
| M9 | Edge function `send-whatsapp` : aucune vérification du JWT, CORS `*`, import `serve` déprécié. Si déployée, n'importe qui peut envoyer des messages depuis le numéro de la boutique. | [supabase/functions/send-whatsapp/index.ts](supabase/functions/send-whatsapp/index.ts) |
| M10 | Upload d'image : aucune validation de type/taille ; les anciennes images ne sont jamais supprimées du bucket (fichiers orphelins). | [src/hooks/useProducts.js:12](src/hooks/useProducts.js#L12) |
| M11 | Qualité : 0 test, 0 CI, pas de TypeScript, oxlint limité à 2 règles (`no-unused-vars` inactif). `await mutateAsync` sans `try/catch` dans Products/Stock → rejets non gérés. | `.oxlintrc.json` |

---

## 5. 🟢 Faible

- Catégories : la recherche ne remet pas `page` à 1 ([src/pages/categories/Categories.jsx:80](src/pages/categories/Categories.jsx#L80)).
- `className="checkbox"` non défini dans `index.css` ([src/pages/suppliers/Suppliers.jsx:442](src/pages/suppliers/Suppliers.jsx#L442)).
- Topbar et Sidebar affichent « Quincaillerie Mabane » en dur au lieu de `SHOP.name` (les Paramètres ne les mettent pas à jour).
- `exportSalesToExcel` exporte devis et factures annulées sans colonne statut.
- Bloc `navigator.share` dupliqué dans `whatsapp.js` (le second est inutile et lève sur les navigateurs sans support fichiers).
- `small_sales` joint `users(full_name)` mais la policy `users` ne laisse voir que son propre profil : un non‑admin voit « — » pour les ventes des collègues.
- README : contact dupliqué, mention de « Créer le compte administrateur » à supprimer après C1.

---

## 6. Points forts

- RPC atomiques avec `for update` et verrous consultatifs pour la numérotation (`FAC/ACH/BL/REC`).
- RLS activée sur toutes les tables, suppressions réservées à l'admin.
- React Query bien utilisé (invalidation ciblée, toasts centralisés), UI responsive, mode sombre, composants réutilisables (`SearchableSelect`, `Pagination`).
- Historisation des noms (`product_name`, `supplier_name`) pour préserver les documents après suppression.
- `lint` et `build` passent (3 avertissements Fast Refresh sans conséquence).

---

## 7. Plan de correction recommandé

**Sprint 0 — immédiat (½ journée)**
1. Désactiver les inscriptions publiques dans Supabase Auth ; corriger le trigger pour ignorer `role` des metadata ; retirer `/register`. *(C1)*
2. Régénérer les clés Supabase ; purger `.env` de l'historique si le dépôt est public. *(C2)*
3. `git rm -r --cached node_modules`. *(H10)*
4. `npm audit fix` + remplacer `xlsx`. *(H9)*

**Sprint 1 — intégrité des données (2–3 jours)**
5. Réparer `schema.sql` (colonne `payment_method`, contrainte dupliquée) et le tester sur un projet neuf. *(C3)*
6. Réécrire `update_sale_items` (remise/client inclus, refus si livraison partielle/devis) et `cancel_sale` (partielle). *(C4, C5, C6, H8)*
7. Ajouter `set search_path = public`, remplacer `p_user_id` par `auth.uid()`, ignorer `purchase_price` client, ajouter les contrôles de rôle (`is_admin()`) dans `cancel_small_sale`, `*_stock_movement`, `update_*_items` ; bloquer les mouvements liés à une vente/achat. *(H1, H2, H3)*
8. `create_delivery` : refuser les devis. Retirer l'édition directe de `stock`. *(H6, H7)*

**Sprint 2 — robustesse front (2 jours)**
9. `ErrorBoundary` global, gestion `isError` (Dashboard, tables), `QueryCache.onError` pour les toasts. *(H4)*
10. Corriger `sendReceiptViaWhatsApp` (transmettre le téléphone). *(H5)*
11. Aligner Finances/Dashboard (exclure devis, définir « CA encaissé » vs « facturé »). *(H11)*
12. Code splitting (`React.lazy` par page + import dynamique de jspdf/xlsx), logo compressé, police locale. *(M1, M2)*
13. Sortir `useDashboard` de Topbar (requête dédiée `lowStock`). *(M3)*

**Sprint 3 — qualité (continu)**
14. Factoriser les utilitaires dupliqués ; Vitest sur les calculs (marges, dette, normalisation téléphone) ; GitHub Actions `lint + build` ; oxlint `no-unused-vars` ; `@ts-check` progressif.

---

## 8. Verdict

**5 / 10 en l'état.** L'application est utilisable au quotidien par une équipe de confiance, mais elle ne doit pas être exposée sur Internet tant que C1/C2 ne sont pas corrigés, et les modules « livraison échelonnée » et « modification de facture » produisent aujourd'hui des stocks faux. Les corrections des Sprints 0–1 sont bien délimitées et ramèneraient le projet autour de 8 / 10.
