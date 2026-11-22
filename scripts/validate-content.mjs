#!/usr/bin/env node
/**
 * Strict content & security validator for The Financial Crimes.
 * Validates:
 *  - Every content/articles/<yyyy>/<mm>/<slug>/{meta.json, body.html}
 *  - Strict sanitize-html allowlist & HTML5 AST violation detection on body.html
 *  - Strict https:// URL enforcement on sources[] and paint-refs.json
 *  - 1:1 paint-refs.json + public/paint-refs/<slug>.jpg coverage, size (> 5 KB), and JPEG magic bytes
 *  - Edition manifests under content/editions/ (including YYYY-MM-DD filename <-> edition_date match)
 *  - content/ledger/rollup-stats.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

const PROJECT_ROOT = process.cwd();
const ARTICLES_ROOT = path.join(PROJECT_ROOT, 'content', 'articles');
const EDITIONS_ROOT = path.join(PROJECT_ROOT, 'content', 'editions');
const ROLLUP_PATH = path.join(PROJECT_ROOT, 'content', 'ledger', 'rollup-stats.json');
const PAINT_REFS_JSON_PATH = path.join(PROJECT_ROOT, 'content', 'paint-refs.json');
const PAINT_REFS_DIR = path.join(PROJECT_ROOT, 'public', 'paint-refs');
const MIN_PAINT_REF_BYTES = 5 * 1024;

function isSafeHttpsUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

const GENERIC_HUB_TERMINAL_SEGMENTS = new Set([
  'news',
  'newsroom',
  'press',
  'pr',
  'press-releases',
  'news-releases',
  'media-releases',
  'recent-actions',
  'enforcement-actions',
  'enforcement',
  'litigation-releases',
  'orders',
  'orders.html',
  'publications',
  'publications.html',
  'announcements',
  'policy-statements-and-announcements',
  'index.html',
  'index.htm',
  'index.php',
  'index.aspx',
  'default.aspx',
  'massnahmen_node_en.html',
  'health-care-fraud-unit',
  'foreign-corrupt-practices-act',
]);

const REDIRECT_WRAPPER_HOSTS = new Set(['vertexaisearch.cloud.google.com']);

/**
 * Rejects generic agency newsroom hubs, bare root domains, and search redirect
 * wrappers in sources[].url so every citation resolves to a specific primary
 * release, order, or court filing.
 *
 * Returns a human-readable error reason string when rejected, or null if OK.
 */
export function findGenericHubUrlReason(url) {
  if (typeof url !== 'string') return 'URL must be a string';
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return 'Invalid URL';
  }

  const host = parsed.hostname.toLowerCase();
  if (REDIRECT_WRAPPER_HOSTS.has(host)) {
    return `redirect wrapper host "${host}" is not allowed; resolve to the canonical official URL`;
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  const hasQuery = parsed.search.length > 1;

  if (!normalizedPath && !hasQuery) {
    return 'bare root domain URL with no path or query; cite a specific press release, order, or filing';
  }

  if (!hasQuery) {
    const segments = normalizedPath.toLowerCase().split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] ?? '';
    if (GENERIC_HUB_TERMINAL_SEGMENTS.has(lastSegment)) {
      return `generic newsroom/hub path ending in "/${lastSegment}"; cite a direct deep-linked release or filing URL`;
    }
  }

  return null;
}

const HttpsUrlSchema = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .refine(isSafeHttpsUrl, 'URL must use the https:// protocol');

const LegalStageSchema = z.enum([
  'investigation',
  'civil_complaint',
  'indicted',
  'arrested',
  'interim_order',
  'guilty_plea',
  'convicted',
  'sentenced',
  'settlement',
  'regulatory_order',
  'dpa',
  'appeal',
  'dismissed',
  'acquitted',
]);

const ArticleMetaSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  publish_date: z.string().min(1),
  edition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().min(1),
  edition: z.string().min(1),
  jurisdiction: z.object({
    country_iso: z.string().min(2).max(10),
    venue: z.string().min(1),
  }),
  category: z.string().min(1),
  agencies: z.array(z.string().min(1)).min(1),
  docket_number: z.string().nullable(),
  legal_stage: LegalStageSchema,
  template: z.enum(['news', 'opinion']),
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  deck: z.string().min(1),
  byline: z.string().min(1),
  dateline: z.string().min(1),
  read_time_min: z.number().int().positive(),
  layout_slot: z.enum([
    'lead-hero',
    'lead-live',
    'lead-right',
    'lead-grid',
    'secondary-1',
    'secondary-2',
    'rail-feature',
    'rail-mini',
    'rail-opinion',
    'ledger',
  ]),
  live_updates: z
    .array(z.object({ text: z.string().min(1), ago: z.string().min(1) }))
    .optional(),
  corrections: z
    .array(
      z.object({
        date: z.string().min(1),
        note: z.string().min(1),
        type: z.enum(['correction', 'clarification', 'update']).optional(),
      })
    )
    .optional(),
  financials: z.object({
    amount_usd: z.number().nullable(),
    amount_display: z.string().min(1),
    fine_usd: z.number().nullable(),
    fine_display: z.string().min(1),
    fine_ratio_pct: z.number().nullable(),
    prison_months: z.number().nullable(),
    prison_display: z.string().min(1),
    admitted_guilt: z.boolean().nullable(),
  }),
  slap_on_wrist_score: z.number().min(0).max(100).nullable(),
  street_crime_compare: z.object({
    exec_summary: z.string().min(1),
    street_equivalent: z.string().min(1),
    street_sentence: z.string().min(1),
  }),
  sources: z
    .array(
      z.object({
        title: z.string().min(1),
        agency: z.string().min(1),
        url: HttpsUrlSchema,
        date: z.string().min(1),
      })
    )
    .min(1),
  interactive_art_spec: z.object({
    accent: z.enum(['crimson', 'slate', 'gold', 'sage']),
    theme: z.enum(['newsprint', 'monochrome']).optional(),
    caption: z.string().min(1),
    credit: z.string().optional(),
  }),
  status: z.literal('published'),
});

const PaintRefEntrySchema = z.object({
  refImage: z
    .string()
    .min(1)
    .regex(/^\/paint-refs\/[a-z0-9-]+\.jpg$/, 'refImage must be /paint-refs/<slug>.jpg'),
  subject: z.string().min(1),
  sourceUrl: HttpsUrlSchema,
  sourceLicense: z.string().min(1),
  isPortrait: z.boolean(),
  focalPoint: z.object({
    u: z.number().min(0).max(1),
    v: z.number().min(0).max(1),
  }),
  paletteMood: z.enum([
    'verdict-crimson',
    'bullion-gold',
    'subpoena-cobalt',
    'banknote-emerald',
    'courtroom-ochre',
    'monochrome-noir',
  ]),
  toyKind: z.enum(['stamp', 'coins', 'redaction', 'crash-line', 'envelopes', 'gavel-ripple']),
  toyText: z.string().min(1),
  toySubtext: z.string().min(1),
  alt: z.string().min(1),
});

const PaintRefsManifestSchema = z.record(
  z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  PaintRefEntrySchema
);

const EditionManifestSchema = z.object({
  edition_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  volume: z.string().min(1),
  display_date: z.string().min(1),
  tagline: z.string().optional(),
  published_at: z.string().optional(),
  slots: z.object({
    lead_hero: z.string().min(1),
    lead_live: z.string().min(1),
    lead_right: z.string().min(1),
    lead_grid: z.array(z.string().min(1)).min(1),
    secondary_1: z.string().min(1),
    secondary_2: z.string().min(1),
    rail_feature: z.string().min(1),
    rail_mini: z.array(z.string().min(1)).min(1),
    rail_opinion: z.array(z.string().min(1)).min(1),
    ledger: z.array(z.string().min(1)).default([]),
  }),
  article_slugs: z.array(z.string().min(1)).optional(),
});

const RegionalRollupSchema = z.object({
  label: z.string().min(1),
  case_count: z.number().int().nonnegative(),
  total_loot_usd: z.number().nonnegative(),
  total_loot_display: z.string().min(1),
  total_fines_usd: z.number().nonnegative(),
  total_fines_display: z.string().min(1),
  avg_fine_ratio_pct: z.number().nonnegative().nullable(),
});

const RollupStatsSchema = z.object({
  as_of: z.string().min(1),
  edition_date: z.string().min(1),
  total_cases: z.number().int().nonnegative(),
  total_loot_usd: z.number().nonnegative(),
  total_loot_display: z.string().min(1),
  total_fines_usd: z.number().nonnegative(),
  total_fines_display: z.string().min(1),
  avg_fine_ratio_pct: z.number().nonnegative(),
  avg_slap_on_wrist_score: z.number().min(0).max(100),
  zero_prison_cases: z.number().int().nonnegative(),
  regions: z.record(z.string(), RegionalRollupSchema),
});

const ALLOWED_ARTICLE_TAGS = [
  'p',
  'h2',
  'h3',
  'blockquote',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'a',
  'br',
  'code',
  'sup',
  'sub',
  'span',
];

const ALLOWED_ARTICLE_ATTRIBUTES = {
  a: ['href', 'title', 'rel', 'target'],
  p: ['class'],
  span: ['class'],
  blockquote: ['class'],
};

