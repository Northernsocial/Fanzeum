import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface StaticWorthItem {
  slug: string;
  category: string;
  name: string;
}

const itemsPath = path.resolve(__dirname, '../src/data/worthItems.json');
const publicDir = path.resolve(__dirname, '../public');
const outPath = path.join(publicDir, 'sitemap.xml');

const raw = fs.readFileSync(itemsPath, 'utf-8');
const items: StaticWorthItem[] = JSON.parse(raw);

const baseUrl = process.env.SITE_URL ?? 'https://fanzeum.com';
const today = new Date().toISOString().split('T')[0];

const categorySlugs = Array.from(new Set(items.map((item) => item.category)));

const urls: string[] = [
  '',
  '/worth',
  ...categorySlugs.map((category) => `/worth/${category}`),
  ...items.map((item) => `/worth/${item.category}/${item.slug}`),
];

const urlEntries = urls
  .map(
    (url) => `  <url>
    <loc>${baseUrl}${url}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  )
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(outPath, sitemap, 'utf-8');

console.log(`Sitemap written to ${outPath} (${urls.length} URLs)`);
