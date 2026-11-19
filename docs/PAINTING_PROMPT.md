# The Financial Crimes — Master Prompt for Interactive JavaScript Impasto Paintings

> **Purpose:** Reusable editorial + engineering prompt for **Gemini 4 Hydrogen** (both in the automated 6:00 AM ET daily sweep and for manual/agent art direction) to transform a real public-domain / Wikimedia reference photograph of a white-collar crime subject into an interactive Canvas 2D impressionist oil painting in the `sambitbiswas.com` impasto brushstroke style—with **The Financial Crimes'** own broadsheet editorial voice.
>
> **Companion Machine Prompt:** [`pipeline/prompts/js-painting-prompt.md`](../pipeline/prompts/js-painting-prompt.md) (loaded programmatically by `pipeline/run-sweep.mjs`).
> **Runtime Engine:** `src/painting/` (`types.ts`, `palette.ts`, `brush.ts`, `weave.ts`, `engine.ts`, `loop.ts`, `portrait-scene.ts`, `element.ts`).
> **Manifest & Reference Pool:** `content/paint-refs.json` + `public/paint-refs/<slug>.jpg`.

---

## Section 1: The Financial Crimes Visual Voice

Our painting engine inherits the living Canvas 2D impasto architecture of `sambitbiswas.com`—progressive coarse-to-fine oil underpainting, 3-pass relief brushstrokes, linen canvas weave, pointer-pulled focus refinement, and playful click/poke interactivity—but deliberately establishes **The Financial Crimes' own editorial voice**:

| Dimension | `sambitbiswas.com` Toy-Shelf Voice | **The Financial Crimes** Editorial-Oil Voice |
| :--- | :--- | :--- |
| **Emotional Register** | Sunny windowsill, bright studio toy-shelf, joyful pastel pop | *The New Yorker* / *NYT Magazine* painted broadsheet portraiture — deadpan gravitas, courtroom chiaroscuro, dry institutional irony |
| **Ground & Texture** | Clean white / pale studio cream | Warm aged cotton-rag newsprint (`#F6F3EC` / `hsl(39, 34%, 93%)`) under a procedural linen weave (`mix-blend-mode: multiply`) |
| **Core Pigments** | Poppy `sky`, `sun`, `pink`, `tangerine`, `violet`, `leaf` | Rich high-conviction editorial oils (`FC_OIL` in `src/painting/palette.ts`) |
| **Lighting & Value** | High-key sunlit washes | Dramatic chiaroscuro shadows, warm skin/stone midtones, controlled edge vignette into mood pigment |
| **Opinion Pages** | Same colour system | **`monochrome-noir`** — warm charcoal & sepia oil chiaroscuro on newsprint cream, punctuated *only* by a single Verdict Crimson mark when poked |
| **Frame Chrome** | Pure edge-to-edge canvas | **Zero cluttered HUD bars.** No dateline pills, no raw ISO timestamps, no `FIG. VIII` stamps, no opaque caption boxes covering the paint, no 3-button clusters—only the 3 stacked `<canvas>` layers and a whisper-quiet hover-only repaint glyph (`↻`) |

### The Financial Crimes Oil Palette (`FC_OIL`)

Every scene and mood grade derives exclusively from these pigments (`src/painting/palette.ts`):

| Token | HSL (`[h, s, l]`) | Editorial Role |
| :--- | :--- | :--- |
| `verdictCrimson` | `[355, 68, 41]` | Legal carmine — enforcement headlines, stamps, plunging charts, Opinion poke accent |
| `bullionGold` | `[41, 74, 50]` | Sovereign gold — yachts, luxury watches, corporate treasury loot, coin bursts |
| `subpoenaCobalt` | `[213, 52, 37]` | Prussian courthouse blue — federal filings, AI-washing, European prosecutors, aviation steel |
| `banknoteEmerald` | `[154, 42, 32]` | Intaglio currency green — offshore banking hubs, green-finance loans, MAS/ESG ironies |
| `courtroomOchre` | `[30, 56, 46]` | Mahogany & sandstone — parliamentary halls, Southwark brick, DOJ corridors, gavel ripples |
| `pressBlack` | `[28, 12, 11]` | Warm printer's lampblack — redaction bars, monochrome darks, deep suit lapels |
| `newsprintCream` | `[39, 34, 93]` | Cotton-rag broadsheet paper — ground wash, subpoena envelopes, highlight glazes |
| `charcoalShadow` | `[218, 16, 17]` | Cool shadow glaze — slate vignettes and evening skylines |
| `scandalRose` | `[348, 48, 56]` | Muted editorial blush — warm portrait midtone bridge |
| `editorialSlate` | `[210, 26, 44]` | Institutional stone — steel, glass towers, monochrome midtones |

