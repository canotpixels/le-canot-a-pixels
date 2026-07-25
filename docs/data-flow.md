# Flux de données

## 1. Import & normalisation (`npm run data:import`)

```
data/pricecharting/collection.csv  +  data/pricecharting/wanted.csv
        │  combineCsvSources()  (csv.ts)         — fusion (wanted = statut « recherché »)
        │  parseCsv()           (csv.ts)         — parseur tolérant
        ▼
   lignes normalisées
        │  adaptRows()          (pricecharting.ts) — colonnes → modèle interne
        ▼
   AdaptedGame[]  + lignes invalides + doublons
        │  applyOverrides()     (overrides.ts)     — data/overrides.json
        ▼
   jeux (statut, notes appliqués ; jeux "hidden" retirés)
        │  detectPersonalImageKeys() + buildGameImages() (images.ts)
        │  + cache pochettes (cover-cache.ts)
        ▼
   Game[]  ─▶ data/generated/games.json
        └────▶ data/reports/{import-summary.json, invalid-rows.csv,
                              missing-covers.csv, uncertain-cover-matches.csv}
```

Points clés :

- Une ligne invalide n'interrompt pas l'import ; elle est **rapportée**.
- L'absence d'une colonne **essentielle** (`id`, `product-name`, `console-name`)
  interrompt l'import avec un message clair.
- Identifiant : `pc-<id>` si l'id PriceCharting existe, sinon `gen-<hash>`
  déterministe (titre + console + région + édition).
- Slugs : lisibles, déterministes, **uniques** (désambiguïsés par la console).

## 2. Synchronisation des pochettes (`npm run covers:sync`)

```
CSV ─▶ adaptRows ─▶ (jeux sans photo perso, sans pochette résolue)
        │  createCoverProvider(env)   (null | igdb)
        ▼
   provider.searchCover(identité)     — APPEL RÉSEAU (uniquement ici)
        │  rankCandidates()           (match-score.ts) — score de correspondance
        ▼
   meilleure pochette ─▶ data/cache/covers.json
```

- N'interroge **que** les pochettes manquantes ou invalidées (sauf `--force`).
- Ne choisit jamais aveuglément le premier résultat : classement par score.
- Robuste : si l'API échoue, l'entrée précédente est conservée ; sinon
  « not-found ». Le build ultérieur reste fonctionnel.

## 3. Build des données (`npm run data:build`)

Identique à l'import (même orchestrateur `assemble.ts`), **sans réseau** :
utilise le cache de pochettes existant. C'est l'étape appelée par `npm run build`
avant `astro build`. Retombe sur la fixture si le CSV de production est absent.

## 4. Rendu du site (`astro build`)

```
data/generated/games.json ─▶ src/data/games.ts (accès typé)
        ▼
   pages Astro (FR + EN) ─▶ dist/  (HTML statique + assets optimisés)
```

## Ordre de fallback des images (rappel)

1. première photo personnelle (`src/assets/games/personal/<id>/…`) ;
2. pochette générique (cache → CDN autorisé ou fichier local) ;
3. placeholder (`public/placeholder.svg`).

Toute image non personnelle porte la mention « Image de référence — l'article
réel peut différer. »
