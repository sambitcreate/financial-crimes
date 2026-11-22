import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.SITE_URL || 'https://financialcrimes.fyi';

/**
 * Story metadata for the sitemap, read straight from content/ at config time:
 * lastmod = updated_at (falling back to publish_date), and retracted tombstones are omitted.
 */
function collectStorySitemapMeta() {
  const byPath = new Map();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === 'meta.json') {
        try {
          const meta = JSON.parse(fs.readFileSync(full, 'utf8'));
          if (!meta?.slug) continue;
          const href = meta.template === 'opinion' ? `/opinion/${meta.slug}` : `/article/${meta.slug}`;
          const updated = typeof meta.updated_at === 'string' && !Number.isNaN(Date.parse(meta.updated_at));
          byPath.set(href, {
            lastmod: updated ? meta.updated_at : meta.publish_date,
            retracted: Boolean(meta.retracted && typeof meta.retracted === 'object' && meta.retracted.date),
          });
        } catch {
          // validate-content.mjs reports malformed meta.json; the sitemap just skips it
        }
      }
    }
  };
  walk(path.resolve('content/articles'));

  const editionsDir = path.resolve('content/editions');
  if (fs.existsSync(editionsDir)) {
    for (const file of fs.readdirSync(editionsDir)) {
      const m = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(file);
      if (!m) continue;
      try {
        const edition = JSON.parse(fs.readFileSync(path.join(editionsDir, file), 'utf8'));
        byPath.set(`/edition/${m[1]}`, { lastmod: edition.published_at || m[1], retracted: false });
      } catch {
        // ignore
      }
    }
  }
  return byPath;
}

const storySitemapMeta = collectStorySitemapMeta();

function sitemapPath(pageUrl) {
  try {
    return new URL(pageUrl).pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  } catch {
    return pageUrl;
  }
}

export default defineConfig({
  site: siteUrl,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [
    sitemap({
      filter: (page) => {
        if (page.endsWith('/404') || page.endsWith('/404.html')) return false;
        return !storySitemapMeta.get(sitemapPath(page))?.retracted;
      },
      serialize: (item) => {
        const meta = storySitemapMeta.get(sitemapPath(item.url));
        const ms = meta ? Date.parse(meta.lastmod) : NaN;
        if (Number.isFinite(ms)) item.lastmod = new Date(ms).toISOString();
        return item;
      },
    }),
  ],
  vite: {
    build: {
      sourcemap: false,
      target: 'es2022',
      // Never inline component scripts: public/_headers ships `script-src 'self'` (no
      // 'unsafe-inline', no hashes), so every script must be a cacheable /_astro file.
      // scripts/check-csp.mjs fails the build if an inline script slips through.
      assetsInlineLimit: (filePath) => (filePath.includes('.astro') ? false : undefined),
    },
  },
});
