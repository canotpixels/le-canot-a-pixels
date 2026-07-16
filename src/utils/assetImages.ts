import type { ImageMetadata } from 'astro';

// -----------------------------------------------------------------------------
// Résolution des photos personnelles vers des assets optimisables par Astro.
//
// Les clés stockées dans games.json ("games/personal/<id>/xx.png") sont mises
// en correspondance avec les modules importés depuis src/assets. Toute image
// ajoutée dans le bon dossier est détectée sans changement de code.
// -----------------------------------------------------------------------------

const modules = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/games/**/*.{png,jpg,jpeg,webp,avif}',
  { eager: true }
);

const byKey: Record<string, ImageMetadata> = {};
for (const [path, mod] of Object.entries(modules)) {
  const key = path.replace('../assets/', '');
  byKey[key] = mod.default;
}

export function getPersonalImage(key: string): ImageMetadata | undefined {
  return byKey[key];
}
