# The Financial Crimes — Editorial Scoring & Daily Sweep Pipeline

This directory holds the **Slap-on-the-Wrist Score** Gemini judge (`judge-wrist-slap.mjs`), the machine-readable art & scoring prompts (`prompts/`), and the **Phase 2** daily sweep orchestrator (`run-sweep.mjs`).

---

## Implementation Status (Phase 1 vs. Phase 2 vs. Phase 3)

| Capability | File / Workflow | Status |
| :--- | :--- | :--- |
| **Gemini Slap-on-the-Wrist Score Judge** | `pipeline/judge-wrist-slap.mjs` + `prompts/wrist-slap-judge.md` | **Implemented (Phase 1)** — scores unscored/changed resolved cases (`settlement`, `regulatory_order`, `sentenced`, `dpa`) with stored provenance and writes `null` (`PENDING`) for unresolved stages. |
| **Impasto Painting Prompt & `paint-refs.json` Audit** | `pipeline/run-sweep.mjs` + `prompts/js-painting-prompt.md` | **Implemented (Phase 1)** — `--mode dry-run` verifies prompt integrity, 1:1 coverage between `content/articles/` and `content/paint-refs.json`, `https://` `sourceUrl` + `sourceLicense` attribution, JPEG existence (`> 5 KB`), and mood/toy enums. |
| **Global Regulator Feed Fetchers & Automated Drafting** | `pipeline/fetchers/` (planned) | **Stubbed for Phase 2** — `GLOBAL_REGULATOR_FEEDS` is cataloged in `run-sweep.mjs`; live feed fetchers, automated Wikimedia 320px portrait normalization, and article drafting are not yet wired. |
| **Automated Daily 6:00 AM ET Sweep** | Antigravity Scheduled Automation (`Financial Crimes — Daily Morning Sweep`, `gemini-4-neon-high`) | **Configured** — replaces GitHub Actions cron; runs daily at 6:00 AM `America/New_York`, researches new global white-collar filings, writes verified HTML + `meta.json` + 320px portraits, runs validation/tests/build, pushes to `main`, and deploys live to `https://financialcrimes.fyi`. |
| **Email Sign-Ups & Tip Intake** | Cloudflare Email Service (GA) | **Coming Soon (Phase 3)** — RSS at `/rss.xml` is live now; Subscribe & Tip Line modals display Coming Soon. |

---

## Daily Sweep Schedule (`CRON_TZ=America/New_York 0 6 * * *`)

The daily sweep runs via **Antigravity Scheduled Automation** (**`Financial Crimes — Daily Morning Sweep`**) pinned to **Gemini 4 Neon (High)**:

1. Pulls latest `main` and inspects existing slugs in `content/articles/` to avoid duplicates.
2. Sweeps primary global court & regulatory sources (DOJ, SEC, CFTC, FinCEN/OCC/OFAC, SEBI, ED/CBI, UK SFO/FCA, EU EPPO, BaFin, MAS, HK SFC) for new material white-collar enforcement actions.
3. Drafts primary-sourced `meta.json` + sanitized `body.html`, sources & normalizes `<= 320px` Wikimedia/gov reference JPEGs into `public/paint-refs/<slug>.jpg` with mandatory `https://` CC attribution in `content/paint-refs.json`, and updates `content/editions/` + `content/ledger/rollup-stats.json` (via `npm run rollup:recompute`).
4. Runs `npm run validate:content && npm test && npm run check && npm run build`, commits & pushes to `origin main`, and deploys `dist/` to `https://financialcrimes.fyi`.

---

## Editorial & Visual Contracts

1. **White-Collar Research & Sanitized HTML Drafting:**
   - Enforces the **Hard Fact/Satire Wall** (zero fabricated quotes, charges, defendants, or figures) and strict `legal_stage` enum (`src/schemas/article.ts`).
   - Every `sources[].url` MUST use `https://`.
   - `body.html` MUST use allowlisted broadsheet HTML tags only (`<p>`, `<h2>`, `<h3>`, `<blockquote>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<b>`, `<i>`, `<a>`, `<br>`, `<code>`, `<sup>`, `<sub>`, `<span>`) — **never** `<img>`, `<script>`, `<aside>`, inline event handlers, or `javascript:`/`data:` URLs. All `body.html` is sanitized at build time by `src/utils/sanitize.ts` and validated by `scripts/validate-content.mjs`.
