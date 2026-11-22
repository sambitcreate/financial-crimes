# The Financial Crimes — Editorial Scoring & Daily Sweep Pipeline

This directory holds the **Slap-on-the-Wrist Score** Gemini judge (`judge-wrist-slap.mjs`), the machine-readable art & scoring prompts (`prompts/`), and the **Phase 2** daily sweep orchestrator (`run-sweep.mjs`).

---

## Implementation Status (Phase 1 vs. Phase 2 vs. Phase 3)

| Capability | File / Workflow | Status |
| :--- | :--- | :--- |
| **Gemini Slap-on-the-Wrist Score Judge** | `pipeline/judge-wrist-slap.mjs` + `prompts/wrist-slap-judge.md` | **Implemented (Phase 1)** — scores resolved cases (`settlement`, `regulatory_order`, `sentenced`, `dpa`) and writes `null` (`PENDING`) for unresolved stages. |
| **Impasto Painting Prompt & `paint-refs.json` Audit** | `pipeline/run-sweep.mjs` + `prompts/js-painting-prompt.md` | **Implemented (Phase 1)** — `--mode dry-run` verifies prompt integrity, 1:1 coverage between `content/articles/` and `content/paint-refs.json`, `https://` `sourceUrl` + `sourceLicense` attribution, JPEG existence (`> 5 KB`), and mood/toy enums. |
| **Global Regulator Feed Fetchers & Automated Drafting** | `pipeline/fetchers/` (planned) | **Stubbed for Phase 2** — `GLOBAL_REGULATOR_FEEDS` is cataloged in `run-sweep.mjs`; live feed fetchers, automated Wikimedia 320px portrait normalization, and article drafting are not yet wired. |
| **Automated Daily 6:00 AM ET Sweep** | Antigravity Scheduled Automation (`Financial Crimes — Daily Morning Sweep`, `gemini-4-neon-high`) | **Configured** — replaces GitHub Actions cron; runs daily at 6:00 AM `America/New_York`, researches new global white-collar filings, writes verified HTML + `meta.json` + 320px portraits, runs validation/tests/build, pushes to `main`, and deploys live to `https://financialcrimes.fyi`. |
| **Email Sign-Ups & Tip Intake** | Cloudflare Email Service (GA) | **Coming Soon (Phase 3)** — RSS at `/rss.xml` is live now; Subscribe & Tip Line modals display Coming Soon. |

---

## Daily Sweep Schedule (`CRON_TZ=America/New_York 0 6 * * *`)

The daily sweep runs via **Antigravity Scheduled Automation** (**`Financial Crimes — Daily Morning Sweep`**) pinned to **Gemini 4 Neon (High)**:

1. Pulls latest `main` and inspects existing slugs in `content/articles/` to avoid duplicates.
2. Sweeps primary global court & regulatory sources (DOJ, SEC, CFTC, FinCEN/OCC/OFAC, SEBI, ED/CBI, UK SFO/FCA, EU EPPO, BaFin, MAS, HK SFC) for new material white-collar enforcement actions.
3. Drafts primary-sourced `meta.json` + sanitized `body.html`, sources & normalizes `<= 320px` Wikimedia/gov reference JPEGs into `public/paint-refs/<slug>.jpg` with mandatory `https://` CC attribution in `content/paint-refs.json`, and updates `content/editions/` + `content/ledger/rollup-stats.json`.
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

Scores are never hand-entered. `pipeline/judge-wrist-slap.mjs` sends each resolved case's verified facts to Gemini with the PRD §2.3 rubric in `pipeline/prompts/wrist-slap-judge.md` and writes `slap_on_wrist_score` (`0–100`) to `meta.json`.

- **Scored stages:** `settlement`, `regulatory_order`, `sentenced`, `dpa`
- **Unresolved stages:** written as `null` and rendered as `PENDING`

```bash
GEMINI_API_KEY=... npm run judge:slap                       # dry run: prints scores & rationale
GEMINI_API_KEY=... npm run judge:slap -- --write            # updates meta.json for all stories
GEMINI_API_KEY=... npm run judge:slap -- --slug <slug> --write
```

Override the Gemini model with `GEMINI_MODEL` (e.g. `GEMINI_MODEL=gemini-2.5-pro`).

---

## Running `run-sweep.mjs` Locally

```bash
# Dry-run audit (no API key required; verifies prompt + 1:1 paint-refs + JPEGs + https:// attribution)
node pipeline/run-sweep.mjs --mode dry-run

# Sweep mode (with GEMINI_API_KEY, runs judgeAll({ write: true }) to refresh meta.json scores;
# Phase 2 feed fetchers & remote article drafting remain scaffolded)
GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.5-pro node pipeline/run-sweep.mjs --mode sweep
```

---

## Configuration (Secrets & Variables)

See [`.env.example`](../.env.example) for the complete list:
- **Repository Secrets:** `GEMINI_API_KEY`, optional `ANTIGRAVITY_AGENT_ENDPOINT` & `ANTIGRAVITY_AGENT_TOKEN`, plus `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID` (if deploying via GitHub Actions).
- **Repository Variables:** `GEMINI_MODEL` (defaults to `gemini-2.5-pro` in `daily-sweep.yml`), `CLOUDFLARE_DEPLOY_ENABLED` (`true` to enable GitHub Actions deploy in `ci.yml`).
