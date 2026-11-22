#!/usr/bin/env node
/**
 * Deterministically recomputes content/ledger/rollup-stats.json from all
 * published article meta.json files under content/articles/.
 * Uses the exact same sum(fines)/sum(scale) formula as src/loaders/articles.ts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const ARTICLES_ROOT = path.join(PROJECT_ROOT, 'content', 'articles');
const ROLLUP_PATH = path.join(PROJECT_ROOT, 'content', 'ledger', 'rollup-stats.json');

const REGION_LABELS = {
  us: 'U.S.',
  'new-york': 'NEW YORK',
  chicago: 'CHICAGO',
  'los-angeles': 'L.A.',
  london: 'LONDON',
  india: 'INDIA',
  europe: 'EUROPE',
  global: 'GLOBAL',
};

const REGION_ORDER = ['us', 'new-york', 'chicago', 'los-angeles', 'london', 'india', 'europe'];
const US_EDITIONS = new Set(['us', 'new-york', 'chicago', 'los-angeles']);

function formatUsdShort(value, digits = { B: 2, M: 1, K: 0 }) {
  if (!Number.isFinite(value)) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const units = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (let i = 0; i < units.length; i++) {
    const [size, unit] = units[i];
    const scaled = Number((abs / size).toFixed(digits[unit]));
    if (scaled >= 1000 && i > 0) {
      const [biggerSize, biggerUnit] = units[i - 1];
      return `${sign}$${(abs / biggerSize).toFixed(digits[biggerUnit])}${biggerUnit}`;
    }
    if (scaled >= 1) return `${sign}$${scaled.toFixed(digits[unit])}${unit}`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

function aggregateRatioPct(fines, loot) {
  return loot > 0 ? Number(((fines / loot) * 100).toFixed(2)) : null;
}

async function findMetaFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findMetaFiles(full)));
    } else if (entry.isFile() && entry.name === 'meta.json') {
      results.push(full);
    }
  }
  return results;
}

async function main() {
  const metaPaths = await findMetaFiles(ARTICLES_ROOT);
  const articles = [];
  for (const metaPath of metaPaths) {
    const raw = await fs.readFile(metaPath, 'utf-8');
    articles.push(JSON.parse(raw));
  }

  articles.sort((a, b) => {
    const dateCmp = (Date.parse(b.publish_date) || 0) - (Date.parse(a.publish_date) || 0);
    if (dateCmp !== 0) return dateCmp;
    return String(a.id).localeCompare(String(b.id));
  });

  const totalLootUsd = articles.reduce((sum, a) => sum + (a.financials?.amount_usd ?? 0), 0);
  const totalFinesUsd = articles.reduce((sum, a) => sum + (a.financials?.fine_usd ?? 0), 0);
  const avgFineRatioPct = aggregateRatioPct(totalFinesUsd, totalLootUsd) ?? 0;

  const scores = articles
    .map((a) => a.slap_on_wrist_score)
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  const avgSlapScore =
    scores.length > 0
      ? Number((scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(1))
      : 0;

  const zeroPrisonCases = articles.filter((a) => a.financials?.prison_months === 0).length;

  const regionBuckets = new Map();
  for (const article of articles) {
    const key = String(article.edition || '').toLowerCase();
    const bucketKeys = new Set([key]);
    if (US_EDITIONS.has(key)) bucketKeys.add('us');
    for (const bucketKey of bucketKeys) {
      if (!bucketKey || bucketKey === 'global') continue;
      const bucket = regionBuckets.get(bucketKey) ?? [];
      bucket.push(article);
      regionBuckets.set(bucketKey, bucket);
    }
  }

  const orderedKeys = [
    ...REGION_ORDER.filter((k) => regionBuckets.has(k)),
    ...[...regionBuckets.keys()].filter((k) => !REGION_ORDER.includes(k)).sort(),
  ];

  const regions = {};
  for (const key of orderedKeys) {
    const list = regionBuckets.get(key) ?? [];
    const loot = list.reduce((sum, a) => sum + (a.financials?.amount_usd ?? 0), 0);
    const fines = list.reduce((sum, a) => sum + (a.financials?.fine_usd ?? 0), 0);
    regions[key] = {
      label: REGION_LABELS[key] ?? key.toUpperCase(),
      case_count: list.length,
      total_loot_usd: loot,
      total_loot_display: formatUsdShort(loot),
      total_fines_usd: fines,
      total_fines_display: formatUsdShort(fines),
      avg_fine_ratio_pct: aggregateRatioPct(fines, loot),
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

  const latestEditionDate = articles[0]?.edition_date ?? new Date().toISOString().slice(0, 10);

  const rollup = {
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

  await fs.writeFile(ROLLUP_PATH, `${JSON.stringify(rollup, null, 2)}\n`, 'utf-8');
  console.log(
    `✅ Recomputed rollup-stats.json: ${rollup.total_cases} cases, scale ${rollup.total_loot_display}, fines ${rollup.total_fines_display} (${rollup.avg_fine_ratio_pct}%), avg slap ${rollup.avg_slap_on_wrist_score}.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
