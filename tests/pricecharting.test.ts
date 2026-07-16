import { describe, it, expect } from 'vitest';
import { parseCsv } from '../scripts/lib/csv';
import { adaptRows, adaptRow, mapCompleteness } from '../scripts/lib/pricecharting';

const HEADER =
  'id,product-name,console-name,price-in-pennies,include-string,condition-string,sku,notes,cost-basis-in-pennies,quantity,date-entered,date-purchased,grading-company,grading-cert-id,folder';

function rowsFrom(lines: string[]) {
  return parseCsv([HEADER, ...lines].join('\n'));
}

describe('mapCompleteness', () => {
  it('traduit include-string vers le modèle interne', () => {
    expect(mapCompleteness('Item only')).toBe('loose');
    expect(mapCompleteness('Item, Box, and Manual')).toBe('cib');
    expect(mapCompleteness('New Item, Box, and Manual')).toBe('new');
    expect(mapCompleteness('')).toBe('unknown');
  });
});

describe('adaptRows', () => {
  it('convertit les pennies en montants et lit les colonnes clés', () => {
    const parsed = rowsFrom([
      '6656,The Hobbit,Xbox,696,Item only,Normal wear,,,150,1,2025-08-18,,,,',
    ]);
    const { games } = adaptRows(parsed);
    expect(games).toHaveLength(1);
    const g = games[0]!;
    expect(g.id).toBe('pc-6656');
    expect(g.priceChartingId).toBe('6656');
    expect(g.estimatedValue).toBeCloseTo(6.96);
    expect(g.purchasePrice).toBeCloseTo(1.5);
    expect(g.console).toBe('Xbox');
    expect(g.completeness).toBe('loose');
    expect(g.status).toBe('collection');
  });

  it('détecte le statut via la colonne folder', () => {
    const parsed = rowsFrom([
      '1,Game A,Xbox,100,Item only,Normal wear,,,0,1,2025-01-01,,,,À vendre',
      '2,Game B,Xbox,100,Item only,Normal wear,,,0,1,2025-01-01,,,,Wishlist',
    ]);
    const { games } = adaptRows(parsed);
    expect(games[0]?.status).toBe('for-sale');
    expect(games[1]?.status).toBe('wishlist');
  });

  it('ignore une ligne invalide sans faire échouer le reste', () => {
    const parsed = rowsFrom([
      '1,Valid Game,Xbox,100,Item only,Normal wear,,,0,1,2025-01-01,,,,',
      ',,,,,,,Ligne invalide,,,,,,,',
    ]);
    const { games, invalidRows } = adaptRows(parsed);
    expect(games).toHaveLength(1);
    expect(invalidRows).toHaveLength(1);
    expect(invalidRows[0]?.reason).toMatch(/Titre/);
  });

  it('signale les doublons d’identifiant', () => {
    const parsed = rowsFrom([
      '5,Game,Xbox,100,Item only,Normal wear,,,0,1,2025-01-01,,,,',
      '5,Game,Xbox,100,Item only,Normal wear,,,0,1,2025-01-01,,,,',
    ]);
    const { games, duplicates } = adaptRows(parsed);
    expect(games).toHaveLength(1);
    expect(duplicates).toBe(1);
  });

  it('retourne une erreur fatale si des colonnes essentielles manquent', () => {
    const parsed = parseCsv('foo,bar\n1,2');
    const result = adaptRows(parsed);
    expect(result.fatal).toBeDefined();
    expect(result.fatal).toMatch(/product-name/);
  });
});

describe('adaptRow', () => {
  it('génère un id déterministe sans identifiant PriceCharting', () => {
    const parsed = rowsFrom([',No PC Id,Xbox,100,Item only,Normal wear,,,0,1,2025-01-01,,,,']);
    // product-name présent mais id absent -> id généré
    const result = adaptRow(parsed.rows[0]!);
    expect('game' in result).toBe(true);
    if ('game' in result) {
      expect(result.game.id.startsWith('gen-')).toBe(true);
      expect(result.game.priceChartingId).toBeUndefined();
    }
  });
});
