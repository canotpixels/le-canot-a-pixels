// -----------------------------------------------------------------------------
// Constantes partagées par les scripts d'outillage.
// La devise/locale d'affichage vit dans src/config/site.ts (côté site) ;
// ici on ne garde que ce dont le pipeline a besoin.
// -----------------------------------------------------------------------------

/** Devise par défaut appliquée aux prix importés. */
export const SITE_CURRENCY = 'CAD';

/**
 * Chemin (relatif à la racine web) du placeholder local. La base éventuelle
 * (GitHub Pages) est ajoutée à l'affichage par les composants Astro.
 */
export const PLACEHOLDER_SRC = '/placeholder.svg';
