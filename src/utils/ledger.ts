import type { ArticleRecord } from '../schemas/article';
import type { PaletteMood, PaintRefManifestEntry, ToyKind } from '../painting/types';
import { accentToMood } from '../painting/palette';
import {
  formatBroadsheetDate,
  formatFineRatio,
  formatLegalStage,
  formatShortDate,
  isResolvedStage,
  stageFineRatio,
} from './format';

export const LEDGER_PAGE_SIZE = 24;
export const RSS_MAX_ITEMS = 40;
export const CREDITS_PAGE_SIZE = 30;

export type LedgerSortMode = 'newest' | 'loot-desc' | 'fine-desc' | 'slap-desc' | 'ratio-asc';
export type LedgerSlapMode = 'all' | '70' | '85' | 'zero-prison' | 'pending';

export interface LedgerPaintSummary {
  slug: string;
  refImage?: string;
  isPortrait: boolean;
  focalPoint?: { u: number; v: number };
  paletteMood: PaletteMood;
  toyKind: ToyKind;
  toyText?: string;
  toySubtext?: string;
  monochrome: boolean;
  alt: string;
}

export interface LedgerEntry {
  id: string;
  slug: string;
  url: string;
  headline: string;
  deck: string;
  city: string;
  edition: string;
  category: string;
  agencies: string[];
  docket_number: string | null;
  legal_stage: string;
  legal_stage_label: string;
  /** A penalty was imposed (settlement / regulatory order / sentence / DPA). */
  resolved?: boolean;
  template: string;
  publish_date: string;
  short_date: string;
  broadsheet_date: string;
  slap_on_wrist_score: number | null;
  financials: {
    amount_usd: number | null;
    amount_display: string;
    fine_usd: number | null;
    fine_display: string;
    fine_ratio_pct: number | null;
    fine_ratio_editorial: string;
    fine_ratio_table: string;
    prison_months: number | null;
    prison_display: string;
  };
  search_blob: string;
  paintRef: LedgerPaintSummary;
}

