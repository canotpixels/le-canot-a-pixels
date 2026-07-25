// -----------------------------------------------------------------------------
// Parseur CSV tolérant, sans dépendance.
//
// Gère : guillemets, virgules et sauts de ligne à l'intérieur de champs
// entre guillemets, guillemets doublés ("") comme échappement, lignes vides,
// et fins de ligne CRLF ou LF. Ne lève jamais d'exception sur une donnée :
// c'est l'appelant qui décide de la validité sémantique des lignes.
// -----------------------------------------------------------------------------

export interface ParsedCsv {
  /** En-têtes bruts tels que rencontrés. */
  headersRaw: string[];
  /** En-têtes normalisés (minuscule, tirets, sans espaces superflus). */
  headers: string[];
  /** Lignes de données ; chaque cellule est associée à son en-tête normalisé. */
  rows: CsvRow[];
}

export interface CsvRow {
  /** Numéro de ligne 1-indexé dans le fichier source (en-tête = ligne 1). */
  line: number;
  values: Record<string, string>;
  /** Cellules brutes, dans l'ordre, avant association aux en-têtes. */
  cells: string[];
}

/** Normalise un nom de colonne : minuscule, trim, espaces/underscores -> tiret. */
export function normalizeHeader(header: string): string {
  return header
    .replace(/^﻿/, '') // BOM éventuel
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Découpe le texte CSV en un tableau de lignes, chaque ligne étant un tableau
 * de cellules. Respecte les champs entre guillemets contenant des virgules,
 * des sauts de ligne et des guillemets échappés ("").
 */
export function splitCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let started = false; // au moins un caractère vu sur la ligne courante

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
    started = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1; // guillemet échappé
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      started = true;
    } else if (char === ',') {
      pushField();
      started = true;
    } else if (char === '\r') {
      // ignoré ; le \n suivant termine l'enregistrement
    } else if (char === '\n') {
      // On termine toujours l'enregistrement (les lignes vides sont conservées
      // sous la forme [''] pour préserver la numérotation de ligne source ;
      // parseCsv les ignore ensuite).
      pushRecord();
    } else {
      field += char;
      started = true;
    }
  }

  // Dernier enregistrement (fichier sans saut de ligne final)
  if (started || field.length > 0 || record.length > 0) {
    pushRecord();
  }

  return records;
}

export function parseCsv(text: string): ParsedCsv {
  const records = splitCsvRecords(text);
  if (records.length === 0) {
    return { headersRaw: [], headers: [], rows: [] };
  }

  const headersRaw = (records[0] ?? []).map((h) => h.trim());
  const headers = headersRaw.map(normalizeHeader);

  const rows: CsvRow[] = [];
  for (let r = 1; r < records.length; r += 1) {
    const cells = records[r] ?? [];
    // Ligne réellement vide (une seule cellule vide) -> ignorée en silence.
    if (cells.length === 1 && cells[0]?.trim() === '') continue;

    const values: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      values[header] = (cells[index] ?? '').trim();
    });

    rows.push({ line: r + 1, values, cells });
  }

  return { headersRaw, headers, rows };
}

/**
 * Fusionne un CSV de base avec un CSV secondaire partageant le même en-tête.
 * Les lignes de données du second sont ajoutées après celles du premier ;
 * l'en-tête du second est ignoré. Sert à combiner collection.csv et wanted.csv
 * (dont la colonne folder=Wishlist détermine le statut « recherché »).
 */
export function combineCsvSources(base: string, extra?: string): string {
  if (!extra || !extra.trim()) return base;
  const [, ...rest] = extra.replace(/\r\n?/g, '\n').split('\n');
  const dataRows = rest.filter((line) => line.trim() !== '');
  if (dataRows.length === 0) return base;
  const baseTrimmed = base.replace(/\s*$/, '');
  return `${baseTrimmed}\n${dataRows.join('\n')}\n`;
}
