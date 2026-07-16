import type { CoverProvider, CoverSearchResult, GameIdentity, CoverCandidate } from './types.js';
import { rankCandidates, ACCEPT_THRESHOLD } from './match-score.js';

// -----------------------------------------------------------------------------
// Fournisseurs de pochettes génériques, isolés derrière l'interface
// CoverProvider (types.ts) afin de pouvoir en changer sans toucher au reste.
//
// Règles respectées :
//   - appels réseau uniquement pendant covers:sync (jamais côté client) ;
//   - clés lues depuis l'environnement, jamais committées ;
//   - le fournisseur nul permet de compiler sans aucune clé ;
//   - seule exception au « pas de scraping » : PriceCharting, qui lit la page
//     produit PUBLIQUE correspondant à l'id exact du CSV (même source que les
//     données), une seule fois par jeu, avec délai de politesse entre requêtes.
// -----------------------------------------------------------------------------

/** Fournisseur nul : ne fait aucun appel réseau, ne renvoie aucun candidat. */
export class NullCoverProvider implements CoverProvider {
  readonly name = 'null';
  async searchCover(_game: GameIdentity): Promise<CoverSearchResult> {
    void _game;
    return { provider: this.name, candidates: [] };
  }
}

// -----------------------------------------------------------------------------
// Fournisseur Libretro (libretro-thumbnails) — AUCUNE clé API.
//
// Jaquettes (« Named_Boxarts ») par système, nommées d'après la convention
// No-Intro/Redump (avec balises de région, ex. « (USA) »). L'index de chaque
// système est récupéré une seule fois puis mis en cache mémoire pendant la
// synchronisation. Les images sont ensuite téléchargées localement par
// covers:sync pour un site entièrement autonome.
// -----------------------------------------------------------------------------

const LIBRETRO_BASE = 'https://thumbnails.libretro.com';

/** Console interne → dossier système Libretro. */
const LIBRETRO_SYSTEMS: Record<string, string> = {
  xbox: 'Microsoft - Xbox',
  'xbox 360': 'Microsoft - Xbox 360',
};

/** Priorité de région (plus petit = préféré). */
function regionRank(fileName: string): number {
  const lower = fileName.toLowerCase();
  if (lower.includes('(usa')) return 0;
  if (lower.includes('(world')) return 1;
  if (lower.includes('(europe')) return 2;
  if (lower.includes('(japan')) return 4;
  return 3;
}

export class LibretroCoverProvider implements CoverProvider {
  readonly name = 'libretro';
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new Map<string, CoverCandidate[]>();

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  private systemFor(consoleName: string): string | undefined {
    return LIBRETRO_SYSTEMS[consoleName.toLowerCase().trim()];
  }

  private async loadSystem(system: string): Promise<CoverCandidate[]> {
    const cached = this.cache.get(system);
    if (cached) return cached;

    const url = `${LIBRETRO_BASE}/${encodeURIComponent(system)}/Named_Boxarts/`;
    const res = await this.fetchImpl(url);
    if (!res.ok) throw new Error(`Libretro index échoué (${system}) : HTTP ${res.status}`);
    const html = await res.text();

    const seen = new Set<string>();
    const candidates: CoverCandidate[] = [];
    for (const match of html.matchAll(/href="([^"]+\.png)"/g)) {
      const rawEncoded = match[1] ?? '';
      let fileName: string;
      try {
        fileName = decodeURIComponent(rawEncoded);
      } catch {
        fileName = rawEncoded;
      }
      if (fileName.includes('/') || seen.has(fileName)) continue;
      seen.add(fileName);
      const titleNoExt = fileName.replace(/\.png$/i, '');
      candidates.push({
        externalId: fileName,
        title: titleNoExt,
        platform: system.replace('Microsoft - ', ''),
        imageUrl: `${LIBRETRO_BASE}/${encodeURIComponent(system)}/Named_Boxarts/${encodeURIComponent(fileName)}`,
        attribution: 'Jaquette via libretro-thumbnails',
      });
    }

