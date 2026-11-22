import fs from 'node:fs/promises';
import path from 'node:path';
import type { PaintRefManifestEntry } from './types';
import { loadAllArticles } from '../loaders/articles';
import { PaintRefsManifestSchema } from '../schemas/article';

const PROJECT_ROOT = process.cwd();
const PAINT_REFS_PATH = path.join(PROJECT_ROOT, 'content', 'paint-refs.json');

interface RefLookupCache {
  manifest: Record<string, PaintRefManifestEntry>;
  idToSlug: Map<string, string>;
  captionToSlug: Map<string, string>;
}

let cachedLookup: Promise<RefLookupCache> | null = null;

/**
 * Reads and strictly parses content/paint-refs.json with the shared Zod schema.
 * Throws (failing the build) on a missing, unparseable, or schema-invalid manifest — never
 * silently renders without paintings, and never lets an unsafe sourceUrl (javascript:, http:,
 * credentials, IP literal…) reach an href.
 */
export async function readPaintRefsManifest(
  manifestPath: string = PAINT_REFS_PATH
): Promise<Record<string, PaintRefManifestEntry>> {
  let raw: string;
  try {
    raw = await fs.readFile(manifestPath, 'utf-8');
  } catch (err) {
    throw new Error(`paint-refs manifest unreadable at ${manifestPath}: ${(err as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `paint-refs manifest is not valid JSON (${manifestPath}): ${(err as Error).message}`
    );
  }
  const result = PaintRefsManifestSchema.safeParse(json);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    throw new Error(`paint-refs manifest failed schema validation (${manifestPath}): ${detail}`);
  }
  return result.data;
}

async function buildLookupCache(): Promise<RefLookupCache> {
  const manifest = await readPaintRefsManifest();

  const idToSlug = new Map<string, string>();
  const captionToSlug = new Map<string, string>();

  const articles = await loadAllArticles();
  for (const article of articles) {
    idToSlug.set(article.id, article.slug);
    const caption = article.interactive_art_spec?.caption?.trim();
    if (caption && !captionToSlug.has(caption)) {
      captionToSlug.set(caption, article.slug);
    }
  }

  return { manifest, idToSlug, captionToSlug };
}

export function getPaintRefLookup(): Promise<RefLookupCache> {
  if (!cachedLookup) {
    cachedLookup = buildLookupCache();
  }
  return cachedLookup;
}

export async function resolvePaintRef(params: {
  id: string;
  slug?: string;
  caption?: string;
}): Promise<{ slug: string | undefined; entry: PaintRefManifestEntry | undefined }> {
  const { manifest, idToSlug, captionToSlug } = await getPaintRefLookup();

  // 1. Explicit slug always wins
  if (params.slug) {
    const trimmed = params.slug.trim();
    if (trimmed) {
      return { slug: trimmed, entry: manifest[trimmed] };
    }
  }

  // 2. Match spec caption (handles RightRail 2x2 quad cells borrowing other articles' specs)
  const cap = params.caption?.trim();
  if (cap) {
    const byCaption = captionToSlug.get(cap);
    if (byCaption && manifest[byCaption]) {
      return { slug: byCaption, entry: manifest[byCaption] };
    }
  }

  // 3. Direct id match or base article ID extraction (e.g. "fc-2026-001-thumb" -> "fc-2026-001")
  const directById = idToSlug.get(params.id);
  if (directById) {
    return { slug: directById, entry: manifest[directById] };
  }

  const baseIdMatch = params.id.match(/^(fc-\d{4}-\d{3,})/);
  if (baseIdMatch) {
    const mapped = idToSlug.get(baseIdMatch[1]);
    if (mapped) {
      return { slug: mapped, entry: manifest[mapped] };
    }
  }

  // 4. Check if id itself starts with a known manifest slug
  if (manifest[params.id]) {
    return { slug: params.id, entry: manifest[params.id] };
  }
  for (const key of Object.keys(manifest)) {
    if (params.id.startsWith(`${key}-`)) {
      return { slug: key, entry: manifest[key] };
    }
  }

  return { slug: undefined, entry: undefined };
}
