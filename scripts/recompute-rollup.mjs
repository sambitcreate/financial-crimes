#!/usr/bin/env node
/**
 * Recomputes content/ledger/rollup-stats.json from every content/articles/** /meta.json and the
 * dated edition manifests in content/editions/, using scripts/lib/rollup.mjs (the single rollup
 * definition shared with src/loaders/articles.ts and the wrist-slap judge).
 *
 *   npm run rollup:recompute            # rewrite if the computed body changed
 *   npm run rollup:recompute -- --check # exit 1 if rollup-stats.json is stale (no writes)
 *
 * Idempotent: `as_of` is only bumped when the computed body actually changes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { computeRollup, loadRollupInputs, recomputeRollupFile } from './lib/rollup.mjs';

async function check(root) {
  const { articles, editions } = await loadRollupInputs(root);
  const body = computeRollup(articles, { editions });
  const raw = await fs.readFile(path.join(root, 'content', 'ledger', 'rollup-stats.json'), 'utf-8');
  const { as_of: _asOf, ...onDisk } = JSON.parse(raw);
  if (JSON.stringify(onDisk) !== JSON.stringify(body)) {
    console.error('❌ content/ledger/rollup-stats.json is stale. Run `npm run rollup:recompute`.');
    process.exit(1);
  }
  console.log('✅ content/ledger/rollup-stats.json is up to date.');
}

async function main() {
  const root = process.cwd();
  if (process.argv.includes('--check')) return check(root);
  const { changed, rollup } = await recomputeRollupFile(root);
  const summary = `${rollup.total_cases} cases (${rollup.resolved_cases} resolved), loot ${rollup.total_loot_resolved_display} resolved + ${rollup.total_loot_alleged_display} alleged, fines ${rollup.total_fines_display} (${rollup.avg_fine_ratio_pct}%), frozen ${rollup.total_frozen_display}, avg slap ${rollup.avg_slap_on_wrist_score}, edition ${rollup.edition_date}`;
  console.log(changed ? `✅ Recomputed rollup-stats.json: ${summary}.` : `✅ rollup-stats.json unchanged: ${summary}.`);
}

main().catch((err) => {
  console.error(`❌ rollup recompute failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
