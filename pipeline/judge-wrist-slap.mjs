#!/usr/bin/env node
/**
 * Slap-on-the-Wrist Score judge. Gemini scores each resolved case against the PRD §2.3 rubric
 * in pipeline/prompts/wrist-slap-judge.md and the result is written to meta.json
 * `slap_on_wrist_score`. Unresolved cases are always written as null (PENDING).
 *
 *   GEMINI_API_KEY=... node pipeline/judge-wrist-slap.mjs            # dry run: print scores
 *   GEMINI_API_KEY=... node pipeline/judge-wrist-slap.mjs --write    # write meta.json
 *   ... --slug <slug>                                                # one case only
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const ARTICLES_ROOT = path.join(ROOT, 'content', 'articles');
const PROMPT_PATH = path.join(ROOT, 'pipeline', 'prompts', 'wrist-slap-judge.md');
const MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Stages with a final penalty. Everything else (indicted, arrested, interim orders, trial
 *  convictions awaiting sentence) renders PENDING. DPAs are final corporate resolutions. */
export const RESOLVED_STAGES = new Set(['settlement', 'regulatory_order', 'sentenced', 'dpa']);

async function findMetaFiles(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await findMetaFiles(full)));
    else if (entry.name === 'meta.json') out.push(full);
  }
  return out;
}

function caseFacts(meta) {
  return {
    headline: meta.headline,
    deck: meta.deck,
    jurisdiction: meta.jurisdiction,
    agencies: meta.agencies,
    legal_stage: meta.legal_stage,
    financials: meta.financials,
    exec_summary: meta.street_crime_compare?.exec_summary,
  };
}

/** Ask Gemini for one case's score. Returns { score, components, rationale }. */
export async function judgeCase(meta, { apiKey, model = MODEL, rubric }) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: rubric }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(caseFacts(meta), null, 2) }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const parsed = JSON.parse(text);
  const score = Math.round(Number(parsed.score));
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new Error(`Gemini returned an invalid score: ${text.slice(0, 200)}`);
  }
  return { score, components: parsed.components ?? null, rationale: String(parsed.rationale ?? '') };
}

/** Score every case (or one slug). Returns the number of meta.json files changed. */
export async function judgeAll({ apiKey, write = false, slug = null, model = MODEL } = {}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is required to judge wrist-slap scores');
  const rubric = await fs.readFile(PROMPT_PATH, 'utf-8');
  let changed = 0;

  for (const file of await findMetaFiles(ARTICLES_ROOT)) {
    const meta = JSON.parse(await fs.readFile(file, 'utf-8'));
    if (slug && meta.slug !== slug) continue;

    let next = null;
    if (RESOLVED_STAGES.has(String(meta.legal_stage).toLowerCase())) {
      const verdict = await judgeCase(meta, { apiKey, model, rubric });
      next = verdict.score;
      console.log(`[wrist-slap] ${meta.slug}: ${verdict.score}/100 — ${verdict.rationale}`);
    } else {
      console.log(`[wrist-slap] ${meta.slug}: PENDING (${meta.legal_stage})`);
    }

    if (meta.slap_on_wrist_score !== next) {
      changed++;
      if (write) {
        meta.slap_on_wrist_score = next;
        await fs.writeFile(file, `${JSON.stringify(meta, null, 2)}\n`);
      }
    }
  }
  console.log(`[wrist-slap] ${changed} score(s) ${write ? 'updated' : 'would change (dry run; pass --write)'}.`);
  return changed;
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const argv = process.argv.slice(2);
  const slugIdx = argv.indexOf('--slug');
  judgeAll({
    apiKey: process.env.GEMINI_API_KEY,
    write: argv.includes('--write'),
    slug: slugIdx >= 0 ? argv[slugIdx + 1] : null,
  }).catch((err) => {
    console.error('[wrist-slap] failed:', err.message);
    process.exit(1);
  });
}
