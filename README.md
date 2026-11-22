# The Financial Crimes

> *"All the Crimes Fit to Fine."*

**The Financial Crimes** is an independent, satirical-yet-factually-grounded digital broadsheet covering global white-collar, corporate, regulatory, political, and institutional financial crimes. Built with **Astro 5** (static output), **Pagefind** client-side search, a custom **Canvas 2D impasto painting engine** (`<fc-painting>`, zero `<img>` tags in the DOM), and **Cloudflare Workers with Static Assets**.

---

## Quickstart

Requires **Node.js 22** (pinned in [`.nvmrc`](./.nvmrc)).

```bash
nvm use          # switches to Node 22
npm ci           # installs dependencies cleanly
npm run dev      # starts local Astro dev server at http://localhost:4321
```

> **Note on Search (`/ledger`):** Pagefind indexes the compiled HTML in `dist/` at build time. Full-text search on `/ledger` activates after building and previewing:
>
> ```bash
> npm run build && npm run preview
> ```

No API keys or environment variables are needed for local development, testing, validation, or static builds. See [`.env.example`](./.env.example) for optional scoring (`GEMINI_API_KEY`) and deployment variables.

---

## npm Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `npm run dev` | Start the Astro 5 development server (`http://localhost:4321`) |
| `build` | `npm run build` | Build static site into `dist/` and generate the Pagefind search index (`dist/pagefind`) |
| `preview` | `npm run preview` | Serve `dist/` locally (including Pagefind search, sitemap, and RSS) |
| `check` | `npm run check` | Run `astro check` + TypeScript typechecking across `src/` |
| `test` | `npm test` | Run the Vitest unit test suite (`vitest run`) |
| `validate:content` | `npm run validate:content` | Validate every article `meta.json` & sanitized `body.html`, edition manifests, rollup stats, and 1:1 `paint-refs.json` + JPEG integrity |
| `rollup:recompute` | `npm run rollup:recompute` | Recompute `content/ledger/rollup-stats.json` from articles + dated edition manifests via `scripts/lib/rollup.mjs` (idempotent: `as_of` only changes when totals change; `-- --check` exits 1 if stale). Run after any `meta.json` or edition change. |
| `judge:slap` | `npm run judge:slap` | Score **unscored or changed** resolved cases (`settlement`, `regulatory_order`, `sentenced`, `dpa`) via Gemini with stored `score_provenance` (`-- --plan` lists targets without a key; `GEMINI_API_KEY` + `-- --write` to update `meta.json`; see [`pipeline/README.md`](./pipeline/README.md)) |

Run the full pre-commit check locally:

```bash
npm run validate:content && npm test && npm run check && npm run build
```

---

## Repository Map

```text
.
├── content/
│   ├── articles/YYYY/MM/<slug>/   # Git-backed CMS: meta.json + body.html per story
│   ├── editions/                  # Daily edition manifests (YYYY-MM-DD.json & latest.json)
│   ├── ledger/rollup-stats.json   # Generated aggregates (npm run rollup:recompute); never hand-edit
│   └── paint-refs.json            # Impasto painting manifest + Wikimedia/gov CC attribution
├── public/
│   ├── paint-refs/<slug>.jpg      # Normalized reference JPEGs (max 320px, >5KB; decoded in memory only)
│   ├── og-card.png                # 1200×630 OpenGraph / Twitter social card
│   ├── favicon.svg                # Site icon
│   ├── robots.txt                 # Crawler & sitemap directives
│   └── _headers                   # Cloudflare security & immutable asset cache headers
├── src/
│   ├── components/                # Broadsheet UI (Masthead, LeadPackage, RightRail, FcArt, CrimeReceiptModal, etc.)
│   ├── layouts/BaseLayout.astro   # Global chrome, OpenGraph/JSON-LD, dynamic edition volume
│   ├── loaders/articles.ts        # Cached content loader + build-time HTML sanitization
│   ├── pages/                     # Routes: /, /article/[slug], /opinion/[slug], /ledger, /edition/[date], /about, /corrections, /rss.xml, /404
│   ├── painting/                  # Canvas 2D impasto engine (<fc-painting>, Sobel brush, linen weave, Wet-Oil & Archival Exhibit toys)
│   ├── schemas/article.ts         # Zod schemas (ArticleMeta, LegalStage, HttpsUrl, PaintRefs, Editions, RollupStats)
│   ├── styles/                    # Broadsheet design tokens (tokens.css) & layout styles (broadsheet.css)
│   └── utils/                     # Formatting helpers & strict sanitize-html wrapper (sanitize.ts)
├── scripts/
│   ├── validate-content.mjs       # Deterministic schema, HTML security, and paint-ref validator
│   ├── recompute-rollup.mjs       # CLI for npm run rollup:recompute
│   └── lib/rollup.mjs             # Single rollup definition (resolved fines vs. frozen money, retractions)
├── pipeline/
│   ├── judge-wrist-slap.mjs       # Gemini Slap-on-the-Wrist Score judge (PRD §2.3 rubric)
│   ├── run-sweep.mjs              # Daily sweep & publish orchestrator (dry-run audit + Phase 2 scaffold)
│   ├── config.mjs                 # Shared default Gemini model (override with GEMINI_MODEL)
│   ├── prompts/                   # Machine prompts (js-painting-prompt.md, wrist-slap-judge.md)
│   └── README.md                  # Pipeline architecture & Phase 1 vs. Phase 2 status
├── tests/                         # Vitest unit tests (sanitization, schemas, formatting, painting)
├── docs/
│   └── PAINTING_PROMPT.md         # Master editorial & TypeScript handbook for <fc-painting>
├── .github/workflows/
│   └── ci.yml                     # PR & main verification (validate:content, test, check, build)
├── astro.config.mjs               # Astro 5 static config (format: 'file', trailingSlash: 'never', sitemap)
├── wrangler.jsonc                 # Cloudflare Workers Static Assets config (serves ./dist on financialcrimes.fyi)
└── PRD.md                         # Product Requirements Document (v1.4)
```

