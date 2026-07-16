import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CoverCache, CoverCacheEntry, GameIdentity, CoverProvider } from './types.js';
import { rankCandidates, UNCERTAIN_THRESHOLD, ACCEPT_THRESHOLD } from './match-score.js';

// -----------------------------------------------------------------------------
// Cache local des recherches de pochettes (data/cache/covers.json).
//
// Objectif : une compilation normale ne relance PAS les recherches déjà
// résolues, et le site continue de fonctionner si l'API est indisponible.
// -----------------------------------------------------------------------------

export async function loadCoverCache(path: string): Promise<CoverCache> {
  if (!existsSync(path)) return {};
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as CoverCache;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function saveCoverCache(path: string, cache: CoverCache): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(path, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

export interface ResolveOptions {
  /** Force une nouvelle recherche même si une entrée résolue existe. */
  force?: boolean;
  /** Horodatage injecté (déterminisme des tests). */
  now?: () => string;
}

/**
 * Résout la pochette d'un jeu : renvoie l'entrée du cache si déjà résolue,
 * sinon interroge le fournisseur, classe les candidats et retient le meilleur.
 * Toute erreur du fournisseur est capturée : on renvoie une entrée dégradée
 * sans faire échouer l'ensemble.
 */
export async function resolveCover(
  game: GameIdentity,
  provider: CoverProvider,
  cache: CoverCache,
  options: ResolveOptions = {}
): Promise<{ entry: CoverCacheEntry; fromCache: boolean }> {
  const now = options.now ?? (() => new Date().toISOString());
  const existing = cache[game.id];

  const isReusable =
    existing &&
    existing.status !== 'invalidated' &&
    existing.provider === provider.name &&
    !options.force;

  if (isReusable && existing) {
    return { entry: existing, fromCache: true };
  }

  const query = game.normalizedTitle;
  try {
    const result = await provider.searchCover(game);
    const ranked = rankCandidates(game, result.candidates);
    const best = ranked[0];

    // Aucun candidat, ou meilleur score sous le seuil d'acceptation :
    // on refuse plutôt que d'afficher une jaquette erronée.
    if (!best || best.score < ACCEPT_THRESHOLD) {
      return {
        entry: {
          gameId: game.id,
          query,
          provider: provider.name,
          confidence: best ? Number(best.score.toFixed(3)) : 0,
          fetchedAt: now(),
          status: 'not-found',
        },
        fromCache: false,
      };
    }

    return {
      entry: {
        gameId: game.id,
        query,
        provider: provider.name,
        externalId: best.candidate.externalId,
        imageUrl: best.candidate.imageUrl,
        confidence: Number(best.score.toFixed(3)),
        ...(best.candidate.attribution ? { attribution: best.candidate.attribution } : {}),
        fetchedAt: now(),
        status: 'resolved',
        matchedTitle: best.candidate.title,
      },
      fromCache: false,
    };
  } catch (error) {
    // API indisponible : on conserve l'entrée précédente si elle existe,
    // sinon on marque « not-found » sans interrompre la synchronisation.
    if (existing) return { entry: existing, fromCache: true };
    return {
      entry: {
        gameId: game.id,
        query,
        provider: provider.name,
        confidence: 0,
        fetchedAt: now(),
        status: 'not-found',
        matchedTitle: error instanceof Error ? `erreur: ${error.message}` : undefined,
      },
      fromCache: false,
    };
  }
}

export function isUncertain(entry: CoverCacheEntry): boolean {
  return entry.status === 'resolved' && entry.confidence < UNCERTAIN_THRESHOLD;
}
