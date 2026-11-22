import { describe, expect, it } from 'vitest';
import { computeRollupFromArticles, loadAllArticles } from '../src/loaders/articles';
import { getPaintRefLookup } from '../src/painting/refs-loader';
import type { ArticleRecord } from '../src/schemas/article';
import {
  buildCreditEntries,
  buildLedgerEntries,
  computeFilteredTotals,
  CREDITS_PAGE_SIZE,
  filterAndSortLedger,
  filterCreditEntries,
  formatMonthLabel,
  groupArticlesByMonth,
  LEDGER_PAGE_SIZE,
  matchesEdition,
  paginateItems,
  RSS_MAX_ITEMS,
  selectRssItems,
  summarizeLicenses,
  type LedgerEntry,
} from '../src/utils/ledger';

function makeSyntheticEntry(index: number, overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  const day = String((index % 28) + 1).padStart(2, '0');
  const month = String((Math.floor(index / 28) % 12) + 1).padStart(2, '0');
  const slug = overrides.slug ?? `case-${String(index).padStart(4, '0')}`;
  return {
    id: overrides.id ?? `fc-2026-${String(index).padStart(4, '0')}`,
    slug,
    url: overrides.url ?? `/article/${slug}`,
    headline: overrides.headline ?? `Synthetic Enforcement Action ${index}`,
    deck: overrides.deck ?? `Deck for synthetic case ${index}`,
    city: overrides.city ?? 'New York',
    edition: overrides.edition ?? 'new-york',
    category: overrides.category ?? 'Wall Street',
    agencies: overrides.agencies ?? ['SEC', 'DOJ'],
    docket_number: overrides.docket_number ?? `1:26-cr-${index}`,
    legal_stage: overrides.legal_stage ?? 'settlement',
    legal_stage_label: overrides.legal_stage_label ?? 'SETTLEMENT',
    template: overrides.template ?? 'dispatch',
    publish_date: overrides.publish_date ?? `2026-${month}-${day}T12:00:00Z`,
    short_date: overrides.short_date ?? 'Nov. 19',
    broadsheet_date: overrides.broadsheet_date ?? 'Nov. 19, 2026',
    slap_on_wrist_score:
      overrides.slap_on_wrist_score !== undefined ? overrides.slap_on_wrist_score : 75,
    financials: overrides.financials ?? {
      amount_usd: 100_000_000,
      amount_display: '$100M',
      fine_usd: 10_000_000,
      fine_display: '$10M',
      fine_ratio_pct: 10,
      fine_ratio_editorial: '10.00%',
      fine_ratio_table: '10.00%',
      prison_months: 0,
      prison_display: '0 days',
    },
    search_blob:
      overrides.search_blob ??
      `synthetic enforcement action ${index} new york wall street sec doj`.toLowerCase(),
    paintRef: overrides.paintRef ?? {
      slug,
      refImage: `/paint-refs/${slug}.jpg`,
      isPortrait: true,
      paletteMood: 'verdict-crimson',
      toyKind: 'stamp',
      monochrome: false,
      alt: `Oil painting for ${slug}`,
    },
  };
}

describe('paginateItems (Stage 1 static scale-proofing)', () => {
  it('handles empty collections cleanly', () => {
    const res = paginateItems([], 1, LEDGER_PAGE_SIZE);
    expect(res).toEqual({
      items: [],
      page: 1,
      pageSize: LEDGER_PAGE_SIZE,
      totalItems: 0,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
    });
  });

  it('slices boundary counts (24, 25, and 500 items) accurately', () => {
    const exact24 = Array.from({ length: 24 }, (_, i) => i + 1);
    const p24 = paginateItems(exact24, 1, 24);
    expect(p24.totalPages).toBe(1);
    expect(p24.startIndex).toBe(1);
    expect(p24.endIndex).toBe(24);
    expect(p24.items).toHaveLength(24);

    const items25 = Array.from({ length: 25 }, (_, i) => i + 1);
    const page1 = paginateItems(items25, 1, 24);
    const page2 = paginateItems(items25, 2, 24);
    expect(page1.totalPages).toBe(2);
    expect(page1.items).toHaveLength(24);
    expect(page2.items).toEqual([25]);
    expect(page2.startIndex).toBe(25);
    expect(page2.endIndex).toBe(25);

    const items500 = Array.from({ length: 500 }, (_, i) => i + 1);
    const lastPage = paginateItems(items500, 999, 24);
    expect(lastPage.totalPages).toBe(21);
    expect(lastPage.page).toBe(21);
    expect(lastPage.startIndex).toBe(481);
    expect(lastPage.endIndex).toBe(500);
    expect(lastPage.items).toHaveLength(20);
  });

  it('clamps invalid or negative page numbers to page 1', () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateItems(items, 0, 2).page).toBe(1);
    expect(paginateItems(items, -5, 2).page).toBe(1);
    expect(paginateItems(items, Number.NaN, 2).page).toBe(1);
  });
});

