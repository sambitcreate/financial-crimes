#!/usr/bin/env node
/**
 * Strict content, legal & security validator for The Financial Crimes.
 *
 * Runs FIRST in `npm run build` / `npm run verify` / `npm run deploy` (fail-fast gate).
 * It imports the real Zod schemas (src/schemas/article.ts) and sanitizer
 * (src/utils/sanitize.ts) through Node's native TypeScript type stripping (Node >= 22.18),
 * so there is exactly one definition of every rule.
 *
 * Validates:
 *  - Layout: content/articles/<YYYY>/<MM>/<slug>/{meta.json, body.html}; YYYY/MM must equal the
 *    literal YYYY-MM of publish_date; no stray directories (drafts/ etc.); no future publish dates
 *  - Strict article/paint-ref/edition/rollup schemas (unknown keys, ISO dates, money >= 0, int score)
 *  - AGENTS.md §2C legal rules (stage <-> score, fine ratio, banned terms, admitted_guilt,
 *    opinion monochrome) via checkArticleRules()
 *  - Source URLs: https hardening, generic-hub guard, official-domain allowlist (`secondary: true`
 *    escape hatch for press citations, never as the only source)
 *  - body.html: sanitizer/detector agreement, comments/CDATA, real prose length
 *  - paint-refs.json 1:1 coverage, licence allowlist, JPEG SOF parse (RGB, <= 320px, > 5 KB)
 *  - Editions: filenames, latest.json == newest dated edition, slot/article_slugs integrity
 *  - Rollup: schema, case count, edition_date
 *
 * Programmatic use: `validateContent({ root, now })` → `{ errors, warnings, stats }`.
 * `now` defaults to $FC_NOW (ISO string) or the current time.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  ArticleMetaSchema,
  EditionManifestSchema,
  PaintRefsManifestSchema,
  RollupStatsSchema,
  checkArticleRules,
  editionSlotSlugs,
} from '../src/schemas/article.ts';
import {
  findHtmlSecurityViolations,
  htmlProseText,
  isSafeHttpsUrl,
} from '../src/utils/sanitize.ts';

export const MIN_PAINT_REF_BYTES = 5 * 1024;
export const MAX_PAINT_REF_EDGE = 320;
export const MIN_PAINT_REF_LONG_EDGE = 160;
export const MIN_PAINT_REF_SHORT_EDGE = 64;
export const MIN_PAINT_REF_SCAN_BYTES = 4096;
export const MIN_BODY_PROSE_CHARS = 150;
/** Allowed clock skew for "not in the future" checks (timezones, scheduled morning editions). */
export const FUTURE_SKEW_MS = 36 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Source URL policy
// ---------------------------------------------------------------------------

const GENERIC_HUB_TERMINAL_SEGMENTS = new Set([
  'news',
  'newsroom',
  'press',
  'pr',
  'press-releases',
  'news-releases',
  'media-releases',
  'media',
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
  'search',
  'search.html',
  'index.html',
  'index.htm',
  'index.php',
  'index.aspx',
  'default.aspx',
  'home',
  'en',
  'massnahmen_node_en.html',
  'health-care-fraud-unit',
  'foreign-corrupt-practices-act',
]);

/** Search/redirect wrappers and URL shorteners — never a canonical primary source. */
const REDIRECT_WRAPPER_HOSTS = new Set([
  'vertexaisearch.cloud.google.com',
  'bit.ly',
  't.co',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  'buff.ly',
  'lnkd.in',
  'rebrand.ly',
  'is.gd',
  'cutt.ly',
  'shorturl.at',
  'l.facebook.com',
  'lm.facebook.com',
  'out.reddit.com',
  'href.li',
  'archive.ph',
  'archive.today',
]);