    // Régions préférées d'abord : en cas d'égalité de score, la variante USA gagne.
    candidates.sort((a, b) => regionRank(a.externalId) - regionRank(b.externalId));
    this.cache.set(system, candidates);
    return candidates;
  }

  async searchCover(game: GameIdentity): Promise<CoverSearchResult> {
    const system = this.systemFor(game.console);
    if (!system) return { provider: this.name, candidates: [] };
    const candidates = await this.loadSystem(system);
    return { provider: this.name, candidates };
  }
}

// -----------------------------------------------------------------------------
// Fournisseur PriceCharting — correspondance EXACTE par id produit.
//
// Le CSV source vient de PriceCharting : chaque ligne porte l'id de sa fiche
// produit, qui possède (presque) toujours une photo de la boîte. On lit la
// page publique https://www.pricecharting.com/game/<id> (redirection vers la
// fiche canonique) et on extrait l'image du bloc « cover », en remontant à la
// variante 1600 px. Aucune clé, aucun matching flou : l'id garantit la fiche.
// Le titre et la console extraits de la page servent de contre-vérification
// via le score habituel (un id erroné donnerait un candidat mal noté).
// -----------------------------------------------------------------------------

const PRICECHARTING_BASE = 'https://www.pricecharting.com';

/**
 * Décode les entités HTML courantes des textes extraits de la page. Sans cela,
 * « Assassin&#39;s Creed » laisse un « 39 » que le scoreur prend pour un numéro
 * de suite et la correspondance — pourtant exacte — est rejetée.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

interface PriceChartingOptions {
  /** Injection pour les tests (par défaut fetch global). */
  fetchImpl?: typeof fetch;
  /** Délai de politesse minimal entre deux requêtes réseau, en ms (défaut 1000). */
  delayMs?: number;
  /** Tentatives supplémentaires en cas de limitation (429/5xx/réseau). Défaut 3. */
  maxRetries?: number;
}

export class PriceChartingCoverProvider implements CoverProvider {
  readonly name = 'pricecharting';
  private readonly fetchImpl: typeof fetch;
  private readonly delayMs: number;
  private readonly maxRetries: number;
  private lastRequestAt = 0;

