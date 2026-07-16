import type { AdaptedGame } from './pricecharting.js';
import type { Overrides, OverrideEntry } from './types.js';

// -----------------------------------------------------------------------------
// Couche de surcharge locale (data/overrides.json).
//
// Le CSV reste la source principale. Les surcharges ne servent qu'aux
// propriétés propres au site absentes de l'export PriceCharting (statut,
// prix de vente, notes de boutique, région, masquage).
//
// Clé de surcharge : identifiant PriceCharting brut ("6656") OU identifiant
// interne complet ("pc-6656", "gen-xxxx").
// -----------------------------------------------------------------------------

export interface OverriddenGame extends AdaptedGame {
  salePrice?: number;
  hidden?: boolean;
}

function lookup(game: AdaptedGame, overrides: Overrides): OverrideEntry | undefined {
  if (game.priceChartingId && overrides[game.priceChartingId]) {
    return overrides[game.priceChartingId];
  }
  return overrides[game.id];
}

export function applyOverride(game: AdaptedGame, entry: OverrideEntry | undefined): OverriddenGame {
  if (!entry) return { ...game };
  return {
    ...game,
    ...(entry.status ? { status: entry.status } : {}),
    ...(entry.region ? { region: entry.region } : {}),
    ...(entry.edition ? { edition: entry.edition } : {}),
    ...(entry.notes ? { notes: entry.notes } : {}),
    ...(entry.estimatedValue !== undefined ? { estimatedValue: entry.estimatedValue } : {}),
    ...(entry.salePrice !== undefined ? { salePrice: entry.salePrice } : {}),
    ...(entry.hidden !== undefined ? { hidden: entry.hidden } : {}),
  };
}

export function applyOverrides(games: AdaptedGame[], overrides: Overrides): OverriddenGame[] {
  return games.map((game) => applyOverride(game, lookup(game, overrides)));
}
