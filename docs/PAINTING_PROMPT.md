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
| **Interaction Aesthetic** | Playful studio shelf pokes | **Unified "Wet-Oil & Archival Exhibit" System** (*NYT Magazine* × *The New Yorker* × Museum Print) — two disciplined layers only: a single lower-left cotton-rag Archival Exhibit Plate + dignified wet-oil / fine-print surface reactions |
| **Frame Chrome** | Pure edge-to-edge canvas | **Zero cluttered HUD bars.** No dateline pills, no raw ISO timestamps, no `FIG. VIII` stamps, no opaque caption boxes covering the paint, no 3-button clusters—only the 3 stacked `<canvas>` layers and a whisper-quiet hover-only repaint glyph (`↻`) |

### The Financial Crimes Oil Palette (`FC_OIL`)

Every scene and mood grade derives exclusively from these pigments (`src/painting/palette.ts`):

| Token | HSL (`[h, s, l]`) | Editorial Role |
| :--- | :--- | :--- |
| `verdictCrimson` | `[355, 68, 41]` | Legal carmine — enforcement headlines, stamps, plunging charts, Opinion poke accent |
| `bullionGold` | `[41, 74, 50]` | Sovereign gold — yachts, luxury watches, corporate treasury loot, 24k gold-leaf impasto gilding |
| `subpoenaCobalt` | `[213, 52, 37]` | Prussian courthouse blue — federal filings, AI-washing, European prosecutors, aviation steel |
| `banknoteEmerald` | `[154, 42, 32]` | Intaglio currency green — offshore banking hubs, green-finance loans, MAS/ESG ironies |
| `courtroomOchre` | `[30, 56, 46]` | Mahogany & sandstone — parliamentary halls, Southwark brick, DOJ corridors, chiaroscuro accents |
| `pressBlack` | `[28, 12, 11]` | Warm printer's lampblack — wet oil redaction bars, engraving hairlines, monochrome darks, deep suit lapels |
| `newsprintCream` | `[39, 34, 93]` | Cotton-rag broadsheet paper — ground wash, lower-left Archival Exhibit Plate paper (`#faf7f0`), highlight glazes |
| `charcoalShadow` | `[218, 16, 17]` | Cool shadow glaze — slate vignettes and evening skylines |
| `scandalRose` | `[348, 48, 56]` | Muted editorial blush — warm portrait midtone bridge |
| `editorialSlate` | `[210, 26, 44]` | Institutional stone — steel, glass towers, monochrome midtones |

### Hard Visual Prohibitions (Explicitly Outlawed Forever)
1. **ZERO floating drop-shadow typography** drawn over the middle of a painting or over a subject's face (`g.fillText` floating in mid-air, slapped across architecture/portraits, or rising like arcade XP numbers). Every word of factual satire lives exclusively inside the anchored lower-left Archival Exhibit Plate.
2. **ZERO cartoon clipart or arcade particles** — no bouncing gold Mario coins, no tumbling triangle-flap envelopes, no chunky dashed radar rings, no star/sparkle bursts, no laser tips, no spotlight flashes, and no giant rotated stamp boxes with ink-splatter rays.
3. **ZERO rounded SaaS pills, glowing blurs, or HUD widgets** overlaid on the canvas — never draw top header bars, raw ISO timestamps like `2026-11-19T06:00:00-05:00`, `FIG.` badges, fake telemetry tickers, or HTML button bars overlapping the artwork.
4. **ZERO neon SaaS colors** (no electric cyan `#00ffff`, no hot magenta, no purple-blue AI gradients, no glowing glassmorphism).
5. **ZERO `<img>` tags in the DOM** — the reference photograph is fetched purely in memory via `loadPixels()` into an offscreen pixel buffer and discarded; the reader sees *only* living oil brushstrokes painted onto `<canvas>`.
6. **ZERO flat vector charts masquerading as paintings** — every interactive mark must belong natively to wet oil brushwork (`sample()`) or *NYT*-grade fine-print engraving (`live()`).