  constructor(options: PriceChartingOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.delayMs = options.delayMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  /** Espace les requêtes pour rester courtois envers le site (188 fiches max, une fois). */
  private async politeDelay(): Promise<void> {
    if (this.delayMs <= 0) return;
    const wait = this.lastRequestAt + this.delayMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
  }

  /**
   * Récupère la page avec retries et backoff : une synchro complète (~188
   * requêtes) déclenche par moments une limitation transitoire (429/5xx) ;
   * abandonner condamnerait le jeu au fallback alors qu'attendre suffit.
   */
  private async fetchPage(url: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (attempt > 0 && this.delayMs > 0) {
        // Backoff : 5 s, 10 s, 15 s… avant chaque nouvelle tentative.
        await new Promise((resolve) => setTimeout(resolve, attempt * 5 * this.delayMs));
      }
      await this.politeDelay();
      let res: Response | undefined;
      try {
        res = await this.fetchImpl(url, { headers: { Accept: 'text/html' } });
      } catch (error) {
        // Erreur réseau : on retentera après backoff.
        lastError = error;
        continue;
      }
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
      // 4xx autre que 429 : définitif, inutile de réessayer.
      if (res.status !== 429 && res.status < 500) break;
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async searchCover(game: GameIdentity): Promise<CoverSearchResult> {
    if (!game.priceChartingId) return { provider: this.name, candidates: [] };

    const url = `${PRICECHARTING_BASE}/game/${encodeURIComponent(game.priceChartingId)}`;
    let res: Response;
    try {
      res = await this.fetchPage(url);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`PriceCharting fiche ${game.priceChartingId} : ${detail}`);
    }
    const html = await res.text();

    // Image principale : l'<img> du bloc <div class="cover">. Les fiches sans
    // photo affichent un pictogramme hors images.pricecharting.com → aucun candidat.
    const coverMatch = html.match(
      /<div[^>]*class=["']cover["'][^>]*>[\s\S]{0,600}?<img[^>]+src=['"]([^'"]+)['"]/i
    );
    const rawUrl = coverMatch?.[1];
    if (!rawUrl || !rawUrl.includes('images.pricecharting.com')) {
      return { provider: this.name, candidates: [] };
    }
    // La page insère la miniature (…/240.jpg) ; la pleine résolution vit au même chemin.
    const imageUrl = rawUrl.replace(/\/\d+\.jpg$/i, '/1600.jpg');

    // Titre et console lus dans le <h1 id="product_name"> : le lien console y
    // est ANCRÉ (le premier « /console/ » de la page vient du menu de navigation).
    const h1Block = html.match(/id="product_name"[^>]*>([\s\S]{0,400}?)<\/h1>/i)?.[1] ?? '';
    const rawTitle = h1Block.match(/^\s*([^<]+)/)?.[1]?.trim();
    const rawConsole = h1Block.match(/href="\/console\/[^"]*"[^>]*>\s*([^<]+)/i)?.[1]?.trim();
    const pageTitle = rawTitle ? decodeHtmlEntities(rawTitle) : undefined;
    const pageConsole = rawConsole ? decodeHtmlEntities(rawConsole) : undefined;

    return {
      provider: this.name,
      candidates: [
        {
          externalId: game.priceChartingId,
          title: pageTitle || game.title,
          platform: pageConsole || game.console,
          imageUrl,
          attribution: 'Photo de jaquette via PriceCharting',
        },
      ],
    };
  }
}

interface IgdbOptions {
  clientId: string;
  clientSecret: string;
  /** Injection pour les tests (par défaut fetch global). */
  fetchImpl?: typeof fetch;
}

interface IgdbGame {
  id: number;
  name: string;
  first_release_date?: number;
  platforms?: { name?: string; abbreviation?: string }[];
  cover?: { image_id?: string };
}

/**
 * Fournisseur IGDB (via l'authentification Twitch). API et licence autorisent
 * l'affichage des pochettes avec attribution « IGDB.com ». Les images sont
 * servies par le CDN images.igdb.com.
 */
export class IgdbCoverProvider implements CoverProvider {
  readonly name = 'igdb';
  private token: string | null = null;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: IgdbOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    const url = new URL('https://id.twitch.tv/oauth2/token');
    url.searchParams.set('client_id', this.options.clientId);
    url.searchParams.set('client_secret', this.options.clientSecret);
    url.searchParams.set('grant_type', 'client_credentials');
    const res = await this.fetchImpl(url, { method: 'POST' });
    if (!res.ok) throw new Error(`IGDB auth échouée : HTTP ${res.status}`);
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('IGDB auth : token absent');
    this.token = data.access_token;
    return this.token;
  }

