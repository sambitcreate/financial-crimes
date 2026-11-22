import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearArticleCache,
  computeRollupFromArticles,
  loadAllArticles,
  loadAllArticlesIncludingRetracted,
  loadRollupStats,
} from '../src/loaders/articles';
import { ArticleMetaSchema, PaintRefsManifestSchema } from '../src/schemas/article';
import { findGenericHubUrlReason } from '../scripts/validate-content.mjs';

const PROJECT_ROOT = process.cwd();

/** Strips loader-only fields so the strict meta schema sees exactly what meta.json holds. */
async function firstMeta() {
  const articles = await loadAllArticles();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { bodyHtml, url, contentDir, ...meta } = articles[0];
  return meta;
}

describe('ArticleMetaSchema security & hygiene', () => {
  beforeEach(() => {
    clearArticleCache();
  });

  it('rejects javascript: and http: URLs in sources[]', async () => {
    const base = await firstMeta();

    const jsAttempt = ArticleMetaSchema.safeParse({
      ...base,
      sources: [
        {
          title: 'Malicious filing',
          agency: 'Test',
          url: 'javascript:alert(1)',
          date: '2026-11-19',
        },
      ],
    });
    expect(jsAttempt.success).toBe(false);

    const httpAttempt = ArticleMetaSchema.safeParse({
      ...base,
      sources: [
        {
          title: 'Insecure filing',
          agency: 'Test',
          url: 'http://example.com/filing',
          date: '2026-11-19',
        },
      ],
    });
    expect(httpAttempt.success).toBe(false);
  });

  it('rejects unknown or misspelled legal_stage values', async () => {
    const base = await firstMeta();

    const badStage = ArticleMetaSchema.safeParse({
      ...base,
      legal_stage: 'setled_out_of_court',
    });
    expect(badStage.success).toBe(false);
  });

  it('accepts optional corrections entries without dead legacy fields', async () => {
    const base = await firstMeta();

    const withCorrection = ArticleMetaSchema.safeParse({
      ...base,
      corrections: [
        {
          date: '2026-11-20',
          note: 'Clarified docket citation number.',
          type: 'clarification',
        },
      ],
    });
    expect(withCorrection.success).toBe(true);
  });

  it('rejects the legacy corrections shape {date, summary} documented before the schema fix', async () => {
    const base = await firstMeta();
    const legacy = ArticleMetaSchema.safeParse({
      ...base,
      corrections: [{ date: '2026-11-20', summary: 'Old field name.' }],
    });
    expect(legacy.success).toBe(false);
  });

  it('parses every real meta.json with the strict schema (no loader-only or unknown keys)', async () => {
    const articles = await loadAllArticles();
    for (const a of articles) {
      const raw = JSON.parse(await fs.readFile(path.join(a.contentDir, 'meta.json'), 'utf-8'));
      const parsed = ArticleMetaSchema.safeParse(raw);
      expect(parsed.success, `${a.slug}: ${parsed.success ? '' : parsed.error.message}`).toBe(true);
    }
  });
});

