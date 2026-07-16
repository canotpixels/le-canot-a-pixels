# Contribuer

Merci de votre intérêt ! Ce dépôt est un catalogue statique de jeux rétro
(Astro + TypeScript strict, CSS natif).

## Mise en route

```bash
npm install
npm run dev
```

## Avant d'ouvrir une Pull Request

Exécutez la validation complète :

```bash
npm run validate   # types + lint + validation des données
npm test           # tests unitaires
npm run build      # compilation du site
npm run test:e2e   # tests fonctionnels (facultatif en local)
```

## Conventions

- **TypeScript strict** : aucune erreur de type tolérée (`npm run typecheck`).
- **CSS natif, convention BEM** ; variables CSS pour couleurs, espacements,
  rayons et typographie. Pas de framework CSS.
- **JavaScript client minimal** : privilégier une solution Astro/HTML/CSS.
- **Le code du site ne dépend jamais des colonnes du CSV** : toute nouvelle
  donnée passe par l'adaptateur (`scripts/lib/pricecharting.ts`) et le modèle
  interne (`scripts/lib/types.ts`).
- **Aucun secret** dans le dépôt ni dans le bundle client.
- **i18n** : toute chaîne visible passe par `src/i18n/{fr,en}.json`.

## Structure

- `scripts/lib/` — pipeline de données (parseur, adaptateur, images, cache) — **testé unitairement**.
- `scripts/` — points d'entrée CLI (`import`, `covers-sync`, `build-data`).
- `src/` — site Astro (composants, pages, styles, i18n).
- `tests/` — Vitest. `e2e/` — Playwright.
- `data/` — CSV, surcharges, cache, données générées, rapports, fixtures.

## Tests

- Toute logique du pipeline doit être couverte par un test Vitest.
- Les tests d'API utilisent des **mocks / fixtures** ; ils ne consomment jamais
  l'API réelle.