describe('filterAndSortLedger & computeFilteredTotals', () => {
  const sample: LedgerEntry[] = [
    makeSyntheticEntry(1, {
      slug: 'ny-mega-bank',
      city: 'New York',
      edition: 'new-york',
      category: 'Wall Street',
      publish_date: '2026-11-19T12:00:00Z',
      slap_on_wrist_score: 92,
      financials: {
        amount_usd: 2_000_000_000,
        amount_display: '$2.0B',
        fine_usd: 50_000_000,
        fine_display: '$50M',
        fine_ratio_pct: 2.5,
        fine_ratio_editorial: '2.50%',
        fine_ratio_table: '2.50%',
        prison_months: 0,
        prison_display: '0 days',
      },
      search_blob: 'mega bank aml fine new york wall street occ',
    }),
    makeSyntheticEntry(2, {
      slug: 'frankfurt-wire',
      city: 'Frankfurt',
      edition: 'europe',
      category: 'Europe',
      publish_date: '2026-11-20T12:00:00Z',
      slap_on_wrist_score: 40,
      financials: {
        amount_usd: 500_000_000,
        amount_display: '$500M',
        fine_usd: 250_000_000,
        fine_display: '$250M',
        fine_ratio_pct: 50,
        fine_ratio_editorial: '50.00%',
        fine_ratio_table: '50.00%',
        prison_months: 48,
        prison_display: '4 years',
      },
      search_blob: 'frankfurt wire fraud bafin europe',
    }),
    makeSyntheticEntry(3, {
      slug: 'mumbai-pending',
      city: 'Mumbai',
      edition: 'india',
      category: 'India & Asia',
      publish_date: '2026-11-21T12:00:00Z',
      slap_on_wrist_score: null,
      legal_stage: 'indicted',
      legal_stage_label: 'INDICTED',
      financials: {
        amount_usd: 300_000_000,
        amount_display: '$300M',
        fine_usd: 0,
        fine_display: 'Pending',
        fine_ratio_pct: null,
        fine_ratio_editorial: 'Pending',
        fine_ratio_table: '—',
        prison_months: null,
        prison_display: 'Pending',
      },
      search_blob: 'mumbai sebi interim order india',
    }),
    makeSyntheticEntry(4, {
      slug: 'singapore-crypto',
      city: 'Singapore',
      edition: 'global',
      category: 'Crypto & AI',
      publish_date: '2026-11-18T12:00:00Z',
      slap_on_wrist_score: 74,
      financials: {
        amount_usd: 150_000_000,
        amount_display: '$150M',
        fine_usd: 15_000_000,
        fine_display: '$15M',
        fine_ratio_pct: 10,
        fine_ratio_editorial: '10.00%',
        fine_ratio_table: '10.00%',
        prison_months: 0,
        prison_display: '0 days',
      },
      search_blob: 'singapore mas crypto token',
    }),
  ];

  it('matches regional bureau groupings (us, europe, global, india)', () => {
    expect(matchesEdition(sample[0], 'us')).toBe(true);
    expect(matchesEdition(sample[1], 'europe')).toBe(true);
    expect(matchesEdition(sample[3], 'global')).toBe(true);
    expect(matchesEdition(sample[2], 'india')).toBe(true);
    expect(matchesEdition(sample[2], 'us')).toBe(false);
  });

  it('filters by magnitude, wrist-slap, zero-prison, pending, and Pagefind slug union', () => {
    expect(filterAndSortLedger(sample, { minLoot: 1_000_000_000 }).map((e) => e.slug)).toEqual([
      'ny-mega-bank',
    ]);
    expect(filterAndSortLedger(sample, { slapMode: '85' }).map((e) => e.slug)).toEqual([
      'ny-mega-bank',
    ]);
    expect(filterAndSortLedger(sample, { slapMode: '70' }).map((e) => e.slug)).toEqual([
      'ny-mega-bank',
      'singapore-crypto',
    ]);
    expect(filterAndSortLedger(sample, { slapMode: 'zero-prison' }).map((e) => e.slug)).toEqual([
      'ny-mega-bank',
      'singapore-crypto',
    ]);
    expect(filterAndSortLedger(sample, { slapMode: 'pending' }).map((e) => e.slug)).toEqual([
      'mumbai-pending',
    ]);

    // Pagefind full-text body match surfaces a case even when query isn't in search_blob
    const pfHits = new Set(['frankfurt-wire']);
    expect(
      filterAndSortLedger(sample, { query: 'obscure-body-term' }, pfHits).map((e) => e.slug)
    ).toEqual(['frankfurt-wire']);
  });

  it('sorts accurately across all 5 sort modes', () => {
    expect(filterAndSortLedger(sample, { sortMode: 'newest' }).map((e) => e.slug)).toEqual([
      'mumbai-pending',
      'frankfurt-wire',
      'ny-mega-bank',
      'singapore-crypto',
    ]);
    expect(filterAndSortLedger(sample, { sortMode: 'loot-desc' }).map((e) => e.slug)).toEqual([
      'ny-mega-bank',
      'frankfurt-wire',
      'mumbai-pending',
      'singapore-crypto',
    ]);
    expect(filterAndSortLedger(sample, { sortMode: 'fine-desc' }).map((e) => e.slug)).toEqual([
      'frankfurt-wire',
      'ny-mega-bank',
      'singapore-crypto',
      'mumbai-pending',
    ]);
    expect(filterAndSortLedger(sample, { sortMode: 'slap-desc' }).map((e) => e.slug)).toEqual([
      'ny-mega-bank',
      'singapore-crypto',
      'frankfurt-wire',
      'mumbai-pending',
    ]);
    expect(filterAndSortLedger(sample, { sortMode: 'ratio-asc' }).map((e) => e.slug)).toEqual([
      'ny-mega-bank',
      'singapore-crypto',
      'frankfurt-wire',
      'mumbai-pending',
    ]);
  });

  it('computes aggregate sum(fines)/sum(loot) totals accurately', () => {
    const totals = computeFilteredTotals(sample);
    expect(totals.count).toBe(4);
    expect(totals.totalLoot).toBe(2_950_000_000);
    expect(totals.totalFines).toBe(315_000_000);
    // Fines count only resolved stages, and the ratio is over resolved scale (the indicted
    // $300M case is excluded from the denominator), matching scripts/lib/rollup.mjs.
    expect(totals.avgFineRatioPct).toBeCloseTo((315_000_000 / 2_650_000_000) * 100, 4);
  });
});