function isRedirectWrapper(host, pathname) {
  if (REDIRECT_WRAPPER_HOSTS.has(host)) return true;
  // google.<tld>/url?q=…, www.google.co.uk/url, etc.
  if (/(^|\.)google\.[a-z.]+$/.test(host) && /^\/(url|search|amp)\b/.test(pathname)) return true;
  if (
    host === 'safelinks.protection.outlook.com' ||
    host.endsWith('.safelinks.protection.outlook.com')
  ) {
    return true;
  }
  return false;
}

/**
 * Rejects generic agency newsroom hubs, bare root domains, search/redirect wrappers and
 * shorteners in sources[].url so every citation resolves to a specific primary release, order,
 * or court filing. Query strings never rescue a hub or root URL.
 *
 * Returns a human-readable rejection reason, or null if OK.
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
  if (isRedirectWrapper(host, parsed.pathname)) {
    return `redirect wrapper / shortener host "${host}" is not allowed; resolve to the canonical official URL`;
  }
  for (const value of parsed.searchParams.values()) {
    if (/^(?:https?:)?\/\//i.test(value.trim())) {
      return 'query string embeds another URL (redirect wrapper); cite the target URL directly';
    }
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  if (!normalizedPath) {
    return 'bare root domain URL (a query string does not make it specific); cite a specific press release, order, or filing';
  }

  const segments = normalizedPath.toLowerCase().split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? '';
  if (GENERIC_HUB_TERMINAL_SEGMENTS.has(lastSegment)) {
    return `generic newsroom/hub path ending in "/${lastSegment}" (query strings such as ?page= do not make it specific); cite a direct deep-linked release or filing URL`;
  }

  return null;
}

/**
 * Official primary-source domains (regulators, prosecutors, courts, official gazettes and
 * intergovernmental bodies). A host matches if it equals an entry or is a subdomain of one.
 */
export const OFFICIAL_SOURCE_DOMAINS = [
  // United States (federal agencies are covered by the .gov suffix; listed for documentation)
  'justice.gov',
  'sec.gov',
  'cftc.gov',
  'treasury.gov',
  'fincen.gov',
  'occ.gov',
  'federalreserve.gov',
  'fdic.gov',
  'ftc.gov',
  'irs.gov',
  'uscourts.gov',
  'supremecourt.gov',
  'finra.org',
  'courtlistener.com',
  // United Kingdom
  'gov.uk',
  'fca.org.uk',
  'judiciary.uk',
  'bailii.org',
  'parliament.uk',
  // India
  'sebi.gov.in',
  'cbi.gov.in',
  'rbi.org.in',
  'pib.gov.in',
  'mca.gov.in',
  'enforcementdirectorate.gov.in',
  'sci.gov.in',
  'nic.in',
  // European Union & member states
  'europa.eu',
  'bafin.de',
  'bundesgerichtshof.de',
  'amf-france.org',
  'consob.it',
  'centralbank.ie',
  'dnb.nl',
  'afm.nl',
  'finma.ch',
  // Asia-Pacific
  'mas.gov.sg',
  'sfc.hk',
  'afrc.org.hk',
  'hkex.com.hk',
  'judiciary.hk',
  'icac.org.hk',
  'asic.gov.au',
  'fsa.go.jp',
  // Intergovernmental
  'fatf-gafi.org',
  'bis.org',
  'iosco.org',
  'oecd.org',
  'worldbank.org',
  'interpol.int',
];

/** Restricted government/judicial registries: any host under these suffixes is official. */
export const OFFICIAL_SOURCE_SUFFIXES = [
  'gov',
  'mil',
  'gov.uk',
  'gov.in',
  'nic.in',
  'gov.sg',
  'gov.hk',
  'gov.au',
  'gc.ca',
  'europa.eu',
  'gouv.fr',
  'bund.de',
  'gov.ie',
  'govt.nz',
  'go.jp',
  'go.kr',
  'gov.br',
  'gob.mx',
  'gov.za',
  'admin.ch',
  'gv.at',
  'gov.it',
  'gov.ae',
  'gov.ph',
  'gov.my',
  'go.id',
  'gov.cn',
  'gov.tw',
];

