/**
 * Single source of truth for content/ledger/rollup-stats.json.
 *
 * Used by scripts/recompute-rollup.mjs (writes the file), pipeline/judge-wrist-slap.mjs (refreshes
 * the rollup after writing scores) and src/loaders/articles.ts (build-time fallback + parity tests).
 *
 * Money semantics (presumption of innocence):
 *   - "Fines" are only counted for RESOLVED stages (final penalty imposed).
 *   - Money frozen / escrowed / impounded / ordered in UNRESOLVED (pending or adjudicated-but-not-yet-
 *     sentenced) cases is reported separately as `total_frozen_usd`; it is never a fine.
 *   - Loot is split into `total_loot_resolved_usd` (cases with a final resolution) and
 *     `total_loot_alleged_usd` (everything still pending or awaiting sentence). `total_loot_usd` is
 *     their sum, kept for backwards compatibility. Dismissed / acquitted cases contribute no money.
 *   - Retracted articles are excluded from every total and count except `retracted_cases`.
 *
 * Deterministic: output depends only on the inputs (no clock, no filesystem order). `as_of` is
 * deliberately NOT produced here; recompute-rollup.mjs only bumps it when the computed body changes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/** Final-penalty stages: scored by the judge (integer 0..100) and counted as fines. */
export const RESOLVED_STAGES = Object.freeze(['settlement', 'regulatory_order', 'sentenced', 'dpa']);
/** Presumption-of-innocence stages: score null, fine_ratio_pct null, money is "frozen / at issue". */
export const PENDING_STAGES = Object.freeze([
  'investigation',
  'civil_complaint',
  'indicted',
  'arrested',
  'interim_order',
  'appeal',
]);
/** Adjudicated but not yet penalised (score null). Money still counts as alleged / frozen. */
export const ADJUDICATED_STAGES = Object.freeze(['guilty_plea', 'convicted']);
/** Terminated without liability: contribute no loot / fines / frozen money. */
export const CLEARED_STAGES = Object.freeze(['dismissed', 'acquitted']);
export const ALL_STAGES = Object.freeze([
  ...PENDING_STAGES,
  ...ADJUDICATED_STAGES,
  ...RESOLVED_STAGES,
  ...CLEARED_STAGES,
]);

const RESOLVED = new Set(RESOLVED_STAGES);
const CLEARED = new Set(CLEARED_STAGES);
const STAGES = new Set(ALL_STAGES);

