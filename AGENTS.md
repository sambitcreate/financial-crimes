# AGENTS.md — Repository Guide for AI Coding Agents & Engineers

High-signal architecture map, non-negotiable invariants, and verification commands for **The Financial Crimes** (*"All the Crimes Fit to Fine"*).

---

## 1. Stack & Core Architecture

- **Framework:** Astro 5 (`output: 'static'`, `build.format: 'file'`, `trailingSlash: 'never'`, `@astrojs/sitemap`, `@astrojs/rss`)
- **Runtime / Hosting:** Cloudflare Workers with Static Assets (`wrangler.jsonc`, serving `./dist`, `html_handling: "drop-trailing-slash"`)
- **Search:** Pagefind (`npx pagefind --site dist` runs inside `npm run build`)
- **Testing:** Vitest (`npm test` → `vitest run`, config in `vitest.config.ts`, tests in `tests/`)
- **CMS:** Git-backed JSON + HTML under `content/articles/YYYY/MM/<slug>/{meta.json, body.html}`, `content/editions/`, `content/ledger/rollup-stats.json`, and `content/paint-refs.json`
- **Artwork Engine:** Custom Canvas 2D impasto portrait painter under `src/painting/` rendered via `<fc-painting>` (`src/components/FcArt.astro`)

### Key Directories
- `src/schemas/article.ts` — Single source of truth for Zod schemas (`ArticleMetaSchema`, `LegalStageSchema`, `HttpsUrlSchema`, `PaintRefEntrySchema`, `EditionManifestSchema`, `RollupStatsSchema`)
- `src/utils/sanitize.ts` — Strict `sanitize-html` allowlist + security violation detector (`sanitizeArticleHtml`, `findHtmlSecurityViolations`, `isSafeHttpsUrl`)
- `src/loaders/articles.ts` — Build-time memoized content loaders that **always** sanitize `bodyHtml` before rendering
- `src/painting/` — Modular Canvas 2D engine (`types.ts`, `palette.ts`, `color.ts`, `noise.ts`, `brush.ts`, `weave.ts`, `pixel-field.ts`, `archival-plate.ts`, `toys.ts`, `portrait-scene.ts`, `engine.ts`, `loop.ts`, `element.ts`, `refs-loader.ts`, `fc-art.css`)
- `scripts/validate-content.mjs` — Deterministic CLI validator enforced in CI
- `pipeline/` — Gemini Slap-on-the-Wrist judge (`judge-wrist-slap.mjs`) and Phase 2 sweep orchestrator scaffold (`run-sweep.mjs`)

---

## 2. Non-Negotiable Invariants & Guardrails

### A. HTML Sanitization & `https:` Source URL Rules (Security)
- Every article `body.html` is rendered via Astro `set:html` **only after** passing through `sanitizeArticleHtml()` in `src/loaders/articles.ts` AND checked by `findHtmlSecurityViolations()` in `scripts/validate-content.mjs`.
- **Allowed `body.html` tags ONLY:** `p`, `h2`, `h3`, `blockquote`, `ul`, `ol`, `li`, `strong`, `em`, `b`, `i`, `a`, `br`, `code`, `sup`, `sub`, `span`.
  - **NEVER** emit `<aside class="fc-factbox">`, `<img>`, `<script>`, `<iframe>`, `<style>`, inline `on*` handlers, or `javascript:` / `data:` URIs.
- **Strict `https:` URLs:** Every `sources[].url` in `meta.json` and every `sourceUrl` in `content/paint-refs.json` MUST be a valid `https://` URL (no `http:`, `javascript:`, or `data:`).