2. **Canvas 2D Impasto Portrait Paintings (`src/painting/`):**
   - **Zero `<img>` elements in the DOM:** Every story pairs an entry in `content/paint-refs.json` with a normalized open-license RGB JPEG at `public/paint-refs/<slug>.jpg` (**max `320px` longest edge, `> 5 KB`**), decoded strictly in memory via `loadPixels(url, 180)`.
   - **Mandatory CC Attribution:** Every `content/paint-refs.json` entry requires a valid `https://` `sourceUrl` and `sourceLicense` (`Public Domain`, `CC0`, `CC BY *`, `CC BY-SA *`, `OGL *`, `GODL-India`), rendered automatically in `FcArt.astro` captions and aggregated on `/about`.
   - **Wet-Oil & Archival Exhibit Grammar (v1.3+):** 6 `FC_OIL` palette moods (`verdict-crimson`, `bullion-gold`, `subpoena-cobalt`, `banknote-emerald`, `courtroom-ochre`, and mandatory `monochrome-noir` for Opinion pieces) paired with 6 dignified surface reactions (`stamp`, `coins`, `redaction`, `crash-line`, `envelopes`, `gavel-ripple`) and a single shared lower-left Archival Exhibit Plate (`drawArchivalPlate`). See [`docs/PAINTING_PROMPT.md`](../docs/PAINTING_PROMPT.md).

---

## Slap-on-the-Wrist Score (Gemini-Judged)

Scores are never hand-entered. `pipeline/judge-wrist-slap.mjs` sends each targeted resolved case's verified
facts to Gemini with the PRD §2.3 rubric in `pipeline/prompts/wrist-slap-judge.md` and writes
`slap_on_wrist_score` (integer `0–100`) plus `score_provenance` to `meta.json`.

- **Scored stages:** `settlement`, `regulatory_order`, `sentenced`, `dpa`
- **Unresolved stages:** always `null` (rendered `PENDING`); any stray score or `score_provenance` is removed.
- **Default model:** `gemini-2.5-pro` (`DEFAULT_GEMINI_MODEL` in [`pipeline/config.mjs`](./config.mjs), shared by
  the judge and `run-sweep.mjs`). Override with `GEMINI_MODEL`.

### Which cases get judged

By default the judge **never re-rolls a published score**. It targets only resolved cases whose score is
`null`, or whose stored `score_provenance.inputs_sha256` no longer matches the case facts (the stage,
financials, deck, agencies, jurisdiction or summary changed since judging). Legacy scores without provenance
are left untouched and reported. Re-judge explicitly with `--slug <slug>` (one case) or `--force` (all).

```bash
npm run judge:slap -- --plan                                   # list targets; no API key, no calls
GEMINI_API_KEY=... npm run judge:slap                          # judge targets, print verdicts, write nothing
GEMINI_API_KEY=... npm run judge:slap -- --write               # write meta.json + recompute the rollup
GEMINI_API_KEY=... npm run judge:slap -- --slug <slug> --write # re-judge one case
GEMINI_API_KEY=... npm run judge:slap -- --force --write       # re-judge every resolved case
GEMINI_API_KEY=... npm run judge:slap -- --write --partial     # write successes even if some cases fail
```

`--slug` without a value, unknown flags, `--partial` without `--write`, and `--plan --write` all exit 1.

### Safety guarantees

- **Strict output validation:** `score` must be a JSON integer in `0..100` (no coercion of `null`, `""`,
  `"85"`, `[42]`, `true`); `components` must be exactly `{ fine_ratio: 0..50, no_admission: 0|15,
  accountability_gap: 0..35 }`, all integers, summing **exactly** to `score`; `rationale` is a required
  non-empty string (≤ 1000 chars).
