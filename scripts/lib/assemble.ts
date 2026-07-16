import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { Game, GameIdentity, Overrides, CoverCache, ImportReport } from './types.js';
import { parseCsv } from './csv.js';
import { adaptRows, type AdaptOptions } from './pricecharting.js';
import { applyOverrides, type OverriddenGame } from './overrides.js';
import { ensureUniqueSlug } from './normalize.js';
import { detectPersonalImageKeys, buildGameImages, personalImageWeightWarnings } from './images.js';
import { isUncertain } from './cover-cache.js';
import { computeSummary, type CoverStatusRow } from './reports.js';

// -----------------------------------------------------------------------------
// Assemblage complet : point unique qui transforme le CSV en jeux finaux
// prêts pour Astro. N'effectue AUCUN appel réseau (les pochettes proviennent
// du cache uniquement), donc le site se construit même sans API disponible.
// -----------------------------------------------------------------------------

export async function loadOverrides(path: string): Promise<Overrides> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Overrides;
  } catch {
    return {};
  }
}

export function toIdentity(game: OverriddenGame): GameIdentity {
  return {
    id: game.id,
    ...(game.priceChartingId ? { priceChartingId: game.priceChartingId } : {}),
    title: game.title,
    normalizedTitle: game.normalizedTitle,
    console: game.console,
    ...(game.region ? { region: game.region } : {}),
    ...(game.edition ? { edition: game.edition } : {}),
  };
}

export interface AssembleOptions extends AdaptOptions {
  csvText: string;
  csvSourceLabel: string;
  overrides: Overrides;
  coverCache: CoverCache;
  personalRootDir: string;
  assetsRootDir: string;
  placeholderSrc: string;
  now?: () => string;
  limit?: number;
  gameId?: string;
}

export interface AssembleResult {
  games: Game[];
  report: ImportReport;
  missingCovers: CoverStatusRow[];
  uncertainCovers: CoverStatusRow[];
}

export function assembleGames(options: AssembleOptions): AssembleResult {
  const now = options.now ?? (() => new Date().toISOString());
  const parsed = parseCsv(options.csvText);
  const adapt = adaptRows(parsed, {
    currency: options.currency ?? 'CAD',
    defaultStatus: options.defaultStatus ?? 'collection',
  });

  if (adapt.fatal) {
    throw new Error(adapt.fatal);
  }

  let overridden = applyOverrides(adapt.games, options.overrides).filter((g) => !g.hidden);
  if (options.gameId) {
    overridden = overridden.filter(
      (g) => g.id === options.gameId || g.priceChartingId === options.gameId
    );
  }
  if (options.limit !== undefined) {
    overridden = overridden.slice(0, options.limit);
  }

  const takenSlugs = new Set<string>();
  const games: Game[] = [];
  const missingCovers: CoverStatusRow[] = [];
  const uncertainCovers: CoverStatusRow[] = [];
  const imageWarnings: { line: number; message: string }[] = [];

  for (const g of overridden) {
    const slug = ensureUniqueSlug(g.slugBase, takenSlugs, g.console);
    const personalKeys = detectPersonalImageKeys(
      g.id,
      options.personalRootDir,
      options.assetsRootDir
    );
    for (const message of personalImageWeightWarnings(g.id, options.personalRootDir)) {
      imageWarnings.push({ line: 0, message });
    }

    const cacheEntry = options.coverCache[g.id];
    const genericCover =
      cacheEntry &&
      cacheEntry.status === 'resolved' &&
      (cacheEntry.imageUrl || cacheEntry.imagePath)
        ? {
            src: cacheEntry.imagePath ?? cacheEntry.imageUrl ?? '',
            ...(cacheEntry.attribution ? { attribution: cacheEntry.attribution } : {}),
            ...(cacheEntry.externalId ? { externalId: cacheEntry.externalId } : {}),
          }
        : undefined;

    const images = buildGameImages({
      title: g.title,
      console: g.console,
      personalKeys,
      ...(genericCover ? { genericCover } : {}),
      placeholderSrc: options.placeholderSrc,
    });

    if (personalKeys.length === 0 && !genericCover) {
      missingCovers.push({
        gameId: g.id,
        title: g.title,
        console: g.console,
        reason: cacheEntry?.status === 'not-found' ? 'aucune correspondance API' : 'non recherché',
      });
    }
    if (cacheEntry && isUncertain(cacheEntry)) {
      uncertainCovers.push({
        gameId: g.id,
        title: g.title,
        console: g.console,
        confidence: cacheEntry.confidence,
      });
    }

    const game: Game = {
      id: g.id,
      ...(g.priceChartingId ? { priceChartingId: g.priceChartingId } : {}),
      slug,
      title: g.title,
      console: g.console,
      ...(g.region ? { region: g.region } : {}),
      ...(g.edition ? { edition: g.edition } : {}),
      ...(g.condition ? { condition: g.condition } : {}),
      completeness: g.completeness,
      quantity: g.quantity,
      ...(g.purchasePrice !== undefined ? { purchasePrice: g.purchasePrice } : {}),
      ...(g.estimatedValue !== undefined ? { estimatedValue: g.estimatedValue } : {}),
      ...(g.salePrice !== undefined ? { salePrice: g.salePrice } : {}),
      currency: g.currency,
      status: g.status,
      ...(g.notes ? { notes: g.notes } : {}),
      ...(g.dateAdded ? { dateAdded: g.dateAdded } : {}),
      dataUpdatedAt: now(),
      ...(images.genericCover ? { genericCover: images.genericCover } : {}),
      personalImages: images.personalImages,
      primaryImage: images.primaryImage,
    };
    games.push(game);
  }

  const summary = computeSummary(games);
  const report: ImportReport = {
    generatedAt: now(),
    source: options.csvSourceLabel,
    totalRows: parsed.rows.length,
    imported: games.length,
    skipped: adapt.invalidRows.length,
    duplicates: adapt.duplicates,
    withPersonalPhotos: summary.withPersonalPhotos,
    withGenericCover: summary.withGenericCover,
    withPlaceholder: summary.withPlaceholder,
    uncertainCoverMatches: uncertainCovers.length,
    warnings: [...adapt.warnings, ...imageWarnings],
    invalidRows: adapt.invalidRows,
  };

  return { games, report, missingCovers, uncertainCovers };
}