describe('Article loaders, caching, rollup parity, and 1:1 paint-refs', () => {
  beforeEach(() => {
    clearArticleCache();
  });

  it('loads all published articles and memoizes filesystem reads until cache is cleared', async () => {
    const p1 = loadAllArticles();
    const p2 = loadAllArticles();
    expect(p1).toBe(p2);

    const [a1, a2] = await Promise.all([p1, p2]);
    expect(a1.length).toBeGreaterThanOrEqual(1);
    expect(a1).toBe(a2);

    const gensol = a1.find((a) => a.slug === 'gensol-blusmart-ev-loan-camellias-condo');
    expect(gensol?.legal_stage).toBe('interim_order');
    expect(gensol?.slap_on_wrist_score).toBeNull();

    clearArticleCache();
    const p3 = loadAllArticles();
    expect(p3).not.toBe(p1);
    const a3 = await p3;
    expect(a3).toHaveLength(a1.length);
  });

  it('keeps content/ledger/rollup-stats.json in exact parity with computeRollupFromArticles()', async () => {
    const articles = await loadAllArticles();
    const diskRollup = await loadRollupStats();
    const computed = computeRollupFromArticles(articles, diskRollup.as_of);

    expect(diskRollup.total_cases).toBe(computed.total_cases);
    expect(diskRollup.total_loot_usd).toBe(computed.total_loot_usd);
    expect(diskRollup.total_fines_usd).toBe(computed.total_fines_usd);
    expect(diskRollup.avg_fine_ratio_pct).toBe(computed.avg_fine_ratio_pct);
    expect(diskRollup.avg_slap_on_wrist_score).toBe(computed.avg_slap_on_wrist_score);
    expect(diskRollup.zero_prison_cases).toBe(computed.zero_prison_cases);
    expect(diskRollup.total_loot_display).toBe(computed.total_loot_display);
    expect(diskRollup.total_fines_display).toBe(computed.total_fines_display);
    expect(diskRollup.edition_date).toBe(computed.edition_date);
    expect(Object.keys(diskRollup.regions).sort()).toEqual(Object.keys(computed.regions).sort());

    for (const [regionKey, expectedRegion] of Object.entries(computed.regions)) {
      expect(diskRollup.regions[regionKey]).toEqual(expectedRegion);
    }
  });

  it('validates 1:1 paint-refs.json coverage and valid JPEG files (>5 KB, FF D8 FF)', async () => {
    // Retracted articles keep their paint-ref (the tombstone page still exists), so compare
    // against every article on disk, not just the live listing.
    const articles = await loadAllArticlesIncludingRetracted();
    const rawRefs = await fs.readFile(
      path.join(PROJECT_ROOT, 'content', 'paint-refs.json'),
      'utf-8'
    );
    const manifest = PaintRefsManifestSchema.parse(JSON.parse(rawRefs));

    const articleSlugs = new Set(articles.map((a) => a.slug));
    const manifestSlugs = new Set(Object.keys(manifest));

    expect(manifestSlugs.size).toBe(articleSlugs.size);
    for (const slug of articleSlugs) {
      const entry = manifest[slug];
      expect(entry, `Missing paint-ref entry for ${slug}`).toBeDefined();
      expect(entry.refImage).toBe(`/paint-refs/${slug}.jpg`);

      const jpgPath = path.join(PROJECT_ROOT, 'public', 'paint-refs', `${slug}.jpg`);
      const buf = await fs.readFile(jpgPath);
      expect(buf.byteLength).toBeGreaterThan(5 * 1024);
      expect(buf[0]).toBe(0xff);
      expect(buf[1]).toBe(0xd8);
      expect(buf[2]).toBe(0xff);
    }
  });

  it('rejects generic newsroom hubs, bare root domains, and redirect wrappers in sources[].url', async () => {
    const rejectedExamples = [
      'https://www.sfo.gov.uk/news/',
      'https://www.eppo.europa.eu/en/media/news',
      'https://www.sec.gov/newsroom/press-releases',
      'https://www.fca.org.uk/news/press-releases',
      'https://www.justice.gov/tax/press-releases',
      'https://www.justice.gov/usao-sdny/pr',
      'https://www.occ.gov/news-events/newsroom/index.html',
      'https://ofac.treasury.gov/recent-actions',
      'https://www.sebi.gov.in/enforcement/orders.html',
      'https://www.mas.gov.sg/news/media-releases',
      'https://www.fatf-gafi.org/en/publications.html',
      'https://www.courtlistener.com/',
      'https://www.ca7.uscourts.gov/',
      'https://sat.gov.in/',
      'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123',
    ];
    for (const badUrl of rejectedExamples) {
      expect(
        findGenericHubUrlReason(badUrl),
        `Expected hub URL to be rejected: ${badUrl}`
      ).toBeTruthy();
    }

    const acceptedExamples = [
      'https://home.treasury.gov/news/press-releases/sb0657',
      'https://www.occ.gov/news-issuances/news-releases/2026/nr-occ-2026-89.html',
      'https://ofac.treasury.gov/recent-actions/20261013_33',
      'https://www.sec.gov/enforcement-litigation/litigation-releases/lr-26254',
      'https://apps.sfc.hk/edistributionWeb/gateway/EN/news-and-announcements/news/doc?refNo=26PR62',
      'https://media.ca7.uscourts.gov/cgi-bin/OpinionsWeb/processWebInputExternal.pl?Submit=Display&Path=Y2026/D04-27/C:25-2249:J:Scudder:aut:T:fnOp:N:3530621:S:0',
    ];
    for (const goodUrl of acceptedExamples) {
      expect(
        findGenericHubUrlReason(goodUrl),
        `Expected canonical URL to pass: ${goodUrl}`
      ).toBeNull();
    }

    const articles = await loadAllArticles();
    // No hard article-count floor: retractions and removals must not break CI.
    expect(articles.length).toBeGreaterThanOrEqual(1);
    const violations: string[] = [];
    for (const article of articles) {
      for (const [idx, source] of article.sources.entries()) {
        const reason = findGenericHubUrlReason(source.url);
        if (reason) {
          violations.push(`${article.slug} sources[${idx}] (${source.url}): ${reason}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
