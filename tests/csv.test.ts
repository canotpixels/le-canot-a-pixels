import { describe, it, expect } from 'vitest';
import { parseCsv, splitCsvRecords, normalizeHeader } from '../scripts/lib/csv';

describe('normalizeHeader', () => {
  it('minusculise, retire les espaces et normalise les séparateurs', () => {
    expect(normalizeHeader('  Product Name ')).toBe('product-name');
    expect(normalizeHeader('price_in_pennies')).toBe('price-in-pennies');
    expect(normalizeHeader('Console-Name')).toBe('console-name');
  });
});

describe('splitCsvRecords', () => {
  it('gère les guillemets avec virgules internes', () => {
    const rows = splitCsvRecords('a,"b,c",d');
    expect(rows[0]).toEqual(['a', 'b,c', 'd']);
  });

  it('gère les guillemets échappés ("")', () => {
    const rows = splitCsvRecords('a,"say ""hi""",b');
    expect(rows[0]).toEqual(['a', 'say "hi"', 'b']);
  });

  it('gère les sauts de ligne dans un champ entre guillemets', () => {
    const rows = splitCsvRecords('a,"line1\nline2",c');
    expect(rows.length).toBe(1);
    expect(rows[0]?.[1]).toBe('line1\nline2');
  });

  it('gère les fins de ligne CRLF et conserve les lignes vides (numérotation)', () => {
    // Les lignes vides sont conservées ([''] ) par le découpage bas niveau ;
    // c'est parseCsv qui les ignore tout en préservant les numéros de ligne.
    const rows = splitCsvRecords('a,b\r\n\r\nc,d\r\n');
    expect(rows).toEqual([['a', 'b'], [''], ['c', 'd']]);
  });
});

describe('parseCsv', () => {
  const csv = [
    'id,product-name,console-name',
    '1,The Hobbit,Xbox',
    '',
    '2,"Halo, Combat",Xbox 360',
  ].join('\n');

  it('associe les cellules aux en-têtes normalisés', () => {
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(['id', 'product-name', 'console-name']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.values['product-name']).toBe('The Hobbit');
    expect(parsed.rows[1]?.values['product-name']).toBe('Halo, Combat');
  });

  it('conserve le numéro de ligne source (1-indexé)', () => {
    const parsed = parseCsv(csv);
    // ligne 2 = premier enregistrement, ligne 4 = second (ligne 3 vide)
    expect(parsed.rows[0]?.line).toBe(2);
    expect(parsed.rows[1]?.line).toBe(4);
  });

  it('retourne un résultat vide sur une entrée vide', () => {
    expect(parseCsv('').rows).toHaveLength(0);
  });
});
