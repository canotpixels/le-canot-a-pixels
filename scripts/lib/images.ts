import { readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import type { GameImage } from './types.js';

/** Seuil au-delà duquel une photo personnelle déclenche un avertissement. */
export const MAX_PERSONAL_IMAGE_BYTES = 1_500_000; // 1,5 Mo

// -----------------------------------------------------------------------------
// Détection des photos personnelles et logique de fallback des images.
//
// Ordre de fallback (strict) :
//   1. première photo personnelle
//   2. pochette générique trouvée automatiquement
//   3. image placeholder locale
// -----------------------------------------------------------------------------

export const ACCEPTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'] as const;

export function isAcceptedImage(fileName: string): boolean {
  return (ACCEPTED_IMAGE_EXTENSIONS as readonly string[]).includes(extname(fileName).toLowerCase());
}

/** Tri déterministe et insensible à la casse par nom de fichier. */
export function sortImageFiles(files: string[]): string[] {
  return [...files].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'en'));
}

/**
 * Liste les photos personnelles d'un jeu, triées de façon déterministe.
 * Retourne les chemins relatifs au dossier des assets (clés utilisables par
 * le glob Astro), p. ex. "games/personal/pc-6656/01-front.webp".
 * Aucune modification de code n'est requise après l'ajout d'un fichier.
 */
export function detectPersonalImageKeys(
  gameId: string,
  personalRootDir: string,
  assetsRootDir: string
): string[] {
  const dir = join(personalRootDir, gameId);
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const images = sortImageFiles(entries.filter(isAcceptedImage));
  return images.map((file) => relative(assetsRootDir, join(dir, file)).split(/[\\/]/).join('/'));
}

/**
 * Repère les photos personnelles trop lourdes afin qu'elles ne passent pas
 * silencieusement. Retourne un message d'avertissement par fichier concerné.
 */
export function personalImageWeightWarnings(gameId: string, personalRootDir: string): string[] {
  const dir = join(personalRootDir, gameId);
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const warnings: string[] = [];
  for (const file of entries.filter(isAcceptedImage)) {
    try {
      const { size } = statSync(join(dir, file));
      if (size > MAX_PERSONAL_IMAGE_BYTES) {
        const mb = (size / 1_000_000).toFixed(1);
        warnings.push(
          `Photo personnelle volumineuse (${mb} Mo) : ${gameId}/${file} — pensez à la compresser (WebP/AVIF, largeur ≤ 1600 px).`
        );
      }
    } catch {
      // ignore
    }
  }
  return warnings;
}

export interface BuildImagesInput {
  title: string;
  console: string;
  personalKeys: string[];
  genericCover?: { src: string; attribution?: string; externalId?: string };
  placeholderSrc: string;
}

export interface BuiltImages {
  personalImages: GameImage[];
  genericCover?: GameImage;
  placeholder: GameImage;
  primaryImage: GameImage;
  tier: 'personal' | 'generic' | 'placeholder';
}

function defaultAlt(title: string, consoleName: string): string {
  return `${title} — ${consoleName}`;
}

/** Construit les images d'un jeu et applique l'ordre de fallback (fonction pure). */
export function buildGameImages(input: BuildImagesInput): BuiltImages {
  const alt = defaultAlt(input.title, input.console);

  const personalImages: GameImage[] = input.personalKeys.map((src, index) => ({
    src,
    alt: index === 0 ? alt : `${alt} (photo ${index + 1})`,
    source: 'personal',
  }));

  const genericCover: GameImage | undefined = input.genericCover
    ? {
        src: input.genericCover.src,
        alt,
        source: 'generic',
        ...(input.genericCover.attribution ? { attribution: input.genericCover.attribution } : {}),
        ...(input.genericCover.externalId ? { externalId: input.genericCover.externalId } : {}),
      }
    : undefined;

  const placeholder: GameImage = {
    src: input.placeholderSrc,
    alt,
    source: 'placeholder',
  };

  let primaryImage: GameImage;
  let tier: BuiltImages['tier'];
  if (personalImages[0]) {
    primaryImage = personalImages[0];
    tier = 'personal';
  } else if (genericCover) {
    primaryImage = genericCover;
    tier = 'generic';
  } else {
    primaryImage = placeholder;
    tier = 'placeholder';
  }

  return {
    personalImages,
    ...(genericCover ? { genericCover } : {}),
    placeholder,
    primaryImage,
    tier,
  };
}
