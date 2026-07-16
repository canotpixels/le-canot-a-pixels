# Architecture

## Vue d'ensemble

Site **statique** généré par Astro. Deux couches nettement séparées :

1. **Pipeline de données** (`scripts/`) — Node/TypeScript, exécuté hors ligne
   (import, synchro des pochettes, build des données). Produit un seul artefact :
   `data/generated/games.json`.
2. **Site Astro** (`src/`) — ne lit **que** `games.json` (+ les assets). Il ne
   connaît ni le CSV, ni les API externes.

```
CSV PriceCharting ─▶ [pipeline scripts] ─▶ data/generated/games.json ─▶ [Astro] ─▶ dist/ (site statique)
                          ▲   ▲
             overrides.json   cache pochettes (covers.json)
```

Cette frontière garantit que :

- le code du site **ne dépend jamais** des noms de colonnes du CSV ;
- aucun appel réseau n'a lieu pendant une compilation normale ;
- le site se construit même si l'API d'images est indisponible.

## Pipeline de données (`scripts/lib/`)

| Module              | Responsabilité                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `csv.ts`            | Parseur CSV tolérant (guillemets, virgules internes, CRLF, lignes vides).                            |
| `normalize.ts`      | Normalisation des titres, slugs, identifiants déterministes, unicité des slugs.                      |
| `pricecharting.ts`  | **Adaptateur** : ligne CSV → modèle interne stable. Colonnes essentielles, complétude, statut, prix. |
| `overrides.ts`      | Application des surcharges locales (`overrides.json`).                                               |
| `images.ts`         | Détection des photos personnelles + **ordre de fallback** des images.                                |
| `match-score.ts`    | Score de correspondance des pochettes ; classement des candidats.                                    |
| `cover-provider.ts` | Interface `CoverProvider` + `NullCoverProvider` + `IgdbCoverProvider`.                               |
| `cover-cache.ts`    | Cache local des pochettes ; résolution robuste à une API indisponible.                               |
| `assemble.ts`       | Orchestrateur : CSV → jeux finaux (sans réseau).                                                     |
| `reports.ts`        | Génération des rapports (`data/reports/`).                                                           |
| `types.ts`          | Modèle interne (`Game`, `GameImage`, cache, surcharges, rapports).                                   |

Points d'entrée CLI :

- `scripts/import.ts` → `npm run data:import`
- `scripts/covers-sync.ts` → `npm run covers:sync`
- `scripts/build-data.ts` → `npm run data:build`

## Site Astro (`src/`)

| Dossier                    | Rôle                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| `config/site.ts`           | Configuration centrale (nom, devise, contact ; canaux vides masqués).           |
| `i18n/{fr,en}.json`        | Dictionnaires de traduction.                                                    |
| `utils/`                   | i18n, locales, thèmes, routing (base + langue), formatage, résolution d'assets. |
| `data/games.ts`            | Accès typé à `games.json` (filtres, tris, compteurs).                           |
| `layouts/BaseLayout.astro` | Coquille HTML, `<head>` SEO, thème anti-FOUC, header/footer.                    |
| `components/`              | `GameImage`, `GameCard`, `Catalog`, `Badge`, `Header`, `Footer`, vues.          |
| `pages/`                   | Routes FR (racine) + EN (`/en/…`), fiche `jeux/[slug]`, `robots.txt`.           |
| `styles/`                  | `global.css` (BEM) + thèmes clair/sombre.                                       |
| `scripts/`                 | JS client léger : contrôles UI, filtrage du catalogue.                          |

## Internationalisation & routage

- Locale par défaut **français** sans préfixe (`/collection`), **anglais** préfixé
  (`/en/collection`). Voir `src/utils/routing.ts`.
- `astro.config.mjs` configure l'i18n et le sitemap ; `base` et `site`
  proviennent de l'environnement pour Cloudflare / GitHub Pages.

## Thèmes

- Tokens CSS dans `styles/themes/theme-{dark,light}.css`, pilotés par
  l'attribut `data-theme` sur `<html>`.
- Un script inline (dans `<head>`) applique le thème mémorisé **avant** le rendu
  pour éviter tout flash (FOUC). Persistance via `localStorage`.

## Images

- **Photos personnelles** : importées via `import.meta.glob` et optimisées par
  Astro (`<Image>`), tailles responsives.
- **Pochettes génériques** : URL distante autorisée (ex. CDN IGDB) ou fichier
  local ; affichées via `<img>` avec dimensions explicites (pas de décalage).
- **Placeholder** : SVG local (`public/placeholder.svg`).

## Tests

- **Vitest** (`tests/`) : parseur, normalisation, identités, slugs, surcharges,
  détection des photos, ordre de fallback, score de correspondance, robustesse à
  une API indisponible, ligne CSV invalide, assemblage complet.
- **Playwright** (`e2e/`) : accueil, recherche, filtres, navigation, priorité de
  la photo personnelle, fallback générique, fallback placeholder — sur le build
  de **démonstration** (fixture). Aucun appel à l'API réelle.