const COURTS_STATE_US_RE = /(^|\.)(state|courts)\.[a-z]{2}\.us$/;

export function isOfficialSourceHost(hostname) {
  const host = String(hostname ?? '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host) return false;
  const matches = (d) => host === d || host.endsWith(`.${d}`);
  if (OFFICIAL_SOURCE_DOMAINS.some(matches)) return true;
  if (OFFICIAL_SOURCE_SUFFIXES.some((s) => host.endsWith(`.${s}`))) return true;
  return COURTS_STATE_US_RE.test(host);
}

// ---------------------------------------------------------------------------
// JPEG structure parser (no dependencies)
// ---------------------------------------------------------------------------

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const STANDALONE_MARKERS = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);

/**
 * Walks JPEG segments and returns `{ width, height, components, precision, scanBytes, errors }`.
 * `errors` is empty only for a structurally valid baseline/progressive JPEG with SOI, exactly
 * one SOF, at least one SOS with entropy data, and EOI as the final two bytes.
 */
export function inspectJpeg(buf) {
  const out = { width: 0, height: 0, components: 0, precision: 0, scanBytes: 0, errors: [] };
  const fail = (msg) => {
    out.errors.push(msg);
    return out;
  };
  if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return fail('not a JPEG (missing SOI FF D8)');
  }
  let i = 2;
  let sofCount = 0;
  let sawSos = false;
  let sawEoi = false;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return fail(`corrupt JPEG: expected marker at byte ${i}`);
    // Skip fill bytes
    while (i < buf.length && buf[i] === 0xff) i++;
    if (i >= buf.length) return fail('corrupt JPEG: truncated marker');
    const marker = buf[i++];
    if (marker === 0xd9) {
      sawEoi = true;
      if (i !== buf.length)
        return fail(`trailing ${buf.length - i} byte(s) after EOI (padded/appended data)`);
      break;
    }
    if (marker === 0xd8) return fail('corrupt JPEG: nested SOI');
    if (STANDALONE_MARKERS.has(marker)) continue;
    if (i + 2 > buf.length) return fail('corrupt JPEG: truncated segment length');
    const len = (buf[i] << 8) | buf[i + 1];
    if (len < 2 || i + len > buf.length)
      return fail(`corrupt JPEG: bad segment length ${len} for marker 0x${marker.toString(16)}`);
    if (SOF_MARKERS.has(marker)) {
      sofCount++;
      if (len < 8) return fail('corrupt JPEG: short SOF segment');
      out.precision = buf[i + 2];
      out.height = (buf[i + 3] << 8) | buf[i + 4];
      out.width = (buf[i + 5] << 8) | buf[i + 6];
      out.components = buf[i + 7];
    }
    const segEnd = i + len;
    if (marker === 0xda) {
      if (sofCount === 0) return fail('corrupt JPEG: SOS before SOF');
      sawSos = true;
      // Entropy-coded data runs until a marker that is not 0x00 stuffing or RSTn.
      let j = segEnd;
      while (j < buf.length) {
        if (buf[j] === 0xff) {
          const next = buf[j + 1];
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
            j += 2;
            continue;
          }
          if (next === 0xff) {
            j++;
            continue;
          }
          break;
        }
        j++;
      }
      out.scanBytes += j - segEnd;
      i = j;
      continue;
    }
    i = segEnd;
  }
  if (!sawEoi) return fail('corrupt JPEG: missing EOI (FF D9) at end of file');
  if (sofCount !== 1)
    return fail(`corrupt JPEG: expected exactly one SOF frame header, found ${sofCount}`);
  if (!sawSos) return fail('corrupt JPEG: no SOS (image data) segment');
  return out;
}

