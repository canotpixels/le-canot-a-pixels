import type { GameIdentity, CoverCandidate } from './types.js';
import { normalizeTitle, EDITION_KEYWORDS } from './normalize.js';

// -----------------------------------------------------------------------------
// Score de correspondance entre un jeu local et un candidat de pochette.
// Renvoie une confiance dans [0, 1]. On ne choisit jamais aveuglément le
// premier résultat de l'API : on classe les candidats par score.
// -----------------------------------------------------------------------------

/** Seuil en dessous duquel une correspondance est jugée incertaine (affichée mais signalée). */
export const UNCERTAIN_THRESHOLD = 0.7;

/**
 * Seuil d'acceptation : en dessous, on refuse la correspondance (placeholder)
 * plutôt que d'afficher une jaquette erronée. Une mauvaise image est pire
 * qu'une absence d'image.
 */
export const ACCEPT_THRESHOLD = 0.5;

// Numéral romain composé de i/v/x (i … xxxix) — évite les faux positifs sur
// des lettres isolées comme « l », « c », « d », « m ».
const ROMAN_RE = /^(?=[ivx])(x{0,3})(ix|iv|v?i{0,3})$/;

/** Dernier marqueur de suite (chiffre arabe ou romain) d'un titre normalisé. */
export function sequelMarker(normalized: string): string | undefined {
  const tokens = normalized.split(' ').filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const tok = tokens[i] ?? '';
    if (/^\d+$/.test(tok)) return tok;
    if (ROMAN_RE.test(tok)) return String(romanToInt(tok));
  }
  return undefined;
}

function romanToInt(roman: string): number {
  const map: Record<string, number> = { i: 1, v: 5, x: 10 };
  let total = 0;
  let prev = 0;
  for (let i = roman.length - 1; i >= 0; i -= 1) {
    const value = map[roman[i] ?? ''] ?? 0;
    total += value < prev ? -value : value;
    prev = value;
  }
  return total;
}

/** Familles de plateformes reconnues, pour comparer console vs plateforme API. */
const PLATFORM_ALIASES: Record<string, string[]> = {
  xbox: ['xbox', 'microsoft xbox'],
  'xbox 360': ['xbox 360', 'x360', 'xbox360'],
};

function platformKey(value: string): string {
  const v = value.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(PLATFORM_ALIASES)) {
    if (aliases.some((a) => v === a || v.includes(a))) return key;
  }
  return v;
}

/** Similarité de chaînes : bag-of-words Jaccard + bonus égalité stricte. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const setA = new Set(na.split(' '));
  const setB = new Set(nb.split(' '));
  let inter = 0;
  for (const token of setA) if (setB.has(token)) inter += 1;
  const union = new Set([...setA, ...setB]).size;
  const jaccard = union === 0 ? 0 : inter / union;

  // Bonus si l'un contient entièrement l'autre.
  const containment = na.includes(nb) || nb.includes(na) ? 0.15 : 0;
  return Math.min(1, jaccard + containment);
}

function editionKeywords(text: string): Set<string> {
  const lower = text.toLowerCase();
  return new Set(EDITION_KEYWORDS.filter((kw) => lower.includes(kw)));
}

export function scoreCandidate(game: GameIdentity, candidate: CoverCandidate): number {
  let score = titleSimilarity(game.title, candidate.title) * 0.7;

  // Plateforme / console
  if (candidate.platform) {
    const same = platformKey(game.console) === platformKey(candidate.platform);
    score += same ? 0.2 : -0.15;
  }

  // Année
  if (game.year && candidate.year) {
    const diff = Math.abs(game.year - candidate.year);
    if (diff === 0) score += 0.05;
    else if (diff <= 1) score += 0.02;
    else if (diff >= 3) score -= 0.05;
  }

  // Numéro de suite : « Prototype 2 » ne doit pas correspondre à « Portal 2 »,
  // ni « Battlefront II » à « Battlefront ».
  const gameSeq = sequelMarker(normalizeTitle(game.title));
  const candSeq = sequelMarker(normalizeTitle(candidate.title));
  if (gameSeq && candSeq && gameSeq !== candSeq) score -= 0.3;
  else if (Boolean(gameSeq) !== Boolean(candSeq)) score -= 0.2;

  // Cohérence des mentions d'édition (Platinum Hits, GOTY, etc.)
  const gameEd = editionKeywords(`${game.title} ${game.edition ?? ''}`);
  const candEd = editionKeywords(candidate.title);
  if (gameEd.size > 0 || candEd.size > 0) {
    const shared = [...gameEd].filter((k) => candEd.has(k)).length;
    const total = new Set([...gameEd, ...candEd]).size;
    if (total > 0) score += (shared / total) * 0.05;
  }

  return Math.max(0, Math.min(1, score));
}

export interface RankedCandidate {
  candidate: CoverCandidate;
  score: number;
}

/** Classe les candidats du meilleur au moins bon. */
export function rankCandidates(
  game: GameIdentity,
  candidates: CoverCandidate[]
): RankedCandidate[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(game, candidate) }))
    .sort((a, b) => b.score - a.score);
}
