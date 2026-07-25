import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { PATHS } from './lib/paths.js';
import { parseArgs } from './lib/cli.js';
import { loadEnv } from './lib/env.js';
import { combineCsvSources } from './lib/csv.js';
import { loadOverrides, assembleGames } from './lib/assemble.js';
import { loadCoverCache } from './lib/cover-cache.js';
import { writeReports } from './lib/reports.js';
import { PLACEHOLDER_SRC, SITE_CURRENCY } from './lib/constants.js';

// -----------------------------------------------------------------------------
// npm run data:build
// Génère les données finales consommées par Astro (data/generated/games.json)
// à partir du CSV, des surcharges et du cache de pochettes. Aucun appel réseau.
// --validate-only : vérifie sans écrire (utilisé par `npm run validate`).
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadEnv();

  const useFixture = args.useFixture || !existsSync(PATHS.csv);
  const csvPath = useFixture ? PATHS.fixtureCsv : PATHS.csv;

  if (!existsSync(csvPath)) {
    console.error(`✖ Aucun CSV trouvé (${PATHS.csv} ni ${PATHS.fixtureCsv}).`);
    process.exit(1);
  }
  if (useFixture && !args.useFixture) {
    console.warn('⚠ CSV de production absent : utilisation de la fixture de démonstration.');
  }

  // Production : la collection et la liste des jeux recherchés vivent dans deux
  // fichiers distincts (wanted.csv, folder=Wishlist) fusionnés ici. En mode
  // fixture, un seul fichier suffit (la colonne folder porte déjà les statuts).
  const wantedText =
    !useFixture && existsSync(PATHS.wantedCsv)
      ? await readFile(PATHS.wantedCsv, 'utf8')
      : undefined;
  const csvText = combineCsvSources(await readFile(csvPath, 'utf8'), wantedText);
  const overrides = await loadOverrides(PATHS.overrides);
  const coverCache = await loadCoverCache(PATHS.coverCache);

  const result = assembleGames({
    csvText,
    csvSourceLabel: useFixture ? 'fixture' : 'pricecharting/collection.csv (+ wanted.csv)',
    overrides,
    coverCache,
    personalRootDir: PATHS.personalImagesDir,
    assetsRootDir: PATHS.assetsRoot,
    placeholderSrc: PLACEHOLDER_SRC,
    currency: SITE_CURRENCY,
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
    ...(args.gameId ? { gameId: args.gameId } : {}),
  });

  if (result.games.length === 0) {
    console.error('✖ Aucun jeu valide produit — vérifiez le CSV et les rapports.');
    process.exit(1);
  }

  if (args.validateOnly) {
    console.log(
      `✔ Validation des données OK : ${result.games.length} jeux, ${result.report.skipped} ligne(s) ignorée(s).`
    );
    return;
  }

  await mkdir(dirname(PATHS.generatedGames), { recursive: true });
  await writeFile(PATHS.generatedGames, `${JSON.stringify(result.games, null, 2)}\n`, 'utf8');
  await writeReports({
    reportsDir: PATHS.reportsDir,
    report: result.report,
    games: result.games,
    missingCovers: result.missingCovers,
    uncertainCovers: result.uncertainCovers,
  });

  console.log(`✔ data/generated/games.json — ${result.games.length} jeux`);
  console.log(
    `  perso: ${result.report.withPersonalPhotos} · générique: ${result.report.withGenericCover} · placeholder: ${result.report.withPlaceholder}`
  );
}

main().catch((error) => {
  console.error('✖ Échec de data:build :', error instanceof Error ? error.message : error);
  process.exit(1);
});