export const REGION_LABELS = Object.freeze({
  us: 'U.S.',
  'new-york': 'NEW YORK',
  chicago: 'CHICAGO',
  'los-angeles': 'L.A.',
  london: 'LONDON',
  india: 'INDIA',
  europe: 'EUROPE',
  global: 'GLOBAL',
});
const REGION_ORDER = ['us', 'new-york', 'chicago', 'los-angeles', 'london', 'india', 'europe'];
const US_EDITIONS = new Set(['us', 'new-york', 'chicago', 'los-angeles']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ROLLUP_DIGITS = { B: 2, M: 1, K: 0 };
const USD_UNITS = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** Mirrors src/utils/format.ts formatUsdShort() with the rollup digit profile { B: 2, M: 1, K: 0 }. */
export function formatRollupUsd(value) {
  if (!Number.isFinite(value)) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  for (let i = 0; i < USD_UNITS.length; i++) {
    const [size, unit] = USD_UNITS[i];
    const scaled = Number((abs / size).toFixed(ROLLUP_DIGITS[unit]));
    if (scaled >= 1000 && i > 0) {
      const [biggerSize, biggerUnit] = USD_UNITS[i - 1];
      return `${sign}$${(abs / biggerSize).toFixed(ROLLUP_DIGITS[biggerUnit])}${biggerUnit}`;
    }
    if (scaled >= 1) return `${sign}$${scaled.toFixed(ROLLUP_DIGITS[unit])}${unit}`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

/** Fines as a share of loot, aggregated (sum/sum), 2 dp. null when there is no loot to divide by. */
export function aggregateRatioPct(fines, loot) {
  return loot > 0 ? Number(((fines / loot) * 100).toFixed(2)) : null;
}

/** A retraction tombstone (`retracted: { date, note }`) marks the article as withdrawn. */
export function isRetracted(article) {
  const r = article?.retracted;
  return r !== null && r !== undefined && r !== false;
}

export function isResolvedStage(stage) {
  return RESOLVED.has(String(stage));
}

/**
 * Minimal structural validation of the fields the rollup reads. Throws with a precise message.
 * (Full schema validation is scripts/validate-content.mjs; this guards the arithmetic.)
 */
export function assertRollupInput(article, label = article?.slug ?? '<unknown>') {
  const fail = (msg) => {
    throw new Error(`rollup input ${label}: ${msg}`);
  };
  if (!article || typeof article !== 'object') fail('not an object');
  if (typeof article.slug !== 'string' || !article.slug) fail('missing slug');
  if (!STAGES.has(article.legal_stage)) fail(`unknown legal_stage "${article.legal_stage}"`);
  if (typeof article.edition !== 'string' || !article.edition) fail('missing edition');
  const fin = article.financials;
  if (!fin || typeof fin !== 'object') fail('missing financials');
  for (const key of ['amount_usd', 'fine_usd', 'prison_months']) {
    const v = fin[key];
    if (v === null || v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) fail(`financials.${key} must be a finite number >= 0 or null`);
  }
  const s = article.slap_on_wrist_score;
  if (s !== null && s !== undefined) {
    if (typeof s !== 'number' || !Number.isFinite(s) || s < 0 || s > 100) fail('slap_on_wrist_score must be 0..100 or null');
  }
}

function emptyBucket() {
  return { cases: 0, resolved: 0, lootResolved: 0, lootAlleged: 0, fines: 0, frozen: 0 };
}

function addToBucket(bucket, article) {
  const fin = article.financials;
  const amount = fin.amount_usd ?? 0;
  const fine = fin.fine_usd ?? 0;
  bucket.cases += 1;
  if (isResolvedStage(article.legal_stage)) {
    bucket.resolved += 1;
    bucket.lootResolved += amount;
    bucket.fines += fine;
  } else if (!CLEARED.has(article.legal_stage)) {
    bucket.lootAlleged += amount;
    bucket.frozen += fine;
  }
}

function bucketToRegion(label, b) {
  const loot = b.lootResolved + b.lootAlleged;
  return {
    label,
    case_count: b.cases,
    resolved_case_count: b.resolved,
    total_loot_usd: loot,
    total_loot_display: formatRollupUsd(loot),
    total_loot_resolved_usd: b.lootResolved,
    total_loot_resolved_display: formatRollupUsd(b.lootResolved),
    total_loot_alleged_usd: b.lootAlleged,
    total_loot_alleged_display: formatRollupUsd(b.lootAlleged),
    total_fines_usd: b.fines,
    total_fines_display: formatRollupUsd(b.fines),
    total_frozen_usd: b.frozen,
    total_frozen_display: formatRollupUsd(b.frozen),
    avg_fine_ratio_pct: aggregateRatioPct(b.fines, b.lootResolved),
  };
}

/** Newest YYYY-MM-DD among edition manifests (objects with edition_date) or bare date strings. */
export function newestEditionDate(editions = []) {
  let newest = null;
  for (const e of editions) {
    const d = typeof e === 'string' ? e : e?.edition_date;
    if (typeof d === 'string' && DATE_RE.test(d) && (newest === null || d > newest)) newest = d;
  }
  return newest;
}

/**
 * Compute the full rollup-stats object EXCEPT `as_of`.
 * @param {object[]} articles raw meta.json objects (or loader records)
 * @param {{ editions?: Array<{edition_date: string} | string> }} [opts]
 */
export function computeRollup(articles, { editions = [] } = {}) {
  const all = [...articles];
  for (const a of all) assertRollupInput(a);
  // Sort for deterministic floating-point summation regardless of input order.
  all.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));

  const slugs = new Set();
  for (const a of all) {
    if (slugs.has(a.slug)) throw new Error(`rollup input: duplicate slug "${a.slug}"`);
    slugs.add(a.slug);
  }

  const live = all.filter((a) => !isRetracted(a));
  const resolved = live.filter((a) => isResolvedStage(a.legal_stage));

  const global = emptyBucket();
  const regionBuckets = new Map();
  for (const article of live) {
    addToBucket(global, article);
    const key = String(article.edition).toLowerCase();
    const keys = new Set([key]);
    if (US_EDITIONS.has(key)) keys.add('us');
    for (const k of keys) {
      if (!k || k === 'global') continue;
      if (!regionBuckets.has(k)) regionBuckets.set(k, emptyBucket());
      addToBucket(regionBuckets.get(k), article);
    }
  }

  const orderedKeys = [
    ...REGION_ORDER.filter((k) => regionBuckets.has(k)),
    ...[...regionBuckets.keys()].filter((k) => !REGION_ORDER.includes(k)).sort(),
  ];
  const regions = {};
  for (const key of orderedKeys) {
    regions[key] = bucketToRegion(REGION_LABELS[key] ?? key.toUpperCase(), regionBuckets.get(key));
  }
  const globalRegion = bucketToRegion('GLOBAL', global);
  regions.global = globalRegion;

  const scores = resolved
    .map((a) => a.slap_on_wrist_score)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  const avgSlapScore =
    scores.length > 0 ? Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1)) : 0;

  let editionDate = newestEditionDate(editions);
  if (editionDate === null) {
    // No dated edition manifests supplied: fall back to the newest article edition_date.
    editionDate = newestEditionDate(live.map((a) => a.edition_date));
  }
  if (editionDate === null) throw new Error('rollup: cannot determine edition_date (no dated editions or articles)');

  return {
    edition_date: editionDate,
    total_cases: live.length,
    resolved_cases: resolved.length,
    unresolved_cases: live.length - resolved.length,
    retracted_cases: all.length - live.length,
    total_loot_usd: globalRegion.total_loot_usd,
    total_loot_display: globalRegion.total_loot_display,
    total_loot_resolved_usd: globalRegion.total_loot_resolved_usd,
    total_loot_resolved_display: globalRegion.total_loot_resolved_display,
    total_loot_alleged_usd: globalRegion.total_loot_alleged_usd,
    total_loot_alleged_display: globalRegion.total_loot_alleged_display,
    total_fines_usd: globalRegion.total_fines_usd,
    total_fines_display: globalRegion.total_fines_display,
    total_frozen_usd: globalRegion.total_frozen_usd,
    total_frozen_display: globalRegion.total_frozen_display,
    avg_fine_ratio_pct: globalRegion.avg_fine_ratio_pct ?? 0,
    avg_slap_on_wrist_score: avgSlapScore,
    zero_prison_cases: resolved.filter((a) => a.financials.prison_months === 0).length,
    regions,
  };
}

