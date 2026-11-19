# The Financial Crimes — Phase 2 Daily Remote Sweep Pipeline

This directory contains the blueprint and CLI entry point for **The Financial Crimes** autonomous daily broadsheet production pipeline.

## Schedule (DST-Safe `America/New_York`)

| Beat | Local Time (ET) | Mode | Purpose |
| :--- | :--- | :--- | :--- |
| **Morning Research & Art Sweep** | **6:00 AM ET** | `--mode sweep` | Polls 25+ global court & regulator feeds (DOJ, SEC, CFTC, CourtListener, FinCEN/OCC/OFAC, SEBI, ED/CBI, UK SFO/FCA, EU EPPO, BaFin, MAS, HK SFC), runs **Gemini 4 Hydrogen** deep research + Atomic Fact Ledger verification + deadpan NYT-register drafting + custom interactive JS editorial painting spec generation (`interactive_art_spec`), validates all schemas, and stages the daily edition. |
| **Morning Press Auto-Publish** | **7:00 AM ET** | `--mode publish` | Performs a fast pre-press delta check, updates `content/editions/YYYY-MM-DD.json`, `content/editions/latest.json`, and `content/ledger/rollup-stats.json`, verifies `validate:content` + `check` + `build`, and pushes to `main` so GitHub + Cloudflare CI/CD auto-deploys `dist/` to Cloudflare Workers with Static Assets. |

## AI Engine Architecture

Both editorial journalism and visual storytelling are powered by **Gemini 4 Hydrogen** via the **Gemini API** or an **Antigravity managed remote agent**:

1. **White-Collar Research & Drafting (`GEMINI_MODEL=gemini-4-hydrogen`):**
   - Strictly enforces the **Hard Fact/Satire Wall** (zero fabricated quotes, charges, defendants, or figures).
   - Grounded exclusively in primary public filings, indictments, consent orders, and regulatory dockets.
   - Outputs valid `meta.json` (matching `src/schemas/article.ts`) and semantic `body.html` (`<p>`, `<h2>`, `<blockquote>`, `<aside class="fc-factbox">`, zero `<img>` tags).
2. **Custom Interactive JavaScript Editorial Paintings (`GEMINI_MODEL=gemini-4-hydrogen`):**
   - Zero real photographs or stock images anywhere on the site.
   - For every story, Gemini 4 Hydrogen selects one of the 8 editorial archetypes (`shell-network`, `scale-of-impunity`, `redacted-dossier`, `pump-dump-ticker`, `ponzi-pyramid`, `offshore-flight-map`, `editorial-vignette`, `penalty-wheel`) and generates a case-specific `interactive_art_spec` JSON payload populated with verified entity names, dollar amounts, timestamps, court quotes, and geographic routes.

## Slap-on-the-Wrist Score (Gemini-judged)

Scores are never hand-entered. `pipeline/judge-wrist-slap.mjs` sends each case's facts to Gemini with the
PRD §2.3 rubric in `pipeline/prompts/wrist-slap-judge.md` and writes `slap_on_wrist_score` to `meta.json`.
Only resolved stages (`settlement`, `regulatory_order`, `sentenced`, `dpa`) get a score; every other stage is
written as `null` and renders PENDING. The 6:00 AM sweep re-judges every case when `GEMINI_API_KEY` is set.

```bash
GEMINI_API_KEY=... npm run judge:slap              # dry run, prints scores and rationale
GEMINI_API_KEY=... npm run judge:slap -- --write   # write meta.json
GEMINI_API_KEY=... npm run judge:slap -- --slug <slug> --write
```

## Required Secrets (Phase 2 Activation)

Configure these in GitHub Actions Repository Secrets when enabling Phase 2:

- `GEMINI_API_KEY` — Gemini API key with access to `gemini-4-hydrogen`.
- `ANTIGRAVITY_AGENT_ENDPOINT` *(optional)* — Managed Antigravity remote agent endpoint if delegating the multi-step sweep to an Antigravity remote worker.
- `ANTIGRAVITY_AGENT_TOKEN` *(optional)* — Auth token for the managed Antigravity remote agent.
- `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID` — For Wrangler Static Assets deployment (or connect the GitHub repo directly in Cloudflare Workers Builds).

## Newsletter (Phase 3 — Deferred)

Phase 1 and Phase 2 remain **website-only**. Automated 7:00 AM ET **Morning Docket** email delivery is planned for **Phase 3** using **Cloudflare Email Service (GA)**.

## Running Locally

```bash
# Dry-run blueprint check (no API key required)
node pipeline/run-sweep.mjs --mode dry-run --date 2026-11-19

# Sweep stage (requires GEMINI_API_KEY when Phase 2 fetchers are wired)
GEMINI_API_KEY=... node pipeline/run-sweep.mjs --mode sweep --date 2026-11-19
```
