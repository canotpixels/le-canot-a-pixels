import { parseArgs as nodeParseArgs } from 'node:util';

// -----------------------------------------------------------------------------
// npm run pc:search -- "<titre>" [--console="Xbox 360"] [--limit=5]
// Recherche un jeu sur PriceCharting (page de recherche publique) et affiche
// les candidats : id, titre exact, console, prix CIB (USD). Sert au skill
// `jeu-recherche`. Un seul appel réseau, aucune clé requise.
// -----------------------------------------------------------------------------

const { values, positionals } = nodeParseArgs({
  allowPositionals: true,
  options: {
    console: { type: 'string' },
    limit: { type: 'string', default: '5' },
  },
});

const title = positionals.join(' ').trim();
if (!title) {
  console.error('Usage : npm run pc:search -- "<titre>" [--console="Xbox 360"] [--limit=5]');
  process.exit(1);
}

const query = [title, values.console].filter(Boolean).join(' ');
const url = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(query)}`;
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' } });
if (!res.ok) {
  console.error(`✖ HTTP ${res.status}`);
  process.exit(1);
}
const html = await res.text();

const decode = (s: string): string =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

const limit = Number(values.limit);
const rows = [...html.matchAll(/<tr id="product-(\d+)"[\s\S]*?<\/tr>/g)];
if (rows.length === 0) {
  console.log('Aucun résultat (ou page produit directe). Essayez un titre plus court.');
  process.exit(0);
}
for (const row of rows.slice(0, limit)) {
  const block = row[0];
  const id = row[1];
  const name = decode(block.match(/<td class="title">\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '?');
  const consoleName = decode(
    block.match(/<td class="console[^"]*">\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? '?'
  );
  const cib = block.match(/cib_price">\s*<span class="js-price">([^<]*)</)?.[1] ?? '?';
  console.log(`${id}\t${name}\t${consoleName}\tCIB ${cib}`);
}