// ---------------------------------------------------------------------------
// Filesystem helpers (shared by recompute-rollup.mjs and the judge)
// ---------------------------------------------------------------------------

async function findMetaFiles(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  const out = [];
  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findMetaFiles(full)));
    else if (entry.isFile() && entry.name === 'meta.json') out.push(full);
  }
  return out;
}

/** Read every content/articles/** /meta.json and every dated edition manifest under `root`. */
export async function loadRollupInputs(root = process.cwd()) {
  const articlesRoot = path.join(root, 'content', 'articles');
  const editionsRoot = path.join(root, 'content', 'editions');
  const articles = [];
  for (const file of await findMetaFiles(articlesRoot)) {
    let meta;
    try {
      meta = JSON.parse(await fs.readFile(file, 'utf-8'));
    } catch (err) {
      throw new Error(`${path.relative(root, file)}: invalid JSON (${err.message})`);
    }
    assertRollupInput(meta, path.relative(root, file));
    articles.push(meta);
  }
  const editions = [];
  let files = [];
  try {
    files = await fs.readdir(editionsRoot);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  for (const file of files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) {
    const manifest = JSON.parse(await fs.readFile(path.join(editionsRoot, file), 'utf-8'));
    if (manifest?.edition_date !== file.slice(0, 10)) {
      throw new Error(`content/editions/${file}: edition_date "${manifest?.edition_date}" does not match filename`);
    }
    editions.push({ edition_date: manifest.edition_date });
  }
  return { articles, editions };
}

/** Stable JSON for the body comparison (key order as produced by computeRollup). */
function serialize(rollup) {
  return `${JSON.stringify(rollup, null, 2)}\n`;
}

/**
 * Recompute content/ledger/rollup-stats.json under `root`. Idempotent: `as_of` is only bumped (to
 * `now`) when the computed body differs from what is on disk; otherwise the file is untouched.
 * Written atomically (temp file + rename).
 * @returns {Promise<{ changed: boolean, rollup: object }>}
 */
export async function recomputeRollupFile(root = process.cwd(), { now = () => new Date() } = {}) {
  const rollupPath = path.join(root, 'content', 'ledger', 'rollup-stats.json');
  const { articles, editions } = await loadRollupInputs(root);
  if (editions.length === 0) throw new Error('rollup: no dated edition manifests found in content/editions/');
  const body = computeRollup(articles, { editions });

  let existing = null;
  try {
    existing = JSON.parse(await fs.readFile(rollupPath, 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT' && !(err instanceof SyntaxError)) throw err;
  }
  if (existing && typeof existing.as_of === 'string') {
    const { as_of: _asOf, ...existingBody } = existing;
    if (serialize(existingBody) === serialize(body)) {
      return { changed: false, rollup: existing };
    }
  }

  const rollup = { as_of: now().toISOString(), ...body };
  await fs.mkdir(path.dirname(rollupPath), { recursive: true });
  const tmp = `${rollupPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, serialize(rollup), 'utf-8');
  await fs.rename(tmp, rollupPath);
  return { changed: true, rollup };
}
