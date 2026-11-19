#!/usr/bin/env node
/**
 * The Financial Crimes — Daily Remote Sweep & Auto-Publish Orchestrator (v1.3)
 *
 * Schedule (America/New_York, DST-safe):
 *   - 6:00 AM ET (`--mode sweep`):   Global white-collar feed sweep -> Gemini 4 Hydrogen
 *                                    research, lean NYT-register drafting, Wikimedia/public-domain
 *                                    reference portrait sourcing (`public/paint-refs/<slug>.jpg`),
 *                                    and Canvas 2D impasto painting config generation via
 *                                    `pipeline/prompts/js-painting-prompt.md` (`content/paint-refs.json`).
 *   - 7:00 AM ET (`--mode publish`): Pre-press validation (articles + paint-refs + JPEGs),
 *                                    edition manifest finalization & auto-publish handoff
 *                                    to GitHub + Cloudflare CI/CD.
 *
 * AI Engine: Gemini API / Antigravity managed remote agent running `gemini-4-hydrogen`.
 * Painting Architecture: `sambitbiswas.com`-style Canvas 2D impasto engine (`src/painting/`)
 *   following the v1.3 "Wet-Oil & Archival Exhibit" interaction standard (shared lower-left
 *   Archival Exhibit Plate + 6 dignified wet-oil/fine-print surface reactions; zero floating
 *   center text, zero cartoon particles, zero `<img>` in DOM).
 * Note: Newsletter delivery (Cloudflare Email Service GA) is deferred to Phase 3.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { judgeAll } from './judge-wrist-slap.mjs';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
const PAINTING_PROMPT_PATH = path.join(process.cwd(), 'pipeline', 'prompts', 'js-painting-prompt.md');
const PAINT_REFS_MANIFEST_PATH = path.join(process.cwd(), 'content', 'paint-refs.json');
const PAINT_REFS_PUBLIC_DIR = path.join(process.cwd(), 'public');

const GLOBAL_REGULATOR_FEEDS = [
  { id: 'doj-press', region: 'us', agency: 'U.S. Department of Justice', kind: 'json' },
  { id: 'sec-litigation', region: 'us', agency: 'U.S. SEC', kind: 'rss' },
  { id: 'cftc-enforcement', region: 'us', agency: 'U.S. CFTC', kind: 'rss' },
  { id: 'treasury-fincen-ofac', region: 'us', agency: 'FinCEN / OCC / OFAC', kind: 'rss' },
  { id: 'courtlistener-recap', region: 'us', agency: 'Federal Courts (RECAP)', kind: 'api' },
  { id: 'sebi-orders', region: 'india', agency: 'SEBI', kind: 'rss' },
  { id: 'india-ed-cbi', region: 'india', agency: 'ED / CBI / PIB', kind: 'rss' },
  { id: 'uk-sfo-fca', region: 'london', agency: 'UK SFO / FCA', kind: 'atom' },
  { id: 'eu-eppo-bafin', region: 'europe', agency: 'EU EPPO / BaFin', kind: 'rss' },
  { id: 'apac-mas-sfc', region: 'global', agency: 'Singapore MAS / HK SFC', kind: 'rss' },
];

export const IMPASTO_PALETTE_MOODS = [
  'verdict-crimson',
  'bullion-gold',
  'subpoena-cobalt',
  'banknote-emerald',
  'courtroom-ochre',
  'monochrome-noir',
];

export const IMPASTO_TOY_KINDS = [
  'stamp',
  'coins',
  'redaction',
  'crash-line',
  'envelopes',
  'gavel-ripple',
];

export const INTERACTION_AESTHETIC = 'wet-oil-archival-exhibit-v1.3';

/**
 * Load the reusable Gemini 4 Hydrogen impasto painting prompt template (v1.3 Wet-Oil &
 * Archival Exhibit standard) and interpolate story dossier placeholders for either
 * `manifest-json` or `bespoke-scene-ts` output.
 */
