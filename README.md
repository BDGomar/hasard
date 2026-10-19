# Boules Game — Frontend (SPA)

SPA **Vue 3 + Vite + Tailwind** du jeu de boules. Elle consomme l'API Laravel
hébergée séparément sur `http://141.136.42.88` (dépôt backend `BDGomar/boule`).

## Développement

```bash
npm install
npm run dev          # SPA sur http://localhost:5173, API sur http://localhost:8000/api
```

L'URL de l'API en développement est définie dans `.env.development`
(`VITE_API_URL`) ; en production le SPA appelle `/api` sur sa propre origine.

## Construction

| Commande | Sortie | Destinataire |
| - | - | - |
| `npm run build` | `dist/` (assets sur `/assets/…`) | **Vercel** |
| `npm run build:laravel` | `../boules-game/public/build` (assets sur `/build/assets/…`) | SPA servie par Laravel, en repli |

`build:laravel` n'est utile que pour la SPA servie par Laravel sur `APP_URL`
(`http://141.136.42.88`), le temps que le SPA Vercel soit en place.

## Déploiement Vercel

| Réglage | Valeur |
| - | - |
| Repository | `BDGomar/hasard` |
| Root Directory | *(racine du dépôt)* |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` (défini dans `vercel.json`) |

`vercel.json` proxifie `/api/*` vers `http://141.136.42.88/api/*` : le SPA
appelle donc `/api` sur sa propre origine, sans problème de CORS ni de contenu
mixte (le navigateur ne voit qu'une origine HTTPS, Vercel relaie l'appel côté
serveur). Le routage SPA `/(.*) → /index.html` gère le *deep linking*.

Pour appeler l'API **directement** (sans proxy), définir dans Vercel
`VITE_API_URL=https://boules.roidesdentelles.cloud/api` et autoriser cette
origine côté backend (`FRONTEND_URLS`).

## Paiement mobile money

Les routes `/paiement/succes` et `/paiement/annule` (`src/views/PaymentResult.vue`)
sont les URLs de retour LigdiCash : elles interrogent le backend (endpoint
`confirm`, en boucle) avant d'afficher le résultat et de rafraîchir le solde.
`initRecharge()` (`src/api/client.js`) transmet l'origine du SPA au backend afin
que le client revienne sur *cette* application après paiement.