---

## Section 2: Exact Canvas 2D Engine Contract

All paintings run inside our three-canvas stack inside `<fc-painting>` (`src/painting/element.ts`):
1. **`ground` canvas** — Holds permanent cumulative oil strokes laid down by `Painter` (underpainting + continuous maintenance + focal sharpening).
2. **`weave` canvas** — Static 180×180 procedural linen warp/weft tile (`paintWeave`, `src/painting/weave.ts`) composited via CSS `mix-blend-mode: multiply`.
3. **`live` canvas** — Cleared and redrawn at 60fps every frame by `scene.live(g, width, height, t)` for dignified fine-print editorial marks (subtle circular letterpress registration seal, delicate flat metallic foil flecks, fine-nib engraving plunge curves, forensic architectural routing arcs, razor-thin hairline chiaroscuro rings) plus the single shared lower-left **Archival Exhibit Plate** (`drawArchivalPlate`). Never used for floating center typography or arcade particles.

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

### Step 4 — Apply the Unified "Wet-Oil & Archival Exhibit" Interaction Grammar (`toyKind`)

Every painting rewards curiosity on click/poke using **ONE disciplined, museum-grade two-layer grammar** (*NYT Magazine* × *The New Yorker* × Museum Print). Never draw floating text over the middle of the painting or over a subject's face, and never emit cartoon particles.

#### Layer 1 — Shared Lower-Left Archival Exhibit Plate (`drawArchivalPlate`)
Whenever ANY of the 6 interactions is triggered, factual satire (`toyText` + `toySubtext`) is anchored inside ONE consistent, crisp museum/broadsheet exhibit tag pinned to the **lower-left inset** (`margin = clamp(unit * 0.04, 12, 22)` — never obscuring faces or the center of the canvas):
- **Paper & Frame:** Warm cotton-rag paper surface `#faf7f0` at `94%` opacity (`rgba(250, 247, 240, 0.94)`), sharp `0px` corners (zero rounded SaaS pills), crisp `1px solid #121212` (`rgba(18, 18, 18, 0.88)`) hairline border, subtle corner press-proof registration tick, and a `3px` vertical left pigment bar in the story's `FC_OIL` accent (`FC_OIL.verdictCrimson` for `monochrome-noir` Opinion pieces).
- **Editorial Typography (Zero Drop Shadow):**
  - Headline (`toyText`): refined `Newsreader`, `Georgia`, serif at weight `600`, `#121212`, slight tracking.
  - Subline (`toySubtext`): muted `JetBrains Mono`, `ui-monospace`, monospace at weight `500`, uppercase, `#4a4843`.
- **Calm, Authoritative Motion:** Settles upward `6px` while fading in over `220ms` (`easeOutCubic`), holds steady for `5.2s`, and fades out cleanly over `1.1s`. **Maximum 1 plate visible at a time** (re-clicking cleanly refreshes the active plate; never stack overlapping boxes). Under `prefers-reduced-motion: reduce`, renders statically without slide/flicker.

#### Layer 2 — 6 Dignified Painterly / Fine-Print Surface Reactions (ZERO Cartoon Clipart)
Every click triggers both Layer 1 (`drawArchivalPlate`) and ONE native wet-oil (`sample()`) or fine-print (`live()`) surface reaction:

