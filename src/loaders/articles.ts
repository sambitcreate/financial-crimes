import fs from 'node:fs/promises';
import path from 'node:path';
import { sanitizeArticleHtml } from '../utils/sanitize';
import {
  ArticleMetaSchema,
  EditionManifestSchema,
  type ArticleMeta,
  type ArticleRecord,
  type EditionManifest,
} from '../schemas/article';
import {
  computeRollup,
  isRetracted as isRetractedRaw,
  type RollupFile,
  type RollupRegion,
} from '../../scripts/lib/rollup.mjs';

/**
 * Full rollup shape produced by scripts/lib/rollup.mjs. A superset of the schema's RollupStats:
 * adds resolved/alleged loot split, frozen (unresolved-case) money and case-status counts.
 */
export type LedgerRollup = RollupFile;
export type LedgerRollupRegion = RollupRegion;

const PROJECT_ROOT = process.cwd();
const CONTENT_ROOT = path.join(PROJECT_ROOT, 'content');
const ARTICLES_ROOT = path.join(CONTENT_ROOT, 'articles');
const EDITIONS_ROOT = path.join(CONTENT_ROOT, 'editions');
const ROLLUP_PATH = path.join(CONTENT_ROOT, 'ledger', 'rollup-stats.json');

let cachedArticlesPromise: Promise<ArticleRecord[]> | null = null;
let cachedListedPromise: Promise<ArticleRecord[]> | null = null;
let cachedEditionsPromise: Promise<EditionManifest[]> | null = null;
let cachedRollupPromise: Promise<LedgerRollup> | null = null;
const cachedEditionByDate = new Map<string, Promise<EditionManifest | null>>();

export function clearArticleCache(): void {
  cachedArticlesPromise = null;
  cachedListedPromise = null;
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

/**
 * True when the article carries a retraction tombstone (`retracted: { date, note }`).
 * Retracted articles stay in the content tree (their URL renders a retraction notice and keeps the
 * corrections trail) but are excluded from listings, RSS, the ledger and every rollup total.
 */
export function isRetracted(article: object | null | undefined): boolean {
  return isRetractedRaw(article as { retracted?: unknown } | null | undefined);
}

/**
 * Rollup computed by the shared scripts/lib/rollup.mjs definition. Fines count only resolved-stage
 * articles; frozen/escrowed money in unresolved cases is reported as `total_frozen_usd`; retracted
 * articles are excluded. `edition_date` is the newest dated edition when `editions` is supplied
 * (falls back to the newest article edition_date otherwise).
 */
export function computeRollupFromArticles(
  articles: ArticleRecord[],
  asOf?: string,
  editions: ReadonlyArray<Pick<EditionManifest, 'edition_date'>> = []
): LedgerRollup {
  return {
    as_of: asOf ?? new Date().toISOString(),
    ...computeRollup(articles, { editions }),
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

  const seen = new Map<string, string>();
  for (const article of articles) {
    const prior = seen.get(article.slug);
    if (prior) {
      throw new Error(
        `Duplicate article slug "${article.slug}" in ${prior} and ${article.contentDir}; slugs must be unique site-wide.`
      );
    }
    seen.set(article.slug, article.contentDir);
  }

  return articles.sort((a, b) => {
    const dateCmp = (Date.parse(b.publish_date) || 0) - (Date.parse(a.publish_date) || 0);
    if (dateCmp !== 0) return dateCmp;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Every article on disk INCLUDING retracted ones. Use for per-article page generation (so a
 * retracted URL renders its tombstone instead of 404ing) and for /corrections.
 */
export function loadAllArticlesIncludingRetracted(): Promise<ArticleRecord[]> {
  if (!cachedArticlesPromise) {
    cachedArticlesPromise = readAllArticlesFromDisk().catch((err) => {
      cachedArticlesPromise = null;
      throw err;
    });
  }
  return cachedArticlesPromise;
}

/**
 * Listed (non-retracted) articles, newest first. Use for homepage, ledger, archive, RSS, search
 * indexes and any other listing or aggregate.
 */
export function loadAllArticles(): Promise<ArticleRecord[]> {
  if (!cachedListedPromise) {
    cachedListedPromise = loadAllArticlesIncludingRetracted()
      .then((all) => all.filter((article) => !isRetracted(article)))
      .catch((err) => {
        cachedListedPromise = null;
        throw err;
      });
  }
  return cachedListedPromise;
}

/** One article by slug, including retracted articles (the caller renders the tombstone). */
export async function loadArticleBySlug(slug: string): Promise<ArticleRecord | null> {
  const all = await loadAllArticlesIncludingRetracted();
  return all.find((article) => article.slug === slug) ?? null;
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

/**
 * The rollup is always recomputed from content (articles + dated editions) so the site can never
 * render stale or hand-edited totals. content/ledger/rollup-stats.json supplies only `as_of`; its
 * body is kept in parity by `npm run rollup:recompute` and enforced by tests/validation.
 */
async function readRollupStats(): Promise<LedgerRollup> {
  const [articles, editions] = await Promise.all([
    loadAllArticlesIncludingRetracted(),
    loadAllEditions(),
  ]);
  let asOf: string | undefined;
  if (await pathExists(ROLLUP_PATH)) {
    const disk: unknown = JSON.parse(await fs.readFile(ROLLUP_PATH, 'utf-8'));
    const value = (disk as { as_of?: unknown } | null)?.as_of;
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) asOf = value;
  }
  return computeRollupFromArticles(articles, asOf, editions);
}

export function loadRollupStats(): Promise<LedgerRollup> {
  if (!cachedRollupPromise) {
    cachedRollupPromise = readRollupStats().catch((err) => {
      cachedRollupPromise = null;
      throw err;
    });
  }
  return cachedRollupPromise;
}
