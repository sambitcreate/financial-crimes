import type { HSL, Hotspot, PaintRefConfig, PaletteMood, PointerKind, Sample, Scene, ToyKind } from './types';
import { fbm, hashString, mulberry32, type Rand } from './noise';
import { clamp, lerp, mixHslShortest, rgbToHsl } from './color';
import { FC_OIL, resolveMoodProfile } from './palette';
import {
  SAMPLE_WIDTH,
  blendAngle,
  computeCoverCrop,
  createDefaultCrop,
  loadPixels,
  oilContrast,
  sampleLocalLuminance,
  type CropWindow,
  type PixelField,
} from './pixel-field';
import { drawArchivalPlate, type ArchivalPlateState } from './archival-plate';
import {
  applySurfacePigmentEffects,
  collectToyHotspots,
  createToyState,
  hasActiveToys,
  hasLiveToys,
  renderLiveToys,
  resetToyState,
  sampleRedactionOverlay,
  scratchRedactionsAt,
  triggerToy,
  updateToys,
} from './toys';

export { loadPixels, type PixelField };

const LOAD_TIMEOUT_MS = 6500;

export interface PortraitSceneOptions {
  random?: Rand;
  load?: (url: string) => Promise<PixelField>;
}

/**
 * Creates a Financial Crimes Canvas 2D Impressionist Impasto Portrait Scene:
 * - Samples a real reference portrait/photograph in memory with Sobel contour tangents
 * - Grades into editorial broadsheet oils (or dramatic monochrome Opinion chiaroscuro)
 * - Pulls fine brushstroke focus toward the reader's pointer (drifting gently over the face when idle)
 * - Paints tactile, story-specific interactive satire right onto the canvas on click/poke
 * - Gracefully underpaints a procedural impressionist portrait silhouette if no image loads
 */
