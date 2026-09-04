# 📋 Rapport d'Audit Complet — Quincaillerie Mabane

**Projet** : Quincaillerie Mabane – Gestion  
**Date** : 4 septembre 2026  
**Auditeur** : Revue statique complète (frontend React/Vite, backend Supabase/PostgreSQL)  
**Stack** : React 19 + Vite 8 + Tailwind 3.4 + React Query 5 + Supabase JS 2

---

## 1. Synthèse exécutive

Le projet est une application de gestion de quincaillerie complète et fonctionnelle : gestion de stock, ventes/facturation (avec devis, livraisons échelonnées, paiements partiels), achats fournisseurs, finances, clients/fournisseurs, tableau de bord et paramètres. Le code est bien structuré, le UI est soigné et responsive, et le backend SQL est robuste (verrous transactionnels, RLS détaillé, RPCs atomiques).

**Les points critiques les plus urgents sont (1) une fuite d’identifiants Supabase due à l’absence de `.gitignore`, et (2) un bug de cohérence de stock/prix-d’achat qui corrompt les marges dans le dashboard et la page Finances.**

| Niveau | Nombre | Explications rapides |
|---|---|---|
| 🔴 Critique | 6 | Fuite `.env`, bug marge/prix d'achat, suppression sans RPC stock, lien admin commenté, dépendances SQL non documentées |
| 🟠 High | 7 | `SHOP.location`/`activities` fragiles, erreurs non toaster, RLS update caissier, double création profil, `updated_at` manquant, code mort, imports inutiles |
| 🟡 Medium | 6 | Vite minimal, oxlint faible, pas de TypeScript, pas de tests, pas de CI, pagination search bug |
| 🟢 Low | 3 | exportExcel montants purs, nettoyage dist, README incomplet |

---

## 2. Architecture & structure

```
quincaillerie-mabane/
src/
  assets/              logo/médias
  components/          Layout, Sidebar, Topbar, Modal, ConfirmDialog, StatCard, ThemeToggle, SearchableSelect, Pagination, ProtectedRoute
  context/             AuthContext, ThemeContext, ToastContext
  hooks/               useSupabaseTable, useProducts, useSales, usePurchases, useSmallSales, useEntities, useDashboard, useShopSettings
  lib/                 supabase.js (client), constants.js (SHOP, ROLES, WHATSAPP_MESSAGE, currency)
  pages/               auth/{Login,Register}, dashboard, products, categories, stock, clients, suppliers, purchases, sales/{Sales,SmallSales}, expenses/Finances, settings, users/UsersAdmin
  utils/               exportExcel.js, invoicePdf.js, deliveryPdf.js, whatsapp.js
supabase/
  schema.sql           ✅ Schéma principal (tables, RPC, RLS, triggers, seed)
  small_sales.sql      ⚠️  Tables small_sales + RPCs (séparé, non documenté)
  stock_movement_rpc_fix.sql  ⚠️ Redéfinit update_stock_movement / delete_stock_movement (duplication)
  update_sale_items_rpc.sql   ⚠️ RPC update_sale_items (séparé, non documenté)
  update_purchase_items_rpc.sql ⚠️ RPC update_purchase_items (séparé, non documenté)
  functions/send-whatsapp  Edge function optionnelle (Meta WhatsApp Cloud)
```

### Points forts
- Schéma SQL très complet : UUIDs, contraintes métier (`CHECK`), verrous `FOR UPDATE` sur les RPCs critiques, sequenceurs de numéros de facture/achat/BL avec lock préventif contre les collisions.
- Architecture React Query bien ficelée : cache, invalidation ciblée, toasts centralisés.
- UI soignée : mode clair/sombre, responsive mobile/tablette/desktop, composants réutilisables (`ActionButton`, `ActionButton`, `SearchableSelect`).
- Séparation RBAC (admin-only pour users, suppressions) via RLS au niveau base.

### Points faibles structurels
- **Pas de dossier `supabase/migrations/`** : tout est dans un seul `schema.sql` exécuté manuellement → impossible d’utiliser `supabase db push`/migrations et de versionner proprement l’évolution du schéma.
- **Scripts de déploiement non centralisés** : 4 fichiers SQL annexes (`small_sales.sql`, `stock_movement_rpc_fix.sql`, `update_sale_items_rpc.sql`, `update_purchase_items_rpc.sql`) orphéliques.
- **Pas de tests, pas de CI/CD**, ni de fichier `AGENTS.md`/`kilo.json`.

---

## 3. 🔴 CRITIQUE — À corriger URGEMMENT

