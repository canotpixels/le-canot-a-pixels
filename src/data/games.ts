import type { Game, GameStatus, Completeness, GameImage } from '../../scripts/lib/types';
import rawGames from '../../data/generated/games.json';

// -----------------------------------------------------------------------------
// Accès typé aux données générées (data/generated/games.json).
// -----------------------------------------------------------------------------

export type { Game, GameStatus, Completeness, GameImage };

export const games: Game[] = rawGames as Game[];

export function gamesByStatus(status: GameStatus): Game[] {
  return games.filter((g) => g.status === status);
}

/**
 * PUBLIC_SELL_ALL_COLLECTION=true : la collection entière apparaît dans l'onglet
 * « à vendre ». Pour éviter deux pages au contenu identique (mauvais pour le SEO),
 * la page Collection redirige alors vers À vendre et disparaît de la navigation.
 */
export const SELL_ALL_COLLECTION = import.meta.env.PUBLIC_SELL_ALL_COLLECTION === 'true';

/** Jeux affichés dans l'onglet « à vendre » (statut for-sale, + toute la collection si le flag est actif). */
export function forSaleGames(): Game[] {
  if (!SELL_ALL_COLLECTION) return gamesByStatus('for-sale');
  return games.filter((g) => g.status === 'for-sale' || g.status === 'collection');
}

export function getGameBySlug(slug: string): Game | undefined {
  return games.find((g) => g.slug === slug);
}

/** Liste triée des consoles présentes. */
export function consoleList(source: Game[] = games): string[] {
  return [...new Set(source.map((g) => g.console))].sort((a, b) => a.localeCompare(b));
}

export interface StatusCounts {
  collection: number;
  'for-sale': number;
  wishlist: number;
  total: number;
}

export function statusCounts(): StatusCounts {
  return {
    collection: gamesByStatus('collection').length,
    'for-sale': forSaleGames().length,
    wishlist: gamesByStatus('wishlist').length,
    total: games.length,
  };
}

/** Jeux récemment ajoutés (par date d'entrée décroissante). */
export function recentGames(limit = 6): Game[] {
  return [...games]
    .filter((g) => g.dateAdded)
    .sort((a, b) => (b.dateAdded ?? '').localeCompare(a.dateAdded ?? ''))
    .slice(0, limit);
}

/** Valeur totale estimée de la collection (pour la page d'accueil / à-propos). */
export function totalEstimatedValue(source: Game[] = games): number {
  return source.reduce((sum, g) => sum + (g.estimatedValue ?? 0) * g.quantity, 0);
}