describe('selectRssItems (RSS 40-item cap)', () => {
  it('caps large archives to the latest 40 items in descending publish_date order', () => {
    const synthetic = Array.from({ length: 100 }, (_, i) => ({
      id: `fc-2026-${String(i + 1).padStart(4, '0')}`,
      publish_date: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
    }));

    const selected = selectRssItems(synthetic);
    expect(RSS_MAX_ITEMS).toBe(40);
    expect(selected).toHaveLength(40);
    expect(selected[0].id).toBe('fc-2026-0100');
    expect(selected[39].id).toBe('fc-2026-0061');
    for (let i = 1; i < selected.length; i++) {
      expect(Date.parse(selected[i - 1].publish_date)).toBeGreaterThanOrEqual(
        Date.parse(selected[i].publish_date)
      );
    }
  });
});

describe('groupArticlesByMonth & archive helpers', () => {
  it('formats YYYY-MM month labels cleanly', () => {
    expect(formatMonthLabel('2026-11')).toBe('November 2026');
    expect(formatMonthLabel('2027-01')).toBe('January 2027');
    expect(formatMonthLabel('undated')).toBe('undated');
  });

  it('groups multi-month articles in reverse-chronological order with accurate sums', async () => {
    const real = await loadAllArticles();
    const base = real[0];
    const synthetic: ArticleRecord[] = [
      { ...base, id: 'fc-1', slug: 's-1', legal_stage: 'settlement', edition_date: '2026-10-15', publish_date: '2026-10-15T12:00:00Z', financials: { ...base.financials, amount_usd: 100, fine_usd: 10 } },
      { ...base, id: 'fc-2', slug: 's-2', legal_stage: 'settlement', edition_date: '2026-12-03', publish_date: '2026-12-03T12:00:00Z', financials: { ...base.financials, amount_usd: 500, fine_usd: 50 } },
      { ...base, id: 'fc-3', slug: 's-3', legal_stage: 'settlement', edition_date: '2026-10-20', publish_date: '2026-10-20T12:00:00Z', financials: { ...base.financials, amount_usd: 200, fine_usd: 20 } },
    ];

    const groups = groupArticlesByMonth(synthetic);
    expect(groups.map((g) => g.monthKey)).toEqual(['2026-12', '2026-10']);
    expect(groups[0].label).toBe('December 2026');
    expect(groups[0].totalLootUsd).toBe(500);
    expect(groups[1].articles.map((a) => a.id)).toEqual(['fc-3', 'fc-1']);
    expect(groups[1].totalLootUsd).toBe(300);
    expect(groups[1].totalFinesUsd).toBe(30);
  });
});