### 3.1 Fuite d’identifiants Supabase (`.env` dans git)
- **Absence totale de `.gitignore`** — aucun fichier `.gitignore` n’existe dans le projet (`node_modules`, `dist`, `.env` sont donc potentiellement trackés).
- **`git ls-files .env` renvoie `.env`** → le fichier `.env` réel contenant `VITE_SUPABASE_URL` et surtout `VITE_SUPABASE_ANON_KEY` est **commité et poussé** dans le dépôt.
- Le `VITE_…` prefix signifie que la clé est **embarquée dans le bundle client** ; mais la clé *anon* ne doit JAMAIS être exposée publiquement (elle permet l’accès aux données via RLS et peut être abusée).
- `.env.example` contient aussi un project ID (`srgwjypfadlzvpubcqzb`) en dur (informationnel mais à nettoyer si c’est un vrai projet).

**Actions :**
1. Créer immédiatement un `.gitignore` incluant `.env`, `node_modules/`, `dist/`, `.kilo/`, etc.
2. Retirer `.env` du suivi git : `git rm --cached .env` + commit.
3. Révoquer la clé API actuelle depuis le tableau de bord Supabase et en générer une nouvelle.

### 3.2 Bug de marge → `purchase_price` toujours = 0 sur les ventes (factures)
- Le hook `src/hooks/useSales.js:35` (`useCreateSale`) envoie les articles **sans le champ `purchase_price`** :
  ```js
  items: cart.map((c) => ({ product_id, product_name, quantity, unit_price }))
  ```
- La RPC `create_sale` (schema.sql:388) fait alors `coalesce((v_item->>'purchase_price')::numeric, 0)` → **enregistre `purchase_price = 0`** dans `sale_items`.
- Conséquence : dans `useDashboard.js` (ligne 107-117) et `Finances.jsx` (getSaleGrossMargin), la marge est calculée `(unit_price - purchase_price) * quantity` = **marge = unit_price × quantity = SURÉSTIMÉE au maximum** (la marge réelle disparaît).
- **Contrairement** : la RPC `create_small_sale` (small_sales.sql:142) lit *correctement* `purchase_price` depuis la table `products`. → incohérence entre le deux flux.

**Action :** Ajouter `purchase_price: product.purchase_price` dans le `cart`/`items` de `Sales.jsx:247-252`. Idéalement, faire lire la RPC `create_sale` depuis `products` pour être robuste (comme `create_small_sale`).

### 3.3 Suppression directe des ventes/achats sans RPC → stock incohérent
- `useDeleteSale` (useSales.js:251) et `useDeleteSmallSale` (useSmallSales.js:73) suppriment via `supabase.from(...).delete()` **directement**, **sans RPC**.
- `sales` : le stock n’est jamais restitué → **stock sous-estimé**.
- `small_sales` : il n’existe **aucune RPC d’annulation** pour small_sales → le stock est **irréversiblement perdu** lors d’une suppression. Le README n’avertit pas du tout le caissier de ce risque.
- Pour `sales`, il existe `cancel_sale` (RPC qui restitue le stock non livré) mais le bouton "Supprimer" (`/trash2`) contourne cette logique et agit **sans vérifier le stock disponible** → peut générer un stock **négatif** si d’autres mouvements interviennent.

**Action :** Remplacer les suppressions directes par des RPCs dédiées (`cancel_small_sale`, `cancel_purchase` s’il existe pour small_sales, ou désactiver la suppression directe au profit de l’annulation).

### 3.4 Lien de création du premier admin commenté sur la page Login
- `Login.jsx:85-90` : le lien `"Première utilisation ? Créer le compte administrateur"` est **commenté** → il est **impossible de créer le premier administrateur depuis l’interface**.
- `Register.jsx` existe et appelle `signUp(..., 'admin')`, mais il n’est **pas accessible depuis Login**.
- **Conflit avec le README** (ligne 59-61) qui indique : « Ouvrez l’application → cliquez sur "Créer le compte administrateur" depuis la page de connexion ».

**Action :** Décommenter le lien sur Login.jsx ou exposer Register autrement.

### 3.5 Tables/RPCs `small_sales` dépendent d’un fichier SQL non documenté
- `small_sales` / `small_sale_items`, ainsi que les RPCs `create_small_sale` / `update_small_sale`, sont définis dans `supabase/small_sales.sql` — **fichier NON mentionné dans le README** (qui n’indique exécuter que `schema.sql`) ni dans `schema.sql`.
- Conséquence : `useDashboard.js`, `useSmallSales.js`, `Finances.jsx` et `SmallSales.jsx` font toutes références à la table `small_sales`. Si le déployeur n’exécute que `schema.sql`, **ces pages plantent en runtime** (`PGRST200` / table introuvable).

