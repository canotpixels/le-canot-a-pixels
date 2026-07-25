# Collection Xbox Rétro — Catalogue de jeux vidéo

Site web **statique**, rapide, responsive, accessible et bilingue (français / anglais)
présentant une collection de jeux vidéo rétro (Xbox / Xbox 360) sous l'angle d'un
**collectionneur** :

- la **collection** personnelle (avec ouverture discrète aux échanges entre collectionneurs) ;
- les **jeux recherchés** pour agrandir la collection ;
- les informations importées d'un **export CSV de PriceCharting** ;
- une **image de référence générique** par jeu (facultative) ;
- des **photos personnelles** facultatives lorsqu'elles existent.

Le CSV PriceCharting est la **source principale des données**. Le site est généré
statiquement (Astro), sans serveur applicatif ni base de données, et se déploie
gratuitement sur **Cloudflare Pages** ou **GitHub Pages**.

---

## Table des matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Commandes](#commandes)
- [Format du CSV PriceCharting](#format-du-csv-pricecharting)
- [Exporter depuis PriceCharting](#exporter-depuis-pricecharting)
- [Remplacer le CSV](#remplacer-le-csv)
- [Surcharges locales (statut, notes…)](#surcharges-locales)
- [Photos personnelles](#photos-personnelles)
- [Pochettes génériques et fallback](#pochettes-génériques-et-fallback)
- [Variables d'environnement](#variables-denvironnement)
- [Changer de fournisseur d'images](#changer-de-fournisseur-dimages)
- [Rapports générés](#rapports-générés)
- [Déploiement](#déploiement)
- [Résolution des erreurs fréquentes](#résolution-des-erreurs-fréquentes)
- [Architecture](#architecture)

---

## Prérequis

- **Node.js ≥ 20.11** (recommandé : 22, voir `.nvmrc`)
- **npm** (fourni avec Node)

## Installation

```bash
git clone <votre-dépôt>
cd poc-collection-xbox
npm install
cp .env.example .env   # facultatif : seulement pour la synchro de pochettes
```

Lancer le site en développement :

```bash
npm run dev
```

## Commandes

| Commande              | Rôle                                                                       |
| --------------------- | -------------------------------------------------------------------------- |
| `npm run dev`         | Serveur de développement Astro                                             |
| `npm run build`       | Génère les données **puis** compile le site (`data:build` + `astro build`) |
| `npm run preview`     | Sert le build statique localement                                          |
| `npm run data:import` | Importe et normalise le CSV, écrit `games.json` et les rapports            |
| `npm run covers:sync` | Recherche **uniquement** les pochettes manquantes ou invalidées            |
| `npm run data:build`  | Génère les données finales consommées par Astro                            |
| `npm run validate`    | Vérifie types + lint + validation des données                              |
| `npm test`            | Tests unitaires (Vitest)                                                   |
| `npm run test:e2e`    | Tests fonctionnels (Playwright, sur données de démonstration)              |
| `npm run lint`        | ESLint + Prettier (vérification)                                           |
| `npm run format`      | Prettier (écriture)                                                        |

### Options utiles des scripts de données

```bash
npm run data:import -- --fixture        # utilise le CSV de démonstration
npm run data:import -- --dry-run         # n'écrit aucun fichier
npm run covers:sync -- --force           # re-résout toutes les pochettes
npm run covers:sync -- --game-id=6656    # une seule fiche
npm run covers:sync -- --limit=20        # limite le nombre de recherches
```

## Format du CSV PriceCharting

Les données sont réparties en **deux fichiers** partageant le même en-tête :

```
data/pricecharting/collection.csv   ← les jeux de la collection
data/pricecharting/wanted.csv       ← les jeux recherchés (à acquérir)
```

Au build, `wanted.csv` est fusionné à `collection.csv` (ses lignes portent
`folder=Wishlist`, ce qui leur donne le statut « recherché »). Pour ajouter un
jeu à la liste des recherchés, il suffit d'ajouter une ligne dans `wanted.csv`.
`wanted.csv` est facultatif : s'il est absent, seule la collection est chargée.

Colonnes attendues (celles réellement présentes dans un export « collection » PriceCharting) :

| Colonne                 | Utilisation                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `id`                    | Identifiant PriceCharting (base de l'identifiant interne `pc-<id>`) |
| `product-name`          | Titre du jeu (**essentiel**)                                        |
| `console-name`          | Console / plateforme (**essentiel**)                                |
| `price-in-pennies`      | Valeur de référence (en centimes) → `estimatedValue`                |
| `include-string`        | Complétude : _Item only_, _Item, Box, and Manual_, _New…_           |
| `condition-string`      | État (ex. _Normal wear_)                                            |
| `notes`                 | Notes libres                                                        |
| `cost-basis-in-pennies` | Prix d'achat (en centimes) → `purchasePrice`                        |
| `quantity`              | Quantité                                                            |
| `date-entered`          | Date d'ajout                                                        |
| `folder`                | Indice de statut (heuristique : _Wishlist_, _Collection_)           |

> Le parseur est **tolérant** : il normalise les noms de colonnes, gère les
> guillemets et virgules internes, ignore les lignes vides, ne fait pas échouer
> tout l'import à cause d'une seule ligne invalide et **conserve un rapport**
> des lignes ignorées. Seules `id`, `product-name` et `console-name` sont
> considérées essentielles ; leur absence interrompt l'import avec un message clair.

L'application ne dépend jamais directement de ces noms de colonnes :
l'**adaptateur PriceCharting** (`scripts/lib/pricecharting.ts`) les traduit vers
un modèle interne stable (`scripts/lib/types.ts`).

## Exporter depuis PriceCharting

1. Connectez-vous à votre compte PriceCharting.
2. Ouvrez votre **collection**.
3. Utilisez la fonction d'**export CSV** proposée par PriceCharting.
4. Téléchargez le fichier `.csv`.

> Ce projet ne contourne aucune API ni authentification et n'utilise aucune
> image par hotlinking. Aucun mot de passe PriceCharting n'est requis ni
> conservé. Seule lecture effectuée côté PriceCharting : la **page produit
> publique** de chaque jeu (une fois par jeu, avec délai de politesse) pour en
> récupérer la photo de jaquette — voir
> [Pochettes génériques et fallback](#pochettes-génériques-et-fallback).

## Remplacer le CSV

1. Remplacez le fichier `data/pricecharting/collection.csv` par votre export
   (et, au besoin, mettez à jour `data/pricecharting/wanted.csv` pour les jeux recherchés).
2. Régénérez les données :

   ```bash
   npm run data:build
   ```

3. (Facultatif) Recherchez les pochettes manquantes : `npm run covers:sync`.
4. Relancez `npm run dev` ou `npm run build`.

Aucune modification de code n'est nécessaire.

## Surcharges locales

Le CSV reste la **source principale**. Les propriétés propres au site qui ne
figurent pas dans l'export se déclarent dans `data/overrides.json`, indexées par
identifiant PriceCharting brut (`"6656"`) ou par identifiant interne (`"pc-6656"`).

```json
{
  "6656": {
    "status": "collection",
    "notes": "Édition québécoise, boîtier impeccable.",
    "region": "NTSC"
  },
  "6290": { "hidden": true }
}
```

Champs disponibles : `status` (`collection` | `for-sale` | `wishlist`),
`notes`, `region`, `edition`, `hidden` (et, hérités, `salePrice`/`estimatedValue`,
non affichés par le site orienté collectionneur).

> Les statuts peuvent aussi être détectés automatiquement : la colonne `folder`
> du CSV (`Wishlist` / `Collection`) et le fichier `wanted.csv` (statut « recherché »).
> Les surcharges de `overrides.json` ont priorité.

## Photos personnelles

Déposez vos photos dans le dossier correspondant à l'**identifiant interne** du jeu :

```
src/assets/games/personal/<game-id>/
  01-front.webp
  02-back.webp
  03-disc.webp
```

- `<game-id>` = `pc-<id PriceCharting>` (ex. `pc-6656`) ou l'identifiant généré.
- Formats acceptés : **JPEG, PNG, WebP, AVIF**.
- Les images sont triées **de façon déterministe** par nom de fichier.
- Elles sont automatiquement détectées et **optimisées par Astro** — aucune
  modification du CSV ou du code n'est nécessaire après l'ajout.
- La **première** photo (ordre alphabétique) devient l'image principale.

Puis régénérez : `npm run data:build`.

## Pochettes génériques et fallback

### Ordre de fallback des images (strict)

1. **première photo personnelle** ;
2. **pochette générique** trouvée automatiquement ;
3. **image placeholder** locale (`public/placeholder.svg`).

Toute image générique porte la mention discrète :
« _Image de référence — l'article réel peut différer._ »

### Fonctionnement

Les pochettes sont recherchées **uniquement** pendant `npm run covers:sync`
(jamais pendant une compilation normale, jamais côté client). Les résultats sont
mis en **cache local** dans `data/cache/covers.json` et les images téléchargées
dans `public/covers/` : une compilation normale ne relance pas les recherches
déjà résolues, et le site fonctionne même si la source est indisponible.

### Fournisseurs disponibles et couverture

| Fournisseur                  | Clé requise           | Couverture                                                                       |
| ---------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `pricecharting` (**défaut**) | Non                   | **~100 %** : correspondance **exacte** par id produit du CSV, photo de la fiche. |
| `libretro`                   | Non                   | Xbox d'origine : bonne. **Xbox 360 : très limitée** (~12 jaquettes à la source). |
| `igdb`                       | Oui (Twitch, gratuit) | Xbox **et** Xbox 360 : complète. Combine automatiquement IGDB + Libretro.        |
| `null`                       | —                     | Aucune (placeholders seulement).                                                 |

Le défaut `pricecharting` est une **chaîne de priorité** : PriceCharting
(id exact, aucun matching flou possible) → IGDB (si identifiants fournis) →
Libretro. Le premier maillon dont le meilleur candidat franchit le seuil
d'acceptation gagne. Comme le CSV **provient** de PriceCharting, chaque ligne
pointe vers une fiche produit qui possède presque toujours une photo de boîte :
c'est la jaquette la plus fidèle possible à l'article catalogué.

> **Notes sur PriceCharting** : le fournisseur lit la page produit publique
> (`https://www.pricecharting.com/game/<id>`) et en extrait l'image principale —
> il n'existe pas d'API image gratuite. Les requêtes sont espacées d'une seconde
> et ne sont faites **qu'une seule fois** par jeu (cache + images téléchargées
> versionnées). Si la structure HTML de la page change, le fournisseur ne casse
> rien : les jeux non résolus passent au maillon suivant de la chaîne.
>
> Pour ajouter IGDB comme maillon de secours (recommandé) :
>
> 1. Créez une application sur <https://dev.twitch.tv/console> (gratuit).
> 2. Copiez le _Client ID_ et générez un _Client Secret_.
> 3. Dans `.env` : `COVER_API_CLIENT_ID=…`, `COVER_API_CLIENT_SECRET=…`
>    (en gardant `COVER_PROVIDER=pricecharting`).
> 4. `npm run covers:sync` puis `npm run build`.

Les correspondances sont **sécurisées par un seuil** : sous le score minimal, on
conserve le placeholder plutôt que d'afficher une jaquette erronée. Les
correspondances peu sûres sont listées dans `data/reports/uncertain-cover-matches.csv`
pour révision manuelle (surcharge possible via `data/overrides.json`).

Le choix de la pochette n'est **jamais** la première réponse de l'API : un
**score de correspondance** est calculé (titre normalisé, plateforme, année,
édition, mentions comme _Platinum Hits_, _Greatest Hits_…). Les correspondances
sous le seuil de confiance sont signalées dans un rapport.

## Variables d'environnement

Voir `.env.example`. Ces variables ne sont lues **que** par les scripts Node
(import / covers:sync), **jamais** par le code du site, et ne se retrouvent
jamais dans le bundle client.

| Variable                  | Rôle                                                                      |
| ------------------------- | ------------------------------------------------------------------------- |
| `SITE_URL`                | URL publique (canoniques, sitemap, Open Graph)                            |
| `BASE_PATH`               | Chemin de base (`/` pour Cloudflare, `/<repo>/` pour GitHub Pages projet) |
| `COVER_PROVIDER`          | `pricecharting` (défaut, aucune clé), `libretro`, `igdb` ou `null`        |
| `COVER_API_CLIENT_ID`     | Identifiant du fournisseur d'images (secret)                              |
| `COVER_API_CLIENT_SECRET` | Secret du fournisseur d'images (secret)                                   |

> **Ne committez jamais** de clé. Le vrai fichier `.env` est ignoré par git.
> En CI, les identifiants proviennent des **GitHub Actions Secrets**.

## Changer de fournisseur d'images

Le fournisseur est **isolé derrière une interface** (`CoverProvider`,
`scripts/lib/cover-provider.ts`). Implémentations fournies :

- `PriceChartingCoverProvider` — photo de la fiche PriceCharting par id exact, sans clé (tête de chaîne par défaut) ;
- `LibretroCoverProvider` — libretro-thumbnails, sans clé ;
- `IgdbCoverProvider` — IGDB via l'authentification Twitch (attribution « IGDB.com ») ;
- `SequentialCoverProvider` — chaîne de priorité : s'arrête au premier fournisseur satisfaisant ;
- `CompositeCoverProvider` — fusionne plusieurs sources (IGDB + Libretro) ;
- `NullCoverProvider` — aucun appel réseau, compile sans clé.

Pour ajouter un fournisseur : implémentez `CoverProvider`, puis référencez-le
dans `createCoverProvider()`. Aucune autre partie du code ne change.

> **Licence des images** : n'incluez jamais de contenu dont la licence interdit
> la redistribution ou l'usage prévu. IGDB autorise l'affichage des pochettes
> avec attribution ; les images sont servies par le CDN `images.igdb.com`.
> Respectez les conditions du fournisseur que vous choisissez.

## Rapports générés

Après chaque import / build, dans `data/reports/` :

- `import-summary.json` — totaux, importés, ignorés, doublons, répartition des
  images (perso / générique / placeholder), correspondances incertaines ;
- `invalid-rows.csv` — lignes rejetées avec la raison ;
- `missing-covers.csv` — jeux sans aucune image ;
- `uncertain-cover-matches.csv` — correspondances de pochette peu fiables.

## Déploiement

### Cloudflare Pages (recommandé)

1. Connectez le dépôt à Cloudflare Pages.
2. **Build command** : `npm run build`
3. **Output directory** : `dist`
4. **Variables d'environnement** : `NODE_VERSION=22`, `SITE_URL=<votre URL>`,
   `BASE_PATH=/`.
5. (Facultatif) La synchro des pochettes se fait **en local** ou via le workflow
   GitHub manuel — pas à chaque déploiement.

### GitHub Pages

Le workflow `.github/workflows/deploy-github-pages.yml` :

1. installe les dépendances avec `npm ci` (verrouillage reproductible) ;
2. génère les données, valide (types + lint + données), exécute les tests ;
3. compile le site avec le bon `base_path` (fourni par `configure-pages`) ;
4. **déploie uniquement si toutes les étapes précédentes réussissent**.

Activez GitHub Pages (Settings → Pages → Source : _GitHub Actions_).
Pour un dépôt de **projet**, `base` vaut automatiquement `/<nom-du-depot>/`.
Pour un dépôt **utilisateur** (`<user>.github.io`), `base` vaut `/`.

### Synchronisation des pochettes (workflow manuel)

`.github/workflows/covers-sync.yml` se lance **à la demande**
(`workflow_dispatch`), lit les secrets, et ouvre une Pull Request avec le cache
mis à jour. Aucun secret n'est exposé.

## Résolution des erreurs fréquentes

| Symptôme                                              | Cause / solution                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `Colonnes essentielles manquantes`                    | Le CSV n'a pas `id` / `product-name` / `console-name`. Vérifiez l'export.             |
| `Aucun CSV trouvé`                                    | Placez le fichier dans `data/pricecharting/collection.csv` ou utilisez `--fixture`.   |
| Toutes les images sont des placeholders               | Normal sans photos ni `covers:sync`. Ajoutez des photos ou configurez un fournisseur. |
| `covers:sync` ne trouve rien                          | `COVER_PROVIDER=null` (défaut). Configurez `igdb` + identifiants dans `.env`.         |
| Liens cassés après déploiement                        | Vérifiez `BASE_PATH` (Cloudflare = `/`, GitHub Pages projet = `/<repo>/`).            |
| Le site ne se reconstruit pas après ajout d'une photo | Relancez `npm run data:build`.                                                        |

## Architecture

Voir [`docs/architecture.md`](docs/architecture.md) et
[`docs/data-flow.md`](docs/data-flow.md).

## Licence

Aucune licence n'est encore choisie — voir [`LICENSE`](LICENSE). Le propriétaire
doit sélectionner une licence adaptée avant toute diffusion publique du code.
