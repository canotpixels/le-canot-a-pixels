import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from './lib/paths.js';
import { parseArgs } from './lib/cli.js';
import { loadEnv } from './lib/env.js';
import { loadOverrides, assembleGames } from './lib/assemble.js';
import { loadCoverCache } from './lib/cover-cache.js';
import { writeReports } from './lib/reports.js';
import { PLACEHOLDER_SRC, SITE_CURRENCY } from './lib/constants.js';

// -----------------------------------------------------------------------------
// npm run data:import
// Importe et normalise le CSV, applique les surcharges, écrit games.json et
// les rapports. Utilise le cache de pochettes existant (aucun appel réseau).
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadEnv();

  const csvPath = args.useFixture ? PATHS.fixtureCsv : PATHS.csv;
  if (!existsSync(csvPath)) {
    console.error(`✖ CSV introuvable : ${csvPath}`);
    console.error('  Placez votre export PriceCharting dans data/pricecharting/collection.csv');
    console.error('  ou utilisez --fixture pour la démonstration.');
    process.exit(1);
  }

  const csvText = await readFile(csvPath, 'utf8');
  const overrides = await loadOverrides(PATHS.overrides);
  const coverCache = await loadCoverCache(PATHS.coverCache);

  const result = assembleGames({
    csvText,
    csvSourceLabel: args.useFixture ? 'fixture' : 'pricecharting/collection.csv',
    overrides,
    coverCache,
    personalRootDir: PATHS.personalImagesDir,
    assetsRootDir: PATHS.assetsRoot,
    placeholderSrc: PLACEHOLDER_SRC,
    currency: SITE_CURRENCY,
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
    ...(args.gameId ? { gameId: args.gameId } : {}),
  });

  const { report } = result;
  console.log('— Importation PriceCharting —');
  console.log(`  Source            : ${report.source}`);
  console.log(`  Lignes totales    : ${report.totalRows}`);
  console.log(`  Jeux importés     : ${report.imported}`);
  console.log(`  Lignes ignorées   : ${report.skipped}`);
  console.log(`  Doublons          : ${report.duplicates}`);
  console.log(`  Avec photo perso  : ${report.withPersonalPhotos}`);
  console.log(`  Avec pochette gén.: ${report.withGenericCover}`);
  console.log(`  Avec placeholder  : ${report.withPlaceholder}`);
  console.log(`  Corresp. incertaines: ${report.uncertainCoverMatches}`);

  if (report.warnings.length > 0) {
    console.log(`  ⚠ ${report.warnings.length} avertissement(s) (voir rapports).`);
  }

  if (args.dryRun) {
    console.log('\n(dry-run : aucun fichier écrit)');
    return;
  }

  await mkdir(dirname(PATHS.generatedGames), { recursive: true });
  await writeFile(PATHS.generatedGames, `${JSON.stringify(result.games, null, 2)}\n`, 'utf8');
  await writeReports({
    reportsDir: PATHS.reportsDir,
    report,
    games: result.games,
    missingCovers: result.missingCovers,
    uncertainCovers: result.uncertainCovers,
  });

  console.log(`\n✔ ${result.games.length} jeux écrits dans data/generated/games.json`);
  console.log('✔ Rapports écrits dans data/reports/');
}

main().catch((error) => {
  console.error('✖ Échec de l’importation :', error instanceof Error ? error.message : error);
  process.exit(1);
});
