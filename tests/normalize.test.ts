import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  extractEdition,
  slugify,
  deterministicId,
  ensureUniqueSlug,
} from '../scripts/lib/normalize';

describe('normalizeTitle', () => {
  it('minuscule, sans accents, sans crochets/parenthèses', () => {
    expect(normalizeTitle('Pokémon [Platinum Hits]')).toBe('pokemon');
    expect(normalizeTitle('Tom Clancy’s Splinter Cell (2002)')).toBe('tom clancy s splinter cell');
  });

  it('remplace & par "and" et réduit la ponctuation', () => {
    expect(normalizeTitle('Dungeons & Dragons: Heroes!')).toBe('dungeons and dragons heroes');
  });
});

describe('extractEdition', () => {
  it('extrait la mention entre crochets', () => {
    expect(extractEdition('Army of Two [Platinum Hits]')).toBe('Platinum Hits');
    expect(extractEdition('Fable')).toBeUndefined();
  });
});

describe('slugify', () => {
  it('produit un slug lisible et déterministe', () => {
    expect(slugify('Assassin’s Creed IV: Black Flag')).toBe('assassin-s-creed-iv-black-flag');
    expect(slugify('Halo: Combat Evolved')).toBe('halo-combat-evolved');
  });
});

describe('deterministicId', () => {
  it('est stable pour les mêmes entrées', () => {
    const a = deterministicId({ title: 'Fable', console: 'Xbox' });
    const b = deterministicId({ title: 'Fable', console: 'Xbox' });
    expect(a).toBe(b);
    expect(a.startsWith('gen-')).toBe(true);
  });

  it('diffère selon la console', () => {
    const xbox = deterministicId({ title: 'Tomb Raider', console: 'Xbox' });
    const x360 = deterministicId({ title: 'Tomb Raider', console: 'Xbox 360' });
    expect(xbox).not.toBe(x360);
  });
});

describe('ensureUniqueSlug', () => {
  it('désambiguïse par le discriminant puis par compteur', () => {
    const taken = new Set<string>();
    expect(ensureUniqueSlug('tomb-raider', taken, 'Xbox')).toBe('tomb-raider');
    expect(ensureUniqueSlug('tomb-raider', taken, 'Xbox 360')).toBe('tomb-raider-xbox-360');
    expect(ensureUniqueSlug('tomb-raider', taken, 'Xbox 360')).toBe('tomb-raider-xbox-360-2');
  });
});
