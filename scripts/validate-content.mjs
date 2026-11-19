#!/usr/bin/env node
/**
 * Fast content validator for The Financial Crimes.
 * Validates every content/articles/<yyyy>/<mm>/<slug>/{meta.json, body.html},
 * every edition manifest under content/editions/, and content/ledger/rollup-stats.json.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const PROJECT_ROOT = process.cwd();
const ARTICLES_ROOT = path.join(PROJECT_ROOT, 'content', 'articles');
const EDITIONS_ROOT = path.join(PROJECT_ROOT, 'content', 'editions');
const ROLLUP_PATH = path.join(PROJECT_ROOT, 'content', 'ledger', 'rollup-stats.json');

const ArtArchetypeSchema = z.enum([
  'shell-network',
  'scale-of-impunity',
  'redacted-dossier',
  'pump-dump-ticker',
  'ponzi-pyramid',
  'offshore-flight-map',
  'editorial-vignette',
  'penalty-wheel',
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
  legal_stage: z.string().min(1),
  template: z.enum(['news', 'opinion']),
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  deck: z.string().min(1),
  byline: z.string().min(1),
  dateline: z.string().min(1),
  read_time_min: z.number().int().positive(),
  comment_count: z.number().int().nonnegative(),
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
        url: z.string().url(),
        date: z.string().min(1),
      })
    )
    .min(1),
  interactive_art_spec: z.object({
    archetype: ArtArchetypeSchema,
    accent: z.enum(['crimson', 'slate', 'gold', 'sage']),
    theme: z.enum(['newsprint', 'monochrome']).optional(),
    caption: z.string().min(1),
    credit: z.string().optional(),
    data: z.record(z.string(), z.any()),
  }),
  status: z.literal('published'),
});

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
      if (/<img\b/i.test(html)) {
        errors.push(`${relDir}/body.html: contains forbidden <img> tag (zero real photos policy)`);
      }
      if (/<script\b/i.test(html)) {
        errors.push(`${relDir}/body.html: contains forbidden <script> tag`);
      }
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
      RollupStatsSchema.parse(JSON.parse(raw));
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
    `✅ Content validation passed: ${articleDirs.length} article(s), ${editionCount} edition manifest(s).`
  );
}

main().catch((err) => {
  console.error('❌ Unexpected validator error:', err);
  process.exit(1);
});
