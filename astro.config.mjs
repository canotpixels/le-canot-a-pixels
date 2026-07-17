// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import sitemap from '@astrojs/sitemap';
import { LOCALES, DEFAULT_LOCALE } from './src/utils/locales.ts';

// -----------------------------------------------------------------------------
// Cible de déploiement
//   - Cloudflare Pages (par défaut)  → base '/'
//   - GitHub Pages (dépôt de projet) → base '/<repo>/'  via BASE_PATH
//
// Aucune valeur sensible ici. `SITE_URL` et `BASE_PATH` proviennent de
// l'environnement (voir .env.example et le workflow GitHub Actions).
// -----------------------------------------------------------------------------
const SITE_URL = process.env.SITE_URL ?? 'https://otisdave.github.io';
const BASE_PATH = process.env.BASE_PATH ?? '/';

const localeIds = LOCALES.map((locale) => locale.id);

// Tout est à vendre : les pages /collection redirigent vers « à vendre » et
// sont exclues du sitemap (une seule URL indexée, pas de contenu dupliqué).
const { PUBLIC_SELL_ALL_COLLECTION } = loadEnv(process.env.NODE_ENV ?? '', process.cwd(), '');
const SELL_ALL_COLLECTION = PUBLIC_SELL_ALL_COLLECTION === 'true';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  compressHTML: true,

  integrations: [
    sitemap({
      filter: (url) =>
        !SELL_ALL_COLLECTION || !/\/collection\/?$/.test(new URL(url).pathname),
      i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales: Object.fromEntries(localeIds.map((l) => [l, l])),
      },
    }),
  ],

  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    locales: localeIds,
    routing: {
      // URL françaises propres (/collection), anglais préfixé (/en/collection)
      prefixDefaultLocale: false,
    },
  },
});
