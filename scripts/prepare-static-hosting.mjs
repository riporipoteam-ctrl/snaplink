import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const indexFile = resolve(distDir, 'index.html');
const fallbackFile = resolve(distDir, '200.html');

if (!existsSync(indexFile)) {
  console.error('Missing dist/index.html. Run the Vite build before preparing static hosting.');
  process.exit(1);
}

copyFileSync(indexFile, fallbackFile);
console.log('Prepared static-hosting SPA fallback: dist/200.html');

const rawSiteUrl =
  process.env.SITE_URL ||
  process.env.URL ||
  process.env.DEPLOY_URL ||
  process.env.VERCEL_URL ||
  process.env.DEPLOY_PRIME_URL ||
  'https://snaplinknetwork.netlify.app';

const siteUrl = (/^https?:\/\//i.test(rawSiteUrl) ? rawSiteUrl : `https://${rawSiteUrl}`).replace(/\/+$/, '');
const now = new Date().toISOString();
const sitemapRoutes = [
  '/',
  '/announcements',
  '/challenges',
  '/events',
  '/friends',
  '/groups',
  '/install',
  '/live',
  '/messages',
  '/notifications',
  '/premium',
  '/profile',
  '/ripoai',
  '/search',
  '/settings',
  '/shop',
  '/suggestions',
  '/makespace',
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapRoutes.map((route) => `  <url>
    <loc>${siteUrl}${route}</loc>
    <lastmod>${now}</lastmod>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync(resolve(distDir, 'sitemap.xml'), sitemap, 'utf8');
writeFileSync(resolve(distDir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`, 'utf8');
console.log(`Generated dist/sitemap.xml and dist/robots.txt for ${siteUrl}`);