const STRICT_SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_ARTICLE_TAGS,
  allowedAttributes: ALLOWED_ARTICLE_ATTRIBUTES,
  allowedSchemes: ['https', 'http', 'mailto'],
  allowedSchemesByTag: {
    a: ['https', 'http', 'mailto'],
  },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
};

const ALLOWED_TAG_SET = new Set(ALLOWED_ARTICLE_TAGS);

/**
 * AST-backed HTML security check using sanitize-html (htmlparser2) — immune to regex
 * attribute-quote bypasses like <a title=">" onclick="alert(1)" href="#">.
 */
function findHtmlSecurityViolations(html) {
  const violations = [];

  const passthrough = sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    transformTags: {
      '*': (tagName, attribs) => {
        const tag = tagName.toLowerCase();
        if (!ALLOWED_TAG_SET.has(tag)) {
          violations.push(`disallowed tag <${tag}>`);
        }

        const allowedForTag = new Set(ALLOWED_ARTICLE_ATTRIBUTES[tag] ?? []);
        for (const [rawName, rawVal] of Object.entries(attribs)) {
          const name = rawName.toLowerCase();
          if (name.startsWith('on')) {
            violations.push(`disallowed event handler "${name}" on <${tag}>`);
          } else if (!allowedForTag.has(name)) {
            violations.push(`disallowed attribute "${name}" on <${tag}>`);
          } else if (name === 'href') {
            const cleaned = String(rawVal ?? '').replace(/[\u0000-\u0020]+/g, '');
            if (cleaned.startsWith('//')) {
              violations.push(`disallowed protocol-relative href "${rawVal}" on <${tag}>`);
            } else if (
              /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned) &&
              !/^(https?:|mailto:)/i.test(cleaned)
            ) {
              violations.push(`disallowed href scheme "${rawVal}" on <${tag}>`);
            }
          }
        }

        return { tagName, attribs };
      },
    },
  }).trim();

  const sanitized = sanitizeHtml(html, STRICT_SANITIZE_OPTIONS).trim();
  if (violations.length === 0 && sanitized !== passthrough) {
    violations.push('HTML contains constructs stripped or mutated by sanitize-html');
  }

  return violations;
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function findArticleDirs(dir) {
  if (!(await pathExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === 'meta.json')) {
    return [dir];
  }
  const out = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      out.push(...(await findArticleDirs(path.join(dir, e.name))));
    }
  }
  return out;
}