describe('Real repository integration (ledger index & credits directory)', () => {
  it('builds a complete, XSS-safe ledger index matching site-wide rollup totals', async () => {
    const [articles, { manifest }] = await Promise.all([loadAllArticles(), getPaintRefLookup()]);
    const entries = buildLedgerEntries(articles, manifest);
    const rollup = computeRollupFromArticles(articles);
    const totals = computeFilteredTotals(entries);

    expect(entries).toHaveLength(articles.length);
    expect(totals.count).toBe(rollup.total_cases);
    expect(totals.totalLoot).toBe(rollup.total_loot_usd);
    // Resolved-only fines semantics arrive with the shared rollup (total_loot_resolved_usd);
    // older rollups summed frozen sums in pending cases as fines, which the ledger no longer does.
    if ('total_loot_resolved_usd' in rollup) {
      expect(totals.totalFines).toBe(rollup.total_fines_usd);
      expect(totals.avgFineRatioPct).toBeCloseTo(rollup.avg_fine_ratio_pct, 1);
    }

    for (const entry of entries) {
      expect(entry.paintRef.refImage).toMatch(/^\/paint-refs\/.+\.jpg$/);
      expect(entry.url).toMatch(/^\/(article|opinion)\//);
    }
  });

  it('builds searchable & paginated reference portrait credits with valid licenses', async () => {
    const [articles, { manifest }] = await Promise.all([loadAllArticles(), getPaintRefLookup()]);
    const credits = buildCreditEntries(articles, manifest);
    const summary = summarizeLicenses(credits);

    expect(credits.length).toBeGreaterThanOrEqual(articles.length);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.reduce((sum, item) => sum + item.count, 0)).toBe(credits.length);

    const firstLicense = summary[0].license;
    const byLicense = filterCreditEntries(credits, '', firstLicense);
    expect(byLicense).toHaveLength(summary[0].count);

    const paged = paginateItems(credits, 1, CREDITS_PAGE_SIZE);
    expect(paged.items.length).toBeLessThanOrEqual(CREDITS_PAGE_SIZE);
  });
});
