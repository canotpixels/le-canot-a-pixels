import { DEFAULT_LOCALE } from './locales';

// -----------------------------------------------------------------------------
// Construction d'URL localisées et compatibles avec un chemin de base
// (Cloudflare Pages = '/', GitHub Pages projet = '/<repo>/').
//
// Français (locale par défaut) : URL sans préfixe (/collection).
// Anglais : préfixe /en (/en/collection).
// -----------------------------------------------------------------------------

export type RouteKey = 'home' | 'collection' | 'wishlist' | 'games' | 'about' | 'contact';

const SEGMENTS: Record<string, Record<Exclude<RouteKey, 'home'>, string>> = {
  fr: {
    collection: 'collection',
    wishlist: 'jeux-recherches',
    games: 'jeux',
    about: 'a-propos',
    contact: 'contact',
  },
  en: {
    collection: 'collection',
    wishlist: 'wanted',
    games: 'games',
    about: 'about',
    contact: 'contact',
  },
};

const BASE = import.meta.env.BASE_URL || '/';

function withBase(path: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const clean = path.startsWith('/') ? path : `/${path}`;
  const joined = `${base}${clean}`;
  return joined === '' ? '/' : joined;
}

function localePrefix(lang: string): string {
  return lang === DEFAULT_LOCALE ? '' : `/${lang}`;
}

export function link(lang: string, key: RouteKey, slug?: string): string {
  const prefix = localePrefix(lang);
  if (key === 'home') {
    return withBase(prefix || '/');
  }
  const segment = SEGMENTS[lang]?.[key] ?? SEGMENTS[DEFAULT_LOCALE]?.[key] ?? key;
  if (key === 'games' && slug) {
    return withBase(`${prefix}/${segment}/${slug}`);
  }
  return withBase(`${prefix}/${segment}`);
}

/** URL absolue pour les canoniques / Open Graph. */
export function absoluteUrl(site: URL | undefined, path: string): string {
  if (!site) return path;
  return new URL(path, site).toString();
}

/** Prépare un chemin d'asset public (placeholder, images téléchargées). */
export function publicAsset(path: string): string {
  return withBase(path);
}
