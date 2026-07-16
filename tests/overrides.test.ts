import { describe, it, expect } from 'vitest';
import { applyOverride, applyOverrides } from '../scripts/lib/overrides';
import type { AdaptedGame } from '../scripts/lib/pricecharting';

function makeGame(partial: Partial<AdaptedGame> = {}): AdaptedGame {
  return {
    id: 'pc-100',
    priceChartingId: '100',
    title: 'Game',
    console: 'Xbox',
    completeness: 'loose',
    quantity: 1,
    currency: 'CAD',
    status: 'collection',
    normalizedTitle: 'game',
    slugBase: 'game',
    ...partial,
  };
}

describe('applyOverride', () => {
  it('applique le statut, le prix de vente et les notes', () => {
    const result = applyOverride(makeGame(), {
      status: 'for-sale',
      salePrice: 19.99,
      notes: 'Bon état',
    });
    expect(result.status).toBe('for-sale');
    expect(result.salePrice).toBe(19.99);
    expect(result.notes).toBe('Bon état');
  });

  it('ne modifie rien si aucune surcharge', () => {
    const game = makeGame();
    expect(applyOverride(game, undefined)).toEqual({ ...game });
  });
});

describe('applyOverrides', () => {
  it('résout par identifiant PriceCharting brut ou id interne', () => {
    const games = [makeGame({ id: 'pc-100', priceChartingId: '100' })];
    const byRaw = applyOverrides(games, { '100': { status: 'wishlist' } });
    expect(byRaw[0]?.status).toBe('wishlist');

    const byInternal = applyOverrides(games, { 'pc-100': { status: 'for-sale' } });
    expect(byInternal[0]?.status).toBe('for-sale');
  });

  it('marque un jeu comme masqué', () => {
    const games = [makeGame()];
    const out = applyOverrides(games, { '100': { hidden: true } });
    expect(out[0]?.hidden).toBe(true);
  });
});
