// @ts-check
import { defineConfig } from 'astro/config';
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

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'ignore',
  compressHTML: true,

  // Anciennes URL « à vendre » : redirigées vers la collection (SEO / liens existants).
  redirects: {
    '/a-vendre': '/collection',
    '/en/for-sale': '/en/collection',
  },

  integrations: [
    sitemap({
      // Les pages de redirection ne sont pas indexées.
      filter: (url) => !/\/(a-vendre|for-sale)\/?$/.test(url),
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
