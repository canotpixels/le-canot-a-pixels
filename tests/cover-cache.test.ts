import { describe, it, expect } from 'vitest';
import { resolveCover, isUncertain } from '../scripts/lib/cover-cache';
import { NullCoverProvider } from '../scripts/lib/cover-provider';
import type {
  CoverProvider,
  CoverCache,
  GameIdentity,
  CoverSearchResult,
} from '../scripts/lib/types';

const game: GameIdentity = {
  id: 'pc-1',
  title: 'Halo: Combat Evolved',
  normalizedTitle: 'halo combat evolved',
  console: 'Xbox',
  year: 2001,
};

const NOW = () => '2025-01-01T00:00:00.000Z';

class StubProvider implements CoverProvider {
  readonly name = 'stub';
  constructor(private readonly result: CoverSearchResult) {}
  async searchCover(): Promise<CoverSearchResult> {
    return this.result;
  }
}

class FailingProvider implements CoverProvider {
  readonly name = 'failing';
  async searchCover(): Promise<CoverSearchResult> {
    throw new Error('API indisponible');
  }
}

describe('resolveCover', () => {
  it('choisit le meilleur candidat et calcule la confiance', async () => {
    const provider = new StubProvider({
      provider: 'stub',
      candidates: [
        {
          externalId: 'good',
          title: 'Halo: Combat Evolved',
          platform: 'Xbox',
          year: 2001,
          imageUrl: 'https://img/g.jpg',
          attribution: 'IGDB',
        },
        { externalId: 'bad', title: 'FIFA 2003', platform: 'Xbox', imageUrl: 'https://img/b.jpg' },
      ],
    });
    const { entry, fromCache } = await resolveCover(game, provider, {}, { now: NOW });
    expect(fromCache).toBe(false);
    expect(entry.status).toBe('resolved');
    expect(entry.externalId).toBe('good');
    expect(entry.confidence).toBeGreaterThan(0.6);
    expect(entry.attribution).toBe('IGDB');
  });

  it('réutilise une entrée du cache déjà résolue', async () => {
    const cache: CoverCache = {
      'pc-1': {
        gameId: 'pc-1',
        query: 'halo combat evolved',
        provider: 'stub',
        externalId: 'cached',
        imageUrl: 'https://img/cached.jpg',
        confidence: 0.9,
        fetchedAt: NOW(),
        status: 'resolved',
      },
    };
    const provider = new StubProvider({ provider: 'stub', candidates: [] });
    const { entry, fromCache } = await resolveCover(game, provider, cache, { now: NOW });
    expect(fromCache).toBe(true);
    expect(entry.externalId).toBe('cached');
  });

  it('marque "not-found" quand aucun candidat', async () => {
    const provider = new NullCoverProvider();
    const { entry } = await resolveCover(game, provider, {}, { now: NOW });
    expect(entry.status).toBe('not-found');
    expect(entry.confidence).toBe(0);
  });

  it('refuse une correspondance sous le seuil (jaquette erronée évitée)', async () => {
    // "Bayonetta" pour "Halo" : score plateforme seul, sous le seuil d'acceptation.
    const provider = new StubProvider({
      provider: 'stub',
      candidates: [
        { externalId: 'bad', title: 'Bayonetta', platform: 'Xbox', imageUrl: 'https://img/b.jpg' },
      ],
    });
    const { entry } = await resolveCover(game, provider, {}, { now: NOW });
    expect(entry.status).toBe('not-found');
  });

  it('reste robuste si l’API est indisponible (aucune entrée préalable)', async () => {
    const { entry } = await resolveCover(game, new FailingProvider(), {}, { now: NOW });
    expect(entry.status).toBe('not-found');
  });

  it('conserve l’entrée précédente si l’API échoue', async () => {
    const cache: CoverCache = {
      'pc-1': {
        gameId: 'pc-1',
        query: 'q',
        provider: 'failing',
        externalId: 'old',
        confidence: 0.8,
        fetchedAt: NOW(),
        status: 'resolved',
      },
    };
    const { entry, fromCache } = await resolveCover(game, new FailingProvider(), cache, {
      now: NOW,
      force: true,
    });
    expect(fromCache).toBe(true);
    expect(entry.externalId).toBe('old');
  });
});

describe('isUncertain', () => {
  it('détecte une correspondance sous le seuil', () => {
    expect(
      isUncertain({
        gameId: 'x',
        query: 'q',
        provider: 'p',
        confidence: 0.4,
        fetchedAt: NOW(),
        status: 'resolved',
      })
    ).toBe(true);
    expect(
      isUncertain({
        gameId: 'x',
        query: 'q',
        provider: 'p',
        confidence: 0.9,
        fetchedAt: NOW(),
        status: 'resolved',
      })
    ).toBe(false);
  });
});