### B. `<fc-painting>` Zero-`<img>` & CC Attribution Contract
- **Zero `<img>` in DOM:** Never render `<img src="/paint-refs/...">` in Astro templates, `body.html`, or client scripts. Reference JPEGs live in `public/paint-refs/<slug>.jpg` and are decoded strictly in memory via `loadPixels(url, 180)`.
- **Image Format Contract:** Every file in `public/paint-refs/<slug>.jpg` MUST be a normalized RGB JPEG (`components 3`), **max `320px` longest edge**, and **`> 5 KB`**.
- **1:1 Coverage:** Every article slug under `content/articles/` MUST have a matching entry in `content/paint-refs.json` and an existing JPEG on disk.
- **Mandatory CC Attribution:** Every `content/paint-refs.json` entry MUST include valid `sourceUrl` (`https://...`) and `sourceLicense` (`Public Domain`, `CC0`, `CC BY *`, `CC BY-SA *`, `OGL *`, `GODL-India`). Attribution is rendered automatically in `FcArt.astro` captions and aggregated on `/about`.
- **Wet-Oil & Archival Exhibit Aesthetic (v1.3+):**
  - Never draw floating drop-shadow typography over the center of a canvas or a subject's face; all factual satire text lives exclusively in the lower-left `drawArchivalPlate()`.
  - Never emit cartoon clipart or arcade particles (no bouncing coins, tumbling envelopes, dashed radar rings, or spark bursts).
  - Preserve `sampleLocalLuminance()` adaptive contrast (`'screen'` ivory/gilt on dark grounds `< 0.48`, `'multiply'` press-black/deepened pigment on light grounds `>= 0.48`), wrapped in `g.save()`/`g.restore()`.
  - Keep interactive (`mode !== 'thumb'`) stages keyboard-accessible (`tabindex="0"`, `Enter`/`Space`, `role="status"` live region) and `mode="thumb"` non-focusable.
- **Opinion Monochrome Rule:** Any article with `template: "opinion"` MUST use `paletteMood: "monochrome-noir"` in `content/paint-refs.json` (and `theme: "monochrome"` in `interactive_art_spec`).

### C. Legal-Stage Enum, Libel Safety & Scoring Guardrails
- **Hard Fact/Satire Wall:** Never fabricate a quote, defendant, charge, docket number, agency, or dollar figure. Every story must cite primary official filings (`sources.length >= 1`).
- **Strict `legal_stage` Enum:**
  `investigation` | `civil_complaint` | `indicted` | `arrested` | `interim_order` | `guilty_plea` | `convicted` | `sentenced` | `settlement` | `regulatory_order` | `dpa` | `appeal` | `dismissed` | `acquitted`
- **Presumption of Innocence:**
  - For `indicted`, `arrested`, `civil_complaint`, `investigation`, `interim_order`, or `appeal`: NEVER write `"GUILTY"`, `"CONVICTED"`, `"FRAUDSTER"`, prison bars, or handcuffs in headlines, decks, `toyText`, `toySubtext`, or `alt`. Always reflect pending/contested status.
  - For `settlement`, `regulatory_order`, or `dpa` where `admitted_guilt !== true`: NEVER imply criminal conviction or admission of guilt.
  - When the reference portrait depicts a judge, prosecutor, or regulator, state their official title and never attach accusatory defendant labels to them.
- **Slap-on-the-Wrist Score (`slap_on_wrist_score`):**
  - Never hand-invent scores. Scores are judged by Gemini via `pipeline/judge-wrist-slap.mjs` against `pipeline/prompts/wrist-slap-judge.md`.
  - Only resolved stages (`settlement`, `regulatory_order`, `sentenced`, `dpa`) receive an integer `0..100`. All other stages MUST be `null` (rendered as `PENDING`).

### D. Honest UX & Dynamic Metadata
- Do not hardcode edition volumes (`Vol. I, No. 1`) in components — always read `edition.volume` from `loadEdition()`.
- Do not fabricate fake server confirmations in client-only Phase 1 forms (Subscribe / Tip Line); keep RSS and `mailto:` handoffs truthful until Phase 3 backends exist.

---

## 3. Required Commands Before Committing

Always run the full verification chain before opening a PR or committing:

```bash
npm run validate:content && npm test && npm run check && npm run build
```

When modifying anything in `pipeline/`, `docs/PAINTING_PROMPT.md`, or `content/paint-refs.json`, also run:

```bash
node pipeline/run-sweep.mjs --mode dry-run
```

For visual or interactive UI changes, preview the built site (`npm run preview`) and verify:
- Zero console errors and zero `<img>` elements inside `<fc-painting>`
- Working Pagefind search on `/ledger`
- Clean keyboard focus and `prefers-reduced-motion: reduce` behavior
