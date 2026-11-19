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
    },
  },
});
