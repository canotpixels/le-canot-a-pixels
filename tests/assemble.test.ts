import { describe, it, expect } from 'vitest';
import { assembleGames } from '../scripts/lib/assemble';
import type { CoverCache } from '../scripts/lib/types';

const HEADER =
  'id,product-name,console-name,price-in-pennies,include-string,condition-string,sku,notes,cost-basis-in-pennies,quantity,date-entered,date-purchased,grading-company,grading-cert-id,folder';

const CSV = [
  HEADER,
  '1,Halo,Xbox,999,Item only,Normal wear,,,0,1,2025-01-01,,,,Collection',
  '2,Fable,Xbox,1299,Item only,Normal wear,,,0,1,2025-01-02,,,,Collection',
  '3,Tomb Raider,Xbox,500,Item only,Normal wear,,,0,1,2025-01-03,,,,Collection',
  '4,Tomb Raider,Xbox 360,700,Item only,Normal wear,,,0,1,2025-01-04,,,,Collection',
  ',,,,,,,invalide,,,,,,,',
].join('\n');

const NOW = () => '2025-06-01T00:00:00.000Z';

const baseOptions = {
  csvText: CSV,
  csvSourceLabel: 'test',
  overrides: {},
  coverCache: {} as CoverCache,
  personalRootDir: '/nonexistent/personal',
  assetsRootDir: '/nonexistent',
  placeholderSrc: '/placeholder.svg',
  now: NOW,
};

describe('assembleGames', () => {
  it('produit des jeux avec slugs uniques et compte les lignes invalides', () => {
    const { games, report } = assembleGames(baseOptions);
    expect(games).toHaveLength(4);
    expect(report.skipped).toBe(1);
    const slugs = games.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('tomb-raider');
    expect(slugs).toContain('tomb-raider-xbox-360');
  });

  it('applique le placeholder quand aucune image', () => {
    const { games, report } = assembleGames(baseOptions);
    expect(games.every((g) => g.primaryImage.source === 'placeholder')).toBe(true);
    expect(report.withPlaceholder).toBe(4);
  });

  it('utilise la pochette générique du cache', () => {
    const coverCache: CoverCache = {
      'pc-2': {
        gameId: 'pc-2',
        query: 'fable',
        provider: 'demo',
        externalId: 'e',
        imageUrl: 'https://img/fable.jpg',
        confidence: 0.9,
        attribution: 'IGDB',
        fetchedAt: NOW(),
        status: 'resolved',
      },
    };
    const { games } = assembleGames({ ...baseOptions, coverCache });
    const fable = games.find((g) => g.id === 'pc-2');
    expect(fable?.primaryImage.source).toBe('generic');
    expect(fable?.genericCover?.attribution).toBe('IGDB');
  });

  it('applique les surcharges (statut + prix de vente) et le masquage', () => {
    const overrides = {
      '1': { status: 'for-sale' as const, salePrice: 25 },
      '3': { hidden: true },
    };
    const { games } = assembleGames({ ...baseOptions, overrides });
    expect(games).toHaveLength(3); // Tomb Raider Xbox masqué
    const halo = games.find((g) => g.id === 'pc-1');
    expect(halo?.status).toBe('for-sale');
    expect(halo?.salePrice).toBe(25);
  });

  it('lève une erreur si des colonnes essentielles manquent', () => {
    expect(() => assembleGames({ ...baseOptions, csvText: 'foo,bar\n1,2' })).toThrow(
      /product-name/
    );
  });
});
