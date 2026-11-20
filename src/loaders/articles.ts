import fs from 'node:fs/promises';
import path from 'node:path';
import { formatUsdShort } from '../utils/format';
import { sanitizeArticleHtml } from '../utils/sanitize';
import {
  ArticleMetaSchema,
  EditionManifestSchema,
  RollupStatsSchema,
  type ArticleMeta,
  type ArticleRecord,
  type EditionManifest,
  type RegionalRollup,
  type RollupStats,
} from '../schemas/article';

const PROJECT_ROOT = process.cwd();
const CONTENT_ROOT = path.join(PROJECT_ROOT, 'content');
const ARTICLES_ROOT = path.join(CONTENT_ROOT, 'articles');
const EDITIONS_ROOT = path.join(CONTENT_ROOT, 'editions');
const ROLLUP_PATH = path.join(CONTENT_ROOT, 'ledger', 'rollup-stats.json');

const REGION_LABELS: Record<string, string> = {
  us: 'U.S.',
  'new-york': 'NEW YORK',
  chicago: 'CHICAGO',
  'los-angeles': 'L.A.',
  london: 'LONDON',
  india: 'INDIA',
  europe: 'EUROPE',
  global: 'GLOBAL',
};

const REGION_ORDER = ['us', 'new-york', 'chicago', 'los-angeles', 'london', 'india', 'europe'] as const;
const US_EDITIONS = new Set(['us', 'new-york', 'chicago', 'los-angeles']);

let cachedArticlesPromise: Promise<ArticleRecord[]> | null = null;
let cachedEditionsPromise: Promise<EditionManifest[]> | null = null;
let cachedRollupPromise: Promise<RollupStats> | null = null;
const cachedEditionByDate = new Map<string, Promise<EditionManifest | null>>();

export function clearArticleCache(): void {
  cachedArticlesPromise = null;
  cachedEditionsPromise = null;
  cachedRollupPromise = null;
  cachedEditionByDate.clear();
}

export function getArticleHref(article: Pick<ArticleMeta, 'slug' | 'template'>): string {
  return article.template === 'opinion'
    ? `/opinion/${article.slug}`
    : `/article/${article.slug}`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findArticleDirs(dir: string): Promise<string[]> {
  if (!(await pathExists(dir))) {
    return [];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const hasMeta = entries.some((entry) => entry.isFile() && entry.name === 'meta.json');
  if (hasMeta) {
    return [dir];
  }

  const nested: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const childDirs = await findArticleDirs(path.join(dir, entry.name));
      nested.push(...childDirs);
    }
  }
  return nested;
}

/** Fines as a share of loot, aggregated (sum/sum) - the one ratio definition used site-wide. */
function aggregateRatioPct(fines: number, loot: number): number | null {
  return loot > 0 ? Number(((fines / loot) * 100).toFixed(2)) : null;
}

function formatRollupUsd(value: number): string {
  return formatUsdShort(value, { B: 2, M: 1, K: 0 });
}

export function computeRollupFromArticles(
  articles: ArticleRecord[],
  asOf?: string
): RollupStats {
  const totalLootUsd = articles.reduce((sum, a) => sum + (a.financials.amount_usd ?? 0), 0);
  const totalFinesUsd = articles.reduce((sum, a) => sum + (a.financials.fine_usd ?? 0), 0);

  const avgFineRatioPct = aggregateRatioPct(totalFinesUsd, totalLootUsd) ?? 0;

  const scores = articles
    .map((a) => a.slap_on_wrist_score)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgSlapScore =
    scores.length > 0
      ? Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1))
      : 0;

  const zeroPrisonCases = articles.filter(
    (a) => a.financials.prison_months === 0
  ).length;

  const regionBuckets = new Map<string, ArticleRecord[]>();
  for (const article of articles) {
    const key = article.edition.toLowerCase();
    const bucketKeys = new Set<string>([key]);
    if (US_EDITIONS.has(key)) {
      bucketKeys.add('us');
    }
    for (const bucketKey of bucketKeys) {
      if (bucketKey === 'global') continue;
      const bucket = regionBuckets.get(bucketKey) ?? [];
      bucket.push(article);
      regionBuckets.set(bucketKey, bucket);
    }
  }

  const orderedKeys = [
    ...REGION_ORDER.filter((k) => regionBuckets.has(k)),
    ...[...regionBuckets.keys()].filter(
      (k) => !(REGION_ORDER as readonly string[]).includes(k)
    ).sort(),
  ];

  const regions: Record<string, RegionalRollup> = {};
  for (const key of orderedKeys) {
    const list = regionBuckets.get(key) ?? [];
    const loot = list.reduce((sum, a) => sum + (a.financials.amount_usd ?? 0), 0);
    const fines = list.reduce((sum, a) => sum + (a.financials.fine_usd ?? 0), 0);
    regions[key] = {
      label: REGION_LABELS[key] ?? key.toUpperCase(),
      case_count: list.length,
      total_loot_usd: loot,
      total_loot_display: formatRollupUsd(loot),
      total_fines_usd: fines,
      total_fines_display: formatRollupUsd(fines),
      avg_fine_ratio_pct: aggregateRatioPct(fines, loot),
    };
  }

  regions.global = {
    label: 'GLOBAL',
    case_count: articles.length,
    total_loot_usd: totalLootUsd,
    total_loot_display: formatRollupUsd(totalLootUsd),
    total_fines_usd: totalFinesUsd,
    total_fines_display: formatRollupUsd(totalFinesUsd),
    avg_fine_ratio_pct: avgFineRatioPct,
  };

  const latestEditionDate = articles[0]?.edition_date ?? '2026-11-19';

  return {
    as_of: asOf ?? new Date().toISOString(),
    edition_date: latestEditionDate,
    total_cases: articles.length,
    total_loot_usd: totalLootUsd,
    total_loot_display: formatRollupUsd(totalLootUsd),
    total_fines_usd: totalFinesUsd,
    total_fines_display: formatRollupUsd(totalFinesUsd),
    avg_fine_ratio_pct: avgFineRatioPct,
    avg_slap_on_wrist_score: avgSlapScore,
    zero_prison_cases: zeroPrisonCases,
    regions,
  };
}

