import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Game, ImportReport, InvalidRow } from './types.js';

// -----------------------------------------------------------------------------
// Génération des rapports lisibles dans data/reports/.
// -----------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return `${lines.join('\n')}\n`;
}

export interface CoverStatusRow {
  gameId: string;
  title: string;
  console: string;
  confidence?: number;
  reason?: string;
}

export interface WriteReportsInput {
  reportsDir: string;
  report: ImportReport;
  games: Game[];
  missingCovers: CoverStatusRow[];
  uncertainCovers: CoverStatusRow[];
}

export async function writeReports(input: WriteReportsInput): Promise<void> {
  const { reportsDir, report, missingCovers, uncertainCovers } = input;
  await mkdir(reportsDir, { recursive: true });

  await writeFile(
    join(reportsDir, 'import-summary.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );

  await writeFile(
    join(reportsDir, 'invalid-rows.csv'),
    toCsv(
      ['line', 'reason', 'raw'],
      report.invalidRows.map((r: InvalidRow) => [String(r.line), r.reason, r.raw])
    ),
    'utf8'
  );

  await writeFile(
    join(reportsDir, 'missing-covers.csv'),
    toCsv(
      ['gameId', 'title', 'console', 'reason'],
      missingCovers.map((r) => [r.gameId, r.title, r.console, r.reason ?? ''])
    ),
    'utf8'
  );

  await writeFile(
    join(reportsDir, 'uncertain-cover-matches.csv'),
    toCsv(
      ['gameId', 'title', 'console', 'confidence'],
      uncertainCovers.map((r) => [r.gameId, r.title, r.console, String(r.confidence ?? '')])
    ),
    'utf8'
  );
}

/** Calcule les compteurs du résumé à partir des jeux construits. */
export function computeSummary(
  games: Game[]
): Pick<ImportReport, 'withPersonalPhotos' | 'withGenericCover' | 'withPlaceholder'> {
  let withPersonalPhotos = 0;
  let withGenericCover = 0;
  let withPlaceholder = 0;
  for (const game of games) {
    if (game.primaryImage.source === 'personal') withPersonalPhotos += 1;
    else if (game.primaryImage.source === 'generic') withGenericCover += 1;
    else withPlaceholder += 1;
  }
  return { withPersonalPhotos, withGenericCover, withPlaceholder };
}