| `toyKind` | Layer 2 Surface Reaction (Wet-Oil `sample()` & Fine-Print `live()`) | Best Editorial Fit |
| :--- | :--- | :--- |
| `stamp` | **Subtle Letterpress Registration Seal & Local Oil Glaze:** Quiet local pigment wax-seal oil wash painted in real impasto brushstrokes via `sample()` (`r ≈ 0.075`) + compact circular letterpress registration seal (`1.2px` double concentric hairline ring, fine inner crosshairs, tiny `FC` mark at low ink opacity) on `live()` — *zero giant tilted boxes, zero ink-splatter rays*. | Bundle discounts, zero-prison deals, forged forms, record fine comparisons, audit bans |
| `coins` | **24k Gold-Leaf Impasto Gilding:** Organic fbm-masked patch around the click (`r ≈ 0.17`) painted directly into the portrait's oil brushstrokes in `sample()` (`FC_OIL.bullionGold` + warm burnished ochre, following real Sobel contours, gradually repainted by maintenance strokes over ~6.5s) + whisper-subtle `1px` gold hairline ring and 5–7 delicate flat metallic foil flecks — *zero bouncing cartoon Mario coins*. | Diverted EV loans, luxury watches, Medicare yachts, 0.915% bank fines |
| `redaction` | **Wet Lampblack Impasto Censor Bar:** Broad lampblack oil brushstroke painted directly into `sample()` with **zero text on the bar**; hovering physically brushes/repaints the underlying portrait right back through while the lower-left Archival Exhibit Plate displays `toyText` + `HOVER BAR TO REVEAL`. | Unprivileged AI chats, `"~0% AI"` claims, sealed court filings |
| `crash-line` | **Fine-Nib Editorial Engraving Plunge Curve:** Smooth *NYT*-graphics engraving curve across the lower canvas (`1.5px` Verdict Crimson main stroke + `0.75px` dashed peak-baseline hairline + crisp `3.5px` peak/floor vertex dots) — *zero chunky zigzags, zero glowing yellow laser tips, zero spark bursts*. | Crypto collapses (`$40B`), options manipulation, Ponzi curves, bank stock cliffs |
| `envelopes` | **Forensic Investigative Routing Arcs:** 3 delicate `1px` curved architectural ink routing paths (`pressBlack` + hairline crimson dashed overlay) tracing from the click point to tiny ringed archival pinpoint nodes (`r = 3.5px`, cream fill + `1.2px` crimson ring) — *zero tumbling cartoon triangle-flap envelopes*. | 30-person insider rings, 4M fake-student bounce tests, shell-company & bribery trails |
| `gavel-ripple` | **Optical Chiaroscuro Wave:** Expanding annular wave inside `sample()` momentarily shifting real oil brushwork into stark monochrome broadsheet chiaroscuro before color returns behind the wave + 2 razor-thin `1px` continuous hairline rings (`pressBlack` + faint accent echo) and a `3px` ink origin dot — *zero chunky dashed orange rings, zero rising floating text, zero spotlight flash*. | Denied appeals, multi-nation dawn raids, 4-minute insider trade clocks, record Crown Court sentencings |

> **Hotspot Repaint Discipline:** Whenever a surface reaction modifies `sample()` (`stamp` local glaze, `coins` gold-leaf gilding, `redaction` lampblack bar, or `gavel-ripple` chiaroscuro wave), include that active zone in `hotspots(t)` so `Painter` concentrates fine maintenance dabs there and visibly repaints/heals the wet oil!

#### Adaptive Contrast & Canvas Blending Mode Rule (Dark vs. Light Grounds)
Every `live()` surface overlay MUST remain crisp and high-contrast whether the reader clicks on a dark navy flag/suit or a bright sunlit courthouse facade:
- **Measure Local Luminance (`sampleLocalLuminance(u, v, radius)`):** At click time (and along curve/arc midpoints), sample a 5-point cross (`center`, `±r` in `u`/`v`) from the cropped reference `PixelField` (accounting for `crop`, `wingFade`, chiaroscuro, and edge vignette; fallback `0.5` if unloaded).
- **Dark Grounds (`bgLum < 0.48` for `stamp`, `< 0.45` for curves/arcs/waves):** Switch to luminous archival ivory (`[40, 52, 92]`) and burnished gilt foil (`[43, 82, 74]`) / coral-crimson lift (`L = 62%`), applying `g.globalCompositeOperation = 'screen'` to hairline rings, curves, and routing arcs — and for `stamp`, backing razor-sharp `'source-over'` ivory `FC / 2026` typography with a quiet deep-charcoal translucent ground wash (`rgba(12, 12, 14, 0.36)`) rather than a murky pale wash (`>= 7:1` contrast).
- **Light / Mid Grounds (`bgLum >= 0.48` / `>= 0.45`):** Use deepened `mood.accent` or `FC_OIL.pressBlack` ink with `g.globalCompositeOperation = 'multiply'` on rings/curves/arcs (and warm cotton-rag tint `rgba(250, 247, 240, 0.72)` behind `stamp` marks). On very bright grounds (`bgLum > 0.72`), deepen `coins` foil flecks toward antique burnished bronze (`L ≈ 42%`) with a `'multiply'` rim edge.
- **Strict Canvas Isolation:** ALWAYS wrap every `globalCompositeOperation` switch inside `g.save()` / `g.restore()` so `drawArchivalPlate` stays untouched `'source-over'`.

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