export async function buildPaintingPrompt(vars = {}) {
  const template = await fs.readFile(PAINTING_PROMPT_PATH, 'utf8');
  const defaults = {
    ARTICLE_SLUG: '',
    ARTICLE_HEADLINE: '',
    SECTION_TEMPLATE: 'news',
    CITY_VENUE: '',
    DEFENDANT_NAME: '',
    SUBJECT_NAME: '',
    REFERENCE_IMAGE_URL: '',
    SOURCE_LICENSE: 'Public Domain',
    IS_PORTRAIT: 'false',
    KEY_NUMBERS: '',
    LEGAL_STAGE: 'indicted',
    ADMITTED_GUILT: 'null',
    SUMMARY_FACTS: '',
    OUTPUT_MODE: 'manifest-json',
  };
  const merged = { ...defaults, ...vars };
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => String(merged[key] ?? ''));
}

/**
 * Verify that `pipeline/prompts/js-painting-prompt.md` loads cleanly, codifies the v1.3
 * Wet-Oil & Archival Exhibit guardrails, and interpolates with zero leftover tokens.
 */
async function auditPaintingPrompt() {
  try {
    const rendered = await buildPaintingPrompt({
      ARTICLE_SLUG: 'dry-run-check',
      ARTICLE_HEADLINE: 'Dry Run Check',
    });
    const unresolved = rendered.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [];
    const hasArchivalPlate = rendered.includes('drawArchivalPlate');
    const hasNoFloatingBan = rendered.includes('ZERO floating drop-shadow typography');
    const issues = [];
    if (unresolved.length > 0) issues.push(`unresolved placeholders: ${unresolved.join(', ')}`);
    if (!hasArchivalPlate) issues.push('missing drawArchivalPlate specification');
    if (!hasNoFloatingBan) issues.push('missing floating-text prohibition');
    return { ready: issues.length === 0, bytes: Buffer.byteLength(rendered, 'utf8'), issues };
  } catch (err) {
    return { ready: false, bytes: 0, issues: [err.message] };
  }
}

/**
 * Verify that `content/paint-refs.json` is valid, every refImage JPEG exists on disk (>5KB),
 * and every mood/toy enum matches `src/painting/types.ts`.
 */
async function auditPaintRefs() {
  const raw = await fs.readFile(PAINT_REFS_MANIFEST_PATH, 'utf8');
  const manifest = JSON.parse(raw);
  const slugs = Object.keys(manifest);
  const moods = new Set(IMPASTO_PALETTE_MOODS);
  const toys = new Set(IMPASTO_TOY_KINDS);
  let portraits = 0;
  const issues = [];

  for (const slug of slugs) {
    const entry = manifest[slug];
    if (!entry?.refImage || !entry.refImage.startsWith('/paint-refs/')) {
      issues.push(`${slug}: missing or invalid refImage`);
      continue;
    }
    const diskPath = path.join(PAINT_REFS_PUBLIC_DIR, entry.refImage);
    try {
      const stat = await fs.stat(diskPath);
      if (stat.size < 5000) issues.push(`${slug}: refImage too small (${stat.size}B)`);
    } catch {
      issues.push(`${slug}: missing file ${diskPath}`);
    }
    if (!moods.has(entry.paletteMood)) issues.push(`${slug}: invalid paletteMood "${entry.paletteMood}"`);
    if (!toys.has(entry.toyKind)) issues.push(`${slug}: invalid toyKind "${entry.toyKind}"`);
    if (entry.isPortrait) portraits += 1;
  }

  return { total: slugs.length, portraits, issues };
}

function parseArgs(argv) {
  const args = {
    mode: 'dry-run',
    // en-CA formats as YYYY-MM-DD
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mode' && argv[i + 1]) {
      args.mode = argv[++i];
    } else if (argv[i] === '--date' && argv[i + 1]) {
      args.date = argv[++i];
    }
  }
  return args;
}