async function readAllArticlesFromDisk(): Promise<ArticleRecord[]> {
  const dirs = await findArticleDirs(ARTICLES_ROOT);
  const articles: ArticleRecord[] = [];

  for (const dir of dirs) {
    const metaPath = path.join(dir, 'meta.json');
    const bodyPath = path.join(dir, 'body.html');

    const [rawMeta, rawHtml] = await Promise.all([
      fs.readFile(metaPath, 'utf-8'),
      fs.readFile(bodyPath, 'utf-8'),
    ]);

    const parsedJson: unknown = JSON.parse(rawMeta);
    const meta = ArticleMetaSchema.parse(parsedJson);

    articles.push({
      ...meta,
      bodyHtml: sanitizeArticleHtml(rawHtml),
      url: getArticleHref(meta),
      contentDir: path.relative(PROJECT_ROOT, dir),
    });
  }

  return articles.sort((a, b) => {
    const dateCmp = (Date.parse(b.publish_date) || 0) - (Date.parse(a.publish_date) || 0);
    if (dateCmp !== 0) return dateCmp;
    return a.id.localeCompare(b.id);
  });
}

export function loadAllArticles(): Promise<ArticleRecord[]> {
  if (!cachedArticlesPromise) {
    cachedArticlesPromise = readAllArticlesFromDisk().catch((err) => {
      cachedArticlesPromise = null;
      throw err;
    });
  }
  return cachedArticlesPromise;
}

async function readEditionFromDisk(date?: string): Promise<EditionManifest | null> {
  if (!(await pathExists(EDITIONS_ROOT))) {
    return null;
  }

  let targetPath: string | null = null;
  if (date) {
    const candidate = path.join(EDITIONS_ROOT, `${date}.json`);
    if (await pathExists(candidate)) {
      targetPath = candidate;
    }
  } else {
    const latestPath = path.join(EDITIONS_ROOT, 'latest.json');
    if (await pathExists(latestPath)) {
      targetPath = latestPath;
    } else {
      const files = (await fs.readdir(EDITIONS_ROOT))
        .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
        .sort()
        .reverse();
      if (files.length > 0) {
        targetPath = path.join(EDITIONS_ROOT, files[0]);
      }
    }
  }

  if (!targetPath) {
    return null;
  }

  const raw = await fs.readFile(targetPath, 'utf-8');
  return EditionManifestSchema.parse(JSON.parse(raw));
}

export function loadEdition(date?: string): Promise<EditionManifest | null> {
  const key = date ?? '__latest__';
  let promise = cachedEditionByDate.get(key);
  if (!promise) {
    promise = readEditionFromDisk(date).catch((err) => {
      cachedEditionByDate.delete(key);
      throw err;
    });
    cachedEditionByDate.set(key, promise);
  }
  return promise;
}

async function readAllEditionsFromDisk(): Promise<EditionManifest[]> {
  if (!(await pathExists(EDITIONS_ROOT))) {
    return [];
  }

  const files = (await fs.readdir(EDITIONS_ROOT))
    .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
    .sort()
    .reverse();

  const editions: EditionManifest[] = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(EDITIONS_ROOT, file), 'utf-8');
    editions.push(EditionManifestSchema.parse(JSON.parse(raw)));
  }
  return editions;
}

export function loadAllEditions(): Promise<EditionManifest[]> {
  if (!cachedEditionsPromise) {
    cachedEditionsPromise = readAllEditionsFromDisk().catch((err) => {
      cachedEditionsPromise = null;
      throw err;
    });
  }
  return cachedEditionsPromise;
}

async function readRollupStatsFromDisk(): Promise<RollupStats> {
  if (await pathExists(ROLLUP_PATH)) {
    const raw = await fs.readFile(ROLLUP_PATH, 'utf-8');
    const rollup = RollupStatsSchema.parse(JSON.parse(raw));
    for (const region of Object.values(rollup.regions)) {
      region.avg_fine_ratio_pct =
        aggregateRatioPct(region.total_fines_usd, region.total_loot_usd) ?? region.avg_fine_ratio_pct;
    }
    return rollup;
  }
  const articles = await loadAllArticles();
  return computeRollupFromArticles(articles);
}

export function loadRollupStats(): Promise<RollupStats> {
  if (!cachedRollupPromise) {
    cachedRollupPromise = readRollupStatsFromDisk().catch((err) => {
      cachedRollupPromise = null;
      throw err;
    });
  }
  return cachedRollupPromise;
}