/** Applies the AGENTS.md §2B image contract to a JPEG buffer; returns error strings. */
export function checkPaintRefJpeg(buf) {
  const problems = [];
  if (buf.byteLength <= MIN_PAINT_REF_BYTES) {
    problems.push(
      `file too small (${buf.byteLength} bytes; must be > ${MIN_PAINT_REF_BYTES} bytes)`
    );
  }
  const info = inspectJpeg(buf);
  if (info.errors.length) return [...problems, ...info.errors];
  if (info.components !== 3) {
    problems.push(
      `must be RGB/YCbCr with 3 components (found ${info.components}${info.components === 4 ? ' — CMYK/YCCK' : info.components === 1 ? ' — grayscale' : ''})`
    );
  }
  if (info.precision !== 8) problems.push(`must be 8-bit (found ${info.precision}-bit)`);
  const longEdge = Math.max(info.width, info.height);
  const shortEdge = Math.min(info.width, info.height);
  if (longEdge > MAX_PAINT_REF_EDGE) {
    problems.push(
      `longest edge ${longEdge}px exceeds ${MAX_PAINT_REF_EDGE}px (${info.width}x${info.height})`
    );
  }
  if (longEdge < MIN_PAINT_REF_LONG_EDGE || shortEdge < MIN_PAINT_REF_SHORT_EDGE) {
    problems.push(
      `image too small to paint (${info.width}x${info.height}; need longest edge >= ${MIN_PAINT_REF_LONG_EDGE}px and shortest >= ${MIN_PAINT_REF_SHORT_EDGE}px)`
    );
  }
  if (info.scanBytes < MIN_PAINT_REF_SCAN_BYTES) {
    problems.push(
      `only ${info.scanBytes} bytes of entropy-coded image data (< ${MIN_PAINT_REF_SCAN_BYTES}); file size is padding/metadata, not image`
    );
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatError(err) {
  if (err && Array.isArray(err.issues)) {
    return err.issues
      .map((issue) => `${issue.path.length ? issue.path.join('.') : '(root)'}: ${issue.message}`)
      .join('; ');
  }
  return err instanceof Error ? err.message : String(err);
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readdirSafe(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Epoch ms for an ISO date (UTC midnight) or ISO datetime. */
function toMs(value) {
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
}

function resolveNow(now) {
  if (now instanceof Date) return now;
  const raw = now ?? process.env.FC_NOW;
  if (raw == null || raw === '') return new Date();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid FC_NOW / now value: "${raw}"`);
  return d;
}

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^(0[1-9]|1[0-2])$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATED_EDITION_RE = /^(\d{4}-\d{2}-\d{2})\.json$/;

/**
 * Recursively finds every directory containing meta.json (mirrors the loader's discovery, so
 * anything the build would publish is validated) and reports stray layout entries.
 */
async function scanArticleTree(articlesRoot, relOf, errors) {
  const metaDirs = [];
  async function walk(dir, depth) {
    const entries = await readdirSafe(dir);
    const hasMeta = entries.some((e) => e.isFile() && e.name === 'meta.json');
    if (hasMeta) {
      metaDirs.push(dir);
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        if (e.isDirectory()) {
          errors.push(
            `${relOf(path.join(dir, e.name))}: unexpected directory inside an article folder`
          );
        } else if (e.name !== 'meta.json' && e.name !== 'body.html') {
          errors.push(`${relOf(path.join(dir, e.name))}: unexpected file inside an article folder`);
        }
      }
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (!e.isDirectory()) {
        errors.push(`${relOf(full)}: unexpected file in content/articles tree`);
        continue;
      }
      if (depth === 0 && !YEAR_RE.test(e.name)) {
        errors.push(
          `${relOf(full)}: directory must be a 4-digit year (content/articles/YYYY/MM/<slug>/); drafts/other folders are not allowed`
        );
      } else if (depth === 1 && !MONTH_RE.test(e.name)) {
        errors.push(
          `${relOf(full)}: directory must be a 2-digit month 01-12 (content/articles/YYYY/MM/<slug>/)`
        );
      } else if (depth === 2 && !SLUG_RE.test(e.name)) {
        errors.push(`${relOf(full)}: article folder must be a lowercase kebab-case slug`);
      } else if (depth >= 3) {
        errors.push(`${relOf(full)}: nested too deep (expected content/articles/YYYY/MM/<slug>/)`);
      }
      if (depth === 2) {
        const childEntries = await readdirSafe(full);
        if (!childEntries.some((c) => c.isFile() && c.name === 'meta.json')) {
          errors.push(`${relOf(full)}: article folder has no meta.json`);
        }
      }
      await walk(full, depth + 1);
    }
  }
  await walk(articlesRoot, 0);
  return metaDirs.sort();
}

// ---------------------------------------------------------------------------
// Main validation
// ---------------------------------------------------------------------------

export async function validateContent(options = {}) {
  const root = options.root ?? process.cwd();
  const now = resolveNow(options.now);
  const nowLimit = now.getTime() + FUTURE_SKEW_MS;
  const isFuture = (iso) => toMs(iso) > nowLimit;

  const ARTICLES_ROOT = path.join(root, 'content', 'articles');
  const EDITIONS_ROOT = path.join(root, 'content', 'editions');
  const ROLLUP_PATH = path.join(root, 'content', 'ledger', 'rollup-stats.json');
  const PAINT_REFS_JSON_PATH = path.join(root, 'content', 'paint-refs.json');
  const PAINT_REFS_DIR = path.join(root, 'public', 'paint-refs');
  const relOf = (p) => path.relative(root, p).split(path.sep).join('/');

  const errors = [];
  const warnings = [];
  /** @type {Map<string, {meta: any, relDir: string}>} */
  const articles = new Map();
  const ids = new Set();
  /** Folder slugs whose meta.json failed to parse (suppresses cascading 'unknown slug' noise). */
  const brokenSlugs = new Set();

  // ---- Articles --------------------------------------------------------------
  const articleDirs = await scanArticleTree(ARTICLES_ROOT, relOf, errors);
  if (articleDirs.length === 0) {
    errors.push(
      'content/articles/: no articles found (the site cannot build without at least one story)'
    );
  }

  for (const dir of articleDirs) {
    const relDir = relOf(dir);
    const metaPath = path.join(dir, 'meta.json');
    const bodyPath = path.join(dir, 'body.html');

    let meta;
    try {
      const rawMeta = await fs.readFile(metaPath, 'utf-8');
      meta = ArticleMetaSchema.parse(JSON.parse(rawMeta));
    } catch (err) {
      errors.push(`${relDir}/meta.json: ${formatError(err)}`);
      brokenSlugs.add(path.basename(dir));
      continue;
    }
    const where = `${relDir}/meta.json`;

    const folderSlug = path.basename(dir);
    if (meta.slug !== folderSlug) {
      errors.push(`${where}: slug "${meta.slug}" does not match folder name "${folderSlug}"`);
    }
    if (articles.has(meta.slug)) {
      errors.push(
        `${where}: duplicate slug "${meta.slug}" (also at ${articles.get(meta.slug).relDir}); the build would silently drop one`
      );
    } else {
      articles.set(meta.slug, { meta, relDir });
    }
    if (ids.has(meta.id)) errors.push(`${where}: duplicate id "${meta.id}"`);
    ids.add(meta.id);

    // Layout <-> publish_date (literal YYYY-MM in the date's own offset)
    const relParts = path.relative(ARTICLES_ROOT, dir).split(path.sep);
    if (relParts.length === 3) {
      const [yyyy, mm] = relParts;
      const expected = meta.publish_date.slice(0, 7);
      if (`${yyyy}-${mm}` !== expected) {
        errors.push(
          `${where}: folder ${yyyy}/${mm} does not match publish_date ${meta.publish_date} (expected content/articles/${expected.replace('-', '/')}/${folderSlug}/)`
        );
      }
    } else {
      errors.push(
        `${where}: article must live at content/articles/YYYY/MM/<slug>/ (found ${relDir})`
      );
    }

    // No future dates
    if (isFuture(meta.publish_date)) {
      errors.push(
        `${where}: publish_date ${meta.publish_date} is in the future (now ${now.toISOString()})`
      );
    }
    if (isFuture(meta.edition_date)) {
      errors.push(`${where}: edition_date ${meta.edition_date} is in the future`);
    }
    if (meta.updated_at) {
      if (isFuture(meta.updated_at))
        errors.push(`${where}: updated_at ${meta.updated_at} is in the future`);
      if (toMs(meta.updated_at) < toMs(meta.publish_date.slice(0, 10))) {
        errors.push(`${where}: updated_at ${meta.updated_at} is before publish_date`);
      }
    }
    if (meta.retracted && isFuture(meta.retracted.date)) {
      errors.push(`${where}: retracted.date ${meta.retracted.date} is in the future`);
    }
    for (const [idx, c] of (meta.corrections ?? []).entries()) {
      if (isFuture(c.date))
        errors.push(`${where}: corrections[${idx}].date ${c.date} is in the future`);
    }

    // Sources
    let primaryCount = 0;
    for (const [idx, source] of meta.sources.entries()) {
      const label = `${where}: sources[${idx}].url ("${source.url}")`;
      const hubReason = findGenericHubUrlReason(source.url);
      if (hubReason) errors.push(`${label} rejected — ${hubReason}`);
      const host = new URL(source.url).hostname;
      const official = isOfficialSourceHost(host);
      if (source.secondary === true) {
        if (official) {
          warnings.push(`${label} is on an official domain but marked secondary: true`);
        }
      } else if (official) {
        primaryCount++;
      } else {
        errors.push(
          `${label} host "${host}" is not on the official-source allowlist; cite the primary filing, or mark a press citation \`secondary: true\` alongside an official source`
        );
      }
      if (isFuture(source.date)) {
        errors.push(`${where}: sources[${idx}].date ${source.date} is in the future`);
      }
    }
    if (primaryCount === 0 && meta.retracted) {
      // A retraction tombstone may exist precisely because no primary filing could be found.
      warnings.push(`${where}: retracted article has no official primary source (ok while retracted)`);
    } else if (primaryCount === 0) {
      errors.push(
        `${where}: needs at least one non-secondary source on an official domain (court, regulator, prosecutor)`
      );
    }

    // Body
    if (!(await pathExists(bodyPath))) {
      errors.push(`${relDir}: missing body.html`);
    } else {
      const html = (await fs.readFile(bodyPath, 'utf-8')).trim();
      const prose = htmlProseText(html);
      if (prose.length < MIN_BODY_PROSE_CHARS) {
        errors.push(
          `${relDir}/body.html: too little prose (${prose.length} visible chars after stripping tags/entities/whitespace; need >= ${MIN_BODY_PROSE_CHARS})`
        );
      }
      const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
      if (!paragraphs.some((m) => htmlProseText(m[1]).length > 0)) {
        errors.push(`${relDir}/body.html: must contain at least one non-empty <p> paragraph`);
      }
      for (const problem of findHtmlSecurityViolations(html)) {
        errors.push(`${relDir}/body.html: ${problem}`);
      }
    }
  }

  // ---- Paint refs ---------------------------------------------------------------
  let paintRefCount = 0;
  let manifest = null;
  if (!(await pathExists(PAINT_REFS_JSON_PATH))) {
    errors.push('content/paint-refs.json: missing manifest file');
  } else {
    try {
      const rawRefs = await fs.readFile(PAINT_REFS_JSON_PATH, 'utf-8');
      manifest = PaintRefsManifestSchema.parse(JSON.parse(rawRefs));
      paintRefCount = Object.keys(manifest).length;
    } catch (err) {
      errors.push(`content/paint-refs.json: ${formatError(err)}`);
    }
  }

  for (const [slug, { meta, relDir }] of articles) {
    const entry = manifest ? manifest[slug] : null;
    if (manifest && !entry) {
      if (meta.retracted) {
        warnings.push(`content/paint-refs.json: retracted article "${slug}" has no paint-ref (ok)`);
      } else {
        errors.push(`content/paint-refs.json: missing paint-ref entry for article slug "${slug}"`);
      }
    }
    if (entry) {
      const expectedRefImage = `/paint-refs/${slug}.jpg`;
      if (entry.refImage !== expectedRefImage) {
        errors.push(
          `content/paint-refs.json[${slug}]: refImage "${entry.refImage}" must match "${expectedRefImage}"`
        );
      }
      const jpgPath = path.join(PAINT_REFS_DIR, `${slug}.jpg`);
      if (!(await pathExists(jpgPath))) {
        errors.push(`public/paint-refs/${slug}.jpg: missing reference JPEG`);
      } else {
        for (const problem of checkPaintRefJpeg(await fs.readFile(jpgPath))) {
          errors.push(`public/paint-refs/${slug}.jpg: ${problem}`);
        }
      }
    }

    const { errors: ruleErrors, warnings: ruleWarnings } = checkArticleRules(meta, entry ?? null);
    for (const e of ruleErrors) errors.push(`${relDir}/meta.json: ${e}`);
    for (const w of ruleWarnings) warnings.push(`${relDir}/meta.json: ${w}`);
  }

  if (manifest) {
    for (const manifestSlug of Object.keys(manifest)) {
      if (!articles.has(manifestSlug) && !brokenSlugs.has(manifestSlug)) {
        errors.push(
          `content/paint-refs.json: orphaned entry "${manifestSlug}" has no matching article`
        );
      }
    }
  }

  // ---- Editions -----------------------------------------------------------------
  let editionCount = 0;
  const dated = new Map(); // date -> { raw, manifest, relPath }
  let latest = null;
  let newestDate = null;
  if (!(await pathExists(EDITIONS_ROOT))) {
    errors.push(
      'content/editions/: directory missing (the homepage cannot build without an edition)'
    );
  } else {
    for (const e of await readdirSafe(EDITIONS_ROOT)) {
      if (e.name.startsWith('.')) continue;
      const fullPath = path.join(EDITIONS_ROOT, e.name);
      const relPath = relOf(fullPath);
      const datedMatch = DATED_EDITION_RE.exec(e.name);
      if (!e.isFile() || (!datedMatch && e.name !== 'latest.json')) {
        errors.push(
          `${relPath}: unexpected entry; edition files must be named YYYY-MM-DD.json (plus latest.json)`
        );
        continue;
      }
      let raw;
      let ed;
      try {
        raw = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
        ed = EditionManifestSchema.parse(raw);
      } catch (err) {
        errors.push(`${relPath}: ${formatError(err)}`);
        continue;
      }
      editionCount++;
      const where = relPath;

      if (datedMatch) {
        if (ed.edition_date !== datedMatch[1]) {
          errors.push(
            `${where}: filename date "${datedMatch[1]}" does not match internal edition_date "${ed.edition_date}"`
          );
        }
        dated.set(datedMatch[1], { raw, manifest: ed, relPath });
      } else {
        latest = { raw, manifest: ed, relPath };
      }
      if (isFuture(ed.edition_date))
        errors.push(`${where}: edition_date ${ed.edition_date} is in the future`);
      if (ed.published_at && isFuture(ed.published_at)) {
        errors.push(`${where}: published_at ${ed.published_at} is in the future`);
      }

      const slotSlugs = editionSlotSlugs(ed.slots);
      const seen = new Set();
      for (const slug of slotSlugs) {
        if (seen.has(slug))
          errors.push(
            `${where}: slug "${slug}" appears in more than one slot (would render twice)`
          );
        seen.add(slug);
        const art = articles.get(slug);
        if (!art) {
          if (brokenSlugs.has(slug)) continue;
          errors.push(`${where}: references unknown article slug "${slug}"`);
          continue;
        }
        if (art.meta.edition_date > ed.edition_date) {
          errors.push(
            `${where}: references "${slug}" whose edition_date ${art.meta.edition_date} is after this edition (${ed.edition_date})`
          );
        }
        if (art.meta.retracted && !datedMatch) {
          warnings.push(`${where}: latest edition features retracted article "${slug}"`);
        }
      }
      if (ed.article_slugs) {
        const listed = new Set();
        for (const slug of ed.article_slugs) {
          if (listed.has(slug))
            errors.push(`${where}: article_slugs lists "${slug}" more than once`);
          listed.add(slug);
          if (!articles.has(slug) && !brokenSlugs.has(slug))
            errors.push(`${where}: article_slugs references unknown article slug "${slug}"`);
          if (!seen.has(slug))
            errors.push(`${where}: article_slugs lists "${slug}" which is not placed in any slot`);
        }
        for (const slug of seen) {
          if (!listed.has(slug))
            errors.push(`${where}: slot slug "${slug}" is missing from article_slugs`);
        }
      }
    }

    const datedDates = [...dated.keys()].sort();
    newestDate = datedDates[datedDates.length - 1] ?? null;
    if (!newestDate) {
      errors.push(
        'content/editions/: no dated edition manifests (YYYY-MM-DD.json); the homepage and edition pages cannot build'
      );
    }
    if (!latest) {
      if (!errors.some((m) => m.startsWith('content/editions/latest.json'))) {
        errors.push(
          'content/editions/latest.json: missing (must be a copy of the newest dated edition)'
        );
      }
    } else if (newestDate && !isDeepStrictEqual(latest.raw, dated.get(newestDate).raw)) {
      errors.push(
        `content/editions/latest.json: differs from the newest dated edition ${newestDate}.json (stale homepage); copy it verbatim`
      );
    }

    if (newestDate) {
      for (const [slug, { meta, relDir }] of articles) {
        if (dated.has(meta.edition_date)) continue;
        if (meta.edition_date > newestDate) {
          warnings.push(
            `${relDir}/meta.json: edition_date ${meta.edition_date} has no edition file yet (newest is ${newestDate})`
          );
        } else {
          errors.push(
            `${relDir}/meta.json: edition_date ${meta.edition_date} has no content/editions/${meta.edition_date}.json (slug "${slug}")`
          );
        }
      }
    }
  }

  // ---- Rollup -------------------------------------------------------------------
  if (await pathExists(ROLLUP_PATH)) {
    try {
      const rollup = RollupStatsSchema.parse(JSON.parse(await fs.readFile(ROLLUP_PATH, 'utf-8')));
      const liveCount = [...articles.values()].filter((a) => !a.meta.retracted).length;
      if (articles.size > 0 && brokenSlugs.size === 0 && rollup.total_cases !== liveCount) {
        errors.push(
          `content/ledger/rollup-stats.json: total_cases (${rollup.total_cases}) does not match non-retracted article count (${liveCount}); run npm run rollup:recompute`
        );
      }
      if (newestDate && rollup.edition_date !== newestDate) {
        errors.push(
          `content/ledger/rollup-stats.json: edition_date (${rollup.edition_date}) must equal the newest dated edition (${newestDate}); run npm run rollup:recompute`
        );
      }
      if (isFuture(rollup.as_of))
        errors.push(`content/ledger/rollup-stats.json: as_of ${rollup.as_of} is in the future`);
    } catch (err) {
      errors.push(`content/ledger/rollup-stats.json: ${formatError(err)}`);
    }
  } else {
    errors.push('content/ledger/rollup-stats.json: missing (run npm run rollup:recompute)');
  }

  return {
    errors,
    warnings,
    stats: { articles: articleDirs.length, paintRefs: paintRefCount, editions: editionCount },
  };
}

async function main() {
  const { errors, warnings, stats } = await validateContent();
  for (const w of warnings) console.warn(`⚠️  ${w}`);
  if (errors.length > 0) {
    console.error(`\n❌ Content validation failed with ${errors.length} error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `✅ Content validation passed: ${stats.articles} article(s), ${stats.paintRefs} paint-ref(s), ${stats.editions} edition manifest(s).`
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

export { isSafeHttpsUrl };
