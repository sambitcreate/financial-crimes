import fs from 'node:fs/promises';
import path from 'node:path';
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

function formatUsdShort(value: number): string {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

export function computeRollupFromArticles(articles: ArticleRecord[]): RollupStats {
  const totalLootUsd = articles.reduce((sum, a) => sum + (a.financials.amount_usd ?? 0), 0);
  const totalFinesUsd = articles.reduce((sum, a) => sum + (a.financials.fine_usd ?? 0), 0);

  const fineRatios = articles
    .map((a) => a.financials.fine_ratio_pct)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const avgFineRatioPct =
    fineRatios.length > 0
      ? Number((fineRatios.reduce((s, v) => s + v, 0) / fineRatios.length).toFixed(2))
      : totalLootUsd > 0
        ? Number(((totalFinesUsd / totalLootUsd) * 100).toFixed(2))
        : 0;

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
    const bucket = regionBuckets.get(key) ?? [];
    bucket.push(article);
    regionBuckets.set(key, bucket);
  }

  const regions: Record<string, RegionalRollup> = {};
  for (const [key, list] of regionBuckets.entries()) {
    const loot = list.reduce((sum, a) => sum + (a.financials.amount_usd ?? 0), 0);
    const fines = list.reduce((sum, a) => sum + (a.financials.fine_usd ?? 0), 0);
    const ratios = list
      .map((a) => a.financials.fine_ratio_pct)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    regions[key] = {
      label: key.toUpperCase(),
      case_count: list.length,
      total_loot_usd: loot,
      total_loot_display: formatUsdShort(loot),
      total_fines_usd: fines,
      total_fines_display: formatUsdShort(fines),
      avg_fine_ratio_pct:
        ratios.length > 0
          ? Number((ratios.reduce((s, v) => s + v, 0) / ratios.length).toFixed(2))
          : null,
    };
  }

  regions.global = {
    label: 'GLOBAL',
    case_count: articles.length,
    total_loot_usd: totalLootUsd,
    total_loot_display: formatUsdShort(totalLootUsd),
    total_fines_usd: totalFinesUsd,
    total_fines_display: formatUsdShort(totalFinesUsd),
    avg_fine_ratio_pct: avgFineRatioPct,
  };

  const latestEditionDate = articles[0]?.edition_date ?? '2026-11-19';

  return {
    as_of: new Date().toISOString(),
    edition_date: latestEditionDate,
    total_cases: articles.length,
    total_loot_usd: totalLootUsd,
    total_loot_display: formatUsdShort(totalLootUsd),
    total_fines_usd: totalFinesUsd,
    total_fines_display: formatUsdShort(totalFinesUsd),
    avg_fine_ratio_pct: avgFineRatioPct,
    avg_slap_on_wrist_score: avgSlapScore,
    zero_prison_cases: zeroPrisonCases,
    regions,
  };
}

export async function loadAllArticles(): Promise<ArticleRecord[]> {
  const dirs = await findArticleDirs(ARTICLES_ROOT);
  const articles: ArticleRecord[] = [];

  for (const dir of dirs) {
    const metaPath = path.join(dir, 'meta.json');
    const bodyPath = path.join(dir, 'body.html');

    const [rawMeta, bodyHtml] = await Promise.all([
      fs.readFile(metaPath, 'utf-8'),
      fs.readFile(bodyPath, 'utf-8'),
    ]);

    const parsedJson: unknown = JSON.parse(rawMeta);
    const meta = ArticleMetaSchema.parse(parsedJson);

    articles.push({
      ...meta,
      bodyHtml: bodyHtml.trim(),
      url: getArticleHref(meta),
      contentDir: path.relative(PROJECT_ROOT, dir),
    });
  }

  return articles.sort((a, b) => {
    const dateCmp = b.publish_date.localeCompare(a.publish_date);
    if (dateCmp !== 0) return dateCmp;
    return a.id.localeCompare(b.id);
  });
}

export async function loadArticleBySlug(slug: string): Promise<ArticleRecord | null> {
  const all = await loadAllArticles();
  return all.find((article) => article.slug === slug) ?? null;
}

export async function loadEdition(date?: string): Promise<EditionManifest | null> {
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

export async function loadAllEditions(): Promise<EditionManifest[]> {
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

export async function loadRollupStats(): Promise<RollupStats> {
  if (await pathExists(ROLLUP_PATH)) {
    const raw = await fs.readFile(ROLLUP_PATH, 'utf-8');
    return RollupStatsSchema.parse(JSON.parse(raw));
  }
  const articles = await loadAllArticles();
  return computeRollupFromArticles(articles);
}