### Hard Visual Prohibitions
1. **ZERO neon SaaS colors** (no electric cyan `#00ffff`, no hot magenta, no purple-blue AI gradients, no glowing glassmorphism).
2. **ZERO cluttered chrome over the painting** (never draw top header bars, raw ISO timestamps like `2026-11-19T06:00:00-05:00`, fake telemetry tickers, or HTML button bars overlapping the artwork).
3. **ZERO `<img>` tags in the DOM** — the reference photograph is fetched purely in memory via `loadPixels()` into an offscreen pixel buffer and discarded; the reader sees *only* living oil brushstrokes painted onto `<canvas>`.
4. **ZERO flat vector charts masquerading as paintings** — every interactive mark must look *painted* (rough impasto edges, rounded caps, organic jitter, oil shadow/highlight passes).

---

## Section 2: Exact Canvas 2D Engine Contract

All paintings run inside our three-canvas stack inside `<fc-painting>` (`src/painting/element.ts`):
1. **`ground` canvas** — Holds permanent cumulative oil strokes laid down by `Painter` (underpainting + continuous maintenance + focal sharpening).
2. **`weave` canvas** — Static 180×180 procedural linen warp/weft tile (`paintWeave`, `src/painting/weave.ts`) composited via CSS `mix-blend-mode: multiply`.
3. **`live` canvas** — Cleared and redrawn at 60fps every frame by `scene.live(g, width, height, t)` for fast interactive marks (impasto rubber stamps, tumbling gold coin dabs, plunging crimson chart lines, fluttering subpoena slips, gavel shockwaves).

### Core TypeScript Interfaces (`src/painting/types.ts`)

```ts
export type HSL = readonly [h: number, s: number, l: number];

export interface Sample {
  color: HSL;
  /** Stroke direction in radians. Omit to use the painter's gentle default fbm flow field. */
  angle?: number;
  /** Scales colour jitter. 1 = default; lower (0.45–0.7) for skin/sky, higher (1.1–1.5) for foliage/crowds. */
  jitter?: number;
  /** True for monochrome Opinion portraits (suppresses stray rainbow broken-color flecks). */
  monochrome?: boolean;
}

export interface Hotspot {
  u: number;        // Normalized X centre (0..1)
  v: number;        // Normalized Y centre (0..1)
  r: number;        // Radius as fraction of painting width
  detail?: number;  // Dab size multiplier (< 1 paints finer portrait detail, e.g. 0.45)
}

export interface SceneContext {
  visible: boolean;
  lastPlayed: number;
  reducedMotion: boolean;
}

export type PointerKind = 'down' | 'move' | 'leave';

export type PaletteMood =
  | 'verdict-crimson'
  | 'bullion-gold'
  | 'subpoena-cobalt'
  | 'banknote-emerald'
  | 'courtroom-ochre'
  | 'monochrome-noir';

export type ToyKind =
  | 'stamp'
  | 'coins'
  | 'redaction'
  | 'crash-line'
  | 'envelopes'
  | 'gavel-ripple';

export interface Scene {
  aspect: number; // width / height
  alt: string;
  sample(u: number, v: number, t: number): Sample | null;
  hotspots?(t: number): Hotspot[];
  update?(t: number, dt: number, ctx: SceneContext): void;
  live?(g: CanvasRenderingContext2D, width: number, height: number, t: number): void;
  pointer?(kind: PointerKind, u: number, v: number, t: number): void;
  pointerEverywhere?: boolean;
  ready?(): boolean;
  reset?(): void;
}
```

### The 3-Pass Impasto Brushstroke (`paintDab` in `src/painting/brush.ts`)

Every single dab painted onto `ground` executes three layered strokes with `lineCap = 'round'`:
1. **Cast Shadow Edge:** Offset `(+0.25 * wid, +0.35 * wid)` at lightness `l - 16`, opacity `0.40` — creates physical paint thickness rising off the linen.
2. **Thick Oil Body:** Centered at `(x, y)` with width `wid = size * (0.7 + rand() * 0.35)` and length `len = size * (1.1 + rand() * 1.1)` at lightness `l`, opacity `0.90`.
3. **Specular Impasto Ridge (70% of dabs):** Narrow `0.35 * wid` upper-left highlight offset `(-0.15 * wid, -0.20 * wid)` at saturation `s * 0.6`, lightness `min(97, l + 14)`, opacity `0.60`.
4. **Broken-Color Impressionist Fleck (2% of color dabs):** Occasional `±(25..55)°` hue spark (`s + 8`) — automatically suppressed when `sample.monochrome === true`.

