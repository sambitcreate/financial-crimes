import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://financialcrimes.news',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
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
