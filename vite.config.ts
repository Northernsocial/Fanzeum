import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function generateSitemapPlugin(): Plugin {
  return {
    name: 'fanzeum-sitemap',
    generateBundle() {
      try {
        const catalogPath = path.resolve(__dirname, 'src/data/worthCatalog.json');
        if (!fs.existsSync(catalogPath)) return;
        const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
        const urls = [
          'https://fanzeum.com/',
          'https://fanzeum.com/explore',
          'https://fanzeum.com/fresh-finds',
          'https://fanzeum.com/marketplace',
          'https://fanzeum.com/worth',
          'https://fanzeum.com/worth/football_cards',
          'https://fanzeum.com/worth/trading_cards',
          'https://fanzeum.com/worth/coins',
          'https://fanzeum.com/worth/stamps',
          'https://fanzeum.com/worth/comics',
          'https://fanzeum.com/worth/vinyl',
          'https://fanzeum.com/worth/toys',
          'https://fanzeum.com/worth/memorabilia',
        ];
        if (Array.isArray(catalogData)) {
          for (const item of catalogData) {
            if (item.category && item.slug) {
              urls.push(`https://fanzeum.com/worth/${item.category}/${item.slug}`);
            }
          }
        }
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map(
            (u) =>
              `  <url>\n    <loc>${u}</loc>\n    <changefreq>${
                u === 'https://fanzeum.com/' ? 'daily' : 'weekly'
              }</changefreq>\n    <priority>${u === 'https://fanzeum.com/' ? '1.0' : '0.8'}</priority>\n  </url>`,
          )
          .join('\n')}\n</urlset>`;
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: xml,
        });
      } catch (err) {
        console.warn('Sitemap generation skipped:', err);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      generateSitemapPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: '/',
          name: 'Fanzeum — Show off what you collect',
          short_name: 'Fanzeum',
          description:
            "Snap any card, coin, stamp, comic or record. Fanzeum tells you what it is, what it's worth, and gives it the display it deserves.",
          theme_color: '#0E0D0B',
          background_color: '#0E0D0B',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,webp,woff,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