### Painter Lifecycle & Performance Budget (`src/painting/engine.ts`)

- **Coarse-to-Fine Underpainting:** Starts with bold blocking dabs (`coarse = 4.0 * fine`) and eases via `lerp(coarse, 1, Math.pow(p, 0.55))` as `built / buildTarget` advances from `0 → 1`.
- **Mode Presets (`painterOptionsForMode`):**
  - `hero`: `fineFraction: 0.0054`, `buildSeconds: 1.35`, `maintenance: 220`, `maxBuildTarget: 24000`
  - `inline`: `fineFraction: 0.0062`, `buildSeconds: 1.15`, `maintenance: 155`, `maxBuildTarget: 18000`
  - `thumb`: `fineFraction: 0.0115`, `buildSeconds: 0.70`, `maintenance: 34`, `maxBuildTarget: 7500` (allows 20+ homepage thumbnails to glide at 60fps!)
- **Hotspot Focus Share (`HOTSPOT_SHARE = 0.62`):** During post-underpainting maintenance, 62% of fresh dabs land inside `scene.hotspots(t)` (e.g., `detail: 0.45` around the subject's eyes or active pointer), sharpening facial features naturally while the background stays loosely painterly.
- **Offscreen & Accessibility Guardrails:** Single shared `requestAnimationFrame` clock (`src/painting/loop.ts`), `IntersectionObserver` pauses offscreen canvases, DPR capped at `2`, and `prefers-reduced-motion: reduce` completes the underpainting in one static pass (re-opening a 4-second `INTERACTION_GRACE` window only if the reader clicks).

### Reference Image Sampling & Sobel Contour Tangents (`src/painting/portrait-scene.ts`)

When painting from a real reference photograph (`loadPixels(url, 180)`):
1. Decode into an offscreen `180px`-wide `<canvas>` and read `Uint8ClampedArray` RGBA pixels (cached by `url@180`).
2. Compute luminance `L = (0.299R + 0.587G + 0.114B) / 255` and apply a light 3×3 Gaussian smoothing pass to eliminate JPEG block noise.
3. Run 3×3 Sobel operators (`gx`, `gy`) across every pixel to precompute:
   - **`angles[idx] = Math.atan2(gy, gx) + Math.PI / 2`** — the **contour tangent**, so brushstrokes automatically curve *along* cheekbones, eyelids, hairlines, suit lapels, columns, and turbine blades rather than cutting awkwardly across them.
   - **`strength[idx] = clamp(Math.hypot(gx, gy) * 1.9, 0, 1)`** — controls how tightly the brush locks onto structural edges versus blending into gentle `fbm` background flow.

---

## Section 3: Turning a Real Article Reference Image into an Interactive Portrait Painting

Follow this exact 5-step editorial workflow for every new story:

### Step 1 — Source & Normalize a Verified Public-Domain / Open-License Reference Image
- **Priority Order:**
  1. **Actual portrait of the named principal** (defendant, bank CEO, regulator, judge, or chief prosecutor *explicitly named in the story*) from Wikimedia Commons, Wikipedia, or US/UK/EU/India government releases (`Public Domain`, `CC0`, `CC BY`, `CC BY-SA`, `OGL`, `GODL-India`).
  2. **Iconic real photograph of the exact venue, institution, or object in the filing** (e.g., the specific federal courthouse, stock exchange tower, CFM56 jet engine, luxury watch, motor yacht, or headquarters tower) whenever a private defendant has no verified public portrait.
- **Never use:** Logos, SVG graphics, watermarked agency wire photos (Getty/AP/Reuters), black-and-white archival negatives (unless intentional), or blurry low-res crops under 250px wide.
- **Normalize locally (macOS `sips` or Sharp/ImageMagick):**
  ```bash
  sips -Z 420 -s format jpeg -s formatOptions 82 raw_input --out public/paint-refs/<slug>.jpg
  file public/paint-refs/<slug>.jpg   # Must report: JPEG image data, ..., components 3 (RGB), >15KB
  ```
- **Visual Inspection Gate:** Always visually inspect the normalized JPEG before finalizing `focalPoint` so you know the exact eye/subject coordinates and confirm zero cropping artifacts.

### Step 2 — Set `focalPoint` (`{ u, v }`) with Precision
- Normalized coordinates run `u ∈ [0, 1]` (left → right) and `v ∈ [0, 1]` (top → bottom).
- **Tight head-and-shoulders portraits:** Target the bridge of the nose / eye line (`u ≈ 0.48–0.54`, `v ≈ 0.33–0.40`).
- **Waist-up portraits:** Target the face higher in the frame (`v ≈ 0.20–0.28`, e.g., Roger Ver at `v: 0.21`).
- **Architectural / object scenes:** Target the primary structural focal anchor (e.g., the spinning CFM56 turbofan hub at `{ u: 0.30, v: 0.46 }`, or the watch dial at `{ u: 0.49, v: 0.50 }`).
- Both idle focus drift and fine `detail: 0.45` sharpening orbit this exact coordinate until the reader moves their pointer over the canvas.

### Step 3 — Grade the Photo into Editorial Oils & Select `paletteMood`
Transform sampled RGB → HSL (`rgbToHsl`) with our broadsheet oil grade:
- **Chroma & Value:** Boost saturation conservatively (`satBoost ≈ 1.16–1.20` for color moods; `0.15` for `monochrome-noir`) and expand chiaroscuro contrast without clipping highlights past `l = 95` or crushing darks below `l = 8`.
- **Edge Vignette & Mood Glaze:** Gently blend outer corners (`vignetteStrength ≈ 0.20–0.24`) toward the mood's `shadow` pigment so portraits read like framed oil studies rather than rectangular snapshots.
- **Mood Selection Guide:**
  - `verdict-crimson` — Major enforcement busts, record fines, catastrophic collapses, market manipulation.
  - `bullion-gold` — Luxury-asset looting (yachts, watches, penthouse condos), audit/creditor tabs.
  - `subpoena-cobalt` — Federal indictments, courtroom privilege fights, AI-washing, aviation fraud, cross-border prosecutors.
  - `banknote-emerald` — Money-laundering banking hubs (Singapore MAS), green-finance / EV loan diversions.
  - `courtroom-ochre` — Political patronage, regulatory bribery traps, Crown Court / DOJ policy beats.
  - `monochrome-noir` — **Mandatory for all `template: "opinion"` columns** (charcoal/sepia oil portrait + single Verdict Crimson mark on poke).

### Step 4 — Choose a Story-Specific Painterly Toy (`toyKind`)
Every painting must reward curiosity on click/poke with tactile satire **painted directly into the canvas** (never an HTML popup):

| `toyKind` | Painterly Visual Action on Click/Poke | Best Editorial Fit |
| :--- | :--- | :--- |
| `stamp` | Slams a tilted, slightly distressed oil-ink rubber stamp (`toyText` + `toySubtext`) with ink-splatter flecks onto the canvas | Bundle discounts, zero-prison deals, forged forms, record fine comparisons, audit bans |
| `coins` | Bursts thick golden bullion/coin oil dabs arcing under gravity from the click point with specular glint trails | Diverted EV loans, luxury watches, Medicare yachts, 0.915% bank fines |
| `redaction` | Sweeps broad lampblack impasto redaction bars across the canvas on click; hovering rubs/repaints the portrait right back through | Unprivileged AI chats, `"~0% AI"` claims, sealed court filings |
| `crash-line` | Draws a jagged, trembling Verdict Crimson oil price-collapse line plunging across the canvas with spark dabs | Crypto collapses (`$40B`), options manipulation, Ponzi promises, bank stock cliffs |
| `envelopes` | Releases fluttering newsprint-cream & crimson subpoena/bounced-email slips tumbling across the painting | 30-person insider rings, 4M fake-student bounce tests, bribery trap envelopes |
| `gavel-ripple` | Expands concentric painted ink shockwaves & brief chiaroscuro spotlight flash from the poke point | Denied appeals, multi-nation dawn raids, record Crown Court sentencings |

### Step 5 — Enforce the Zero-`<img>` DOM Guarantee
- Never output `<img src="/paint-refs/...">` in Astro templates, article `body.html`, or client JS.
- Pass only the JSON config object into `<fc-painting>` via `FcArt.astro`; `loadPixels()` constructs an unattached `new Image()` in JS memory, draws onto a temporary offscreen canvas, extracts `ImageData`, and lets the temporary image be garbage-collected.

---

## Section 4: Copy-Paste Master Prompt Template (Gemini 4 Hydrogen)

Use this exact prompt template when asking **Gemini 4 Hydrogen** (manually or via `pipeline/run-sweep.mjs`) to art-direct a new story painting.

### Strict Libel & Fair-Report Legal Guardrails Matrix

Before generating ANY `toyText`, `toySubtext`, `alt`, or bespoke visual metaphor, the model **MUST** check `{{LEGAL_STAGE}}`:

| `{{LEGAL_STAGE}}` | **FORBIDDEN Visuals & Stamp Copy** | **PERMITTED Factual Stamp Copy** |
| :--- | :--- | :--- |
| `indicted`, `arrested`, `civil_complaint`, `investigation` | **NEVER** paint prison bars, handcuffs, mugshot height charts, orange jumpsuits, `"GUILTY"`, `"FRAUDSTER"`, or `"CONVICTED"` | `"INDICTED · PENDING TRIAL"`, `"ALLEGED"`, `"30 CHARGED"`, `"ARRESTED · PRESUMED INNOCENT"`, `"~0% AI ALLEGED"` |
| `interim_order`, `appeal` | **NEVER** imply final guilt or exhausted appeals | `"CONTESTED ON APPEAL"`, `"APPEAL PENDING"`, `"ESCROW IMPOUNDED"`, `"SEBI ORDER · APPEAL ACTIVE"` |
| `settlement`, `regulatory_order`, `dpa` (when `admitted_guilt === false`) | **NEVER** say `"ADMITTED GUILT"` or `"CONVICTED"` | `"NO GUILT ADMITTED"`, `"0 EXECS CHARGED"`, `"0 PRISON DAYS"`, `"0.915% FINE"`, `"€45M RECORD FINE"` |
| `settlement` (civil admission, `admitted_guilt === true`, 0 criminal) | **NEVER** imply criminal conviction or jail time | `"$750M DISCOUNT"`, `"0 EXECS CHARGED"`, `"CIVIL ADMISSION"` |
| `guilty_plea`, `convicted`, `sentenced` | **NEVER** invent prison terms or restitution figures not in filings | `"CONVICTED ALL COUNTS"`, `"GUILTY PLEA"`, `"15 YRS · $7.3M/DAY"`, `"85 MOS PRISON"`, `"APPEAL DENIED"` |
| **Portrait of a Judge / Prosecutor / Regulator** (e.g., Kövesi, Blanche) | **NEVER** place accusatory crime labels across their face implying *they* are the defendant | Use neutral docket/policy stamps (`"€410M VAT PROBE"`, `"50% D.P.A. DISCOUNT"`, `"NO COMPLIANCE MONITOR"`) and accurately identify their official title in `subject` and `alt`. |

### Reusable Prompt Template

```text
SYSTEM ROLE:
You are the Art Director & Interactive Canvas 2D Engineer for *The Financial Crimes* ("All the Crimes Fit to Fine"), a satirical-yet-100%-factually-grounded digital broadsheet modeled on classic New York Times typography and New Yorker editorial portraiture.

VISUAL VOICE:
- Paint in living Canvas 2D impressionist impasto oils (sambitbiswas.com architecture: 3-pass shadow/body/specular paintDab, procedural linen weave with mix-blend-multiply, progressive coarse-to-fine underpainting, Sobel luminance-gradient contour brushstrokes, HOTSPOT_SHARE = 0.62 pointer focus).
- Use ONLY The Financial Crimes editorial oil palette (FC_OIL: verdictCrimson, bullionGold, subpoenaCobalt, banknoteEmerald, courtroomOchre, pressBlack, newsprintCream, charcoalShadow, scandalRose, editorialSlate).
- If {{SECTION_TEMPLATE}} is "opinion", you MUST use paletteMood: "monochrome-noir" (charcoal/sepia chiaroscuro oil portrait with Verdict Crimson poke accent only).
- ZERO neon SaaS colors. ZERO cluttered HUD bars, raw ISO timestamps, or HTML overlays on the canvas. ZERO <img> elements in the DOM (the reference JPEG is sampled strictly in memory via loadPixels()).

LIBEL & FACTUAL SAFETY (NON-NEGOTIABLE):
- Ground every word and number strictly in the verified facts below. Never invent a dollar figure, agency, or prison term.
- Check {{LEGAL_STAGE}}:
  * If indicted / arrested / civil_complaint / investigation / interim_order: NEVER use "GUILTY", "CONVICTED", prison bars, or handcuffs. Explicitly reflect contested/pending posture ("ALLEGED", "INDICTED · PENDING TRIAL", "APPEAL PENDING", "PRESUMED INNOCENT").
  * If settlement / regulatory_order / dpa with no guilt admission: reflect exact resolution ("0 EXECS CHARGED", "0 PRISON DAYS", "NO GUILT ADMITTED").
  * Only guilty_plea / convicted / sentenced may state conviction or prison sentences.
  * If {{SUBJECT_NAME}} is a judge, prosecutor, or policy official rather than a defendant, never suggest personal wrongdoing.

INPUT STORY DOSSIER:
- Article Slug:        {{ARTICLE_SLUG}}
- Headline:            {{ARTICLE_HEADLINE}}
- Section Template:    {{SECTION_TEMPLATE}}          # "news" | "opinion"
- City / Venue:        {{CITY_VENUE}}
- Defendant / Target:  {{DEFENDANT_NAME}}
- Visual Subject:      {{SUBJECT_NAME}}              # Exact person/building/object in the reference photo
- Reference Image URL: {{REFERENCE_IMAGE_URL}}       # Verified public-domain / Wikimedia Commons JPEG
- Source License:      {{SOURCE_LICENSE}}            # e.g. "Public Domain", "CC BY-SA 4.0"
- Key Verified Numbers:{{KEY_NUMBERS}}               # e.g. "$5.0B+ late SARs; $1.21B net fine ($750M credited); 0 execs"
- Legal Stage:         {{LEGAL_STAGE}}               # e.g. "settlement" | "indicted" | "sentenced" | "dpa"
- Summary Facts:       {{SUMMARY_FACTS}}

OUTPUT MODE (pick Mode A for daily sweep manifest, or Mode B for a bespoke flagship TypeScript Scene):

=== MODE A: `content/paint-refs.json` ENTRY (DEFAULT FOR DAILY SWEEP) ===
Return ONLY valid JSON matching `PaintRefManifestEntry`:
{
  "{{ARTICLE_SLUG}}": {
    "refImage": "/paint-refs/{{ARTICLE_SLUG}}.jpg",
    "subject": "<exact person + title, or landmark/object>",
    "sourceUrl": "<canonical Wikimedia Commons / gov source page URL>",
    "sourceLicense": "{{SOURCE_LICENSE}}",
    "isPortrait": true | false,
    "focalPoint": { "u": 0.50, "v": 0.35 },
    "paletteMood": "verdict-crimson | bullion-gold | subpoena-cobalt | banknote-emerald | courtroom-ochre | monochrome-noir",
    "toyKind": "stamp | coins | redaction | crash-line | envelopes | gavel-ripple",
    "toyText": "<MAX 18 CHARS, ALL CAPS, razor-sharp factual satire>",
    "toySubtext": "<MAX 26 CHARS, ALL CAPS, accurate legal posture>",
    "alt": "Impressionist oil portrait/painting of <subject>, <factual neutral context>."
  }
}

=== MODE B: BESPOKE INTERACTIVE CANVAS 2D SCENE (FLAGSHIP ONE-OFFS) ===
Return a single TypeScript module exporting `createScene(config: PaintRefConfig): Scene` that:
1. Imports `loadPixels`, `paintDab` conventions, `FC_OIL`, `resolveMoodProfile`, `clamp`, `lerp`, `hslCss`, `rgbToHsl`, `fbm` from `./types`, `./palette`, `./color`, `./noise`, `./portrait-scene`.
2. Uses `loadPixels(config.refImage, 180)` with Sobel contour tangent angles (`field.angles[idx]`) and editorial oil HSL grading in `sample(u, v, t)`.
3. Targets `config.focalPoint` in `hotspots(t)` (`r: 0.14`, `detail: 0.45`) and follows the reader's pointer seamlessly.
4. Implements a story-bespoke painterly click/poke interaction in `live(g, w, h, t)` and/or `sample(u, v, t)` using ONLY painted Canvas 2D strokes (zero DOM overlays), honoring `ctx.reducedMotion` and providing `reset()`.
```

---

## Section 5: Complete Worked Example & Automated QA Checklist

### Worked Example — Lead Hero (`bank-of-america-aml-bundle-discount`)

**Story Inputs:**
- `{{ARTICLE_SLUG}}`: `bank-of-america-aml-bundle-discount`
- `{{ARTICLE_HEADLINE}}`: *Bank of America Admits to Willful Laundering Lapses, Receives $750 Million Bundle Discount on Record Fine*
- `{{DEFENDANT_NAME}}`: Bank of America, N.A.
- `{{SUBJECT_NAME}}`: Brian Moynihan, C.E.O. of Bank of America
- `{{REFERENCE_IMAGE_URL}}`: `https://commons.wikimedia.org/wiki/File:Brian_Moynihan,_official_portrait,_Homeland_Security_Council.jpg` (`Public Domain`)
- `{{KEY_NUMBERS}}`: `$5.0B+ late SARs; $1.96B stacked penalties reduced by $750M OCC credit to $1.21B net; 0 executives charged`
- `{{LEGAL_STAGE}}`: `settlement` (`admitted_guilt: true` civil consent orders, `0` criminal charges)

#### Mode A Output (`content/paint-refs.json` entry):
```json
{
  "bank-of-america-aml-bundle-discount": {
    "refImage": "/paint-refs/bank-of-america-aml-bundle-discount.jpg",
    "subject": "Brian Moynihan, C.E.O. of Bank of America",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:Brian_Moynihan,_official_portrait,_Homeland_Security_Council.jpg",
    "sourceLicense": "Public Domain",
    "isPortrait": true,
    "focalPoint": { "u": 0.49, "v": 0.34 },
    "paletteMood": "verdict-crimson",
    "toyKind": "stamp",
    "toyText": "$750M DISCOUNT",
    "toySubtext": "0 EXECS CHARGED",
    "alt": "Impressionist oil portrait of Bank of America chief executive Brian Moynihan, illustrating the bank's $1.21 billion anti-money-laundering settlement with federal regulators."
  }
}
```

#### Mode B Output (Condensed Bespoke `Scene` Blueprint):
```ts
import type { Hotspot, PaintRefConfig, PointerKind, Sample, Scene } from './types';
import { clamp, hslCss, lerp, rgbToHsl } from './color';
import { FC_OIL, resolveMoodProfile } from './palette';
import { loadPixels, type PixelField } from './portrait-scene';

export function createBofABundleScene(config: PaintRefConfig): Scene {
  const mood = resolveMoodProfile(config.paletteMood ?? 'verdict-crimson');
  const anchor = config.focalPoint ?? { u: 0.49, v: 0.34 };
  let field: PixelField | null = null;
  let status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  let pointer: { u: number; v: number } | null = null;
  const focus = { u: anchor.u, v: anchor.v };
  const stamps: Array<{ u: number; v: number; rot: number; t0: number }> = [];

  const start = () => {
    if (status !== 'idle' || !config.refImage) return;
    status = 'loading';
    loadPixels(config.refImage, 180).then(
      (p) => { field = p; status = 'ready'; },
      () => { status = 'failed'; },
    );
  };

  return {
    aspect: config.aspect ?? 4 / 5,
    alt: config.alt ?? 'Impressionist oil portrait of Bank of America chief executive Brian Moynihan.',
    ready: () => status === 'ready' || status === 'failed',
    sample(u, v) {
      if (!field) return { color: FC_OIL.newsprintCream, jitter: 0.5 };
      const px = Math.min(field.width - 1, Math.max(0, Math.floor(u * field.width)));
      const py = Math.min(field.height - 1, Math.max(0, Math.floor(v * field.height)));
      const idx = py * field.width + px;
      const o = idx * 4;
      const [h, s, l] = rgbToHsl(field.data[o], field.data[o + 1], field.data[o + 2]);
      const edge = Math.hypot((u - 0.5) * 1.4, (v - 0.45) * 1.3);
      const vig = clamp((edge - 0.52) * mood.vignetteStrength, 0, 0.28);
      return {
        color: [h, clamp(s * mood.satBoost + 5, 4, 88), clamp(l * (1 - vig * 0.65) + 2, 9, 95)],
        angle: field.strength[idx] > 0.12 ? field.angles[idx] : undefined,
        jitter: lerp(0.85, 0.48, field.strength[idx]),
      };
    },
    hotspots: () => [{ u: focus.u, v: focus.v, r: 0.14, detail: 0.45 }],
    update(t, dt) {
      start();
      const goal = pointer ?? {
        u: anchor.u + Math.sin(t * 0.24) * 0.08,
        v: anchor.v + Math.cos(t * 0.31) * 0.06,
      };
      const k = 1 - Math.exp(-dt * 5.5);
      focus.u += (goal.u - focus.u) * k;
      focus.v += (goal.v - focus.v) * k;
    },
    live(g, w, h, t) {
      for (const s of stamps) {
        const age = t - s.t0;
        if (age < 0 || age > 8) continue;
        const alpha = age < 0.12 ? age / 0.12 : age > 6.5 ? 1 - (age - 6.5) / 1.5 : 1;
        g.save();
        g.translate(s.u * w, s.v * h);
        g.rotate(s.rot);
        g.strokeStyle = hslCss(FC_OIL.verdictCrimson[0], FC_OIL.verdictCrimson[1], FC_OIL.verdictCrimson[2], 0.88 * alpha);
        g.fillStyle = hslCss(FC_OIL.newsprintCream[0], FC_OIL.newsprintCream[1], FC_OIL.newsprintCream[2], 0.86 * alpha);
        g.lineWidth = Math.max(2, w * 0.006);
        const bw = w * 0.48;
        const bh = h * 0.13;
        g.fillRect(-bw / 2, -bh / 2, bw, bh);
        g.strokeRect(-bw / 2, -bh / 2, bw, bh);
        g.fillStyle = hslCss(FC_OIL.verdictCrimson[0], FC_OIL.verdictCrimson[1], FC_OIL.verdictCrimson[2], 0.96 * alpha);
        g.font = `700 ${Math.round(w * 0.044)}px "Libre Franklin", sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(config.toyText ?? '$750M DISCOUNT', 0, -bh * 0.14);
        g.font = `600 ${Math.round(w * 0.025)}px "JetBrains Mono", monospace`;
        g.fillText(config.toySubtext ?? '0 EXECS CHARGED', 0, bh * 0.24);
        g.restore();
      }
    },
    pointer(kind: PointerKind, u, v, t) {
      pointer = kind === 'leave' ? null : { u, v };
      if (kind === 'down') {
        stamps.push({ u: clamp(u, 0.24, 0.76), v: clamp(v, 0.18, 0.82), rot: -0.14 + (stamps.length % 3) * 0.07, t0: t });
        if (stamps.length > 4) stamps.shift();
      }
    },
    reset() {
      stamps.length = 0;
    },
  };
}
```

---

### Automated & Visual QA Checklist (Run Before Every Edition Publishes)

- [ ] **1. Reference Image Integrity:** Every slug in `content/articles/YYYY/MM/` has a matching key in `content/paint-refs.json` and an existing RGB JPEG (`components 3`, `>15KB`, max `420px`) in `public/paint-refs/<slug>.jpg`.
- [ ] **2. Visual Spot Inspection:** Hero & newly added reference JPEGs are verified clean (no logos, SVG errors, watermarks, B&W negatives, or clipped foreheads).
- [ ] **3. License Audit:** Every entry carries a verified `sourceUrl` and permissive/public-domain `sourceLicense` (`Public Domain`, `CC0`, `CC BY`, `CC BY-SA`, `OGL`, `GODL-India`).
- [ ] **4. Zero-`<img>` DOM Audit:** `document.querySelectorAll('fc-painting img').length === 0` across homepage, article, and opinion pages.
- [ ] **5. Clean Frame Audit:** Zero header bars, zero raw ISO timestamps, zero `FIG.` badges, and zero caption overlays covering the painting canvas.
- [ ] **6. Sobel Contour Readability:** Portraits remain immediately recognizable at both `hero` (`4:5`) and `thumb` (`1:1`) sizes once underpainting finishes (`~1.35s` hero / `~0.7s` thumb).
- [ ] **7. Focal-Point Accuracy:** Hovering off the portrait lets idle brush refinement sharpen the subject's eyes/face (`focalPoint`), not empty wall or sky.
- [ ] **8. Interactive Toy Feel:** Clicking/poking triggers a tactile painterly effect (`stamp`, `coins`, `redaction`, `crash-line`, `envelopes`, or `gavel-ripple`) integrated visually into the oil surface.
- [ ] **9. Opinion Monochrome Rule:** Every `template: "opinion"` article uses `paletteMood: "monochrome-noir"` with zero chromatic noise in the underpainting.
- [ ] **10. Libel & Legal-Stage Lint:** Zero unconvicted/pending defendants have `"GUILTY"`, `"CONVICTED"`, prison bars, or false guilt admissions in `toyText`, `toySubtext`, or `alt`.
- [ ] **11. Performance & CLS:** `CLS === 0.000` (aspect-ratio locked wrapper), DPR capped at `2`, offscreen canvases paused via `IntersectionObserver`, and 60fps smooth scrolling with 20+ homepage paintings mounted.
- [ ] **12. Reduced Motion & Accessibility:** Under `prefers-reduced-motion: reduce`, each canvas completes in one static pass immediately, and carries a truthful descriptive `aria-label` / `alt`.
