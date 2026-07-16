import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from './lib/paths.js';
import { parseArgs } from './lib/cli.js';
import { loadEnv } from './lib/env.js';
import { parseCsv } from './lib/csv.js';
import { adaptRows } from './lib/pricecharting.js';
import { applyOverrides } from './lib/overrides.js';
import { loadOverrides, toIdentity } from './lib/assemble.js';
import { loadCoverCache, saveCoverCache, resolveCover } from './lib/cover-cache.js';
import { createCoverProvider } from './lib/cover-provider.js';
import { detectPersonalImageKeys } from './lib/images.js';
import { SITE_CURRENCY } from './lib/constants.js';

// -----------------------------------------------------------------------------
// npm run covers:sync
// Recherche UNIQUEMENT les pochettes manquantes ou explicitement invalidées.
// Appels réseau isolés dans le fournisseur ; robuste à une API indisponible.
//
// Options : --force  (re-résout tout)   --game-id=<id>   --limit=<n>   --dry-run
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();

  const useFixture = args.useFixture || !existsSync(PATHS.csv);
  const csvPath = useFixture ? PATHS.fixtureCsv : PATHS.csv;
  if (!existsSync(csvPath)) {
    console.error(`✖ CSV introuvable : ${csvPath}`);
    process.exit(1);
  }

  const provider = createCoverProvider(env);
  console.log(`— Synchronisation des pochettes (fournisseur : ${provider.name}) —`);
  if (provider.name === 'null') {
    console.log('  Fournisseur nul : aucune clé configurée. Rien à récupérer.');
    console.log('  Configurez COVER_PROVIDER et les identifiants dans .env pour activer.');
  }

  const csvText = await readFile(csvPath, 'utf8');
  const adapt = adaptRows(parseCsv(csvText), { currency: SITE_CURRENCY });
  if (adapt.fatal) {
    console.error(`✖ ${adapt.fatal}`);
    process.exit(1);
  }
  const overrides = await loadOverrides(PATHS.overrides);
  let games = applyOverrides(adapt.games, overrides).filter((g) => !g.hidden);

  if (args.gameId) {
    games = games.filter((g) => g.id === args.gameId || g.priceChartingId === args.gameId);
  }

  const cache = await loadCoverCache(PATHS.coverCache);

  let checked = 0;
  let resolved = 0;
  let skipped = 0;
  let notFound = 0;

  for (const game of games) {
    if (args.limit !== undefined && checked >= args.limit) break;

    // Une photo personnelle rend la pochette générique inutile.
    const hasPersonal =
      detectPersonalImageKeys(game.id, PATHS.personalImagesDir, PATHS.assetsRoot).length > 0;
    if (hasPersonal && !args.force) {
      skipped += 1;
      continue;
    }

    const existing = cache[game.id];
    const alreadyResolved =
      existing && existing.status === 'resolved' && existing.provider === provider.name;
    if (alreadyResolved && !args.force) {
      skipped += 1;
      continue;
    }

    checked += 1;
    const { entry } = await resolveCover(toIdentity(game), provider, cache, {
      force: args.force,
    });

    // Téléchargement local pour un site autonome (pas de dépendance runtime au CDN).
    if (entry.status === 'resolved' && entry.imageUrl && !args.dryRun) {
      const localPath = await downloadCover(entry.imageUrl, game.id);
      if (localPath) entry.imagePath = localPath;
    }

    cache[game.id] = entry;
    if (entry.status === 'resolved') {
      resolved += 1;
      console.log(`  ✓ ${game.title} → ${entry.matchedTitle} (${entry.confidence})`);
    } else {
      notFound += 1;
    }
  }

  console.log(
    `\n  Vérifiés: ${checked} · résolus: ${resolved} · sans corresp.: ${notFound} · ignorés: ${skipped}`
  );

  if (args.dryRun) {
    console.log('(dry-run : cache non écrit)');
    return;
  }
  await saveCoverCache(PATHS.coverCache, cache);
  console.log('✔ Cache mis à jour : data/cache/covers.json');
}

/**
 * Télécharge une pochette dans public/covers/<id>.<ext> et renvoie son chemin
 * public (ex. "/covers/pc-6656.png"). Retourne undefined en cas d'échec — le
 * cache conserve alors l'URL distante et le site reste fonctionnel.
 */
async function downloadCover(url: string, gameId: string): Promise<string | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const ext = (url.match(/\.(png|jpe?g|webp|avif)(?:\?|$)/i)?.[1] ?? 'png').toLowerCase();
    const fileName = `${gameId}.${ext}`;
    await mkdir(PATHS.downloadedCoversDir, { recursive: true });
    const buffer = Buffer.from(await res.arrayBuffer());
    await writeFile(join(PATHS.downloadedCoversDir, fileName), buffer);
    return `/covers/${fileName}`;
  } catch {
    return undefined;
  }
}

main().catch((error) => {
  console.error('✖ Échec de covers:sync :', error instanceof Error ? error.message : error);
  process.exit(1);
});