- **Timeouts & retries:** each request uses `AbortSignal.timeout(60s)`; 429 / 5xx / network errors / timeouts
  are retried with exponential backoff (2s, 4s; 3 attempts total). Other 4xx and invalid output fail fast.
- **All-or-nothing writes:** every targeted case is judged into memory first. If any fails, nothing is written
  (unless `--partial`). Files are re-validated, written to temp files and renamed into place, then
  `content/ledger/rollup-stats.json` is recomputed via `scripts/lib/rollup.mjs`.
- **Prompt-injection hardening:** case facts are sent as JSON inside a single `<case_facts>` block with `<`/`>`
  escaped (`\u003c`/`\u003e`), so no field can close or forge the block; the system prompt declares the block
  untrusted data, never instructions. The satirical headline is not sent.

### `score_provenance` (written to `meta.json`)

```json
"score_provenance": {
  "model": "gemini-2.5-pro",
  "prompt_sha256": "<sha256 of the exact system prompt = pipeline/prompts/wrist-slap-judge.md>",
  "judged_at": "2026-11-22T12:00:00.000Z",
  "components": { "fine_ratio": 12, "no_admission": 15, "accountability_gap": 35 },
  "rationale": "One deadpan sentence citing the figures used.",
  "inputs_sha256": "<sha256 of the canonical case facts sent to the judge>"
}
```

---

## Rollup Stats (`npm run rollup:recompute`)

`content/ledger/rollup-stats.json` is generated, never hand-edited. `scripts/lib/rollup.mjs` is the single
definition used by `scripts/recompute-rollup.mjs`, the judge, and `src/loaders/articles.ts` (the site always
renders the computed rollup; the file supplies `as_of` and is kept in parity by tests).

```bash
npm run rollup:recompute              # rewrite only if totals changed (as_of bumps only then)
npm run rollup:recompute -- --check   # exit 1 if rollup-stats.json is stale
```

- **Fines** (`total_fines_usd`, `avg_fine_ratio_pct`) count only resolved stages; the ratio is resolved fines
  ÷ resolved loot.
- **Frozen / escrowed money** in unresolved cases is `total_frozen_usd` / `total_frozen_display` — never a fine.
- **Loot** is split into `total_loot_resolved_usd` and `total_loot_alleged_usd` (pending or awaiting
  sentence); `total_loot_usd` is their sum. Dismissed / acquitted cases contribute no money.
- **Counts:** `total_cases`, `resolved_cases`, `unresolved_cases`, `retracted_cases`. Retracted articles are
  excluded from every total. Each region carries the same split plus `resolved_case_count`.
- **`edition_date`** is the newest dated `content/editions/YYYY-MM-DD.json`, not the newest article.

---

## Running `run-sweep.mjs` Locally

```bash
# Dry-run audit (no API key required; verifies prompt + 1:1 paint-refs + JPEGs + https:// attribution)
node pipeline/run-sweep.mjs --mode dry-run

# Sweep mode: requires GEMINI_API_KEY (exits 1 without it). Judges only unscored/changed resolved cases,
# writes atomically and recomputes the rollup. Phase 2 feed fetchers & article drafting remain scaffolded.
GEMINI_API_KEY=... node pipeline/run-sweep.mjs --mode sweep
```

Unknown `--mode` values exit 1.

---

## Configuration (Secrets & Variables)

See [`.env.example`](../.env.example) for the complete list:
- **Secrets:** `GEMINI_API_KEY`, optional `ANTIGRAVITY_AGENT_ENDPOINT` & `ANTIGRAVITY_AGENT_TOKEN`, plus
  `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID` (if deploying via GitHub Actions).
- **Variables:** `GEMINI_MODEL` (optional; defaults to `gemini-2.5-pro` from `pipeline/config.mjs`),
  `CLOUDFLARE_DEPLOY_ENABLED` (`true` to enable GitHub Actions deploy in `ci.yml`).