---

## Deploying to Cloudflare Workers Static Assets

The site builds to static files in `dist/` and deploys via [`wrangler.jsonc`](./wrangler.jsonc) (`assets.directory = "./dist"`, `html_handling = "drop-trailing-slash"`, `not_found_handling = "404-page"`, custom domains `financialcrimes.fyi` and `www.financialcrimes.fyi`). Choose either deployment path:

### Option A: Cloudflare Workers Git Integration (Recommended)
1. In the Cloudflare Dashboard, go to **Workers & Pages → Create → Import a repository** and connect `sambitcreate/financial-crimes` (`main`).
2. Configure the build settings:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Node.js version:** `22`
3. Optional: set `SITE_URL` if deploying to a custom preview/staging domain (defaults to `https://financialcrimes.fyi`).
4. Keep GitHub repository variable `CLOUDFLARE_DEPLOY_ENABLED` unset (or `false`) so `.github/workflows/ci.yml` only runs validation/tests/build and does not duplicate deploys.

### Option B: GitHub Actions Deploy (`.github/workflows/ci.yml`)
1. In GitHub **Settings → Secrets and variables → Actions**:
   - Add **Repository Secrets:** `CLOUDFLARE_API_TOKEN` (Workers Scripts Edit permissions) and `CLOUDFLARE_ACCOUNT_ID`.
   - Add **Repository Variable:** `CLOUDFLARE_DEPLOY_ENABLED` = `true`.
2. Every push to `main` runs `verify` (`validate:content`, `test`, `check`, `build`), uploads `dist/` as a build artifact, and deploys that exact verified `dist/` bundle via `cloudflare/wrangler-action@v3` without rebuilding twice.

### Manual Local Deploy
```bash
npm run build
npx wrangler deploy
```

---

## Project Roadmap & Honest Implementation Status

| Phase | Scope | Current Status |
| :--- | :--- | :--- |
| **Phase 1 — Launch Broadsheet (Website-Only)** | Astro 5 static broadsheet live on `https://financialcrimes.fyi`, 22 verified primary-sourced launch stories, Canvas 2D impasto `<fc-painting>` engine (Wet-Oil & Archival Exhibit interactions, keyboard/screen-reader a11y, CC BY/BY-SA attribution), Pagefind `/ledger`, Crime Receipt printer/PNG, `/about`, `/corrections`, `/rss.xml`, sitemap, OG cards, `sanitize-html` security boundary, Vitest test suite, Gemini `judge:slap` CLI, CI/CD. | **Implemented & Live** |
| **Phase 2 — Automated 6:00 AM ET Daily Sweep (Antigravity Automation)** | Scheduled **Antigravity Automation** (`Financial Crimes — Daily Morning Sweep`, running daily at 6:00 AM `America/New_York` on **Gemini 4 Neon High**) that sweeps global court & regulatory filings, drafts verified stories, sources/normalizes `320px` Wikimedia portraits with CC attribution, runs `validate:content` + `test` + `check` + `build`, pushes to `main`, and deploys live. | **Configured** *(enable in Antigravity Automations Dashboard)* |
| **Phase 3 — Sign-Up, Tip Intake & Live Ops** | Email sign-up / morning digest delivery (Cloudflare Email Service GA), public-filing tip submissions, and direct correction intake. | **Coming Soon** *(RSS `/rss.xml` is live today; Subscribe & Tip Line dialogs show Coming Soon)* |

---

## Documentation

- [`AGENTS.md`](./AGENTS.md) — High-signal repo guide, invariants, and guardrails for AI coding agents & engineers
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Step-by-step runbook for adding stories, normalizing 320px portraits, attribution, scoring, and PRs
- [`PRD.md`](./PRD.md) — Full Product Requirements Document (v1.4)
- [`docs/PAINTING_PROMPT.md`](./docs/PAINTING_PROMPT.md) — Canvas 2D impasto engine contract & editorial art-direction handbook
- [`pipeline/README.md`](./pipeline/README.md) — Scoring judge and Phase 2 sweep orchestrator reference
- [`LICENSE`](./LICENSE) — MIT License
