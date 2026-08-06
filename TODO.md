# TODO — Factures modifiables (ajouter / modifier / retirer des articles)

## Objectif
Permettre de modifier une facture existante : ajouter, modifier la quantité/PU, ou retirer des articles SANS créer une nouvelle facture, avec réajustement du stock.

## Étapes
- [x] 1. Ajouter un sélecteur de produit + bouton « Ajouter » dans la modal de modification de facture
- [x] 2. Rendre le prix unitaire (unit_price) modifiable par ligne dans la modal d'édition
- [x] 3. Ajouter la fonction `addEditProduct` (incrémente si présent, sinon ajoute une ligne)
- [x] 4. État `editProductToAdd`
- [x] 5. Améliorer la validation dans `handleUpdateSale` (stock max, remise ≤ sous-total)
- [x] 6. Calculer les nouveaux totaux en direct dans la modal d'édition
- [x] 7. S'assurer que `useUpdateSaleItems` envoie toutes les lignes (existantes + nouvelles)
- [x] 8. Vérifier build / lint

## Bonus / corrections
- [x] Corrigé le code dupliqué dans `src/pages/expenses/Finances.jsx` (bloc recalculé deux fois)
- [x] Corrigé « Revenus du mois = 0 FCFA » sur le Dashboard : la requête mensuelle `small_sales` ne sélectionnait pas `total` → `NaN` → `totalMonth` cassé. Ajout de `total` + réductions défensives (`Number(s.total || 0)`).
- [x] Build + lint OK
