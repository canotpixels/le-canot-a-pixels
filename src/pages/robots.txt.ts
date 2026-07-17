import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  // Le sitemap vit sous le chemin de base (ex. /canot-pixels-collection/ sur
  // GitHub Pages), pas à la racine du domaine.
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const sitemapPath = `${base}sitemap-index.xml`;
  const sitemapUrl = site ? new URL(sitemapPath, site).toString() : sitemapPath;
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