VISUAL VOICE & INTERACTION AESTHETIC ("WET-OIL & ARCHIVAL EXHIBIT"):
- Paint in living Canvas 2D impressionist impasto oils (sambitbiswas.com architecture: 3-pass shadow/body/specular paintDab, procedural linen weave with mix-blend-multiply, progressive coarse-to-fine underpainting, Sobel luminance-gradient contour brushstrokes, HOTSPOT_SHARE = 0.62 pointer focus).
- Use ONLY The Financial Crimes editorial oil palette (FC_OIL: verdictCrimson, bullionGold, subpoenaCobalt, banknoteEmerald, courtroomOchre, pressBlack, newsprintCream, charcoalShadow, scandalRose, editorialSlate).
- If {{SECTION_TEMPLATE}} is "opinion", you MUST use paletteMood: "monochrome-noir" (charcoal/sepia chiaroscuro oil portrait with Verdict Crimson poke accent only).
- HARD PROHIBITIONS (OUTLAWED FOREVER):
  * ZERO floating drop-shadow typography drawn over the middle of a painting or over a subject's face (no mid-air g.fillText, no rising arcade XP text).
  * ZERO cartoon clipart or arcade particles (no bouncing gold Mario coins, no tumbling triangle-flap envelopes, no chunky dashed radar rings, no star/sparkle bursts, no giant rotated stamp boxes with ink-splatter rays).
  * ZERO rounded SaaS pills, glowing blurs, neon SaaS colors, HUD chrome bars, raw ISO timestamps, or HTML overlays on the canvas.
  * ZERO <img> elements in the DOM (the reference JPEG is sampled strictly in memory via loadPixels()).