export function createPortraitScene(
  config: PaintRefConfig,
  options: PortraitSceneOptions = {},
): Scene {
  let aspect = config.aspect && config.aspect > 0 ? config.aspect : 16 / 10;
  const isPortrait = config.isPortrait ?? true;
  const focal = {
    u: clamp(config.focalPoint?.u ?? 0.5, 0.15, 0.85),
    v: clamp(config.focalPoint?.v ?? (isPortrait ? 0.34 : 0.45), 0.15, 0.82),
  };
  const moodKey: PaletteMood =
    config.paletteMood ?? (config.monochrome ? 'monochrome-noir' : 'verdict-crimson');
  const mood = resolveMoodProfile(moodKey);
  const monochrome = Boolean(config.monochrome || moodKey === 'monochrome-noir');
  const toyKind: ToyKind = config.toyKind ?? 'stamp';
  const toyText = (config.toyText || 'CASE SETTLED').toUpperCase();
  const toySubtext = (config.toySubtext || '').toUpperCase();
  const interactive = config.mode !== 'thumb';

  const baseSeed = config.seed ?? hashString(config.slug || config.refImage || 'fc-portrait');
  const rand: Rand = options.random ?? mulberry32(baseSeed);
  const loadFn = options.load ?? ((url: string) => loadPixels(url, SAMPLE_WIDTH));

  let pixels: PixelField | null = null;
  let crop: CropWindow = createDefaultCrop(focal);
  let status: 'idle' | 'loading' | 'ready' | 'failed' = config.refImage ? 'idle' : 'failed';
  let pixelRevision = 0;

  // Pointer focus & idle eye drift
  let pointerTarget: { u: number; v: number } | null = null;
  const focus = { u: focal.u, v: focal.v };
  let lastClock = 0;
  let reducedMotion = false;

  const accentPigment: HSL = monochrome ? FC_OIL.verdictCrimson : mood.accent;

  // Shared lower-left archival exhibit plate (strictly 1 active plate at a time)
  let activePlate: ArchivalPlateState | null = null;

  // Wet-oil & editorial-engraving interaction states
  const toys = createToyState();

  const applyCrop = () => {
    if (!pixels) return;
    crop = computeCoverCrop(aspect, pixels.width, pixels.height, focal, isPortrait);
    focus.u = crop.canvasFocalU;
    focus.v = crop.canvasFocalV;
  };

  // Loads lazily from update(), i.e. only once the painting is near the viewport.
  const startLoad = () => {
    if (status !== 'idle' || !config.refImage) return;
    status = 'loading';
    // Slow networks paint the procedural fallback after LOAD_TIMEOUT_MS, but a late image
    // still lands and bumps the revision so the painter restarts from the real portrait.
    const timer = setTimeout(() => {
      if (status === 'loading') status = 'failed';
    }, LOAD_TIMEOUT_MS);
    loadFn(config.refImage).then(
      (field) => {
        clearTimeout(timer);
        if (pixels) return;
        const late = status === 'failed';
        pixels = field;
        applyCrop();
        status = 'ready';
        if (late) pixelRevision++;
      },
      () => {
        clearTimeout(timer);
        if (!pixels) status = 'failed';
      },
    );
  };

  /** Rich procedural New Yorker-style portrait silhouette fallback (never blank or broken). */
  function sampleFallbackPortrait(u: number, v: number, t: number): Sample {
    const n1 = fbm(u * 3.8 + (baseSeed % 17), v * 3.8 + 2.3);
    const n2 = fbm(u * 8.2 + 5.1, v * 8.2 - 1.4);
    const sway = Math.sin(t * 0.25 + u * 3) * 0.012;

    const cx = 0.5;
    const headY = 0.36;
    const dx = (u - cx) * Math.min(aspect, 1.45);
    const dyHead = (v - headY) / 0.175;
    const headDist = Math.hypot(dx / 0.135, dyHead);

    // Tailored shoulders & lapels
    const shoulderTop = 0.57 + Math.pow(Math.abs(dx) * 2.15, 1.45) * 0.17;
    const inShoulders = v > shoulderTop && Math.abs(dx) < 0.44 + (v - 0.57) * 0.35;

    // Neck
    const inNeck = v >= 0.49 && v <= 0.62 && Math.abs(dx) < 0.068;

    let color: HSL;
    let angle = (n1 - 0.5) * 1.1;
    let jitter = 0.9;

    if (headDist < 1.0) {
      // Sculpted chiaroscuro portrait head (warm studio key light on left, deep oil shadow on right)
      const keyLight = clamp(0.62 - dx * 2.4 - dyHead * 0.22 + (n2 - 0.5) * 0.16, 0, 1);
      const hairBand = dyHead < -0.32 + (n2 - 0.5) * 0.15;
      angle = Math.atan2(dyHead, dx / 0.135) + Math.PI / 2;
      jitter = 0.65;
      if (monochrome) {
        const l = hairBand ? lerp(11, 24, keyLight) : lerp(18, 82, keyLight);
        color = [lerp(28, 40, keyLight), lerp(6, 15, keyLight), l];
      } else if (hairBand) {
        color = mixHslShortest(mood.shadow, FC_OIL.pressBlack, 0.45 + (1 - keyLight) * 0.4);
      } else {
        const warmHighlight: HSL = [32, 46, 74];
        const midFlesh: HSL = [24, 42, 54];
        const deepShadow: HSL = [18, 34, 24];
        color =
          keyLight > 0.5
            ? mixHslShortest(midFlesh, warmHighlight, (keyLight - 0.5) * 2)
            : mixHslShortest(deepShadow, midFlesh, keyLight * 2);
      }
    } else if (inNeck) {
      const shade = clamp(0.42 - dx * 2.2, 0, 1);
      angle = Math.PI / 2 + (n2 - 0.5) * 0.3;
      color = monochrome ? [34, 14, lerp(16, 52, shade)] : [22, 34, lerp(22, 48, shade)];
      jitter = 0.7;
    } else if (inShoulders) {
      // Crisp shirt collar V and editorial crimson/gold tie inside dark suit
      const inCollarV = v < 0.76 && Math.abs(dx) < (0.76 - v) * 0.42;
      const inTie = v >= 0.61 && v < 0.86 && Math.abs(dx) < 0.026 + (v - 0.61) * 0.04;
      angle = dx < 0 ? -0.42 : 0.42;
      if (inTie) {
        color = monochrome ? [355, 62, 38] : mood.accent;
        angle = Math.PI / 2;
        jitter = 0.55;
      } else if (inCollarV) {
        color = monochrome ? [38, 18, 88 - (v - 0.57) * 40] : mood.paper;
        angle = dx < 0 ? 0.65 : -0.65;
        jitter = 0.5;
      } else {
        const lapelEdge = Math.abs(Math.abs(dx) - (0.76 - v) * 0.46) < 0.025 && v < 0.8;
        const suitShade = clamp(0.5 - dx * 0.9 + (n2 - 0.5) * 0.25, 0, 1);
        if (monochrome) {
          color = [216, 10, lerp(10, 26, suitShade) + (lapelEdge ? 6 : 0)];
        } else {
          color = mixHslShortest(
            FC_OIL.pressBlack,
            mood.shadow,
            0.4 + suitShade * 0.45 + (lapelEdge ? 0.15 : 0),
          );
          color = [color[0], color[1], clamp(color[2] + (lapelEdge ? 7 : 0), 9, 32)];
        }
        jitter = 0.78;
      }
    } else {
      // Painterly courtroom / broadsheet studio backdrop with subtle architectural light
      const beam = Math.exp(-Math.pow((u - 0.34 + sway) * 1.65, 2)) * 0.22;
      const column = Math.sin(u * Math.PI * 6) > 0.72 ? 0.08 : 0;
      const edgeDist = Math.hypot((u - 0.5) * 1.25, (v - 0.45) * 1.2);
      const vig = clamp((edgeDist - 0.28) * 1.15, 0, 1);
      if (monochrome) {
        const l = clamp(72 + beam * 26 - vig * 42 + (n1 - 0.5) * 14 - column * 18, 16, 90);
        color = [lerp(28, 40, l / 100), lerp(6, 15, l / 100), l];
      } else {
        const baseWall = mixHslShortest(mood.midtone, mood.paper, 0.55 + beam - column * 0.5);
        const litWall: HSL = [
          baseWall[0] + (n1 - 0.5) * 14,
          clamp(baseWall[1] * 0.82, 14, 58),
          clamp(baseWall[2] + (n2 - 0.5) * 10, 26, 86),
        ];
        color = mixHslShortest(litWall, mood.shadow, vig * 0.62);
      }
      angle = (n1 - 0.5) * 0.85 - 0.25;
      jitter = 1.05;
    }

    return { color, angle, jitter, monochrome };
  }

  function sample(u: number, v: number, t: number): Sample | null {
    // 1. Check painted redaction oil bars on the ground layer first
    if (toys.redactions.length > 0) {
      const redacted = sampleRedactionOverlay(toys.redactions, u, v);
      if (redacted) return redacted;
    }

    // 2. Graceful procedural impressionist portrait fallback if image failed or absent
    if (!pixels) {
      if (status === 'failed') {
        return applySurfacePigmentEffects(
          toys,
          u,
          v,
          t,
          aspect,
          reducedMotion,
          sampleFallbackPortrait(u, v, t),
        );
      }
      return { color: FC_OIL.newsprintCream, jitter: 0.45, monochrome };
    }

    // 3. Aspect-safe focal-point cover-crop (with seamless painted studio wings for portraits in wide frames)
    const hasWings = crop.canvasU0 > 0.005 || crop.canvasU1 < 0.995;
    const spanU = Math.max(0.001, crop.canvasU1 - crop.canvasU0);
    const rawIu = hasWings ? (u - crop.canvasU0) / spanU : crop.uStart + u * crop.winW;

    let wingFade = 0;
    let sampleIu = rawIu;
    let sampleIv = crop.vStart + v * crop.winH;

    if (hasWings) {
      if (rawIu < 0.08) {
        wingFade = clamp((0.08 - rawIu) / 0.24, 0, 1);
      } else if (rawIu > 0.92) {
        wingFade = clamp((rawIu - 0.92) / 0.24, 0, 1);
      }
      if (wingFade > 0) {
        // Organic brushstroke edge sampling so painted wings never create horizontal streaks
        const edgeJitterU = (fbm(u * 5.2 + 3.1, v * 4.8) - 0.5) * 0.09 * wingFade;
        const edgeJitterV = (fbm(u * 4.4, v * 5.6 + 9.2) - 0.5) * 0.14 * wingFade;
        sampleIu = clamp(rawIu, 0.025, 0.975) + edgeJitterU;
        sampleIv += edgeJitterV;
      }
    }

    const iu = clamp(sampleIu, 0, 0.9999);
    const iv = clamp(sampleIv, 0, 0.9999);
    const px = Math.min(pixels.width - 1, Math.floor(iu * pixels.width));
    const py = Math.min(pixels.height - 1, Math.floor(iv * pixels.height));
    const idx = py * pixels.width + px;
    const p4 = idx * 4;

    const r = pixels.data[p4];
    const g = pixels.data[p4 + 1];
    const b = pixels.data[p4 + 2];

    const edgeStrength = pixels.strength[idx] * (1 - wingFade);

    // Curve oil brushstrokes organically along cheekbones, hairlines, lapels & facades
    const contourWeight = edgeStrength > 0.12 ? clamp((edgeStrength - 0.12) * 1.15, 0, 0.94) : 0;
    const angle =
      contourWeight > 0
        ? blendAngle((fbm(u * 2.4 + 7.3, v * 2.4 + 1.9) - 0.5) * 1.4, pixels.angles[idx], contourWeight)
        : undefined;

    // Subtle radial editorial vignette toward frame corners
    const distFromFocal = Math.hypot((u - crop.canvasFocalU) * 1.12, (v - crop.canvasFocalV) * 1.05);
    const vignette = clamp((distFromFocal - 0.34) * 1.25, 0, 1) * mood.vignetteStrength;

    // Tighter color fidelity on facial edges; richer painterly broken color in open backgrounds/wings
    const focalBoost = Math.exp(-Math.pow(distFromFocal / 0.24, 2));
    const baseJitter = clamp(
      lerp(0.88, 0.44, Math.max(edgeStrength * 0.75, focalBoost * 0.6)),
      0.38,
      0.96,
    );
    const jitter = wingFade > 0 ? lerp(baseJitter, 1.08, wingFade) : baseJitter;

    let graded: HSL;

    if (monochrome) {
      // Dramatic New Yorker Opinion chiaroscuro: rich printer's lampblack charcoal -> warm rag newsprint cream
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const shaped = oilContrast(lum, 0.36);
      const wingDarken = wingFade * 16;
      const l = clamp(lerp(8, 93, shaped) - vignette * 18 - wingDarken, 7, 94);
      const warmth = clamp((l - 16) / 74, 0, 1);
      const h = lerp(28, 40, warmth);
      const s = lerp(6, 16, warmth);
      graded = [h, s, l];
    } else {
      const [rawH, rawS, rawL] = rgbToHsl(r, g, b);
      const shapedL = oilContrast(rawL / 100, 0.22) * 100;

      // Subtle oil color-temperature grading: warm sunlit highlights, rich deep shadows
      let h = rawH;
      if (shapedL < 30 && rawS < 32) {
        // Cool dark neutral shadows slightly toward charcoal/slate oil umber
        h = mixHslShortest([rawH, rawS, shapedL], mood.shadow, 0.25)[0];
      } else if (shapedL > 72 && rawS < 28) {
        // Warm bright neutral whites toward archival rag newsprint ivory
        h = mixHslShortest([rawH, rawS, shapedL], mood.paper, 0.35)[0];
      }

      const s = clamp(rawS * mood.satBoost + (rawS > 8 ? 6 : 3), 5, 89);
      const l = clamp(shapedL * 0.94 + 3.5, 9, 94);

      graded = [h, s, l];
      const totalGlaze = clamp(vignette + wingFade * 0.44, 0, 0.65);
      if (totalGlaze > 0.01) {
        graded = mixHslShortest(graded, mood.shadow, totalGlaze);
      }
    }

    return applySurfacePigmentEffects(toys, u, v, t, aspect, reducedMotion, {
      color: graded,
      angle,
      jitter,
      monochrome,
    });
  }

  function triggerPlate(t: number, title: string, subtitle: string): void {
    activePlate = {
      t0: t,
      title: title.trim().toUpperCase(),
      subtitle: subtitle.trim().toUpperCase(),
      accent: accentPigment,
    };
  }

  return {
    ready: () => status === 'ready' || status === 'failed',
    revision: () => pixelRevision,
    resize(width: number, height: number) {
      if (width <= 0 || height <= 0) return;
      aspect = width / height;
      applyCrop();
    },
    busy: () => Boolean(activePlate) || hasActiveToys(toys, lastClock),
    sample,
    hotspots(t: number): Hotspot[] {
      const spots: Hotspot[] = [
        // Active pointer / gently drifting facial focus hotspot
        { u: focus.u, v: focus.v, r: 0.14, detail: 0.45 },
      ];

      // Keep a gentle secondary anchor on the portrait's face/eyes so features stay expressive
      if (isPortrait) {
        spots.push({ u: crop.canvasFocalU, v: crop.canvasFocalV, r: 0.16, detail: 0.58 });
      }

      collectToyHotspots(toys, t, aspect, reducedMotion, spots);
      return spots;
    },
    update(t, dt, ctx) {
      lastClock = t;
      reducedMotion = ctx.reducedMotion;
      if (status === 'idle') startLoad();

      // Smooth pointer tracking or slow contemplative drift around the subject's eyes
      const goal =
        pointerTarget ?? {
          u: clamp(crop.canvasFocalU + Math.sin(t * 0.23 + baseSeed) * 0.12, 0.12, 0.88),
          v: clamp(crop.canvasFocalV + Math.sin(t * 0.31 + baseSeed * 0.3) * 0.09, 0.12, 0.88),
        };
      const k = 1 - Math.exp(-dt * 6.5);
      focus.u += (goal.u - focus.u) * k;
      focus.v += (goal.v - focus.v) * k;

      updateToys(toys, t, dt);
    },
    live(g, width, height, t, dpr) {
      if (!activePlate && !hasLiveToys(toys)) {
        return false;
      }

      // Normalize to logical CSS pixels so 1px hairlines & typography are razor-sharp at 1x and 2x DPR
      const cw = width / dpr;
      const ch = height / dpr;

      g.save();
      g.scale(dpr, dpr);

      renderLiveToys(g, toys, cw, ch, t, reducedMotion, accentPigment);

      // Shared bottom-left Archival Exhibit Plate always renders crisply last
      if (activePlate && !drawArchivalPlate(g, activePlate, cw, ch, t, reducedMotion)) {
        activePlate = null;
      }

      g.restore();
      return true;
    },
    pointer(kind: PointerKind, u: number, v: number, t: number) {
      const at = Number.isFinite(t) ? t : lastClock;
      if (kind === 'leave') {
        pointerTarget = null;
        return false;
      }

      pointerTarget = { u: clamp(u, 0, 1), v: clamp(v, 0, 1) };

      if (kind === 'up') {
        return false;
      }

      if (kind === 'move' && interactive && toyKind === 'redaction') {
        return scratchRedactionsAt(toys, u, v, at);
      }

      if (kind === 'down' && interactive) {
        const subtitle = triggerToy(toys, toyKind, u, v, at, {
          aspect,
          isPortrait,
          reducedMotion,
          accentPigment,
          rand,
          sampleLuminance: (su, sv, r) =>
            sampleLocalLuminance(pixels, crop, mood, monochrome, su, sv, r),
          toySubtext,
        });
        triggerPlate(at, toyText, subtitle);
        return true;
      }
      return false;
    },
    reset() {
      activePlate = null;
      resetToyState(toys);
      pointerTarget = null;
      if (status === 'failed' && config.refImage) {
        status = 'idle';
        startLoad();
      }
    },
  };
}