**Action :** Intégrer `small_sales.sql` dans `schema.sql` ou documenter clairement l’ordre d’exécution dans le README.

### 3.6 RPCs `update_sale_items` / `update_purchase_items` non documentées
- Ces deux RPCs (utilisées par `Sales.jsx`/`Purchases.jsx` pour **modifier les lignes d’une facture/achat**) sont dans `update_sale_items_rpc.sql` et `update_purchase_items_rpc.sql` — **absents de `schema.sql`** et **non documentés** dans le README.
- Même risque que 3.5 : les fonctionnalités d’édition de lignes cassent si les RPCs ne sont pas déployés.
- De plus, `useSales.js` et `usePurchases.js` n’ont **aucun `onError` digne de ce nom** pour `update_sale_items`/`update_purchase_items` — les erreurs remontent comme un `undefined message`.

**Action :** Fusionner les RPCs dans `schema.sql` et/ou créer un dossier `supabase/migrations/`.

---

## 4. 🟠 HIGH — Bugs & incohérences fonctionnels

### 4.1 `SHOP.location` et `SHOP.activities` non définis initialement
- `src/lib/constants.js` définit `SHOP.address` mais **pas `SHOP.location`**.
- `invoicePdf.js:199` et `deliveryPdf.js:199` utilisent `SHOP.location || 'DIOUROUP - SENEGAL'` → fonctionne par fallback, mais **avant le sync initial des shop_settings** (chargé dans AuthContext), `SHOP.location` est `undefined`.
- `syncShopSettings()` (constants.js:16) crée *dynamiquement* `SHOP.location` (= address) **en dehors du type** → fragile, difficile à typer/garantir.
- `SHOP.activities` est **jamais défini** nulle part → toujours le fallback hardcodé (invoicePdf.js:187, deliveryPdf.js:181).

**Action :** Ajouter `location` et `activities` au `SHOP` initial dans constants.js.

### 4.2 Erreurs de chargement non toaster (useSupabaseTable)
- Dans `useSupabaseTable.js`, le `listQuery` `useQuery` **n’a pas de `onError`** → si la requête de liste échoue (ex: RLS, réseau), **aucun toast n’apparaît**; la page reste bloquée sur l’état vide sans explication.
- Les mutations (`createItem`, etc.) toaster correctement, mais le chargement initial est muet.

**Action :** Ajouter `onError` au `listQuery` ou wrapper la queryFn.

### 4.3 Politique RLS `sales` update restreinte à l’admin → mise à jour client/remise échoue pour un caissier
- Le hook `useUpdateSale` (useSales.js:201) fait un `.from('sales').update({ client_id, discount })` **directement**.
- La policy RLS `sales` update (schema.sql:1351-1352) est `using (public.is_admin())` → **un caissier ne peut PAS mettre à jour client_id/discount**.
- Or il existe la RPC `update_sale_items`, mais **aucune RPC pour mettre à jour `client_id`/`discount` de la venture hors admin**.

**Action :** Vérifier si les caissiers doivent pouvoir modifier client/remise ; si oui, créer une RPC `update_sale_details` ou assouplir la policy.

### 4.4 Race condition / rôle ignoré dans `AuthContext.signUp` vs trigger
- `AuthContext.signUp` (AuthContext.jsx:54) insère manuellement dans `public.users` avec le `role` paramétré.
- Mais le trigger `handle_new_user` (schema.sql:1218) **crée aussi** le profil `users` après `INSERT ON auth.users` — avec `role = 'admin'` (si premier) **sinon `'employe'`**, ignorant complètement le `role` passé par `signUp`.
- Deux cas de race :
  - Le trigger s’exécute **avant** l’insert manuel → le manuel échoue (`on conflict do nothing`), le rôle `admin` passé est **perdu**, et le compte est créé `employe` → **impossible de créer un 2e admin via l’app** (Register force `'admin'` mais le trigger l’écrase).
  - `Register.jsx` force `signUp(..., 'admin')` → si ce n’est pas le **premier** compte, le trigger a déjà créé un `employe` et l’insert manuel est ignoré → **bug d’escalade de privilèges**.

**Action :** Faire gérer le rôle par une seule source de vérité. Soit le trigger respecte `raw_user_meta_data->>'role'`, soit on retire l’insert manuel de `signUp` et on met à jour le rôle via RPC admin-only.

