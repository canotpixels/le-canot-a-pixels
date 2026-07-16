import { createHash } from 'node:crypto';

// -----------------------------------------------------------------------------
// Normalisation des titres, génération de slugs et d'identifiants déterministes.
// -----------------------------------------------------------------------------

/** Mentions d'édition/réédition fréquentes, utiles au scoring de pochette. */
export const EDITION_KEYWORDS = [
  'greatest hits',
  "player's choice",
  'players choice',
  'platinum hits',
  'platinum',
  'classics',
  'game of the year',
  'goty',
  'limited edition',
  'collector',
  'special edition',
  'signature edition',
  'essentials',
  'not for resale',
];

/** Retire accents et diacritiques. */
function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Titre normalisé pour la comparaison : minuscule, sans accents, sans
 * mentions d'édition entre crochets, ponctuation réduite aux espaces.
 */
export function normalizeTitle(title: string): string {
  const withoutBrackets = title.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ');
  return stripDiacritics(withoutBrackets)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Extrait la mention d'édition entre crochets si présente. Ex. "[Platinum Hits]". */
export function extractEdition(title: string): string | undefined {
  const match = title.match(/\[([^\]]+)\]/);
  return match?.[1]?.trim() || undefined;
}

/** Slug URL lisible et déterministe. */
export function slugify(input: string): string {
  return stripDiacritics(input)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Identifiant déterministe pour un jeu sans identifiant PriceCharting.
 * Basé sur titre + console + région + édition afin d'être stable dans le temps.
 */
export function deterministicId(parts: {
  title: string;
  console: string;
  region?: string;
  edition?: string;
}): string {
  const key = [
    normalizeTitle(parts.title),
    parts.console.toLowerCase().trim(),
    (parts.region ?? '').toLowerCase().trim(),
    (parts.edition ?? '').toLowerCase().trim(),
  ].join('|');
  return `gen-${createHash('sha1').update(key).digest('hex').slice(0, 12)}`;
}

/**
 * Rend une liste de slugs uniques de façon déterministe : en cas de collision,
 * on suffixe par la console puis par un compteur.
 */
export function ensureUniqueSlug(base: string, taken: Set<string>, discriminator?: string): string {
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  const withDisc = discriminator ? `${base}-${slugify(discriminator)}` : base;
  if (withDisc !== base && !taken.has(withDisc)) {
    taken.add(withDisc);
    return withDisc;
  }
  let counter = 2;
  let candidate = `${withDisc}-${counter}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${withDisc}-${counter}`;
  }
  taken.add(candidate);
  return candidate;
}
