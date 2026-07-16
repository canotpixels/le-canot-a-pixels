import { describe, it, expect } from 'vitest';
import {
  LibretroCoverProvider,
  CompositeCoverProvider,
  SequentialCoverProvider,
  PriceChartingCoverProvider,
  NullCoverProvider,
  createCoverProvider,
} from '../scripts/lib/cover-provider';
import type { CoverProvider, GameIdentity, CoverSearchResult } from '../scripts/lib/types';

const FAKE_INDEX = `
<html><body><table>
<tr><td><a href="/Microsoft%20-%20Xbox/">Parent</a></td></tr>
<tr><td><a href="Max%20Payne%20(USA).png">Max Payne</a></td></tr>
<tr><td><a href="Halo%20-%20Combat%20Evolved%20(USA).png">Halo</a></td></tr>
<tr><td><a href="Halo%20-%20Combat%20Evolved%20(Europe).png">Halo EU</a></td></tr>
</table></body></html>`;

function fakeFetch(): typeof fetch {
  return (async () =>
    ({
      ok: true,
      status: 200,
      async text() {
        return FAKE_INDEX;
      },
    }) as unknown as Response) as unknown as typeof fetch;
}

const game: GameIdentity = {
  id: 'pc-6371',
  title: 'Max Payne',
  normalizedTitle: 'max payne',
  console: 'Xbox',
};

describe('LibretroCoverProvider', () => {
  it('analyse l’index et construit des candidats avec URL absolue', async () => {
    const provider = new LibretroCoverProvider(fakeFetch());
    const result = await provider.searchCover(game);
    expect(result.provider).toBe('libretro');
    const max = result.candidates.find((c) => c.externalId === 'Max Payne (USA).png');
    expect(max).toBeDefined();
    expect(max?.imageUrl).toContain('/Microsoft%20-%20Xbox/Named_Boxarts/');
    expect(max?.attribution).toMatch(/libretro/i);
    // Le lien parent ("/...") ne doit pas devenir un candidat.
    expect(result.candidates.every((c) => !c.externalId.includes('/'))).toBe(true);
  });

  it('ne renvoie rien pour une console non prise en charge', async () => {
    const provider = new LibretroCoverProvider(fakeFetch());
    const result = await provider.searchCover({ ...game, console: 'PlayStation 2' });
    expect(result.candidates).toHaveLength(0);
  });

  it('priorise la région USA avant Europe', async () => {
    const provider = new LibretroCoverProvider(fakeFetch());
    const result = await provider.searchCover({ ...game, title: 'Halo' });
    const usaIndex = result.candidates.findIndex((c) => c.externalId.includes('(USA)'));
    const euIndex = result.candidates.findIndex((c) => c.externalId.includes('(Europe)'));
    expect(usaIndex).toBeLessThan(euIndex);
  });
});

const PRICECHARTING_PAGE = `
<html><body>
<nav><a href="/console/playstation-2">PlayStation 2</a></nav>
<h1 id="product_name" class="chart_title" title="6656">
    Max Payne
    <a href="/console/xbox">
        Xbox
    </a>
</h1>
<div id="product_details">
  <div class="cover">
    <a href="https://storage.googleapis.com/images.pricecharting.com/TOKEN123/1600.jpg">
      <img src='https://storage.googleapis.com/images.pricecharting.com/TOKEN123/240.jpg'
        loading=lazy
        alt="Max Payne Xbox"
      />
    </a>
  </div>
</div>
</body></html>`;

function fakePcFetch(html: string, ok = true): typeof fetch {
  return (async () =>
    ({
      ok,
      status: ok ? 200 : 404,
      async text() {
        return html;
      },
    }) as unknown as Response) as unknown as typeof fetch;
}