export interface LedgerFilters {
  query?: string;
  edition?: string;
  category?: string;
  minLoot?: number;
  slapMode?: string;
  sortMode?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

export interface FilteredTotals {
  count: number;
  totalLoot: number;
  totalFines: number;
  avgFineRatioPct: number;
}

export interface MonthArchiveGroup {
  monthKey: string;
  label: string;
  articles: ArticleRecord[];
  totalLootUsd: number;
  totalFinesUsd: number;
}

export interface CreditEntry {
  slug: string;
  headline: string;
  href: string | null;
  subject: string;
  sourceUrl: string | null;
  sourceLicense: string;
  searchBlob: string;
}

export interface LicenseSummary {
  license: string;
  count: number;
}

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function buildLedgerSearchBlob(
  article: Pick<
    ArticleRecord,
    'headline' | 'deck' | 'city' | 'edition' | 'category' | 'agencies' | 'docket_number' | 'jurisdiction' | 'byline'
  >
): string {
  return [
    article.headline,
    article.deck,
    article.city,
    article.edition,
    article.category,
    article.agencies.join(' '),
    article.docket_number ?? '',
    article.jurisdiction.venue,
    article.byline,
  ]
    .join(' ')
    .toLowerCase();
}

export function buildLedgerEntries(
  articles: ArticleRecord[],
  paintRefs: Record<string, PaintRefManifestEntry>
): LedgerEntry[] {
  return articles.map((article) => {
    const ref = paintRefs[article.slug];
    const spec = article.interactive_art_spec;
    const isMonochrome =
      spec?.theme === 'monochrome' ||
      article.template === 'opinion' ||
      ref?.paletteMood === 'monochrome-noir';
    const paletteMood: PaletteMood = isMonochrome
      ? 'monochrome-noir'
      : (ref?.paletteMood ?? accentToMood(spec?.accent, spec?.theme));
    const alt =
      ref?.alt ||
      (ref?.subject
        ? `Impressionist oil painting of ${ref.subject}`
        : spec?.caption || 'Impressionist editorial oil painting by The Financial Crimes');

    return {
      id: article.id,
      slug: article.slug,
      url: article.url,
      headline: article.headline,
      deck: article.deck,
      city: article.city,
      edition: article.edition.toLowerCase(),
      category: article.category,
      agencies: article.agencies,
      docket_number: article.docket_number,
      legal_stage: article.legal_stage,
      legal_stage_label: formatLegalStage(article.legal_stage),
      resolved: isResolvedStage(article.legal_stage),
      template: article.template,
      publish_date: article.publish_date,
      short_date: formatShortDate(article.publish_date),
      broadsheet_date: formatBroadsheetDate(article.publish_date),
      slap_on_wrist_score: article.slap_on_wrist_score,
      financials: {
        amount_usd: article.financials.amount_usd,
        amount_display: article.financials.amount_display,
        fine_usd: article.financials.fine_usd,
        fine_display: article.financials.fine_display,
        // Pending cases have no penalty: frozen / escrowed sums never become a fine ratio
        fine_ratio_pct: stageFineRatio(article),
        fine_ratio_editorial: formatFineRatio(stageFineRatio(article), 'Pending'),
        fine_ratio_table: formatFineRatio(stageFineRatio(article), '—'),
        prison_months: article.financials.prison_months,
        prison_display: article.financials.prison_display,
      },
      search_blob: buildLedgerSearchBlob(article),
      paintRef: {
        slug: article.slug,
        refImage: ref?.refImage,
        isPortrait: ref?.isPortrait ?? true,
        focalPoint: ref?.focalPoint,
        paletteMood,
        toyKind: ref?.toyKind ?? 'stamp',
        toyText: ref?.toyText,
        toySubtext: ref?.toySubtext,
        monochrome: isMonochrome,
        alt,
      },
    };
  });
}

export function matchesEdition(
  entry: Pick<LedgerEntry, 'edition' | 'city'>,
  editionKey: string
): boolean {
  const key = (editionKey || 'all').toLowerCase();
  if (key === 'all') return true;
  const ed = entry.edition.toLowerCase();
  const city = entry.city.toLowerCase();
  if (key === 'us') return ['us', 'new-york', 'chicago', 'los-angeles'].includes(ed);
  if (key === 'europe') return ed === 'europe' || ed === 'london' || city.includes('frankfurt');
  if (key === 'global') {
    return ed === 'global' || city.includes('singapore') || city.includes('hong kong');
  }
  return ed === key || city.includes(key.replace('-', ' '));
}

export function compareLedgerEntries(a: LedgerEntry, b: LedgerEntry, sortMode: string): number {
  if (sortMode === 'loot-desc') {
    const diff = (b.financials.amount_usd ?? 0) - (a.financials.amount_usd ?? 0);
    if (diff !== 0) return diff;
  } else if (sortMode === 'fine-desc') {
    const diff = (b.financials.fine_usd ?? 0) - (a.financials.fine_usd ?? 0);
    if (diff !== 0) return diff;
  } else if (sortMode === 'slap-desc') {
    const diff = (b.slap_on_wrist_score ?? -1) - (a.slap_on_wrist_score ?? -1);
    if (diff !== 0) return diff;
  } else if (sortMode === 'ratio-asc') {
    const ra = a.financials.fine_ratio_pct ?? -1;
    const rb = b.financials.fine_ratio_pct ?? -1;
    const va = ra < 0 ? 999999 : ra;
    const vb = rb < 0 ? 999999 : rb;
    if (va !== vb) return va - vb;
  }

  const dateDiff = (Date.parse(b.publish_date) || 0) - (Date.parse(a.publish_date) || 0);
  if (dateDiff !== 0) return dateDiff;
  return a.id.localeCompare(b.id);
}

export function filterAndSortLedger(
  entries: LedgerEntry[],
  filters: LedgerFilters,
  pagefindSlugs: Set<string> | null = null
): LedgerEntry[] {
  const q = (filters.query ?? '').trim().toLowerCase();
  const ed = (filters.edition ?? 'all').toLowerCase();
  const cat = filters.category ?? 'all';
  const minLoot = Number(filters.minLoot ?? 0);
  const slapMode = filters.slapMode ?? 'all';
  const sortMode = filters.sortMode ?? 'newest';

  const filtered = entries.filter((entry) => {
    if (q) {
      const localMatch = entry.search_blob.includes(q);
      const pfMatch = pagefindSlugs ? pagefindSlugs.has(entry.slug) : false;
      if (!localMatch && !pfMatch) return false;
    }

    if (!matchesEdition(entry, ed)) return false;
    if (cat !== 'all' && entry.category !== cat) return false;

    const loot = entry.financials.amount_usd ?? 0;
    if (minLoot > 0 && loot < minLoot) return false;

    const slap = entry.slap_on_wrist_score ?? -1;
    const prison = entry.financials.prison_months ?? -1;
    if (slapMode === '70' && slap < 70) return false;
    if (slapMode === '85' && slap < 85) return false;
    if (slapMode === 'zero-prison' && prison !== 0) return false;
    if (slapMode === 'pending' && slap >= 0) return false;

    return true;
  });

  return filtered.sort((a, b) => compareLedgerEntries(a, b, sortMode));
}

export function paginateItems<T>(
  items: T[],
  requestedPage: number,
  pageSize = LEDGER_PAGE_SIZE
): PaginatedResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const parsedPage = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.min(totalPages, Math.max(1, parsedPage));

