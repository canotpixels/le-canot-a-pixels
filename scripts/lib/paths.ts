import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// scripts/lib -> racine du projet
export const ROOT = resolve(here, '..', '..');

export const PATHS = {
  root: ROOT,
  csv: resolve(ROOT, 'data', 'pricecharting', 'collection.csv'),
  fixtureCsv: resolve(ROOT, 'data', 'fixtures', 'sample-collection.csv'),
  overrides: resolve(ROOT, 'data', 'overrides.json'),
  coverCache: resolve(ROOT, 'data', 'cache', 'covers.json'),
  generatedGames: resolve(ROOT, 'data', 'generated', 'games.json'),
  reportsDir: resolve(ROOT, 'data', 'reports'),
  assetsRoot: resolve(ROOT, 'src', 'assets'),
  personalImagesDir: resolve(ROOT, 'src', 'assets', 'games', 'personal'),
  downloadedCoversDir: resolve(ROOT, 'public', 'covers'),
} as const;
