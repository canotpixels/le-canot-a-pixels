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
    'for-sale': gamesByStatus('for-sale').length,
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
