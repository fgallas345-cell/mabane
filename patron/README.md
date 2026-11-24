# Mabane Patron

Application mobile du propriétaire (PWA installable), séparée de l'application de la boutique :

- **Accueil** : encaissé du jour (comparé à hier), ventes du jour et du mois, bénéfice du mois, dettes clients, produits à commander.
- **Assistant** : questions en français (écrites ou dictées) ; les réponses viennent des vrais chiffres de la base.
- **Alertes** : stock faible, dettes clients (appel / WhatsApp), factures impayées depuis plus de 30 jours.

Tout est **en lecture seule** et **réservé aux comptes administrateurs**.

## Architecture

- `patron/` : application React + Vite (ce dossier), déployée comme **un projet Vercel à part**.
- `supabase/functions/patron-assistant/` : fonction serveur appelée par l'application.
  Elle vérifie que l'appelant est administrateur, lit les données avec **son** jeton (RLS) et fait tourner
  l'assistant (Claude, modèle `claude-opus-5-5`) avec des outils de lecture. La clé Anthropic reste côté serveur.

## Mise en route

### 1. Fonction Supabase (une fois)

```bash
# depuis le dossier mabane/ (racine du dépôt)
npx supabase login
npx supabase link --project-ref <id-du-projet>        # l'id est dans l'URL Supabase : https://<id>.supabase.co
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # clé créée sur console.anthropic.com
npx supabase functions deploy patron-assistant
# optionnel : n'autoriser que l'application Patron
npx supabase secrets set ALLOWED_ORIGIN=https://mabane-patron.vercel.app
```

L'accueil et les alertes fonctionnent dès que la fonction est déployée ; l'assistant a besoin de `ANTHROPIC_API_KEY`.

### 2. Projet Vercel

1. Vercel → **Add New… → Project** → même dépôt GitHub.
2. **Root Directory** : `patron`. Framework : Vite (détecté automatiquement).
3. Variables d'environnement : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que l'application de la boutique).
4. Déployer, puis renommer le domaine en `mabane-patron.vercel.app` si souhaité.

### 3. Sur le téléphone

Ouvrir l'adresse dans Chrome (Android) ou Safari (iPhone) → **Ajouter à l'écran d'accueil**.
L'application s'ouvre ensuite en plein écran avec l'icône Mabane.

## Développement local

```bash
cd patron
cp .env.example .env   # puis renseigner les deux variables
npm install
npm run dev            # http://localhost:5190
```

## Coût de l'assistant

Facturé par Anthropic à l'usage (tokens). Une question courante consomme quelques milliers de tokens :
de l'ordre de quelques centimes de dollar. Le suivi se fait sur console.anthropic.com.
