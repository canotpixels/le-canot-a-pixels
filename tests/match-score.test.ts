import { describe, it, expect } from 'vitest';
import {
  titleSimilarity,
  scoreCandidate,
  rankCandidates,
  sequelMarker,
} from '../scripts/lib/match-score';
import type { GameIdentity, CoverCandidate } from '../scripts/lib/types';

const game: GameIdentity = {
  id: 'pc-1',
  title: 'Halo: Combat Evolved',
  normalizedTitle: 'halo combat evolved',
  console: 'Xbox',
  year: 2001,
};

function candidate(partial: Partial<CoverCandidate>): CoverCandidate {
  return {
    externalId: 'x',
    title: 'Halo: Combat Evolved',
    imageUrl: 'https://img/x.jpg',
    ...partial,
  };
}

describe('titleSimilarity', () => {
  it('vaut 1 pour un titre identique après normalisation', () => {
    expect(titleSimilarity('Halo [Platinum Hits]', 'halo')).toBe(1);
  });
  it('est plus élevée pour des titres proches', () => {
    const close = titleSimilarity('Halo Combat Evolved', 'Halo Combat');
    const far = titleSimilarity('Halo Combat Evolved', 'FIFA 2003');
    expect(close).toBeGreaterThan(far);
  });
});

describe('scoreCandidate', () => {
  it('récompense la même plateforme et l’année exacte', () => {
    const good = scoreCandidate(game, candidate({ platform: 'Xbox', year: 2001 }));
    const wrongPlatform = scoreCandidate(
      game,
      candidate({ platform: 'PlayStation 2', year: 2001 })
    );
    expect(good).toBeGreaterThan(wrongPlatform);
    expect(good).toBeGreaterThan(0.8);
  });

  it('pénalise un titre sans rapport', () => {
    const score = scoreCandidate(game, candidate({ title: 'Madden NFL', platform: 'Xbox' }));
    expect(score).toBeLessThan(0.6);
  });
});

describe('sequelMarker', () => {
  it('extrait le numéro de suite arabe ou romain', () => {
    expect(sequelMarker('prototype 2')).toBe('2');
    expect(sequelMarker('final fantasy xiii')).toBe('13');
    expect(sequelMarker('halo')).toBeUndefined();
  });
});

describe('pénalité de suite', () => {
  it('pénalise fortement un numéro de suite discordant', () => {
    const proto: GameIdentity = {
      id: 'x',
      title: 'Prototype 2',
      normalizedTitle: 'prototype 2',
      console: 'Xbox 360',
    };
    const portal = scoreCandidate(proto, candidate({ title: 'Portal 2', platform: 'Xbox 360' }));
    // Même s'ils partagent le jeton « 2 », le score reste sous le seuil d'acceptation.
    expect(portal).toBeLessThan(0.5);
  });

  it('classe un numéro discordant en dessous d’une suite absente', () => {
    const gr2: GameIdentity = {
      id: 'x',
      title: 'Ghost Recon 2',
      normalizedTitle: 'ghost recon 2',
      console: 'Xbox',
    };
    const wrongNumber = scoreCandidate(
      gr2,
      candidate({ title: 'Ghost Recon 3', platform: 'Xbox' })
    );
    const noNumber = scoreCandidate(gr2, candidate({ title: 'Ghost Recon', platform: 'Xbox' }));
    const exact = scoreCandidate(gr2, candidate({ title: 'Ghost Recon 2', platform: 'Xbox' }));
    expect(exact).toBeGreaterThan(noNumber);
    expect(noNumber).toBeGreaterThan(wrongNumber);
  });
});

describe('rankCandidates', () => {
  it('classe le meilleur candidat en tête', () => {
    const ranked = rankCandidates(game, [
      candidate({ externalId: 'bad', title: 'Halo Wars', platform: 'Xbox 360', year: 2009 }),
      candidate({
        externalId: 'good',
        title: 'Halo: Combat Evolved',
        platform: 'Xbox',
        year: 2001,
      }),
    ]);
    expect(ranked[0]?.candidate.externalId).toBe('good');
    expect(ranked[0]?.score).toBeGreaterThanOrEqual(ranked[1]?.score ?? 0);
  });
});
