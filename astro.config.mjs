import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.SITE_URL || 'https://financialcrimes.news';

export default defineConfig({
  site: siteUrl,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/404') && !page.endsWith('/404.html'),
    }),
  ],
  vite: {
    build: {
      sourcemap: false,
      target: 'es2022',
      // The nav drawer script ships on every page: serve it as a cacheable file instead of
      // inlining it into each HTML document. Everything else keeps the default 4 KB rule.
      assetsInlineLimit: (filePath) => (filePath.includes('NavDrawer.astro') ? false : undefined),
    },
  },
});
