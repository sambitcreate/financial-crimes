# Contributing to The Financial Crimes

Thank you for contributing to **The Financial Crimes**. Every story on this broadsheet is grounded 100% in primary public filings—the satire comes from deadpan restraint and verifiable math, never invented facts.

---

## Prerequisites

```bash
nvm use    # Node 22 (see .nvmrc)
npm ci
```

---

## Runbook: Adding a New Story

### 1. Verify Primary Sources & Editorial Scope
- **In scope:** White-collar, corporate, regulatory, political, and institutional financial crimes (`> $250,000` or involving public officials, regulators, or major corporations).
- **Primary sources only:** Collect at least one official `https://` URL (DOJ, SEC, CFTC, Treasury/FinCEN/OCC/OFAC, CourtListener/RECAP, SEBI, CBI, UK SFO/FCA, EU EPPO, BaFin, MAS, HK SFC/AFRC, etc.).
- **Check `legal_stage`:** Pick the exact current stage from the strict schema enum:
  `investigation`, `civil_complaint`, `indicted`, `arrested`, `interim_order`, `guilty_plea`, `convicted`, `sentenced`, `settlement`, `regulatory_order`, `dpa`, `appeal`, `dismissed`, `acquitted`.

### 2. Create the Article Folder (`meta.json` + `body.html`)
Create a lowercase kebab-case folder under `content/articles/YYYY/MM/<slug>/`, where `YYYY/MM` is the literal year-month of `publish_date` (in the date's own offset — `2026-10-31T23:30:00-05:00` lives in `2026/10`). Any other folder (`drafts/`, `2026/x/`, nested folders, stray files) fails validation, because the loader publishes every `meta.json` it finds:

```text
content/articles/2026/11/<slug>/
├── meta.json
└── body.html
```

**`meta.json` rules:**
- `slug` MUST match the folder name exactly (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- `id` MUST be globally unique (e.g., `fc-2026-023`).
- Every `sources[].url` MUST be a deep link (`https://` only; no credentials, IP literals, ports, backslashes, newsroom hubs such as `/news?page=2`, bare domains, `google.com/url?q=` wrappers or shorteners).
- **Official sources:** each source host must be on the official-domain allowlist in `scripts/validate-content.mjs` (`OFFICIAL_SOURCE_DOMAINS` / `OFFICIAL_SOURCE_SUFFIXES`: courts, prosecutors, regulators, `*.gov`, `*.gov.uk`, `*.gov.in`, `*.europa.eu`, …). A press citation is allowed only with `"secondary": true` **and** at least one non-secondary official source in the same article. Extend the allowlist in a reviewed PR when a new official agency appears.
- Dates are strict ISO-8601: `publish_date` is `YYYY-MM-DDTHH:MM:SS±HH:MM` (or `YYYY-MM-DD`), `edition_date` / `sources[].date` / `retracted.date` are `YYYY-MM-DD`. Nothing may be dated more than 36h in the future (`FC_NOW=<ISO>` overrides "now" for testing).
- Unknown or misspelled keys are rejected everywhere (schemas are `.strict()`); money, ratio and prison values must be `>= 0`.
- Set `slap_on_wrist_score` to `null` initially (you will score resolved cases in Step 5 via `npm run judge:slap`).
- `interactive_art_spec` requires `{ accent, caption }` (optional `theme: "newsprint" | "monochrome"` and `credit`). For `template: "opinion"`, set `theme: "monochrome"`.
- Optional `corrections`: array of `{ "date": "YYYY-MM-DD", "note": "…", "type"?: "correction" | "clarification" | "update" }` entries if a post-publication correction or acquittal update is later issued (rendered on `/corrections`). The field is `note` — `summary` is rejected.
- Optional `updated_at` (ISO date/datetime): last substantive update (feeds `dateModified`, sitemap `lastmod`, RSS).
- Optional `retracted`: `{ "date": "YYYY-MM-DD", "note": "at least 10 chars" }` — see *Retractions* below.
- `slap_on_wrist_score` is an integer `0..100` on resolved stages only; `score_provenance` (`{ model, prompt_sha256, judged_at, components?, rationale? }`) is written by the judge and may only exist alongside a non-null score.

**Legal guardrails enforced by `npm run validate:content`** (see AGENTS.md §2C; implemented in `checkArticleRules()` in `src/schemas/article.ts`):
- Pending stages (`investigation`, `civil_complaint`, `indicted`, `arrested`, `interim_order`, `appeal`): `slap_on_wrist_score: null`, `financials.fine_ratio_pct: null` (frozen/escrowed money is not a fine), `financials.admitted_guilt` never `true`.
- Every non-resolved stage (`guilty_plea`, `convicted`, `dismissed`, `acquitted` and the pending stages) must have `slap_on_wrist_score: null`. A resolved stage with a `null` score only warns ("pending judge run").
- Banned words (case-insensitive) in `headline`, `deck`, `eyebrow`, `interactive_art_spec.caption`/`credit`, `live_updates[].text` and paint-ref `toyText`, `toySubtext`, `alt`, `subject` for pending and exonerated stages and for `settlement` / `regulatory_order` / `dpa` without `admitted_guilt: true`: GUILTY, CONVICT/CONVICTED, FRAUDSTER, CROOK, CRIMINAL (as a label), BEHIND BARS, PRISON BARS, HANDCUFF(S), MUGSHOT. Settlement-type stories without admission additionally ban "admits guilt", "pleaded guilty", "confesses". "Pleaded not guilty" and adjectival "criminal charges" are fine.
- Resolved stages: when `fine_usd` and `amount_usd` are both set (`amount_usd > 0`), `fine_ratio_pct` must equal `fine_usd / amount_usd × 100` within ±0.15 (values above 100 are fine).
- `template: "opinion"` requires `interactive_art_spec.theme: "monochrome"` and paint-ref `paletteMood: "monochrome-noir"`.

**`body.html` rules:**
- At least 150 characters of visible prose (measured after stripping tags, entities and whitespace) and at least one non-empty `<p>`.
- Links: `https://` or site-relative (`/…`, `#…`) only — no `http:` or `mailto:`. `target` may only be `_blank` and then requires `rel="noopener noreferrer"`.
- Classes: only `fc-lead` on `<p>`, `fc-dateline` on `<span>`, `fc-pullquote` on `<blockquote>`.
- No HTML comments, `<![CDATA[`, doctypes or processing instructions.
- **Allowed tags only:** `<p>`, `<h2>`, `<h3>`, `<blockquote>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<b>`, `<i>`, `<a>`, `<br>`, `<code>`, `<sup>`, `<sub>`, `<span>`.
- **Forbidden:** `<img>`, `<script>`, `<aside>`, `<iframe>`, inline event handlers (`onclick`, etc.), or `javascript:`/`data:` URLs.
- Keep prose crisp, deadpan, and strictly faithful to the filings (attribute all allegations on pre-conviction cases and note *"without admitting or denying"* clauses verbatim).

### 3. Source & Normalize a 320px Reference Portrait (`public/paint-refs/<slug>.jpg`)
Every article paints an interactive Canvas 2D oil portrait from an open-license reference photograph decoded strictly in memory (zero `<img>` tags in the DOM).

1. **Choose a verified open-license photo** from Wikimedia Commons or an official government release (`Public Domain`, `CC0`, `CC BY`, `CC BY-SA`, `OGL`, `GODL-India`):
   - Prefer an actual portrait of a named principal (defendant, executive, prosecutor, regulator, or judge).
   - Otherwise use an iconic photograph of the courthouse, headquarters, or physical exhibit named in the filing.
   - Never use agency wire photos (Getty/AP/Reuters), logos, SVGs, or watermarked images.
2. **Normalize to max `320px` longest edge RGB JPEG (`> 5 KB`):**
   - **macOS (`sips`):**
     ```bash
     sips -Z 320 -s format jpeg -s formatOptions 80 raw_input --out public/paint-refs/<slug>.jpg
     ```
   - **Linux / ImageMagick:**
     ```bash
     magick raw_input -resize 320x320\> -colorspace sRGB -quality 80 public/paint-refs/<slug>.jpg
     ```
3. **Verify format & size and visually inspect:**
   ```bash
   file public/paint-refs/<slug>.jpg
   ls -lh public/paint-refs/<slug>.jpg
   ```
   Confirm `JPEG image data`, `components 3` (RGB), longest edge `<= 320px`, file size `> 5 KB`, and no clipped foreheads or artifacts. The validator parses the JPEG frame header and rejects CMYK/grayscale, oversize, tiny (`< 160px` long edge / `< 64px` short edge), truncated, or padded files (data after EOI, or under 4 KB of actual image data).

### 4. Register the Painting & CC Attribution in `content/paint-refs.json`
Add a key matching `<slug>` in [`content/paint-refs.json`](./content/paint-refs.json) (keep keys sorted alphabetically):

```json
"<slug>": {
  "refImage": "/paint-refs/<slug>.jpg",
  "subject": "Exact person + official title, or landmark/object",
  "sourceUrl": "https://commons.wikimedia.org/wiki/File:...",
  "sourceLicense": "CC BY-SA 4.0",
  "isPortrait": true,
  "focalPoint": { "u": 0.50, "v": 0.35 },
  "paletteMood": "verdict-crimson",
  "toyKind": "stamp",
  "toyText": "MAX 18 CHARS CAPS",
  "toySubtext": "MAX 26 CHARS CAPS",
  "alt": "Impressionist oil portrait of ..., factual neutral context."
}
```

- **Mandatory CC Attribution:** `sourceUrl` (`https://...`) and `sourceLicense` are required. `sourceLicense` must match the allowlist exactly: `Public Domain`, `CC0`, `CC BY <ver>`, `CC BY-SA <ver>`, `OGL <ver>`, or `GODL-India` (no `-NC`/`-ND`, wire-agency or "All Rights Reserved"). `FcArt.astro` automatically renders the reference license link in captions, and `/about` automatically lists it in the Reference Attribution table.
- **Mood & Toy enums:** See [`docs/PAINTING_PROMPT.md`](./docs/PAINTING_PROMPT.md) for `paletteMood`, `toyKind`, `focalPoint` targeting, and the `legal_stage` libel matrix.
- **Opinion rule:** `template: "opinion"` MUST use `"paletteMood": "monochrome-noir"`.

### 5. Update the Edition Manifest & Rollup Stats
- Add `<slug>` to exactly one homepage slot (`lead_hero`, `lead_live`, `lead_right`, `lead_grid`, `secondary_1`, `secondary_2`, `rail_feature`, `rail_mini`, `rail_opinion`, or `ledger`) and to `article_slugs` in `content/editions/<YYYY-MM-DD>.json`. A slug may appear in only one slot, and `article_slugs` must list exactly the slot slugs.
- `content/editions/latest.json` must be a byte-for-byte JSON copy of the newest dated edition (`cp content/editions/<YYYY-MM-DD>.json content/editions/latest.json`). Edition files must be named `YYYY-MM-DD.json` matching their `edition_date`; any other file in `content/editions/` fails validation.
- Every article's `edition_date` needs a matching edition file (a story newer than the newest edition only warns until the edition lands).
- Regenerate aggregate figures — never hand-edit `content/ledger/rollup-stats.json`:
  ```bash
  npm run rollup:recompute
  ```

### 6. Score Resolved Cases (`judge:slap`)
Slap-on-the-Wrist Scores are never hand-entered. For resolved cases (`settlement`, `regulatory_order`, `sentenced`, `dpa`), run the Gemini scoring desk:

```bash
# Dry run (prints score + component breakdown + rationale)
GEMINI_API_KEY=... npm run judge:slap -- --slug <slug>

# Write score to meta.json
GEMINI_API_KEY=... npm run judge:slap -- --slug <slug> --write
```

Unresolved stages (`indicted`, `arrested`, `civil_complaint`, `investigation`, `interim_order`, `appeal`, `guilty_plea`, `convicted`) stay `null` (`PENDING`).

### 7. Validate, Test, Typecheck & Build
Run all automated checks locally before opening a pull request:

```bash
npm run verify        # validate:content → test → check → build:site
node pipeline/run-sweep.mjs --mode dry-run
```

`npm run build` itself always runs the content validator first and aborts on any error, and `npm run deploy` runs `npm run verify` before `wrangler deploy`. The validator imports the TypeScript schemas directly via Node type stripping (Node >= 22.18, or >= 22.6 through `npm run validate:content`).

Preview the compiled site and verify your story, `<fc-painting>` interaction, CC attribution caption, and `/ledger` Pagefind search:

```bash
npm run preview
```

### 8. Open a Pull Request
Before requesting review, confirm:
- [ ] All primary sources are official `https://` court/regulator records
- [ ] `legal_stage` and all copy (`headline`, `deck`, `toyText`, `toySubtext`, `alt`) pass libel/presumption-of-innocence guardrails
- [ ] Reference JPEG is normalized (`<= 320px`, `> 5 KB`, RGB) with valid `sourceUrl` + `sourceLicense` in `content/paint-refs.json`
- [ ] `slap_on_wrist_score` is Gemini-judged (resolved stages) or `null` (unresolved stages)
- [ ] `npm run verify` passes cleanly

---

## Submitting Corrections or Acquittal Updates

If a case is dismissed, overturned, settled on appeal, or contains a factual error:
1. Update `legal_stage`, `financials`, and `body.html` with primary-source citations.
2. Append an entry `{ "date": "YYYY-MM-DD", "note": "What changed and why", "type": "correction" }` to the article's `corrections` array in `meta.json` so it surfaces automatically on `/corrections`, and set `updated_at`.
3. Re-run `npm run judge:slap -- --slug <slug> --write` if the legal stage changed, then `npm run rollup:recompute`.
4. Run `npm run verify` and open a PR (direct correction intake on `/corrections` is coming soon).

### Retractions

Never delete a published story (that would erase its `/corrections` history and break inbound links). Instead add a tombstone to `meta.json`:

```json
"retracted": { "date": "2026-11-23", "note": "Retracted: the cited filing concerns a different defendant." }
```

The article stays in the content tree; the site renders a retraction notice instead of the body, keeps its corrections, and excludes it from rollup totals, ledger counts, RSS and search. A retracted story may drop its paint-ref entry and JPEG (e.g. a misidentified portrait). Then run `npm run rollup:recompute` and `npm run verify`.
