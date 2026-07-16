import type { ParsedCsv, CsvRow } from './csv.js';
import type { Completeness, GameStatus, InvalidRow, ImportWarning } from './types.js';
import { normalizeTitle, extractEdition, slugify, deterministicId } from './normalize.js';

// -----------------------------------------------------------------------------
// Adaptateur PriceCharting : transforme les lignes du CSV en enregistrements
// internes stables (AdaptedGame). Aucune autre partie du code ne connaît les
// noms de colonnes de PriceCharting.
// -----------------------------------------------------------------------------

/** Colonnes indispensables : sans elles, l'import global échoue proprement. */
export const REQUIRED_COLUMNS = ['id', 'product-name', 'console-name'] as const;

export interface AdaptOptions {
  currency?: string;
  /** Statut par défaut si aucune indication (CSV ou surcharge). */
  defaultStatus?: GameStatus;
}

export interface AdaptedGame {
  priceChartingId?: string;
  id: string;
  title: string;
  console: string;
  region?: string;
  edition?: string;
  condition?: string;
  completeness: Completeness;
  quantity: number;
  purchasePrice?: number;
  estimatedValue?: number;
  currency: string;
  status: GameStatus;
  notes?: string;
  dateAdded?: string;
  normalizedTitle: string;
  slugBase: string;
}

export interface AdaptResult {
  games: AdaptedGame[];
  invalidRows: InvalidRow[];
  warnings: ImportWarning[];
  duplicates: number;
  /** Renseigné si des colonnes essentielles manquent : import à interrompre. */
  fatal?: string;
}

function penniesToNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9-]/g, '');
  if (cleaned === '' || cleaned === '-') return undefined;
  const pennies = Number.parseInt(cleaned, 10);
  if (Number.isNaN(pennies)) return undefined;
  return Math.round(pennies) / 100;
}

/** Traduit include-string PriceCharting vers un niveau de complétude interne. */
export function mapCompleteness(includeString: string): Completeness {
  const value = includeString.toLowerCase();
  if (!value) return 'unknown';
  if (value.startsWith('new')) return 'new';
  if (value.includes('box') && value.includes('manual')) return 'cib';
  if (value.includes('item only') || value.includes('loose')) return 'loose';
  if (value.includes('box')) return 'loose';
  return 'unknown';
}

/** Détecte un statut à partir de la colonne folder (heuristique tolérante). */
function statusFromFolder(folder: string): GameStatus | undefined {
  const value = folder.toLowerCase();
  if (!value) return undefined;
  if (/(vendre|sale|for-sale|selling|à vendre)/.test(value)) return 'for-sale';
  if (/(wishlist|souhait|wanted|recherche)/.test(value)) return 'wishlist';
  if (/collection/.test(value)) return 'collection';
  return undefined;
}

function extractYear(dateEntered: string, datePurchased: string): number | undefined {
  const source = dateEntered || datePurchased;
  const match = source.match(/(\d{4})/);
  if (!match) return undefined;
  const year = Number.parseInt(match[1] ?? '', 10);
  return Number.isNaN(year) ? undefined : year;
}

/** Adapte une ligne. Retourne null si la ligne est invalide (avec la raison). */
export function adaptRow(
  row: CsvRow,
  options: AdaptOptions = {}
): { game: AdaptedGame } | { invalid: InvalidRow } {
  const currency = options.currency ?? 'CAD';
  const defaultStatus = options.defaultStatus ?? 'collection';
  const v = row.values;

  const title = (v['product-name'] ?? '').trim();
  const consoleName = (v['console-name'] ?? '').trim();

  if (!title) {
    return {
      invalid: {
        line: row.line,
        reason: 'Titre (product-name) manquant',
        raw: row.cells.join(','),
      },
    };
  }
  if (!consoleName) {
    return {
      invalid: {
        line: row.line,
        reason: 'Console (console-name) manquante',
        raw: row.cells.join(','),
      },
    };
  }

  const priceChartingId = (v['id'] ?? '').trim() || undefined;
  const edition = extractEdition(title);
  const completeness = mapCompleteness(v['include-string'] ?? '');
  const condition = (v['condition-string'] ?? '').trim() || undefined;
  const notes = (v['notes'] ?? '').trim() || undefined;

  const quantityRaw = Number.parseInt((v['quantity'] ?? '1').replace(/[^0-9-]/g, ''), 10);
  const quantity = Number.isNaN(quantityRaw) || quantityRaw < 1 ? 1 : quantityRaw;

  const estimatedValue = penniesToNumber(v['price-in-pennies'] ?? '');
  const purchasePrice = penniesToNumber(v['cost-basis-in-pennies'] ?? '');
  const dateAdded = (v['date-entered'] ?? '').trim() || undefined;

  const status = statusFromFolder(v['folder'] ?? '') ?? defaultStatus;

  const id = priceChartingId
    ? `pc-${priceChartingId}`
    : deterministicId({ title, console: consoleName, edition });

  const game: AdaptedGame = {
    ...(priceChartingId ? { priceChartingId } : {}),
    id,
    title,
    console: consoleName,
    ...(edition ? { edition } : {}),
    ...(condition ? { condition } : {}),
    completeness,
    quantity,
    ...(purchasePrice !== undefined ? { purchasePrice } : {}),
    ...(estimatedValue !== undefined ? { estimatedValue } : {}),
    currency,
    status,
    ...(notes ? { notes } : {}),
    ...(dateAdded ? { dateAdded } : {}),
    normalizedTitle: normalizeTitle(title),
    slugBase: slugify(title),
  };
  void extractYear; // année disponible pour un scoring futur
  return { game };
}

export function adaptRows(parsed: ParsedCsv, options: AdaptOptions = {}): AdaptResult {
  const missing = REQUIRED_COLUMNS.filter((col) => !parsed.headers.includes(col));
  if (missing.length > 0) {
    return {
      games: [],
      invalidRows: [],
      warnings: [],
      duplicates: 0,
      fatal: `Colonnes essentielles manquantes dans le CSV : ${missing.join(', ')}. Colonnes détectées : ${parsed.headers.join(', ')}`,
    };
  }

  const games: AdaptedGame[] = [];
  const invalidRows: InvalidRow[] = [];
  const warnings: ImportWarning[] = [];
  const seenIds = new Map<string, number>();
  let duplicates = 0;

  for (const row of parsed.rows) {
    const result = adaptRow(row, options);
    if ('invalid' in result) {
      invalidRows.push(result.invalid);
      continue;
    }
    const { game } = result;
    const previous = seenIds.get(game.id);
    if (previous !== undefined) {
      duplicates += 1;
      warnings.push({
        line: row.line,
        message: `Doublon d'identifiant "${game.id}" (déjà vu ligne ${previous}) : "${game.title}"`,
      });
      continue;
    }
    seenIds.set(game.id, row.line);
    games.push(game);
  }

  return { games, invalidRows, warnings, duplicates };
}