async function runSweepBlueprint({ mode, date }) {
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);
  const hasAntigravityAgent = Boolean(
    process.env.ANTIGRAVITY_AGENT_ENDPOINT && process.env.ANTIGRAVITY_AGENT_TOKEN
  );

  const promptAudit = await auditPaintingPrompt();
  const paintAudit = await auditPaintRefs().catch((err) => ({
    total: 0,
    portraits: 0,
    issues: [`paint-refs audit error: ${err.message}`],
  }));

  console.log('====================================================================');
  console.log(' The Financial Crimes — Remote Sweep Pipeline (v1.3 Wet-Oil Ready)  ');
  console.log('====================================================================');
  console.log(`Mode:            ${mode}`);
  console.log(`Edition Date:    ${date} (America/New_York)`);
  console.log(`AI Model:        ${DEFAULT_MODEL} (Research/Drafting + Canvas 2D Impasto Art)`);
  console.log(`Auth Status:     GEMINI_API_KEY=${hasGeminiKey ? 'configured' : 'unset'} | ANTIGRAVITY_REMOTE=${hasAntigravityAgent ? 'configured' : 'unset'}`);
  console.log(`Feeds Queued:    ${GLOBAL_REGULATOR_FEEDS.length} official regulator & court feeds`);
  console.log(`Painting Prompt: ${promptAudit.ready ? 'READY' : 'INVALID'} (${path.relative(process.cwd(), PAINTING_PROMPT_PATH)}, ${promptAudit.bytes}B)`);
  console.log(`Paint Refs Pool: ${paintAudit.total} entries (${paintAudit.portraits} portraits, ${paintAudit.total - paintAudit.portraits} landmarks/objects)`);
  console.log(`Engine Palette:  ${IMPASTO_PALETTE_MOODS.length} FC_OIL moods | ${IMPASTO_TOY_KINDS.length} wet-oil interactions | ${INTERACTION_AESTHETIC}`);

  if (promptAudit.issues.length > 0) {
    console.error('\n[painting-prompt] Audit issues detected:');
    for (const issue of promptAudit.issues) console.error(`  - ${issue}`);
    process.exitCode = 1;
    return;
  }

  if (paintAudit.issues.length > 0) {
    console.error('\n[paint-refs] Audit issues detected:');
    for (const issue of paintAudit.issues) console.error(`  - ${issue}`);
    process.exitCode = 1;
    return;
  }

  if (mode === 'dry-run' || (!hasGeminiKey && !hasAntigravityAgent)) {
    console.log('\n[blueprint] Running in safe non-mutating blueprint mode.');
    console.log('[blueprint] Phase 2 activation steps:');
    console.log('  1. Add GEMINI_API_KEY (or ANTIGRAVITY_AGENT_ENDPOINT + TOKEN) to GitHub Secrets.');
    console.log('  2. Wire feed fetchers + Wikimedia Commons portrait normalizer (max 320px RGB JPEG)');
    console.log('     in pipeline/fetchers/ writing to public/paint-refs/<slug>.jpg.');
    console.log('  3. 6:00 AM ET sweep invokes Gemini 4 Hydrogen with pipeline/prompts/js-painting-prompt.md');
    console.log('     to draft lean body.html + meta.json + content/paint-refs.json (libel-checked)');
    console.log('     and stages the daily edition.');
    console.log('  4. 7:00 AM ET publish runs validate:content + astro check + astro build + pagefind');
    console.log('     and merges to main for Cloudflare Workers Static Assets deployment.');
    return;
  }

  // Phase 2 hook: verify editions directory exists before remote agent invocation
  const editionsDir = path.join(process.cwd(), 'content', 'editions');
  await fs.mkdir(editionsDir, { recursive: true });

  // Wrist-slap scores are always Gemini's call (PRD §2.3 rubric), never hand-entered
  if (mode === 'sweep' && hasGeminiKey) {
    await judgeAll({ apiKey: process.env.GEMINI_API_KEY, write: true, model: DEFAULT_MODEL });
  }

  console.log(`\n[${mode}] Ready to dispatch ${DEFAULT_MODEL} sweep for edition ${date}.`);
  console.log(`[${mode}] Loaded impasto master prompt (${path.relative(process.cwd(), PAINTING_PROMPT_PATH)}).`);
  console.log(`[${mode}] Remote agent execution hook is scaffolded; no files mutated in Phase 1.`);
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const parsed = parseArgs(process.argv.slice(2));
  runSweepBlueprint(parsed).catch((err) => {
    console.error('Pipeline error:', err);
    process.exit(1);
  });
}