  if (totalItems === 0) {
    return {
      items: [],
      page: 1,
      pageSize: safePageSize,
      totalItems: 0,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
    };
  }

  const offset = (page - 1) * safePageSize;
  const slice = items.slice(offset, offset + safePageSize);
  return {
    items: slice,
    page,
    pageSize: safePageSize,
    totalItems,
    totalPages,
    startIndex: offset + 1,
    endIndex: offset + slice.length,
  };
}

/**
 * Ledger totals, matching the site rollup (scripts/lib/rollup.mjs): loot is the full alleged +
 * adjudicated scale, but fines count only resolved-stage cases (money frozen in a pending case
 * is not a fine), and the ratio is resolved fines over resolved scale.
 */
export function computeFilteredTotals(entries: LedgerEntry[]): FilteredTotals {
  let totalLoot = 0;
  let resolvedLoot = 0;
  let totalFines = 0;
  let ratioSum = 0;
  let ratioCount = 0;

  for (const entry of entries) {
    const resolved = entry.resolved ?? isResolvedStage(entry.legal_stage);
    const loot = entry.financials.amount_usd ?? 0;
    totalLoot += loot;
    if (!resolved) continue;
    resolvedLoot += loot;
    totalFines += entry.financials.fine_usd ?? 0;
    const r = entry.financials.fine_ratio_pct;
    if (typeof r === 'number' && Number.isFinite(r) && r >= 0) {
      ratioSum += r;
      ratioCount++;
    }
  }

  const avgFineRatioPct =
    resolvedLoot > 0
      ? (totalFines / resolvedLoot) * 100
      : ratioCount > 0
        ? ratioSum / ratioCount
        : 0;

  return {
    count: entries.length,
    totalLoot,
    totalFines,
    avgFineRatioPct,
  };
}

export function selectRssItems<T extends Pick<ArticleRecord, 'publish_date' | 'id'>>(
  articles: T[],
  limit = RSS_MAX_ITEMS
): T[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  return [...articles]
    .sort((a, b) => {
      const dateDiff = (Date.parse(b.publish_date) || 0) - (Date.parse(a.publish_date) || 0);
      if (dateDiff !== 0) return dateDiff;
      return a.id.localeCompare(b.id);
    })
    .slice(0, safeLimit);
}

