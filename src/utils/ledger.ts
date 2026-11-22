import type { ArticleRecord } from '../schemas/article';
import type { PaletteMood, PaintRefManifestEntry, ToyKind } from '../painting/types';
import { accentToMood } from '../painting/palette';
import {
  formatBroadsheetDate,
  formatFineRatio,
  formatLegalStage,
  formatShortDate,
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
        fine_ratio_pct: article.financials.fine_ratio_pct,
        fine_ratio_editorial: formatFineRatio(article.financials.fine_ratio_pct, 'Pending'),
        fine_ratio_table: formatFineRatio(article.financials.fine_ratio_pct, '—'),
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

export function computeFilteredTotals(entries: LedgerEntry[]): FilteredTotals {
  let totalLoot = 0;
  let totalFines = 0;
  let ratioSum = 0;
  let ratioCount = 0;

  for (const entry of entries) {
    totalLoot += entry.financials.amount_usd ?? 0;
    totalFines += entry.financials.fine_usd ?? 0;
    const r = entry.financials.fine_ratio_pct;
    if (typeof r === 'number' && Number.isFinite(r) && r >= 0) {
      ratioSum += r;
      ratioCount++;
    }
  }

  const avgFineRatioPct =
    totalLoot > 0
      ? (totalFines / totalLoot) * 100
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
        totalFinesUsd: sorted.reduce((sum, a) => sum + (a.financials.fine_usd ?? 0), 0),
      };
    });
}

export function buildCreditEntries(
  articles: ArticleRecord[],
  paintRefs: Record<string, PaintRefManifestEntry>
): CreditEntry[] {
  const articleBySlug = new Map(articles.map((a) => [a.slug, a]));

  return Object.entries(paintRefs)
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