async function main() {
  const errors = [];
  const warnings = [];
  const slugs = new Set();
  const ids = new Set();

  const articleDirs = await findArticleDirs(ARTICLES_ROOT);
  if (articleDirs.length === 0) {
    warnings.push('No articles found under content/articles/ yet.');
  }

  for (const dir of articleDirs) {
    const relDir = path.relative(PROJECT_ROOT, dir);
    const metaPath = path.join(dir, 'meta.json');
    const bodyPath = path.join(dir, 'body.html');

    let meta;
    try {
      const rawMeta = await fs.readFile(metaPath, 'utf-8');
      meta = ArticleMetaSchema.parse(JSON.parse(rawMeta));
    } catch (err) {
      errors.push(`${relDir}/meta.json: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const expectedFolderSlug = path.basename(dir);
    if (meta.slug !== expectedFolderSlug) {
      errors.push(
        `${relDir}/meta.json: slug "${meta.slug}" does not match folder name "${expectedFolderSlug}"`
      );
    }
    if (slugs.has(meta.slug)) {
      errors.push(`${relDir}/meta.json: duplicate slug "${meta.slug}"`);
    }
    slugs.add(meta.slug);

    if (ids.has(meta.id)) {
      errors.push(`${relDir}/meta.json: duplicate id "${meta.id}"`);
    }
    ids.add(meta.id);

    for (const [idx, source] of meta.sources.entries()) {
      const hubReason = findGenericHubUrlReason(source.url);
      if (hubReason) {
        errors.push(
          `${relDir}/meta.json: sources[${idx}].url ("${source.url}") rejected — ${hubReason}`
        );
      }
    }

    if (!(await pathExists(bodyPath))) {
      errors.push(`${relDir}: missing body.html`);
    } else {
      const html = (await fs.readFile(bodyPath, 'utf-8')).trim();
      if (html.length < 150) {
        errors.push(`${relDir}/body.html: content too short (${html.length} chars)`);
      }
      if (!html.includes('<p')) {
        errors.push(`${relDir}/body.html: must contain at least one <p> paragraph`);
      }
      for (const problem of findHtmlSecurityViolations(html)) {
        errors.push(`${relDir}/body.html: ${problem}`);
      }
    }
  }

  // Validate content/paint-refs.json & public/paint-refs/*.jpg 1:1 against every article slug
  let paintRefCount = 0;
  if (!(await pathExists(PAINT_REFS_JSON_PATH))) {
    errors.push('content/paint-refs.json: missing manifest file');
  } else {
    try {
      const rawRefs = await fs.readFile(PAINT_REFS_JSON_PATH, 'utf-8');
      const manifest = PaintRefsManifestSchema.parse(JSON.parse(rawRefs));
      const manifestSlugs = new Set(Object.keys(manifest));
      paintRefCount = manifestSlugs.size;

      for (const slug of slugs) {
        const entry = manifest[slug];
        if (!entry) {
          errors.push(`content/paint-refs.json: missing paint-ref entry for article slug "${slug}"`);
          continue;
        }

        const expectedRefImage = `/paint-refs/${slug}.jpg`;
        if (entry.refImage !== expectedRefImage) {
          errors.push(
            `content/paint-refs.json[${slug}]: refImage "${entry.refImage}" must match "${expectedRefImage}"`
          );
        }

        const jpgPath = path.join(PAINT_REFS_DIR, `${slug}.jpg`);
        if (!(await pathExists(jpgPath))) {
          errors.push(`public/paint-refs/${slug}.jpg: missing reference JPEG`);
          continue;
        }

        const buf = await fs.readFile(jpgPath);
        if (buf.byteLength <= MIN_PAINT_REF_BYTES) {
          errors.push(
            `public/paint-refs/${slug}.jpg: file too small (${buf.byteLength} bytes; must be > ${MIN_PAINT_REF_BYTES} bytes)`
          );
        }
        if (buf.byteLength < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
          errors.push(
            `public/paint-refs/${slug}.jpg: invalid JPEG magic bytes (expected FF D8 FF)`
          );
        }
      }

      for (const manifestSlug of manifestSlugs) {
        if (slugs.size > 0 && !slugs.has(manifestSlug)) {
          errors.push(
            `content/paint-refs.json: orphaned entry "${manifestSlug}" has no matching article`
          );
        }
      }
    } catch (err) {
      errors.push(
        `content/paint-refs.json: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Validate editions
  let editionCount = 0;
  if (await pathExists(EDITIONS_ROOT)) {
    const editionFiles = (await fs.readdir(EDITIONS_ROOT)).filter((f) => f.endsWith('.json'));
    for (const file of editionFiles) {
      const fullPath = path.join(EDITIONS_ROOT, file);
      const relPath = path.relative(PROJECT_ROOT, fullPath);
      try {
        const raw = await fs.readFile(fullPath, 'utf-8');
        const manifest = EditionManifestSchema.parse(JSON.parse(raw));
        editionCount++;

        const datedMatch = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(file);
        if (datedMatch && manifest.edition_date !== datedMatch[1]) {
          errors.push(
            `${relPath}: filename date "${datedMatch[1]}" does not match internal edition_date "${manifest.edition_date}"`
          );
        }

        const referenced = [
          manifest.slots.lead_hero,
          manifest.slots.lead_live,
          manifest.slots.lead_right,
          ...manifest.slots.lead_grid,
          manifest.slots.secondary_1,
          manifest.slots.secondary_2,
          manifest.slots.rail_feature,
          ...manifest.slots.rail_mini,
          ...manifest.slots.rail_opinion,
          ...manifest.slots.ledger,
        ];
        if (articleDirs.length > 0) {
          for (const slug of referenced) {
            if (!slugs.has(slug)) {
              errors.push(`${relPath}: references unknown article slug "${slug}"`);
            }
          }
        }
      } catch (err) {
        errors.push(`${relPath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    warnings.push('content/editions/ does not exist yet.');
  }

  // Validate rollup stats
  if (await pathExists(ROLLUP_PATH)) {
    try {
      const raw = await fs.readFile(ROLLUP_PATH, 'utf-8');
      const rollup = RollupStatsSchema.parse(JSON.parse(raw));
      if (articleDirs.length > 0 && rollup.total_cases !== articleDirs.length) {
        errors.push(
          `content/ledger/rollup-stats.json: total_cases (${rollup.total_cases}) does not match article count (${articleDirs.length})`
        );
      }
    } catch (err) {
      errors.push(
        `content/ledger/rollup-stats.json: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  } else {
    warnings.push('content/ledger/rollup-stats.json does not exist yet.');
  }

  for (const w of warnings) {
    console.warn(`⚠️  ${w}`);
  }

  if (errors.length > 0) {
    console.error(`\n❌ Content validation failed with ${errors.length} error(s):`);
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ Content validation passed: ${articleDirs.length} article(s), ${paintRefCount} paint-ref(s), ${editionCount} edition manifest(s).`
  );
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error('❌ Unexpected validator error:', err);
    process.exit(1);
  });
}