export function formatMonthLabel(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return monthKey;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${FULL_MONTHS[monthIdx]} ${year}`;
}

export function groupArticlesByMonth(articles: ArticleRecord[]): MonthArchiveGroup[] {
  const buckets = new Map<string, ArticleRecord[]>();

  for (const article of articles) {
    const rawDate = article.edition_date || article.publish_date.slice(0, 10);
    const monthKey = /^\d{4}-\d{2}/.test(rawDate) ? rawDate.slice(0, 7) : 'undated';
    const list = buckets.get(monthKey) ?? [];
    list.push(article);
    buckets.set(monthKey, list);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, grouped]) => {
      const sorted = [...grouped].sort((a, b) => {
        const dateDiff = (Date.parse(b.publish_date) || 0) - (Date.parse(a.publish_date) || 0);
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
      });
      return {
        monthKey,
        label: formatMonthLabel(monthKey),
        articles: sorted,
        totalLootUsd: sorted.reduce((sum, a) => sum + (a.financials.amount_usd ?? 0), 0),
        // Fines only where a penalty was imposed (frozen sums in pending cases excluded)
        totalFinesUsd: sorted.reduce(
          (sum, a) => sum + (isResolvedStage(a.legal_stage) ? (a.financials.fine_usd ?? 0) : 0),
          0,
        ),
      };
    });
}

export function buildCreditEntries(
  articles: ArticleRecord[],
  paintRefs: Record<string, PaintRefManifestEntry>
): CreditEntry[] {
  const articleBySlug = new Map(articles.map((a) => [a.slug, a]));

  return Object.entries(paintRefs)
    // A retracted story's portrait is no longer shown anywhere, so its credit row goes too
    .filter(([slug]) => !isArticleRetracted(articleBySlug.get(slug)))
    .map(([slug, ref]) => {
      const article = articleBySlug.get(slug);
      const headline = article?.headline ?? slug;
      const subject = ref.subject ?? 'Editorial reference study';
      const sourceLicense = ref.sourceLicense ?? 'Public Reference';
      return {
        slug,
        headline,
        href: article?.url ?? null,
        subject,
        sourceUrl: ref.sourceUrl ?? null,
        sourceLicense,
        searchBlob: `${headline} ${subject} ${sourceLicense} ${slug}`.toLowerCase(),
      };
    })
    .sort((a, b) => a.headline.localeCompare(b.headline));
}

export function filterCreditEntries(
  entries: CreditEntry[],
  query = '',
  license = 'all'
): CreditEntry[] {
  const q = query.trim().toLowerCase();
  const lic = license.trim();
  return entries.filter((entry) => {
    if (lic && lic !== 'all' && entry.sourceLicense !== lic) return false;
    if (q && !entry.searchBlob.includes(q)) return false;
    return true;
  });
}

export function summarizeLicenses(entries: CreditEntry[]): LicenseSummary[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.sourceLicense, (counts.get(entry.sourceLicense) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([license, count]) => ({ license, count }))
    .sort((a, b) => b.count - a.count || a.license.localeCompare(b.license));
}

/* ==========================================================================
   Retraction tombstones (meta.retracted = { date, note }).
   The loader (src/loaders/articles.ts) owns the canonical isRetracted(); these helpers read
   the raw field defensively so listings stay correct whichever loader version is in place.
   ========================================================================== */

export interface RetractionInfo {
  date: string;
  note: string;
}

export function getRetraction(article: object | null | undefined): RetractionInfo | null {
  const raw = (article as { retracted?: unknown } | null | undefined)?.retracted;
  if (!raw || typeof raw !== 'object') return null;
  const { date, note } = raw as { date?: unknown; note?: unknown };
  if (typeof date !== 'string' || !date.trim()) return null;
  return { date: date.trim(), note: typeof note === 'string' ? note.trim() : '' };
}

export function isArticleRetracted(article: object | null | undefined): boolean {
  return getRetraction(article) !== null;
}

/** Drop retracted articles from any listing, feed, index or aggregate. */
export function listedArticles<T extends object>(articles: readonly T[]): T[] {
  return articles.filter((article) => !isArticleRetracted(article));
}

/* ==========================================================================
   Ledger URLs: static pages (/ledger, /ledger/page/N) work without JavaScript;
   filtered views live on /ledger?… and are rendered client-side.
   ========================================================================== */

export interface LedgerUrlState {
  query?: string;
  edition?: string;
  category?: string;
  minLoot?: number | string;
  slapMode?: string;
  sortMode?: string;
  view?: string;
}

export function ledgerPagePath(page: number): string {
  const n = Math.floor(Number(page));
  return Number.isFinite(n) && n > 1 ? `/ledger/page/${n}` : '/ledger';
}

export function hasActiveLedgerFilters(state: LedgerUrlState): boolean {
  return Boolean(
    (state.query ?? '').trim() ||
      (state.edition && state.edition !== 'all') ||
      (state.category && state.category !== 'all') ||
      (state.minLoot && String(state.minLoot) !== '0') ||
      (state.slapMode && state.slapMode !== 'all') ||
      (state.sortMode && state.sortMode !== 'newest'),
  );
}

/**
 * Shareable URL for a ledger view. Unfiltered pages map onto the prerendered static paths;
 * any filter, search or sort moves to /ledger?… (q, edition, category, magnitude, slap, sort,
 * view, page).
 */
export function buildLedgerUrl(state: LedgerUrlState, page = 1): string {
  const view = state.view === 'table' ? 'table' : '';
  if (!hasActiveLedgerFilters(state)) {
    const base = ledgerPagePath(page);
    return view ? `${base}?view=table` : base;
  }
  const params = new URLSearchParams();
  const q = (state.query ?? '').trim();
  if (q) params.set('q', q);
  if (state.edition && state.edition !== 'all') params.set('edition', state.edition);
  if (state.category && state.category !== 'all') params.set('category', state.category);
  if (state.minLoot && String(state.minLoot) !== '0') params.set('magnitude', String(state.minLoot));
  if (state.slapMode && state.slapMode !== 'all') params.set('slap', state.slapMode);
  if (state.sortMode && state.sortMode !== 'newest') params.set('sort', state.sortMode);
  if (view) params.set('view', view);
  const n = Math.floor(Number(page));
  if (Number.isFinite(n) && n > 1) params.set('page', String(n));
  return `/ledger?${params.toString()}`;
}