### 4.5 Absence de `updated_at` automatique
- Les tables `products` (et autres) possèdent `updated_at` mais **aucun trigger** ne le rafraîchit.
- Les RPCs le mettent à jour manuellement (`set ... updated_at = now()`), mais **les mises à jour directes via `useSupabaseTable.updateItem`** (`updateItem` générique) **n’incluent pas `updated_at`** → la colonne reste à la date de création (incohérence).
- `shop_settings` possède `updated_at` (mis à jour dans useUpdateShopSettings) — mais les autres entités non.

**Action :** Ajouter un trigger `set_updated_at()` sur `products`, `purchases`, `sales`, `clients`, etc.

### 4.6 Code mort / duplication SQL
- `delivery_number_seq` (schema.sql:846) est **créé mais JAMAIS utilisé** — `next_delivery_number()` calcule via `max()`.
- `update_stock_movement` et `delete_stock_movement` sont **dédupliquées** : définies dans `schema.sql` (ligne 695) **et** redéfinies dans `stock_movement_rpc_fix.sql` (avec `set search_path = public` en plus). Le développeur ne sait pas laquelle est la source de vérité.

### 4.7 Imports inutilisés dans `SmallSales.jsx`
- Plusieurs icônes importées mais jamais utilisées : `Minus`, `ShoppingBag`, `TrendingUp`, `CheckCircle2`, `Package`, `AlertTriangle`, `Receipt` (certains sont utilisés — vérifiable, mais `TrendingUp`/`Receipt` ne le sont pas).
- Oxlint ne signale rien car le plugin `oxc` ne vérifie pas les imports inutilisés par défaut.

---

## 5. 🟡 MEDIUM — Qualité & maintenabilité

### 5.1 Configuration Vite trop basique
- `vite.config.js` (7 lignes) : pas d’alias `@/` → les imports sont en chemins relatifs `../` qui deviennent fragiles et verbeux.
- Pas de `server.proxy` pour le développement (acceptable avec Supabase géré côté client, mais note).

### 5.2 Linting faible
- `.oxlintrc.json` : seulement `rules-of-hooks` et `only-export-components`. Aucune règle de qualité (unused vars, no-console, etc.).
- `npm run lint` couvre `src supabase` mais **pas l’auto-fix** ni de stratégie CI.

### 5.3 Pas de TypeScript
- Tout le code est en JS/JSX pur (pas de types), malgré `@types/react` et `@types/react-dom` en devDependencies. Risque élevé de bugs d’API Supabase non détectés (`data?.foo` sur un schéma mal nommé → runtime).

### 5.4 Absence de tests & CI
- Aucun fichier `*test*`/`*spec*` dans `src/`.
- Aucune action GitHub (`/.github/workflows` n’existe pas). Rien ne valide le build/lint avant le merge → régression fréquente.

### 5.5 Bug de pagination sur recherche — `Categories.jsx`
- `Categories.jsx` : la barre de recherche (ligne 76-81) **ne fait pas `setPage(1)`** → si l’utilisateur est sur la page 3 et cherche un résultat sur la page 1, le filtre est vide mais `page` reste à 3 → l’écran affiche "aucune catégorie" à tort.
- (Les autres pages comme Sales, Stock, Suppliers réinitialisent bien `setPage(1)`.)

### 5.6 Export Excel — montants non formatés
- `exportExcel.js` exporte les montants purs (`s.subtotal`, `e.amount`, etc.) **sans format ni décimales**. C’est acceptable pour Excel mais incohérent avec l’UI (`currency()`). Mineur, mais les totaux Excel ne seront pas identiques à l’affichage (pas de `.2` padding).

### 5.7 `useSupabaseTable` ne gère pas `updated_at` dans `updateItem`
- Constaté dans 4.5 : le `updateItem` générique n’ajoute pas `updated_at`.

### 5.8 Nettoyage `dist/`
- `dist/` existe localement mais **n’est pas tracké** (pas de `.gitignore` → aurait pu l’être) → à confirmer, mais un `.gitignore` manquant est le risque.

---

## 6. 🟢 LOW — Points mineurs / cosmétiques