describe('PriceChartingCoverProvider', () => {
  const pcGame: GameIdentity = { ...game, priceChartingId: '6656' };

  it('extrait la jaquette du bloc cover en pleine résolution (1600)', async () => {
    const provider = new PriceChartingCoverProvider({
      fetchImpl: fakePcFetch(PRICECHARTING_PAGE),
      delayMs: 0,
    });
    const result = await provider.searchCover(pcGame);
    expect(result.provider).toBe('pricecharting');
    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0];
    expect(candidate?.externalId).toBe('6656');
    expect(candidate?.imageUrl).toBe(
      'https://storage.googleapis.com/images.pricecharting.com/TOKEN123/1600.jpg'
    );
    expect(candidate?.title).toBe('Max Payne');
    expect(candidate?.platform).toBe('Xbox');
    expect(candidate?.attribution).toMatch(/PriceCharting/);
  });

  it('ne renvoie rien sans id PriceCharting (aucun appel réseau)', async () => {
    let called = false;
    const spyFetch = (async () => {
      called = true;
      return {
        ok: true,
        status: 200,
        async text() {
          return '';
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const provider = new PriceChartingCoverProvider({ fetchImpl: spyFetch, delayMs: 0 });
    const result = await provider.searchCover(game);
    expect(result.candidates).toHaveLength(0);
    expect(called).toBe(false);
  });

  it('ne renvoie rien si la fiche n’a pas de photo hébergée par PriceCharting', async () => {
    const page = PRICECHARTING_PAGE.replaceAll('images.pricecharting.com', 'example.com/no-photo');
    const provider = new PriceChartingCoverProvider({ fetchImpl: fakePcFetch(page), delayMs: 0 });
    const result = await provider.searchCover(pcGame);
    expect(result.candidates).toHaveLength(0);
  });

  it('signale une erreur HTTP définitive sans réessayer (404)', async () => {
    let calls = 0;
    const counting404 = (async () => {
      calls += 1;
      return { ok: false, status: 404 } as unknown as Response;
    }) as unknown as typeof fetch;
    const provider = new PriceChartingCoverProvider({ fetchImpl: counting404, delayMs: 0 });
    await expect(provider.searchCover(pcGame)).rejects.toThrow(/HTTP 404/);
    expect(calls).toBe(1);
  });

  it('décode les entités HTML du titre (apostrophes, &amp;…)', async () => {
    const page = PRICECHARTING_PAGE.replace('Max Payne', 'Assassin&#39;s Creed &amp; Co');
    const provider = new PriceChartingCoverProvider({ fetchImpl: fakePcFetch(page), delayMs: 0 });
    const result = await provider.searchCover(pcGame);
    expect(result.candidates[0]?.title).toBe("Assassin's Creed & Co");
  });

  it('réessaie après une limitation transitoire (429) puis réussit', async () => {
    let calls = 0;
    const flaky = (async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 429 } as unknown as Response;
      return {
        ok: true,
        status: 200,
        async text() {
          return PRICECHARTING_PAGE;
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const provider = new PriceChartingCoverProvider({ fetchImpl: flaky, delayMs: 0 });
    const result = await provider.searchCover(pcGame);
    expect(calls).toBe(2);
    expect(result.candidates).toHaveLength(1);
  });
});

describe('SequentialCoverProvider', () => {
  const strong: CoverProvider = {
    name: 'strong',
    async searchCover(g): Promise<CoverSearchResult> {
      return {
        provider: 'strong',
        candidates: [
          { externalId: 's', title: g.title, platform: g.console, imageUrl: 'https://x/s.png' },
        ],
      };
    },
  };
  const weak: CoverProvider = {
    name: 'weak',
    async searchCover(): Promise<CoverSearchResult> {
      return {
        provider: 'weak',
        candidates: [{ externalId: 'w', title: 'Sans Rapport Aucun', imageUrl: 'https://x/w.png' }],
      };
    },
  };
  const failing: CoverProvider = {
    name: 'failing',
    async searchCover(): Promise<CoverSearchResult> {
      throw new Error('down');
    },
  };

  it('s’arrête au premier fournisseur dont le meilleur candidat passe le seuil', async () => {
    let secondCalled = false;
    const spy: CoverProvider = {
      name: 'spy',
      async searchCover(): Promise<CoverSearchResult> {
        secondCalled = true;
        return { provider: 'spy', candidates: [] };
      },
    };
    const sequential = new SequentialCoverProvider([strong, spy]);
    const result = await sequential.searchCover(game);
    expect(result.candidates.map((c) => c.externalId)).toEqual(['s']);
    expect(secondCalled).toBe(false);
  });

  it('passe au suivant si le candidat est trop faible ou le fournisseur en échec', async () => {
    const sequential = new SequentialCoverProvider([failing, weak, strong]);
    const result = await sequential.searchCover(game);
    expect(result.candidates.some((c) => c.externalId === 's')).toBe(true);
    expect(sequential.name).toBe('failing>weak>strong');
  });

  it('renvoie les candidats accumulés si aucun ne passe le seuil', async () => {
    const sequential = new SequentialCoverProvider([failing, weak]);
    const result = await sequential.searchCover(game);
    expect(result.candidates.map((c) => c.externalId)).toEqual(['w']);
  });
});

describe('CompositeCoverProvider', () => {
  it('fusionne les candidats et ignore un fournisseur en échec', async () => {
    const good: CoverProvider = {
      name: 'good',
      async searchCover(): Promise<CoverSearchResult> {
        return {
          provider: 'good',
          candidates: [{ externalId: 'a', title: 'A', imageUrl: 'https://x/a.png' }],
        };
      },
    };
    const failing: CoverProvider = {
      name: 'failing',
      async searchCover(): Promise<CoverSearchResult> {
        throw new Error('down');
      },
    };
    const composite = new CompositeCoverProvider([failing, good]);
    const result = await composite.searchCover(game);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.externalId).toBe('a');
  });
});

describe('createCoverProvider', () => {
  it('utilise la chaîne PriceCharting → Libretro par défaut (sans clé)', () => {
    expect(createCoverProvider({}).name).toBe('pricecharting>libretro');
  });
  it('insère IGDB dans la chaîne quand les identifiants sont fournis', () => {
    const p = createCoverProvider({
      COVER_PROVIDER: 'pricecharting',
      COVER_API_CLIENT_ID: 'x',
      COVER_API_CLIENT_SECRET: 'y',
    });
    expect(p.name).toBe('pricecharting>igdb>libretro');
  });
  it('respecte COVER_PROVIDER=libretro', () => {
    expect(createCoverProvider({ COVER_PROVIDER: 'libretro' }).name).toBe('libretro');
  });
  it('retombe sur Libretro si igdb sans identifiants', () => {
    expect(createCoverProvider({ COVER_PROVIDER: 'igdb' }).name).toBe('libretro');
  });
  it('combine igdb + libretro avec identifiants', () => {
    const p = createCoverProvider({
      COVER_PROVIDER: 'igdb',
      COVER_API_CLIENT_ID: 'x',
      COVER_API_CLIENT_SECRET: 'y',
    });
    expect(p.name).toBe('igdb+libretro');
  });
  it('respecte COVER_PROVIDER=null', () => {
    expect(createCoverProvider({ COVER_PROVIDER: 'null' })).toBeInstanceOf(NullCoverProvider);
  });
});
