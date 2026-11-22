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
Create a lowercase kebab-case folder under `content/articles/YYYY/MM/<slug>/`:

```text
content/articles/2026/11/<slug>/
├── meta.json
└── body.html
```

**`meta.json` rules:**
- `slug` MUST match the folder name exactly (`^[a-z0-9]+(?:-[a-z0-9]+)*$`).
- `id` MUST be globally unique (e.g., `fc-2026-023`).
- Every `sources[].url` MUST use `https://`.
- Set `slap_on_wrist_score` to `null` initially (you will score resolved cases in Step 5 via `npm run judge:slap`).
- `interactive_art_spec` requires `{ accent, caption }` (optional `theme: "newsprint" | "monochrome"` and `credit`). For `template: "opinion"`, set `theme: "monochrome"`.
- Optional `corrections`: array of `{ date, summary }` entries if a post-publication correction or acquittal update is later issued (rendered on `/corrections`).

**`body.html` rules:**
- Minimum 150 characters with at least one `<p>`.
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
   Confirm `JPEG image data`, `components 3` (RGB), longest edge `<= 320px`, file size `> 5 KB`, and no clipped foreheads or artifacts.

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

- **Mandatory CC Attribution:** `sourceUrl` (`https://...`) and `sourceLicense` are required. `FcArt.astro` automatically renders the reference license link in captions, and `/about` automatically lists it in the Reference Attribution table.
- **Mood & Toy enums:** See [`docs/PAINTING_PROMPT.md`](./docs/PAINTING_PROMPT.md) for `paletteMood`, `toyKind`, `focalPoint` targeting, and the `legal_stage` libel matrix.
- **Opinion rule:** `template: "opinion"` MUST use `"paletteMood": "monochrome-noir"`.

### 5. Update the Edition Manifest & Rollup Stats
- Add `<slug>` to the appropriate homepage slot (`lead_hero`, `lead_live`, `lead_right`, `lead_grid`, `secondary_1`, `secondary_2`, `rail_feature`, `rail_mini`, `rail_opinion`, or `ledger`) and `article_slugs` in `content/editions/<YYYY-MM-DD>.json` and `content/editions/latest.json`.
- Update aggregate figures in `content/ledger/rollup-stats.json`.

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
npm run validate:content
npm test
npm run check
npm run build
node pipeline/run-sweep.mjs --mode dry-run
```

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
- [ ] `npm run validate:content && npm test && npm run check && npm run build` passes cleanly

---

## Submitting Corrections or Acquittal Updates

If a case is dismissed, overturned, settled on appeal, or contains a factual error:
1. Update `legal_stage`, `financials`, and `body.html` with primary-source citations.
2. Append a timestamped entry to the article's `corrections` array in `meta.json` so it surfaces automatically on `/corrections`.
3. Re-run `npm run judge:slap -- --slug <slug> --write` if the legal stage changed.
4. Run the full verification suite and open a PR (direct correction intake on `/corrections` is coming soon).