  async searchCover(game: GameIdentity): Promise<CoverSearchResult> {
    const token = await this.ensureToken();
    const query = [
      `search "${game.normalizedTitle.replace(/"/g, '')}";`,
      'fields name,first_release_date,platforms.name,platforms.abbreviation,cover.image_id;',
      'limit 10;',
    ].join(' ');

    const res = await this.fetchImpl('https://api.igdb.com/v4/games', {
      method: 'POST',
      headers: {
        'Client-ID': this.options.clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: query,
    });
    if (!res.ok) throw new Error(`IGDB recherche échouée : HTTP ${res.status}`);

    const rows = (await res.json()) as IgdbGame[];
    const candidates: CoverCandidate[] = rows
      .filter((row) => row.cover?.image_id)
      .map((row) => ({
        externalId: String(row.id),
        title: row.name,
        ...(row.platforms?.[0]?.name ? { platform: row.platforms[0].name } : {}),
        ...(row.first_release_date
          ? { year: new Date(row.first_release_date * 1000).getUTCFullYear() }
          : {}),
        imageUrl: `https://images.igdb.com/igdb/image/upload/t_cover_big/${row.cover?.image_id}.jpg`,
        attribution: 'Pochette via IGDB.com',
      }));

    return { provider: this.name, candidates };
  }
}

/**
 * Fournisseur composite : interroge plusieurs fournisseurs et fusionne leurs
 * candidats. Le classement par score (dans resolveCover) choisit ensuite le
 * meilleur, toutes sources confondues. Un fournisseur en échec est ignoré.
 */
export class CompositeCoverProvider implements CoverProvider {
  readonly name: string;
  constructor(private readonly providers: CoverProvider[]) {
    this.name = providers.map((p) => p.name).join('+');
  }
  async searchCover(game: GameIdentity): Promise<CoverSearchResult> {
    const candidates: CoverCandidate[] = [];
    for (const provider of this.providers) {
      try {
        const result = await provider.searchCover(game);
        candidates.push(...result.candidates);
      } catch {
        // Fournisseur indisponible : on continue avec les autres.
      }
    }
    return { provider: this.name, candidates };
  }
}

/**
 * Fournisseur séquentiel : interroge les fournisseurs DANS L'ORDRE et s'arrête
 * au premier dont le meilleur candidat franchit le seuil d'acceptation. C'est
 * la chaîne de priorité (PriceCharting exact → IGDB → Libretro) : contrairement
 * au composite, une source prioritaire qui répond bien court-circuite les
 * suivantes. Si aucune ne suffit, tous les candidats accumulés sont renvoyés
 * pour que resolveCover conserve la meilleure confiance observée.
 */
export class SequentialCoverProvider implements CoverProvider {
  readonly name: string;
  constructor(private readonly providers: CoverProvider[]) {
    this.name = providers.map((p) => p.name).join('>');
  }
  async searchCover(game: GameIdentity): Promise<CoverSearchResult> {
    const accumulated: CoverCandidate[] = [];
    for (const provider of this.providers) {
      try {
        const result = await provider.searchCover(game);
        const best = rankCandidates(game, result.candidates)[0];
        if (best && best.score >= ACCEPT_THRESHOLD) {
          return { provider: this.name, candidates: result.candidates };
        }
        accumulated.push(...result.candidates);
      } catch {
        // Fournisseur indisponible : on tente le suivant.
      }
    }
    return { provider: this.name, candidates: accumulated };
  }
}

export interface ProviderEnv {
  COVER_PROVIDER?: string;
  COVER_API_CLIENT_ID?: string;
  COVER_API_CLIENT_SECRET?: string;
}

/**
 * Fabrique un fournisseur d'après l'environnement. Retombe silencieusement
 * sur le fournisseur nul si les identifiants manquent (compilation sûre).
 */
export function createCoverProvider(env: ProviderEnv, fetchImpl?: typeof fetch): CoverProvider {
  // Défaut : chaîne PriceCharting (id exact, sans clé) → IGDB (si identifiants)
  // → Libretro. N'affecte que covers:sync, jamais le build.
  const kind = (env.COVER_PROVIDER ?? 'pricecharting').toLowerCase().trim();

  if (kind === 'pricecharting') {
    const chain: CoverProvider[] = [new PriceChartingCoverProvider(fetchImpl ? { fetchImpl } : {})];
    const clientId = env.COVER_API_CLIENT_ID?.trim();
    const clientSecret = env.COVER_API_CLIENT_SECRET?.trim();
    if (clientId && clientSecret) {
      chain.push(
        new IgdbCoverProvider({ clientId, clientSecret, ...(fetchImpl ? { fetchImpl } : {}) })
      );
    }
    chain.push(new LibretroCoverProvider(fetchImpl));
    return new SequentialCoverProvider(chain);
  }

  if (kind === 'libretro') {
    return new LibretroCoverProvider(fetchImpl);
  }

  if (kind === 'igdb') {
    const clientId = env.COVER_API_CLIENT_ID?.trim();
    const clientSecret = env.COVER_API_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      // Pas d'identifiants : on retombe sur Libretro (sans clé) plutôt que rien.
      return new LibretroCoverProvider(fetchImpl);
    }
    const igdb = new IgdbCoverProvider({
      clientId,
      clientSecret,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
    // IGDB (large couverture Xbox 360) + Libretro (jaquettes Xbox) combinés.
    return new CompositeCoverProvider([igdb, new LibretroCoverProvider(fetchImpl)]);
  }

  return new NullCoverProvider();
}