| Fichier | Observation |
|---|---|
| `Login.jsx:85-90` | Lien Register commented-out → code mort. Soit le réactiver soit le supprimer. |
| `Suppliers.jsx:441` | `<input className="checkbox" .../>` — la classe Tailwind `.checkbox` **n’est pas définie** dans index.css → le style natif du browser s’applique (UX inégale). |
| `README.md` | Mentionne "9 tables" mais pas small_sales, small_sale_items. Incomplet. |
| `README.md:103` | Ancre de contact perso (`dev-gallas98 : supabase`) — hors-sujet pour un README produit client. |
| `Supabase edge function` | `corsHeaders['Access-Control-Allow-Origin'] = '*'` sur une fonction qui envoie des SMS — acceptable mais on pourrait restreindre à l’origin connu. |
| `index.html` | `<meta name="theme-color" content="#2563eb">` OK. |
| `useDashboard.js` | `refetchInterval: 60000` → 10 requêtes parallèles toutes les 60s → charge Supabase. Acceptable mais à surveiller. |
| `create_delivery` RPC (schema SQL) | Variable mal nommée `v_sale_item` pour une **vente** (devrait être `v_sale`) → confusion, mais fonctionnel. |
| `.env.example` | Contient une URL Supabase concrète (project `srgwjypfadlzvpubcqzb`) → à remplacer par un placeholder si ce n’est pas le projet final. |

---

## 7. Mapping risque par fichier

| Fichier | Risque principal | Niveau |
|---|---|---|
| `.env` (tracké) | Fuite clé API Supabase | 🔴 |
| `.gitignore` (absent) | Risque de tout committre | 🔴 |
| `supabase/schema.sql` | RPCs annoncés manquants (small_sales, update_sale_items, update_purchase_items) | 🔴 |
| `src/hooks/useSales.js` | `purchase_price` non envoyé → marge fausse ; `useDeleteSale` pas de RPC | 🔴 |
| `src/pages/sales/Sales.jsx` | items créés sans purchase_price | 🔴 |
| `src/hooks/useSmallSales.js` | `useDeleteSmallSale` pas de RPC (stock perdu) | 🔴 |
| `src/pages/auth/Login.jsx` | Lien admin commenté | 🔴 |
| `src/lib/constants.js` | `SHOP.location`/`activities` manquants | 🟠 |
| `src/hooks/useSupabaseTable.js` | listQuery sans onError | 🟠 |
| `src/context/AuthContext.jsx` | signUp vs trigger rôle ignoré | 🟠 |
| `src/pages/categories/Categories.jsx` | search sans reset page | 🟡 |
| `supabase/small_sales.sql` | non documenté/README | 🔴 |

---

## 8. Priorés de correction recommandées

### Sprint 1 — Sauvetage (1-2 jours)
1. ✅ `.gitignore` + `git rm --cached .env` + révoquer la clé Supabase.
2. ✅ Dé-commenter/lier Register depuis Login (ou supprimer le contrôle).
3. ✅ Envoyer `purchase_price` dans `useCreateSale` + `Sales.jsx` items (corrige la marge).
4. ✅ Fusionner `small_sales.sql`, `update_sale_items_rpc.sql`, `update_purchase_items_rpc.sql` (et la bonne version de `stock_movement_rpc_fix`) dans `schema.sql` ou migrer vers `supabase/migrations/`.

### Sprint 2 — Intégrité des données (3-4 jours)
5. ✅ Remplacer `useDeleteSale`/`useDeleteSmallSale` par des RPCs d’annulation (créer `cancel_small_sale`).
6. ✅ Résoudre le conflit `signUp` vs trigger → unifier la gestion du rôle.
7. ✅ Assouplir / RPC-er la mise à jour `client_id`/`discount` des ventes pour les caissiers.
8. ✅ Ajouter un trigger `updated_at` sur toutes les tables concernées.

### Sprint 3 — Qualité & process (3-5 jours)
9. ✅ Ajouter `.mocharc`/choisir un framework de test (ex: Vitest) + quelques tests unitaires hooks.
10. ✅ CI GitHub Actions (`lint` + `build`).
11. ✅ Passer à TypeScript progressivement (au moins `@ts-check` sur les hooks).
12. ✅ Alias Vite `@/` + oxlint plus strict (`no-unused-vars`, `no-console`).

---

## 9. Verdict

Le projet est **fonctionnel et bien conçu** côté UX/SQL, mais présente **deux failles critiques opérationnelles** : (a) la fuite d’identifiants dans le dépôt, et (b) un bug de marge silencieux qui fausse **toutes** les statistiques financières (Dashboard, Finances, petite vente partiellement).  
Les 4 fichiers SQL orphelins créent un **risque de déploiement incohérent** qui pourrait rendre plusieurs pages (SmallSales, édition de lignes de facture/achat) totalement inutilisables dans une base fraîche.

**Note /10 : 6.5 / 10** (passer à 8.5 facilement après les corrections du Sprint 1-2).