- MANDATORY TWO-LAYER INTERACTION GRAMMAR:
  * Layer 1 — Shared Lower-Left Archival Exhibit Plate (`drawArchivalPlate`): Anchors `toyText` + `toySubtext` in ONE crisp lower-left museum/broadsheet exhibit tag (`#faf7f0` at 94% opacity, sharp 0px corners, 1px solid `#121212` hairline border, 3px left pigment bar in the story's FC_OIL accent, Newsreader 600 serif headline + muted JetBrains Mono 500 subline, calm 6px settle over 220ms, max 1 plate visible at a time — never obscuring faces).
  * Layer 2 — Dignified Wet-Oil / Fine-Print Surface Reaction:
    - `stamp`: subtle circular letterpress registration seal (1.2px double hairline ring) + quiet local pigment oil glaze in `sample()`.
    - `coins`: 24k gold-leaf impasto gilding painted directly into portrait brushstrokes in `sample()` (following Sobel contours, gradually repainted) + whisper-fine metallic foil flecks.
    - `redaction`: wet lampblack impasto censor bar in `sample()` with ZERO text on the bar; hovering brushes the portrait back through.
    - `crash-line`: fine-nib editorial engraving plunge curve (1.5px Verdict Crimson + 0.75px baseline hairline + crisp peak/floor vertex dots).
    - `envelopes`: forensic investigative routing arcs (1px curved architectural ink paths + ringed archival pinpoint nodes).
    - `gavel-ripple`: optical chiaroscuro wave inside `sample()` shifting oil brushwork into stark monochrome broadsheet chiaroscuro + 2 razor-thin 1px continuous hairline rings.
  * Adaptive Contrast & Canvas Blending Mode Rule: Sample local background luminance via `sampleLocalLuminance(u, v, radius)` (5-point cross accounting for crop, wingFade & vignette). On dark grounds (`bgLum < 0.48`), use luminous archival ivory (`[40, 52, 92]`) / burnished gilt (`[43, 82, 74]`) with `globalCompositeOperation = 'screen'` on hairline marks and a deep-charcoal wash (`rgba(12, 12, 14, 0.36)`) + `'source-over'` ivory type on seals; on light grounds (`bgLum >= 0.48`), use deepened pigment / `pressBlack` ink with `'multiply'` (and warm rag-paper tint `rgba(250, 247, 240, 0.72)` on seals; antique burnished bronze `L ≈ 42%` on `coins` when `bgLum > 0.72`). Strictly wrap all `globalCompositeOperation` changes in `g.save()` / `g.restore()` so `drawArchivalPlate` stays `'source-over'`.

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
1. Imports `loadPixels`, `FC_OIL`, `resolveMoodProfile`, `clamp`, `lerp`, `hslCss`, `mixHslShortest`, `rgbToHsl`, `fbm` from `./types`, `./palette`, `./color`, `./noise`, `./portrait-scene`.
2. Uses `loadPixels(config.refImage, 180)` with Sobel contour tangent angles (`field.angles[idx]`) and editorial oil HSL grading in `sample(u, v, t)`.
3. Targets `config.focalPoint` in `hotspots(t)` (`r: 0.14`, `detail: 0.45`), follows the reader's pointer seamlessly, and concentrates maintenance dabs over any active wet-oil glaze/gilding/redaction/chiaroscuro region.
4. Implements the Two-Layer "Wet-Oil & Archival Exhibit" interaction grammar ONLY:
   - Layer 1: Anchors `toyText` + `toySubtext` in the lower-left `drawArchivalPlate()` cotton-rag exhibit tag (max 1 active plate, 0px corners, 1px `#121212` border, 3px left pigment bar, Newsreader 600 + JetBrains Mono 500, zero floating center/face text).
   - Layer 2: A dignified wet-oil modulation in `sample(u, v, t)` and/or fine-print engraving mark in `live(g, w, h, t)` (zero cartoon clipart, zero arcade particles, zero DOM overlays), honoring `ctx.reducedMotion` and providing `reset()`.
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

#### Mode B Output (Condensed Bespoke `Scene` Blueprint — Wet-Oil & Archival Exhibit Standard):
```ts
import type { HSL, Hotspot, PaintRefConfig, PointerKind, Sample, Scene, SceneContext } from './types';
import { clamp, hslCss, lerp, mixHslShortest, rgbToHsl } from './color';
import { FC_OIL, resolveMoodProfile } from './palette';
import { loadPixels, type PixelField } from './portrait-scene';

interface ExhibitPlate {
  title: string;
  subtext: string;
  t0: number;
}

interface RegistrationSeal {
  u: number;
  v: number;
  t0: number;
}

/** Layer 1: Shared lower-left Archival Exhibit Plate (zero floating center/face text). */
function drawArchivalPlate(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  plate: ExhibitPlate,
  accent: HSL,
  t: number,
  reducedMotion: boolean,
): void {
  const age = t - plate.t0;
  const totalLife = 6.52; // 0.22s settle + 5.2s hold + 1.1s fade
  if (age < 0 || age > totalLife) return;

  const enter = reducedMotion ? 1 : clamp(age / 0.22, 0, 1);
  const eased = 1 - Math.pow(1 - enter, 3);
  const exit = age > 5.42 ? 1 - clamp((age - 5.42) / 1.1, 0, 1) : 1;
  const alpha = eased * exit;
  if (alpha <= 0.01) return;

  const unit = Math.min(w, h);
  const margin = clamp(unit * 0.04, 12, 22);
  const titlePx = Math.round(clamp(unit * 0.038, 12, 20));
  const subPx = Math.round(clamp(unit * 0.023, 9, 12));
  const padX = Math.round(clamp(unit * 0.032, 11, 16));
  const padY = Math.round(clamp(unit * 0.022, 8, 12));
  const accentW = 3;

  g.save();
  g.font = `600 ${titlePx}px "Newsreader", Georgia, serif`;
  const titleW = g.measureText(plate.title).width;
  g.font = `500 ${subPx}px "JetBrains Mono", ui-monospace, monospace`;
  const subW = plate.subtext ? g.measureText(plate.subtext).width : 0;

  const maxPlateW = Math.max(120, w - margin * 2);
  const boxW = Math.min(maxPlateW, Math.ceil(Math.max(titleW, subW)) + padX * 2 + accentW + 6);
  const gap = plate.subtext ? Math.round(subPx * 0.55) : 0;
  const boxH = padY * 2 + titlePx + (plate.subtext ? gap + subPx : 0);
  const rise = reducedMotion ? 0 : (1 - eased) * 6;
  const x = Math.round(margin) + 0.5;
  const y = Math.round(h - margin - boxH + rise) + 0.5;

  // Cotton-rag paper plate (#faf7f0 @ 94%), sharp 0px corners, 1px hairline border
  g.fillStyle = `rgba(250, 247, 240, ${(0.94 * alpha).toFixed(3)})`;
  g.fillRect(x, y, boxW, boxH);

  g.strokeStyle = `rgba(18, 18, 18, ${(0.88 * alpha).toFixed(3)})`;
  g.lineWidth = 1;
  g.strokeRect(x, y, boxW, boxH);

  // 3px left pigment bar in the story's FC_OIL accent
  g.fillStyle = hslCss(accent[0], accent[1], accent[2], 0.96 * alpha);
  g.fillRect(x, y, accentW, boxH);

  // Press-proof top-right hairline registration tick
  g.strokeStyle = `rgba(18, 18, 18, ${(0.35 * alpha).toFixed(3)})`;
  g.beginPath();
  g.moveTo(x + boxW - 8, y + 4.5);
  g.lineTo(x + boxW - 3.5, y + 4.5);
  g.moveTo(x + boxW - 3.5, y + 4.5);
  g.lineTo(x + boxW - 3.5, y + 9);
  g.stroke();

  // Dignified broadsheet typography (zero drop shadow)
  const textX = x + accentW + padX;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillStyle = `rgba(18, 18, 18, ${(0.96 * alpha).toFixed(3)})`;
  g.font = `600 ${titlePx}px "Newsreader", Georgia, serif`;
  g.fillText(plate.title, textX, y + padY, boxW - accentW - padX * 2);

  if (plate.subtext) {
    g.fillStyle = `rgba(74, 72, 67, ${(0.92 * alpha).toFixed(3)})`;
    g.font = `500 ${subPx}px "JetBrains Mono", ui-monospace, monospace`;
    g.fillText(plate.subtext, textX, y + padY + titlePx + gap, boxW - accentW - padX * 2);
  }
  g.restore();
}

export function createBofABundleScene(config: PaintRefConfig): Scene {
  const mood = resolveMoodProfile(config.paletteMood ?? 'verdict-crimson');
  const anchor = config.focalPoint ?? { u: 0.49, v: 0.34 };
  let field: PixelField | null = null;
  let status: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  let pointer: { u: number; v: number } | null = null;
  let reducedMotion = false;
  const focus = { u: anchor.u, v: anchor.v };
  let activeSeal: RegistrationSeal | null = null;
  let activePlate: ExhibitPlate | null = null;

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
    sample(u, v, t) {
      if (!field) return { color: FC_OIL.newsprintCream, jitter: 0.5 };
      const px = Math.min(field.width - 1, Math.max(0, Math.floor(u * field.width)));
      const py = Math.min(field.height - 1, Math.max(0, Math.floor(v * field.height)));
      const idx = py * field.width + px;
      const o = idx * 4;
      const [h, s, l] = rgbToHsl(field.data[o], field.data[o + 1], field.data[o + 2]);
      const edge = Math.hypot((u - 0.5) * 1.4, (v - 0.45) * 1.3);
      const vig = clamp((edge - 0.52) * mood.vignetteStrength, 0, 0.28);
      let color: HSL = [h, clamp(s * mood.satBoost + 5, 4, 88), clamp(l * (1 - vig * 0.65) + 2, 9, 95)];

      // Layer 2 (Wet-Oil): Quiet local pigment wax-seal glaze painted directly into the oil surface
      if (activeSeal) {
        const age = t - activeSeal.t0;
        if (age >= 0 && age < 6.0) {
          const dist = Math.hypot(u - activeSeal.u, v - activeSeal.v);
          const falloff = clamp(1 - dist / 0.075, 0, 1);
          const fade = age > 4.2 ? 1 - (age - 4.2) / 1.8 : 1;
          if (falloff > 0) {
            color = mixHslShortest(color, mood.accent, falloff * falloff * 0.32 * fade);
          }
        }
      }

      return {
        color,
        angle: field.strength[idx] > 0.12 ? field.angles[idx] : undefined,
        jitter: lerp(0.85, 0.48, field.strength[idx]),
      };
    },
    hotspots(t) {
      const spots: Hotspot[] = [{ u: focus.u, v: focus.v, r: 0.14, detail: 0.45 }];
      if (activeSeal && t - activeSeal.t0 < 6.5) {
        spots.push({ u: activeSeal.u, v: activeSeal.v, r: 0.095, detail: 0.55 });
      }
      return spots;
    },
    update(t, dt, ctx: SceneContext) {
      reducedMotion = ctx.reducedMotion;
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
      // Layer 2 (Fine-Print): Compact circular letterpress registration seal (1.2px double hairline ring)
      if (activeSeal) {
        const age = t - activeSeal.t0;
        if (age >= 0 && age < 5.6) {
          const enter = reducedMotion ? 1 : clamp(age / 0.18, 0, 1);
          const scale = reducedMotion ? 1 : lerp(1.04, 1, 1 - Math.pow(1 - enter, 3));
          const fade = age > 4.4 ? 1 - clamp((age - 4.4) / 1.2, 0, 1) : 1;
          const alpha = enter * fade * 0.72;
          const r = clamp(Math.min(w, h) * 0.068, 18, 34);
          const cx = activeSeal.u * w;
          const cy = activeSeal.v * h;

          g.save();
          g.translate(cx, cy);
          g.scale(scale, scale);
          g.strokeStyle = hslCss(mood.accent[0], mood.accent[1], mood.accent[2], alpha);
          g.lineWidth = 1.2;
          g.beginPath();
          g.arc(0, 0, r, 0, Math.PI * 2);
          g.stroke();

          g.lineWidth = 0.8;
          g.beginPath();
          g.arc(0, 0, r * 0.82, 0, Math.PI * 2);
          g.stroke();

          // Subtle letterpress registration crosshairs
          g.beginPath();
          g.moveTo(-r * 1.18, 0); g.lineTo(-r * 0.9, 0);
          g.moveTo(r * 0.9, 0);   g.lineTo(r * 1.18, 0);
          g.moveTo(0, -r * 1.18); g.lineTo(0, -r * 0.9);
          g.moveTo(0, r * 0.9);   g.lineTo(0, r * 1.18);
          g.stroke();

          g.fillStyle = hslCss(mood.accent[0], mood.accent[1], mood.accent[2], alpha * 0.9);
          g.font = `600 ${Math.round(r * 0.42)}px "Newsreader", Georgia, serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('FC', 0, 1);
          g.restore();
        }
      }

      // Layer 1: Shared lower-left Archival Exhibit Plate (max 1 visible at a time)
      if (activePlate) {
        drawArchivalPlate(g, w, h, activePlate, mood.accent, t, reducedMotion);
      }
    },
    pointer(kind: PointerKind, u, v, t) {
      pointer = kind === 'leave' ? null : { u, v };
      if (kind === 'down') {
        activeSeal = { u: clamp(u, 0.14, 0.86), v: clamp(v, 0.14, 0.78), t0: t };
        activePlate = {
          title: config.toyText ?? '$750M DISCOUNT',
          subtext: config.toySubtext ?? '0 EXECS CHARGED',
          t0: t,
        };
      }
    },
    reset() {
      activeSeal = null;
      activePlate = null;
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
- [ ] **5. Clean Frame Audit:** Zero header bars, zero raw ISO timestamps, zero `FIG.` badges, zero rounded SaaS pills, and zero HTML chrome widgets covering the painting canvas.
- [ ] **6. Zero Floating Center Text & Zero Cartoon Clipart:** Clicking any painting NEVER draws floating drop-shadow typography over the center of the artwork or over a subject's face, and NEVER emits cartoon particles (no bouncing gold Mario coins, no tumbling triangle-flap envelopes, no chunky dashed orange rings, no spark bursts, no giant tilted stamp boxes with ink-splatter rays).
- [ ] **7. Unified Archival Exhibit Plate & Wet-Oil Surface Grammar:** Every click renders at most 1 crisp lower-left cotton-rag `drawArchivalPlate` (`#faf7f0` @ 94%, `0px` sharp corners, `1px solid #121212` border, `3px` left `FC_OIL` pigment bar, `Newsreader` 600 serif + `JetBrains Mono` 500 mono) paired with a dignified wet-oil (`sample()`) or fine-print (`live()`) reaction (`stamp`, `coins`, `redaction`, `crash-line`, `envelopes`, or `gavel-ripple`). On `redaction`, zero text is drawn on the lampblack bar itself.
- [ ] **8. Sobel Contour Readability:** Portraits remain immediately recognizable at both `hero` (`4:5`) and `thumb` (`1:1`) sizes once underpainting finishes (`~1.35s` hero / `~0.7s` thumb).
- [ ] **9. Focal-Point & Wet-Oil Repaint Accuracy:** Hovering off the portrait lets idle brush refinement sharpen the subject's eyes/face (`focalPoint`), not empty wall or sky, and active wet-oil zones (`stamp` glaze, `coins` 24k gold-leaf gilding, `redaction` bar, `gavel-ripple` chiaroscuro wave) visibly repaint/heal via `hotspots()`.
- [ ] **10. Opinion Monochrome Rule:** Every `template: "opinion"` article uses `paletteMood: "monochrome-noir"` with zero chromatic noise in the underpainting (Verdict Crimson accent on click only).
- [ ] **11. Libel & Legal-Stage Lint:** Zero unconvicted/pending defendants have `"GUILTY"`, `"CONVICTED"`, prison bars, or false guilt admissions in `toyText`, `toySubtext`, or `alt`.
- [ ] **12. Performance & CLS:** `CLS === 0.000` (aspect-ratio locked wrapper), DPR capped at `2`, offscreen canvases paused via `IntersectionObserver`, and 60fps smooth scrolling with 20+ homepage paintings mounted.
- [ ] **13. Reduced Motion & Accessibility:** Under `prefers-reduced-motion: reduce`, each canvas completes in one static pass immediately, renders a calm non-flickering Archival Exhibit Plate on click, and carries a truthful descriptive `aria-label` / `alt`.
- [ ] **14. Adaptive Contrast & Blend Mode Check:** Clicking dark regions (`bgLum < 0.48`, e.g., dark suits/flags) renders high-contrast embossed ivory/gilt marks (`'screen'` rings + `'source-over'` ivory typography over subtle charcoal wash, `>= 7:1`), while light grounds (`bgLum >= 0.48`) render crisp deepened `'multiply'` letterpress ink, with `drawArchivalPlate` strictly isolated in `'source-over'`.
