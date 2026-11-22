import { describe, expect, it } from 'vitest';
import {
  buildArticleJsonLd,
  PUBLISHER_LOGO_PATH,
} from '../src/layouts/article-meta';
import {
  buildLedgerUrl,
  computeFilteredTotals,
  getRetraction,
  hasActiveLedgerFilters,
  isArticleRetracted,
  ledgerPagePath,
  listedArticles,
  type LedgerEntry,
} from '../src/utils/ledger';
import { buildStoryRedirects } from '../scripts/generate-redirects.mjs';
import { findCspViolations } from '../scripts/check-csp.mjs';

describe('retraction helpers', () => {
  const live = { slug: 'live' };
  const retracted = { slug: 'gone', retracted: { date: '2026-11-21', note: 'Misidentified the defendant.' } };
  const malformed = { slug: 'bad', retracted: { note: 'no date' } };

  it('reads a well-formed tombstone and ignores malformed ones', () => {
    expect(getRetraction(retracted)).toEqual({ date: '2026-11-21', note: 'Misidentified the defendant.' });
    expect(getRetraction(live)).toBeNull();
    expect(getRetraction(malformed)).toBeNull();
    expect(isArticleRetracted(undefined)).toBe(false);
  });

  it('drops retracted stories from listings', () => {
    expect(listedArticles([live, retracted, malformed]).map((a) => a.slug)).toEqual(['live', 'bad']);
  });
});

describe('ledger URLs (no-JS pagination + shareable filters)', () => {
  it('maps unfiltered pages onto the prerendered static paths', () => {
    expect(ledgerPagePath(1)).toBe('/ledger');
    expect(ledgerPagePath(2)).toBe('/ledger/page/2');
    expect(ledgerPagePath(0)).toBe('/ledger');
    expect(ledgerPagePath(Number.NaN)).toBe('/ledger');
    expect(buildLedgerUrl({}, 3)).toBe('/ledger/page/3');
    expect(buildLedgerUrl({ view: 'table' }, 1)).toBe('/ledger?view=table');
  });

  it('reflects q and filters in the query string', () => {
    const state = { query: ' Jane Street ', edition: 'india', sortMode: 'loot-desc', minLoot: '0' };
    expect(hasActiveLedgerFilters(state)).toBe(true);
    expect(buildLedgerUrl(state, 2)).toBe('/ledger?q=Jane+Street&edition=india&sort=loot-desc&page=2');
    expect(buildLedgerUrl({ query: 'x', edition: 'all', category: 'all', slapMode: 'all' }, 1)).toBe('/ledger?q=x');
    expect(hasActiveLedgerFilters({ query: '  ', edition: 'all', sortMode: 'newest', minLoot: '0' })).toBe(false);
  });
});

function entry(stage: string, amount: number, fine: number, ratio: number | null): LedgerEntry {
  return {
    legal_stage: stage,
    financials: {
      amount_usd: amount,
      fine_usd: fine,
      fine_ratio_pct: ratio,
    },
  } as unknown as LedgerEntry;
}

describe('computeFilteredTotals (resolved-only fines)', () => {
  it('never counts frozen money in a pending case as a fine', () => {
    const totals = computeFilteredTotals([
      entry('settlement', 1_000, 100, 10),
      entry('interim_order', 500, 500, null),
      entry('indicted', 300, 250, null),
    ]);
    expect(totals.count).toBe(3);
    expect(totals.totalLoot).toBe(1_800);
    expect(totals.totalFines).toBe(100);
    expect(totals.avgFineRatioPct).toBeCloseTo(10, 6);
  });
});

describe('article structured data (F12)', () => {
  const site = new URL('https://financialcrimes.fyi');
  const base = {
    headline: 'H',
    deck: 'D',
    publish_date: '2026-11-19T06:00:00-05:00',
    url: '/article/x',
    category: 'Courts',
    byline: 'By The Courts Desk',
    template: 'news' as const,
    slug: 'x',
  };

  it('credits desks as organizations and discloses satire', () => {
    const ld = buildArticleJsonLd(base, site) as Record<string, any>;
    expect(ld['@type']).toBe('NewsArticle');
    expect(ld.author['@type']).toBe('Organization');
    expect(ld.author.name).toBe('The Courts Desk, The Financial Crimes');
    expect(ld.genre).toContain('Satire');
    expect(ld.dateModified).toBe(base.publish_date);
    expect(ld.publisher.logo.url).toBe(`https://financialcrimes.fyi${PUBLISHER_LOGO_PATH}`);
    expect(ld.publisher.logo.width).toBe(ld.publisher.logo.height);
  });

  it('uses OpinionNewsArticle for opinion and updated_at for dateModified', () => {
    const ld = buildArticleJsonLd(
      { ...base, template: 'opinion', url: '/opinion/x', updated_at: '2026-11-21T10:00:00-05:00' },
      site,
    ) as Record<string, any>;
    expect(ld['@type']).toBe('OpinionNewsArticle');
    expect(ld.articleSection).toBe('Opinion');
    expect(ld.dateModified).toBe('2026-11-21T10:00:00-05:00');
  });
});

describe('generate-redirects (R1)', () => {
  it('aliases the other template prefix to the live story URL', () => {
    const lines = buildStoryRedirects([
      { slug: 'a-news', template: 'news' },
      { slug: 'b-op', template: 'opinion' },
    ]);
    expect(lines).toEqual(['/opinion/a-news /article/a-news 301', '/article/b-op /opinion/b-op 301']);
  });

  it('rejects slugs that could inject redirect syntax', () => {
    expect(() => buildStoryRedirects([{ slug: 'x /evil 200', template: 'news' }])).toThrow();
  });
});

describe('check-csp (F11)', () => {
  it('allows external scripts and JSON data blocks', () => {
    const html =
      '<script type="module" src="/_astro/a.js"></script><script type="application/ld+json">{"a":1}</script>' +
      '<script type="application/json" class="fc-painting-config">{}</script>';
    expect(findCspViolations(html)).toEqual([]);
  });

  it('flags inline scripts, inline handlers and javascript: URLs', () => {
    expect(findCspViolations('<script>alert(1)</script>')).toHaveLength(1);
    expect(findCspViolations('<script type="module">import "x"</script>')).toHaveLength(1);
    expect(findCspViolations('<button onclick="x()">x</button>')).toHaveLength(1);
    expect(findCspViolations('<a href="javascript:alert(1)">x</a>')).toHaveLength(1);
  });

  it('ignores handler-looking text inside data blocks and styles', () => {
    expect(findCspViolations('<style>.a{content:"onclick="}</style><p>onload= is text</p>')).toEqual([]);
  });
});
