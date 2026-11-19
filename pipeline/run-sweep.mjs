#!/usr/bin/env node
/**
 * The Financial Crimes — Daily Remote Sweep & Auto-Publish Orchestrator (Phase 2 Blueprint)
 *
 * Schedule (America/New_York, DST-safe):
 *   - 6:00 AM ET (`--mode sweep`):   Global white-collar feed sweep -> Gemini 4 Hydrogen
 *                                    research, drafting & custom JS painting spec generation.
 *   - 7:00 AM ET (`--mode publish`): Pre-press validation, edition manifest finalization &
 *                                    auto-publish handoff to GitHub + Cloudflare CI/CD.
 *
 * AI Engine: Gemini API / Antigravity managed remote agent running `gemini-4-hydrogen`.
 * Note: Newsletter delivery (Cloudflare Email Service GA) is deferred to Phase 3.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

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

const ART_ARCHETYPES = [
  'shell-network',
  'scale-of-impunity',
  'redacted-dossier',
  'pump-dump-ticker',
  'ponzi-pyramid',
  'offshore-flight-map',
  'editorial-vignette',
  'penalty-wheel',
];

function parseArgs(argv) {
  const args = {
    mode: 'dry-run',
    date: new Date().toISOString().slice(0, 10),
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

  console.log('==============================================================');
  console.log(' The Financial Crimes — Remote Sweep Pipeline (Phase 2 Ready) ');
  console.log('==============================================================');
  console.log(`Mode:          ${mode}`);
  console.log(`Edition Date:  ${date} (America/New_York)`);
  console.log(`AI Model:      ${DEFAULT_MODEL} (Research/Drafting + JS Editorial Paintings)`);
  console.log(`Auth Status:   GEMINI_API_KEY=${hasGeminiKey ? 'configured' : 'unset'} | ANTIGRAVITY_REMOTE=${hasAntigravityAgent ? 'configured' : 'unset'}`);
  console.log(`Feeds Queued:  ${GLOBAL_REGULATOR_FEEDS.length} official regulator & court feeds`);
  console.log(`Art Engine:    ${ART_ARCHETYPES.length} interactive JS archetypes (zero real photos)`);

  if (mode === 'dry-run' || (!hasGeminiKey && !hasAntigravityAgent)) {
    console.log('\n[blueprint] Running in safe non-mutating blueprint mode.');
    console.log('[blueprint] Phase 2 activation steps:');
    console.log('  1. Add GEMINI_API_KEY (or ANTIGRAVITY_AGENT_ENDPOINT + TOKEN) to GitHub Secrets.');
    console.log('  2. Implement feed fetchers + Atomic Fact Ledger persistence in pipeline/fetchers/.');
    console.log('  3. 6:00 AM ET sweep invokes Gemini 4 Hydrogen to draft body.html + meta.json');
    console.log('     (including bespoke interactive_art_spec for each story) and opens a staged commit.');
    console.log('  4. 7:00 AM ET publish runs validate:content + astro check + astro build + pagefind');
    console.log('     and merges to main for Cloudflare Workers Static Assets deployment.');
    return;
  }

  // Phase 2 hook: verify editions directory exists before remote agent invocation
  const editionsDir = path.join(process.cwd(), 'content', 'editions');
  await fs.mkdir(editionsDir, { recursive: true });

  console.log(`\n[${mode}] Ready to dispatch ${DEFAULT_MODEL} sweep for edition ${date}.`);
  console.log(`[${mode}] Remote agent execution hook is scaffolded; no files mutated in Phase 1.`);
}

const parsed = parseArgs(process.argv.slice(2));
runSweepBlueprint(parsed).catch((err) => {
  console.error('Pipeline error:', err);
  process.exit(1);
});
