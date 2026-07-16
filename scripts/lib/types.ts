// -----------------------------------------------------------------------------
// Modèle interne stable de l'application.
//
// Aucune partie du site ne doit dépendre des noms de colonnes du CSV
// PriceCharting : l'adaptateur (pricecharting.ts) traduit chaque ligne vers
// ces types, qui constituent le contrat unique consommé par Astro.
// -----------------------------------------------------------------------------

export type Completeness = 'loose' | 'cib' | 'new' | 'unknown';
export type GameStatus = 'collection' | 'for-sale' | 'wishlist';
export type ImageSource = 'personal' | 'generic' | 'placeholder';

export interface GameImage {
  src: string;
  width?: number;
  height?: number;
  alt: string;
  source: ImageSource;
  attribution?: string;
  externalId?: string;
}

export interface Game {
  id: string;
  priceChartingId?: string;
  slug: string;
  title: string;
  console: string;
  region?: string;
  edition?: string;
  condition?: string;
  completeness: Completeness;
  quantity: number;
  purchasePrice?: number;
  estimatedValue?: number;
  salePrice?: number;
  currency: string;
  status: GameStatus;
  notes?: string;
  dateAdded?: string;
  dataUpdatedAt?: string;
  genericCover?: GameImage;
  personalImages: GameImage[];
  primaryImage: GameImage;
}

/** Identité minimale d'un jeu, utilisée pour la recherche de pochette. */
export interface GameIdentity {
  id: string;
  /** Id produit PriceCharting brut (colonne `id` du CSV), pour les correspondances exactes. */
  priceChartingId?: string;
  title: string;
  normalizedTitle: string;
  console: string;
  region?: string;
  edition?: string;
  year?: number;
}

// --- Fournisseur de pochettes -------------------------------------------------

export interface CoverCandidate {
  externalId: string;
  title: string;
  platform?: string;
  year?: number;
  imageUrl: string;
  attribution?: string;
}

export interface CoverSearchResult {
  provider: string;
  candidates: CoverCandidate[];
}

export interface CoverProvider {
  readonly name: string;
  searchCover(game: GameIdentity): Promise<CoverSearchResult>;
}

/** Entrée persistée dans data/cache/covers.json. */
export interface CoverCacheEntry {
  gameId: string;
  query: string;
  provider: string;
  externalId?: string;
  imagePath?: string;
  imageUrl?: string;
  confidence: number;
  attribution?: string;
  fetchedAt: string;
  status: 'resolved' | 'not-found' | 'invalidated';
  matchedTitle?: string;
}

export type CoverCache = Record<string, CoverCacheEntry>;

// --- Surcharges locales -------------------------------------------------------

export interface OverrideEntry {
  status?: GameStatus;
  salePrice?: number;
  estimatedValue?: number;
  notes?: string;
  region?: string;
  edition?: string;
  hidden?: boolean;
}

export type Overrides = Record<string, OverrideEntry>;

// --- Rapports d'importation ---------------------------------------------------

export interface InvalidRow {
  line: number;
  reason: string;
  raw: string;
}

export interface ImportWarning {
  line: number;
  message: string;
}

export interface ImportReport {
  generatedAt: string;
  source: string;
  totalRows: number;
  imported: number;
  skipped: number;
  duplicates: number;
  withPersonalPhotos: number;
  withGenericCover: number;
  withPlaceholder: number;
  uncertainCoverMatches: number;
  warnings: ImportWarning[];
  invalidRows: InvalidRow[];
}
