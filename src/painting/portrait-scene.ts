import type {
  HSL,
  Hotspot,
  PaintRefConfig,
  PaletteMood,
  PointerKind,
  Sample,
  Scene,
  ToyKind,
} from './types';
import { fbm, hashString, mulberry32, type Rand } from './noise';
import { clamp, hslCss, hslToRgb, lerp, mixHslShortest, rgbToHsl } from './color';
import { FC_OIL, resolveMoodProfile } from './palette';

const TAU = Math.PI * 2;
const SAMPLE_WIDTH = 180;
const LOAD_TIMEOUT_MS = 6500;

export interface PixelField {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Sobel contour tangent angles (radians) so strokes follow cheekbones, hairlines & lapels. */
  angles: Float32Array;
  /** Normalized Sobel edge magnitude (0..1) controlling how tightly strokes lock to contours. */
  strength: Float32Array;
}

const pixelCache = new Map<string, Promise<PixelField>>();

/** Compute a 1-pass smoothed luminance buffer and Sobel contour tangent field. */
function computeSobelField(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { angles: Float32Array; strength: Float32Array } {
  const count = width * height;
  const rawLum = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    rawLum[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
  }

  // Light 3x3 Gaussian-like blur to suppress JPEG micro-artifacts before Sobel
  const lum = new Float32Array(count);
  for (let y = 0; y < height; y++) {
    const ym = y > 0 ? y - 1 : 0;
    const yp = y < height - 1 ? y + 1 : height - 1;
    for (let x = 0; x < width; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x < width - 1 ? x + 1 : width - 1;
      const idx = y * width + x;
      lum[idx] =
        (rawLum[ym * width + xm] +
          rawLum[ym * width + x] * 2 +
          rawLum[ym * width + xp] +
          rawLum[y * width + xm] * 2 +
          rawLum[idx] * 4 +
          rawLum[y * width + xp] * 2 +
          rawLum[yp * width + xm] +
          rawLum[yp * width + x] * 2 +
          rawLum[yp * width + xp]) /
        16;
    }
  }

  const angles = new Float32Array(count);
  const strength = new Float32Array(count);

  for (let y = 0; y < height; y++) {
    const ym = y > 0 ? y - 1 : 0;
    const yp = y < height - 1 ? y + 1 : height - 1;
    for (let x = 0; x < width; x++) {
      const xm = x > 0 ? x - 1 : 0;
      const xp = x < width - 1 ? x + 1 : width - 1;

      const tl = lum[ym * width + xm];
      const tc = lum[ym * width + x];
      const tr = lum[ym * width + xp];
      const ml = lum[y * width + xm];
      const mr = lum[y * width + xp];
      const bl = lum[yp * width + xm];
      const bc = lum[yp * width + x];
      const br = lum[yp * width + xp];

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const mag = Math.hypot(gx, gy);

      const idx = y * width + x;
      // Brushstroke runs ALONG the contour (perpendicular to luminance gradient)
      angles[idx] = Math.atan2(gy, gx) + Math.PI / 2;
      strength[idx] = clamp(mag * 1.9, 0, 1);
    }
  }

  return { angles, strength };
}

/**
 * Load a reference image completely in memory (never placed in the DOM),
 * downsample to `sampleWidth` px wide, and precompute its Sobel angle field.
 */
export function loadPixels(url: string, sampleWidth = SAMPLE_WIDTH): Promise<PixelField> {
  const cacheKey = `${url}@${sampleWidth}`;
  const existing = pixelCache.get(cacheKey);
  if (existing) return existing;

  const promise = new Promise<PixelField>((resolve, reject) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      reject(new Error('Image decoding requires a browser environment'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {

      const naturalW = img.naturalWidth || sampleWidth;
      const naturalH = img.naturalHeight || sampleWidth;
      const width = sampleWidth;
      const height = Math.max(1, Math.round((width * naturalH) / naturalW));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const g = canvas.getContext('2d', { willReadFrequently: true });
      if (!g) {
        reject(new Error('2D canvas unavailable'));
        return;
      }

      g.drawImage(img, 0, 0, width, height);
      try {
        const data = g.getImageData(0, 0, width, height).data;
        const { angles, strength } = computeSobelField(data, width, height);
        resolve({ width, height, data, angles, strength });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(`Could not read pixels for ${url}`));
      }
    };

    img.onerror = () => {
      reject(new Error(`Could not load ${url}`));
    };

    img.src = url;
  });

  // Evict failed entries so a manual Repaint can retry if network recovers
  promise.catch(() => {
    if (pixelCache.get(cacheKey) === promise) {
      pixelCache.delete(cacheKey);
    }
  });

  pixelCache.set(cacheKey, promise);
  return promise;
}

/* ============================================================================
   Wet-Oil & Archival Exhibit Interaction State Types
   ============================================================================ */

interface ArchivalPlate {
  t0: number;
  title: string;
  subtitle: string;
  accent: HSL;
}

interface RegistrationStamp {
  u: number;
  v: number;
  t0: number;
  seed: number;
  accent: HSL;
  bgLum: number;
}

interface GoldLeafPatch {
  u: number;
  v: number;
  t0: number;
  seed: number;
  bgLum: number;
}

interface GoldFoilFleck {
  u: number;
  v: number;
  vu: number;
  vv: number;
  w: number;
  h: number;
  rot: number;
  vrot: number;
  phase: number;
  t0: number;
  life: number;
  pale: boolean;
  bgLum: number;
}

interface RedactionBar {
  u0: number;
  u1: number;
  v: number;
  halfH: number;
  tilt: number;
  t0: number;
  seed: number;
  /** Per-segment ink coverage (1 = solid lampblack glaze, 0 = rubbed clean back to portrait). */
  cells: Float32Array;
}

interface EngravingPlunge {
  t0: number;
  points: { u: number; v: number }[];
  peakIndex: number;
  bgLum: number;
}

interface RoutingArc {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  delay: number;
}

interface ForensicRoute {
  u: number;
  v: number;
  t0: number;
  arcs: RoutingArc[];
  bgLum: number;
}

interface ChiaroscuroWave {
  u: number;
  v: number;
  t0: number;
  bgLum: number;
}

/* ============================================================================
   Helpers for Cover Crop, Color Grading & Procedural Portrait Fallback
   ============================================================================ */

interface CropWindow {
  uStart: number;
  winW: number;
  vStart: number;
  winH: number;
  /** Canvas U bounds where the portrait sits (0..1 normally; narrower when extending wings). */
  canvasU0: number;
  canvasU1: number;
  canvasFocalU: number;
  canvasFocalV: number;
}

function computeCoverCrop(
  canvasAspect: number,
  imgWidth: number,
  imgHeight: number,
  focal: { u: number; v: number },
  isPortrait: boolean,
): CropWindow {
  const imgAspect = imgWidth / Math.max(1, imgHeight);

  if (canvasAspect > imgAspect) {
    const rawWinH = clamp(imgAspect / canvasAspect, 0.2, 1);

    // For close-up portraits placed in wide frames (16/10, 16/9), avoid slicing off
    // foreheads or chins: keep at least 76% of vertical frame and seamlessly paint
    // atmospheric studio oil brushwork into the left/right canvas wings.
    const minPortraitWinH = 0.76;
    if (isPortrait && rawWinH < minPortraitWinH) {
      const winH = minPortraitWinH;
      const vStart = clamp(focal.v - 0.48 * winH, 0, 1 - winH);
      const spanU = clamp(rawWinH / winH, 0.46, 1);
      const canvasU0 = (1 - spanU) * 0.5;
      const canvasU1 = 1 - canvasU0;
      return {
        uStart: 0,
        winW: 1,
        vStart,
        winH,
        canvasU0,
        canvasU1,
        canvasFocalU: clamp(canvasU0 + focal.u * spanU, 0.16, 0.84),
        canvasFocalV: clamp((focal.v - vStart) / winH, 0.16, 0.84),
      };
    }

    const targetV = isPortrait ? 0.42 : 0.5;
    const vStart = clamp(focal.v - targetV * rawWinH, 0, 1 - rawWinH);
    return {
      uStart: 0,
      winW: 1,
      vStart,
      winH: rawWinH,
      canvasU0: 0,
      canvasU1: 1,
      canvasFocalU: clamp(focal.u, 0.12, 0.88),
      canvasFocalV: clamp((focal.v - vStart) / rawWinH, 0.14, 0.86),
    };
  }

  // Canvas is taller than image: crop horizontally centered around focal.u
  const winW = clamp(canvasAspect / imgAspect, 0.2, 1);
  const uStart = clamp(focal.u - 0.5 * winW, 0, 1 - winW);
  return {
    uStart,
    winW,
    vStart: 0,
    winH: 1,
    canvasU0: 0,
    canvasU1: 1,
    canvasFocalU: clamp((focal.u - uStart) / winW, 0.14, 0.86),
    canvasFocalV: clamp(focal.v, 0.14, 0.86),
  };
}

/** Smooth S-curve contrast lift for expressive oil chiaroscuro. */
function oilContrast(l01: number, strength: number): number {
  const centered = l01 - 0.5;
  const curved = 0.5 + centered * (1 + strength) - Math.pow(centered, 3) * strength * 1.4;
  return clamp(curved, 0, 1);
}

/** Smooth angular interpolation so Sobel tangents blend cleanly with flow angles. */
function blendAngle(flow: number, contour: number, weight: number): number {
  // Brushstrokes are bidirectional (angle ≡ angle + π), so align to shortest half-turn
  let diff = ((contour - flow) % Math.PI + Math.PI * 1.5) % Math.PI - Math.PI / 2;
  if (Number.isNaN(diff)) diff = 0;
  return flow + diff * weight;
}

function easeOutCubic(p: number): number {
  const c = clamp(p, 0, 1);
  return 1 - Math.pow(1 - c, 3);
}

/** Pigment-accurate sRGB color mixing so blue + 24k gold yields warm antique bronze, never neon green. */
function mixHslViaRgb(a: HSL, b: HSL, t: number): HSL {
  const f = clamp(t, 0, 1);
  const [ar, ag, ab] = hslToRgb(a);
  const [br, bg, bb] = hslToRgb(b);
  return rgbToHsl(lerp(ar, br, f), lerp(ag, bg, f), lerp(ab, bb, f));
}

/** Measure editorial tracked text cleanly across Unicode symbols (₹, €, ≈, ·). */
function measureTrackedText(
  g: CanvasRenderingContext2D,
  text: string,
  trackingPx: number,
): number {
  if (!text) return 0;
  if (trackingPx <= 0) return g.measureText(text).width;
  const chars = Array.from(text);
  let total = 0;
  for (let i = 0; i < chars.length; i++) {
    total += g.measureText(chars[i]).width;
    if (i < chars.length - 1) total += trackingPx;
  }
  return total;
}

/** Render left-aligned tracked editorial typography with crisp letter spacing. */
function fillTrackedText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  trackingPx: number,
): void {
  if (!text) return;
  if (trackingPx <= 0) {
    g.fillText(text, x, y);
    return;
  }
  const chars = Array.from(text);
  let cursor = x;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    g.fillText(ch, cursor, y);
    cursor += g.measureText(ch).width + trackingPx;
  }
}

/** Brief flat-bristle lampblack oil sweep for the first 0.24s of a redaction mark. */
function drawWetLampblackSweep(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  alpha: number,
): void {
  g.save();
  g.lineCap = 'butt';
  g.lineWidth = width;
  g.strokeStyle = hslCss(FC_OIL.pressBlack[0], FC_OIL.pressBlack[1], FC_OIL.pressBlack[2], alpha * 0.9);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();

  g.lineWidth = Math.max(1, width * 0.22);
  g.strokeStyle = hslCss(FC_OIL.pressBlack[0], FC_OIL.pressBlack[1], FC_OIL.pressBlack[2] + 9, alpha * 0.35);
  g.beginPath();
  g.moveTo(x0, y0 - width * 0.18);
  g.lineTo(x1, y1 - width * 0.18);
  g.stroke();
  g.restore();
}

/* ============================================================================
   Reference-Portrait Scene Factory
   ============================================================================ */

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
  const moodKey: PaletteMood = config.paletteMood ?? (config.monochrome ? 'monochrome-noir' : 'verdict-crimson');
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
  let crop: CropWindow = {
    uStart: 0,
    winW: 1,
    vStart: 0,
    winH: 1,
    canvasU0: 0,
    canvasU1: 1,
    canvasFocalU: focal.u,
    canvasFocalV: focal.v,
  };
  let status: 'idle' | 'loading' | 'ready' | 'failed' = config.refImage ? 'idle' : 'failed';
  let pixelRevision = 0;

  // Pointer focus & idle eye drift
  let pointerTarget: { u: number; v: number } | null = null;
  const focus = { u: focal.u, v: focal.v };
  let lastClock = 0;
  let reducedMotion = false;

  const accentPigment: HSL = monochrome ? FC_OIL.verdictCrimson : mood.accent;

  // Shared lower-left archival exhibit plate (strictly 1 active plate at a time)
  let activePlate: ArchivalPlate | null = null;

  // Wet-oil & editorial-engraving interaction states
  const stamps: RegistrationStamp[] = [];
  const goldPatches: GoldLeafPatch[] = [];
  const foilFlecks: GoldFoilFleck[] = [];
  const redactions: RedactionBar[] = [];
  let activeCrash: EngravingPlunge | null = null;
  let activeRoute: ForensicRoute | null = null;
  const waves: ChiaroscuroWave[] = [];
  const scratchHotspots: { u: number; v: number; t0: number }[] = [];

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
      color = monochrome
        ? [34, 14, lerp(16, 52, shade)]
        : [22, 34, lerp(22, 48, shade)];
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

  /** Apply redaction oil bars onto the sampled color field (scratched clean on hover!). */
  function sampleRedactionOverlay(u: number, v: number): Sample | null {
    for (let i = redactions.length - 1; i >= 0; i--) {
      const bar = redactions[i];
      const du = u - (bar.u0 + bar.u1) * 0.5;
      const dv = v - bar.v - du * bar.tilt;
      if (u < bar.u0 || u > bar.u1) continue;

      const raggedEdge = (fbm(u * 26 + bar.seed, v * 32) - 0.5) * 0.016;
      const halfH = bar.halfH + raggedEdge;
      if (Math.abs(dv) > halfH) continue;

      const segT = clamp((u - bar.u0) / Math.max(0.001, bar.u1 - bar.u0), 0, 0.9999);
      const segIdx = Math.floor(segT * bar.cells.length);
      const coverage = bar.cells[segIdx];
      if (coverage < 0.14) continue;

      // Ragged oil-bristle ends at the far left/right of the stroke
      const endFade = Math.min((u - bar.u0) / 0.025, (bar.u1 - u) / 0.025, 1);
      if (endFade < 0.35 && fbm(u * 40, v * 48 + bar.seed) > endFade * 2.2) continue;

      const rim = Math.abs(dv) > halfH * 0.78;
      if (rim && fbm(u * 35 + bar.seed, v * 20) > 0.62) {
        // Subtle editorial crimson censor bleed along bristle edge
        return {
          color: [FC_OIL.verdictCrimson[0], FC_OIL.verdictCrimson[1], FC_OIL.verdictCrimson[2] - 6],
          angle: bar.tilt + (fbm(u * 14, v * 14) - 0.5) * 0.18,
          jitter: 0.45,
          monochrome: false,
        };
      }

      return {
        color: [
          FC_OIL.pressBlack[0],
          FC_OIL.pressBlack[1],
          lerp(22, 9, coverage) + (fbm(u * 30, v * 30) - 0.5) * 4,
        ],
        angle: bar.tilt + (fbm(u * 16, v * 16) - 0.5) * 0.14,
        jitter: 0.42,
        monochrome: true,
      };
    }
    return null;
  }

  /** Apply live wet-oil surface transformations directly into the portrait's impasto dabs. */
  function applySurfacePigmentEffects(u: number, v: number, t: number, base: Sample): Sample {
    // Hot path: with no live effects every base sample (always carrying jitter & monochrome) passes through
    if (waves.length === 0 && goldPatches.length === 0 && stamps.length === 0) return base;
    let color = base.color;
    let isMono = Boolean(base.monochrome);
    let jitter = base.jitter ?? 0.72;

    // 1. Optical Chiaroscuro Wave (gavel-ripple): expanding annular charcoal band in real oil strokes
    if (waves.length > 0) {
      for (let i = waves.length - 1; i >= 0; i--) {
        const wv = waves[i];
        const age = t - wv.t0;
        if (age < 0 || age > 2.6) continue;
        const d = Math.hypot((u - wv.u) * aspect, v - wv.v);

        if (reducedMotion) {
          if (d < 0.145) {
            const fade = age < 1.6 ? 1 : clamp(1 - (age - 1.6) / 1.0, 0, 1);
            const mask = clamp((0.145 - d) / 0.05, 0, 1) * fade;
            if (mask > 0.02) {
              const cl = clamp(oilContrast(color[2] / 100, 0.42) * 100, 8, 94);
              color = mixHslShortest(color, [32, 8, cl], mask * 0.88);
              if (mask > 0.4) isMono = true;
            }
          }
          continue;
        }

        const p = clamp(age / 2.2, 0, 1);
        const waveRadius = lerp(0.03, 0.68, 1 - Math.pow(1 - p, 2.1));
        const bandWidth = lerp(0.085, 0.125, p);
        const distFromBand = Math.abs(d - waveRadius);
        if (distFromBand < bandWidth) {
          const bell = Math.cos((distFromBand / bandWidth) * (Math.PI * 0.5));
          const fade = age < 1.85 ? 1 : clamp(1 - (age - 1.85) / 0.75, 0, 1);
          const intensity = bell * bell * fade;
          if (intensity > 0.02) {
            if (!isMono) {
              const cl = clamp(oilContrast(color[2] / 100, 0.44) * 100, 7, 94);
              color = mixHslShortest(color, [32, 8, cl], intensity * 0.94);
              if (intensity > 0.35) isMono = true;
            } else {
              // On monochrome Opinion portraits, shift crest into stark high-contrast charcoal chiaroscuro
              const cl = clamp(oilContrast(color[2] / 100, 0.58) * 100, 6, 95);
              color = [30, 10, lerp(color[2], cl, intensity * 0.85)];
            }
            jitter *= lerp(1, 0.8, intensity);
          }
        }
      }
    }

    // 2. 24k Gold-Leaf Impasto Gilding (coins): Klimt-style organic fbm gold leaf along Sobel contours
    if (goldPatches.length > 0) {
      for (let i = goldPatches.length - 1; i >= 0; i--) {
        const patch = goldPatches[i];
        const age = t - patch.t0;
        if (age < 0 || age > 6.5) continue;
        const d = Math.hypot((u - patch.u) * aspect, v - patch.v);
        if (d > 0.24) continue;

        const edgeNoise = fbm(u * 13 + patch.seed, v * 13 + patch.seed * 0.6);
        const organicR = 0.165 + (edgeNoise - 0.5) * 0.088;
        if (d < organicR) {
          const bloom = reducedMotion ? 1 : clamp(age / 0.22, 0, 1);
          const decay = age < 4.0 ? 1 : clamp(1 - (age - 4.0) / 2.5, 0, 1);
          const edgeMask = clamp((organicR - d) / 0.045, 0, 1);
          const gildWeight = bloom * decay * edgeMask * 0.92;
          if (gildWeight > 0.02) {
            const lum01 = clamp(color[2] / 100, 0, 1);
            const sheen = (fbm(u * 32 - patch.seed, v * 32 + 4.1) - 0.5) * 12;
            const ochreShadow: HSL = [34, 62, 24];
            const bullionMid: HSL = [40, 72, 48];
            const leafHighlight: HSL = [45, 76, 68];
            const baseGold =
              lum01 < 0.5
                ? mixHslShortest(ochreShadow, bullionMid, lum01 * 2)
                : mixHslShortest(bullionMid, leafHighlight, (lum01 - 0.5) * 2);
            const sculptedGold: HSL = [
              baseGold[0],
              baseGold[1],
              clamp(baseGold[2] + sheen, 20, 76),
            ];
            color = mixHslViaRgb(color, sculptedGold, gildWeight);
            isMono = false;
            jitter *= lerp(1, 0.72, gildWeight);
          }
        }
      }
    }

    // 3. Local Oil Wax-Seal Glaze (stamp): compact tactile pigment wash painted into impasto brushwork
    if (stamps.length > 0) {
      for (let i = stamps.length - 1; i >= 0; i--) {
        const st = stamps[i];
        const age = t - st.t0;
        if (age < 0 || age > 5.6) continue;
        const d = Math.hypot((u - st.u) * aspect, v - st.v);
        if (d > 0.105) continue;

        const edge = 0.075 + (fbm(u * 24 + st.seed, v * 24) - 0.5) * 0.02;
        if (d < edge) {
          const washFade = age < 3.6 ? 1 : clamp(1 - (age - 3.6) / 2.0, 0, 1);
          const soft = clamp((edge - d) / 0.032, 0, 1);
          const glaze = soft * washFade * 0.44;
          if (glaze > 0.02) {
            const mixed = mixHslViaRgb(color, st.accent, glaze);
            // Respect underlying portrait luminance so the glaze reads as translucent oil pigment
            const preservedL = lerp(mixed[2], color[2], 0.28);
            color = [mixed[0], mixed[1], clamp(preservedL, 12, 84)];
            isMono = false;
            jitter *= lerp(1, 0.78, glaze);
          }
        }
      }
    }

    return { color, angle: base.angle, jitter, monochrome: isMono };
  }

  function sample(u: number, v: number, t: number): Sample | null {
    // 1. Check painted redaction oil bars on the ground layer first
    if (redactions.length > 0) {
      const redacted = sampleRedactionOverlay(u, v);
      if (redacted) return redacted;
    }

    // 2. Graceful procedural impressionist portrait fallback if image failed or absent
    if (!pixels) {
      if (status === 'failed') {
        return applySurfacePigmentEffects(u, v, t, sampleFallbackPortrait(u, v, t));
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
    const baseJitter = clamp(lerp(0.88, 0.44, Math.max(edgeStrength * 0.75, focalBoost * 0.6)), 0.38, 0.96);
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

    return applySurfacePigmentEffects(u, v, t, { color: graded, angle, jitter, monochrome });
  }

  /**
   * Measure local background luminance (0..1) via a 5-point cross sampled from the
   * cropped reference PixelField, accounting for crop window, wingFade, oil chiaroscuro,
   * and vignette darkening so surface overlays select the highest-contrast ink & blend mode.
   */
  function sampleLocalLuminance(u: number, v: number, radius = 0.045): number {
    if (!pixels) return 0.5;
    const hasWings = crop.canvasU0 > 0.005 || crop.canvasU1 < 0.995;
    const spanU = Math.max(0.001, crop.canvasU1 - crop.canvasU0);
    const shadowL = mood.shadow[2] / 100;

    const offsets: readonly [number, number][] = [
      [0, 0],
      [-radius, 0],
      [radius, 0],
      [0, -radius],
      [0, radius],
    ];

    let sum = 0;
    for (let i = 0; i < offsets.length; i++) {
      const su = clamp(u + offsets[i][0], 0, 1);
      const sv = clamp(v + offsets[i][1], 0, 1);
      const rawIu = hasWings ? (su - crop.canvasU0) / spanU : crop.uStart + su * crop.winW;

      let wingFade = 0;
      if (hasWings) {
        if (rawIu < 0.08) {
          wingFade = clamp((0.08 - rawIu) / 0.24, 0, 1);
        } else if (rawIu > 0.92) {
          wingFade = clamp((rawIu - 0.92) / 0.24, 0, 1);
        }
      }

      const iu = clamp(rawIu, 0, 0.9999);
      const iv = clamp(crop.vStart + sv * crop.winH, 0, 0.9999);
      const px = Math.min(pixels.width - 1, Math.floor(iu * pixels.width));
      const py = Math.min(pixels.height - 1, Math.floor(iv * pixels.height));
      const p4 = (py * pixels.width + px) * 4;

      const r = pixels.data[p4];
      const gr = pixels.data[p4 + 1];
      const b = pixels.data[p4 + 2];
      const rawLum = (0.299 * r + 0.587 * gr + 0.114 * b) / 255;

      const distFromFocal = Math.hypot((su - crop.canvasFocalU) * 1.12, (sv - crop.canvasFocalV) * 1.05);
      const vignette = clamp((distFromFocal - 0.34) * 1.25, 0, 1) * mood.vignetteStrength;

      if (monochrome) {
        const shaped = oilContrast(rawLum, 0.36);
        sum += clamp((lerp(8, 93, shaped) - vignette * 18 - wingFade * 16) / 100, 0, 1);
      } else {
        const shaped = oilContrast(rawLum, 0.22);
        const baseL = clamp(shaped * 0.94 + 0.035, 0.09, 0.94);
        const totalGlaze = clamp(vignette + wingFade * 0.44, 0, 0.65);
        sum += clamp(lerp(baseL, shadowL, totalGlaze), 0, 1);
      }
    }

    return sum / offsets.length;
  }

  /* ============================================================================
     Wet-Oil & Archival Exhibit Interaction Triggers
     ============================================================================ */

  function triggerPlate(t: number, title: string, subtitle: string): void {
    activePlate = {
      t0: t,
      title: title.trim().toUpperCase(),
      subtitle: subtitle.trim().toUpperCase(),
      accent: accentPigment,
    };
  }

  function triggerStamp(u: number, v: number, t: number): void {
    const safeU = clamp(u, 0.12, 0.88);
    const safeV = clamp(v, 0.12, 0.84);
    const bgLum = sampleLocalLuminance(safeU, safeV, 0.06);
    stamps.push({
      u: safeU,
      v: safeV,
      t0: t,
      seed: rand() * 80,
      accent: accentPigment,
      bgLum,
    });
    if (stamps.length > 2) stamps.shift();
    triggerPlate(t, toyText, toySubtext);
  }

  function triggerCoins(u: number, v: number, t: number): void {
    const safeU = clamp(u, 0.08, 0.92);
    const safeV = clamp(v, 0.08, 0.92);
    const bgLum = sampleLocalLuminance(safeU, safeV, 0.06);
    goldPatches.push({
      u: safeU,
      v: safeV,
      t0: t,
      seed: rand() * 90,
      bgLum,
    });
    if (goldPatches.length > 2) goldPatches.shift();

    if (!reducedMotion) {
      const count = 5 + Math.floor(rand() * 3); // 5-7 delicate gold-leaf foil flecks
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * TAU + (rand() - 0.5) * 0.7;
        const speed = 0.028 + rand() * 0.042;
        foilFlecks.push({
          u: safeU + (rand() - 0.5) * 0.03,
          v: safeV + (rand() - 0.5) * 0.03,
          vu: (Math.cos(angle) * speed) / Math.max(0.75, aspect),
          vv: Math.sin(angle) * speed - 0.018,
          w: 4.2 + rand() * 2.8,
          h: 2.2 + rand() * 1.8,
          rot: rand() * TAU,
          vrot: (rand() - 0.5) * 1.4,
          phase: rand() * TAU,
          t0: t,
          life: 1.9 + rand() * 0.9,
          pale: rand() < 0.38,
          bgLum,
        });
      }
      if (foilFlecks.length > 14) {
        foilFlecks.splice(0, foilFlecks.length - 14);
      }
    }

    triggerPlate(t, toyText, toySubtext);
  }

  function triggerRedaction(u: number, v: number, t: number): void {
    const span = 0.46 + rand() * 0.18;
    const centerU = clamp(u, 0.28, 0.72);
    const u0 = clamp(centerU - span * 0.5, 0.06, 0.46);
    const u1 = clamp(u0 + span, 0.52, 0.94);
    const cells = new Float32Array(24);
    cells.fill(1);
    redactions.push({
      u0,
      u1,
      v: clamp(v, 0.14, 0.76),
      halfH: 0.034 + rand() * 0.011,
      tilt: (rand() - 0.5) * 0.045,
      t0: t,
      seed: rand() * 90,
      cells,
    });
    if (redactions.length > 3) redactions.shift();
    triggerPlate(t, toyText, 'HOVER BAR TO REVEAL');
  }

  function triggerCrashLine(_u: number, v: number, t: number): void {
    // Anchor smoothly in the lower portion of the canvas, staying cleanly below faces on portraits
    const peakV = isPortrait
      ? clamp(0.61 + (v - 0.5) * 0.08, 0.58, 0.65)
      : clamp(0.49 + (v - 0.5) * 0.12, 0.47, 0.56);
    const floorV = 0.87;
    const j = () => (rand() - 0.5) * 0.014;

    const points: { u: number; v: number }[] = [
      { u: 0.08, v: clamp(peakV + 0.042 + j(), peakV + 0.01, 0.72) },
      { u: 0.19, v: clamp(peakV + 0.018 + j(), peakV, 0.7) },
      { u: 0.30, v: peakV }, // Peak (index 2)
      { u: 0.39, v: clamp(peakV + 0.034 + j(), peakV + 0.012, 0.73) },
      { u: 0.50, v: clamp(lerp(peakV, floorV, 0.42) + j(), peakV + 0.04, 0.8) },
      { u: 0.59, v: clamp(lerp(peakV, floorV, 0.30) + j(), peakV + 0.02, 0.77) }, // Brief dead-cat bounce
      { u: 0.71, v: clamp(lerp(peakV, floorV, 0.74) + j(), peakV + 0.1, 0.85) },
      { u: 0.82, v: clamp(lerp(peakV, floorV, 0.91) + j(), peakV + 0.14, 0.88) },
      { u: 0.92, v: floorV }, // Floor
    ];

    let lumSum = 0;
    for (const pt of points) {
      lumSum += sampleLocalLuminance(pt.u, pt.v, 0.045);
    }
    const bgLum = lumSum / points.length;

    activeCrash = { t0: t, points, peakIndex: 2, bgLum };
    triggerPlate(t, toyText, toySubtext);
  }

  function triggerEnvelopes(u: number, v: number, t: number): void {
    const ox = clamp(u, 0.14, 0.86);
    const oy = clamp(v, 0.14, 0.70);

    // Candidate archival pinpoint zones distributed across the canvas (avoiding lower-left exhibit plate)
    const zones: { u0: number; u1: number; v0: number; v1: number }[] = [
      { u0: 0.14, u1: 0.34, v0: 0.14, v1: 0.34 }, // Upper-left
      { u0: 0.68, u1: 0.88, v0: 0.14, v1: 0.36 }, // Upper-right
      { u0: 0.68, u1: 0.88, v0: 0.52, v1: 0.78 }, // Lower-right
      { u0: 0.44, u1: 0.64, v0: 0.14, v1: 0.30 }, // Upper-center
      { u0: 0.14, u1: 0.30, v0: 0.42, v1: 0.58 }, // Mid-left
      { u0: 0.52, u1: 0.68, v0: 0.60, v1: 0.80 }, // Lower-mid-right
    ];

    // Pick 3 zones farthest from the click point so the routing arcs always fan out gracefully
    const scored = zones
      .map((z) => {
        const zu = lerp(z.u0, z.u1, 0.25 + rand() * 0.5);
        const zv = lerp(z.v0, z.v1, 0.25 + rand() * 0.5);
        const dist = Math.hypot((zu - ox) * aspect, zv - oy);
        return { zu, zv, dist };
      })
      .sort((a, b) => b.dist - a.dist)
      .slice(0, 3);

    const arcs: RoutingArc[] = scored.map((target, idx) => {
      const mx = (ox + target.zu) * 0.5;
      const my = (oy + target.zv) * 0.5;
      const dx = target.zu - ox;
      const dy = target.zv - oy;
      const len = Math.max(0.001, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;
      const bow = (idx % 2 === 0 ? -1 : 1) * (0.08 + rand() * 0.055);
      return {
        x0: ox,
        y0: oy,
        cx: clamp(mx + nx * bow, 0.06, 0.94),
        cy: clamp(my + ny * bow, 0.06, 0.88),
        x1: target.zu,
        y1: target.zv,
        delay: idx * 0.1,
      };
    });

    let lumSum = sampleLocalLuminance(ox, oy, 0.045);
    let lumCount = 1;
    for (const arc of arcs) {
      lumSum += sampleLocalLuminance(arc.cx, arc.cy, 0.045);
      lumSum += sampleLocalLuminance(arc.x1, arc.y1, 0.045);
      lumCount += 2;
    }
    const bgLum = lumSum / lumCount;

    activeRoute = { u: ox, v: oy, t0: t, arcs, bgLum };
    triggerPlate(t, toyText, toySubtext);
  }

  function triggerGavelRipple(u: number, v: number, t: number): void {
    const safeU = clamp(u, 0.08, 0.92);
    const safeV = clamp(v, 0.08, 0.88);
    const bgLum = sampleLocalLuminance(safeU, safeV, 0.12);
    waves.push({
      u: safeU,
      v: safeV,
      t0: t,
      bgLum,
    });
    if (waves.length > 2) waves.shift();
    triggerPlate(t, toyText, toySubtext);
  }

  function scratchRedactionsAt(u: number, v: number, t: number): boolean {
    if (redactions.length === 0) return false;
    let scratched = false;
    for (let i = redactions.length - 1; i >= 0; i--) {
      const bar = redactions[i];
      if (u < bar.u0 - 0.04 || u > bar.u1 + 0.04) continue;
      const du = u - (bar.u0 + bar.u1) * 0.5;
      const dv = v - bar.v - du * bar.tilt;
      if (Math.abs(dv) > bar.halfH + 0.055) continue;

      const len = bar.cells.length;
      for (let c = 0; c < len; c++) {
        const cellU = lerp(bar.u0, bar.u1, (c + 0.5) / len);
        const dist = Math.abs(cellU - u);
        if (dist < 0.075) {
          const erase = (1 - dist / 0.075) * 0.42;
          if (bar.cells[c] > 0) {
            bar.cells[c] = Math.max(0, bar.cells[c] - erase);
            scratched = true;
          }
        }
      }

      // Drop completely revealed bars
      let maxRemaining = 0;
      for (let c = 0; c < len; c++) {
        if (bar.cells[c] > maxRemaining) maxRemaining = bar.cells[c];
      }
      if (maxRemaining < 0.12) {
        redactions.splice(i, 1);
      }
    }

    if (scratched) {
      scratchHotspots.push({ u, v, t0: t });
      if (scratchHotspots.length > 6) scratchHotspots.shift();
    }
    return scratched;
  }

  /* ============================================================================
     Rule 1: Shared Lower-Left Archival Exhibit Plate (Museum / Broadsheet Print)
     ============================================================================ */

  function drawArchivalPlate(g: CanvasRenderingContext2D, cw: number, ch: number, t: number): void {
    if (!activePlate) return;
    const age = t - activePlate.t0;
    const fadeInDur = 0.22;
    const holdDur = 5.2;
    const fadeOutDur = 1.1;
    const totalDur = fadeInDur + holdDur + fadeOutDur;

    if (age < 0 || age >= totalDur) {
      activePlate = null;
      return;
    }

    let alpha = 1;
    let glideY = 0;
    if (age < fadeInDur) {
      const ease = reducedMotion ? 1 : easeOutCubic(age / fadeInDur);
      alpha = reducedMotion ? 1 : ease;
      glideY = reducedMotion ? 0 : (1 - ease) * 6;
    } else if (age > fadeInDur + holdDur) {
      const outP = clamp((age - fadeInDur - holdDur) / fadeOutDur, 0, 1);
      alpha = 1 - outP * outP;
    }

    if (alpha <= 0.01) return;

    const unit = Math.min(cw, ch);
    const margin = Math.round(clamp(unit * 0.04, 12, 22));
    const accentBarW = 3;
    // Leave clean room on the right for the quiet hover Repaint button
    const maxPlateW = Math.max(140, Math.min(cw - margin * 2 - 40, cw * 0.82));

    let mainSize = clamp(unit * 0.038, 12, 20);
    let subSize = clamp(unit * 0.023, 9, 12);
    const padLeft = Math.round(clamp(unit * 0.032, 11, 15));
    const padRight = Math.round(clamp(unit * 0.038, 13, 18));
    const padY = Math.round(clamp(unit * 0.022, 8, 11));

    const measureFonts = () => {
      const mainTrack = mainSize * 0.042;
      const subTrack = subSize * 0.065;
      g.font = `600 ${mainSize.toFixed(1)}px "Newsreader", Georgia, "Times New Roman", serif`;
      const mainW = measureTrackedText(g, activePlate!.title, mainTrack);
      let subW = 0;
      if (activePlate!.subtitle) {
        g.font = `500 ${subSize.toFixed(1)}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        subW = measureTrackedText(g, activePlate!.subtitle, subTrack);
      }
      return { mainW, subW, mainTrack, subTrack };
    };

    let metrics = measureFonts();
    const rawW = accentBarW + padLeft + Math.max(metrics.mainW, metrics.subW) + padRight;
    if (rawW > maxPlateW) {
      const fit = Math.max(0.72, (maxPlateW - accentBarW - padLeft - padRight) / Math.max(1, Math.max(metrics.mainW, metrics.subW)));
      mainSize = Math.max(10.5, mainSize * fit);
      subSize = Math.max(8, subSize * fit);
      metrics = measureFonts();
    }

    const plateW = Math.round(
      Math.min(maxPlateW, accentBarW + padLeft + Math.max(metrics.mainW, metrics.subW) + padRight),
    );
    const lineGap = activePlate.subtitle ? Math.round(clamp(mainSize * 0.34, 4, 6)) : 0;
    const plateH = Math.round(padY * 2 + mainSize + (activePlate.subtitle ? lineGap + subSize : 0));

    const plateX = margin;
    const plateY = Math.round(ch - margin - plateH + glideY);

    g.save();
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = alpha;

    // Warm cotton-rag paper surface (sharp flat 0px corners, zero drop shadow)
    g.fillStyle = 'rgba(250, 247, 240, 0.94)';
    g.fillRect(plateX, plateY, plateW, plateH);

    // 3px vertical left accent bar in the story's pigment
    const [ah, as, al] = activePlate.accent;
    g.fillStyle = hslCss(ah, as, al, 1);
    g.fillRect(plateX, plateY, accentBarW, plateH);

    // Crisp 1px outer hairline border
    g.strokeStyle = 'rgba(18, 18, 18, 0.88)';
    g.lineWidth = 1;
    g.strokeRect(plateX + 0.5, plateY + 0.5, plateW - 1, plateH - 1);

    // Subtle museum / press-proof corner registration tick at top-right
    const tickX = plateX + plateW - 6.5;
    const tickY = plateY + 6.5;
    g.strokeStyle = 'rgba(18, 18, 18, 0.34)';
    g.lineWidth = 0.75;
    g.beginPath();
    g.moveTo(tickX - 2.5, tickY);
    g.lineTo(tickX + 2.5, tickY);
    g.moveTo(tickX, tickY - 2.5);
    g.lineTo(tickX, tickY + 2.5);
    g.stroke();

    // Refined editorial serif headline (zero drop shadow)
    const textX = plateX + accentBarW + padLeft;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.font = `600 ${mainSize.toFixed(1)}px "Newsreader", Georgia, "Times New Roman", serif`;
    g.fillStyle = '#121212';
    fillTrackedText(g, activePlate.title, textX, plateY + padY, metrics.mainTrack);

    // Archival monospace sub-line
    if (activePlate.subtitle) {
      g.font = `500 ${subSize.toFixed(1)}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
      g.fillStyle = '#4a4843';
      fillTrackedText(
        g,
        activePlate.subtitle,
        textX,
        plateY + padY + mainSize + lineGap,
        metrics.subTrack,
      );
    }

    g.restore();
  }

  /* ============================================================================
     Rule 2: 6 Dignified Surface Interactions (Zero Cartoon Clipart)
     ============================================================================ */

  /** 1. gavel-ripple: Razor-thin architectural hairline rings + tiny 3px ink origin dot. */
  function renderChiaroscuroWaves(g: CanvasRenderingContext2D, cw: number, ch: number, t: number): void {
    const unit = Math.min(cw, ch);
    const echoColor: HSL = monochrome ? FC_OIL.verdictCrimson : mood.accent;

    for (let i = waves.length - 1; i >= 0; i--) {
      const wv = waves[i];
      const age = t - wv.t0;
      const maxAge = reducedMotion ? 5.6 : 2.1;
      if (age < 0 || age > maxAge) {
        if (age > 5.6) waves.splice(i, 1);
        continue;
      }

      const cx = wv.u * cw;
      const cy = wv.v * ch;
      const isDark = wv.bgLum < 0.45;

      g.save();
      g.setLineDash([]);

      if (reducedMotion) {
        const fade = age < 4.5 ? 1 : clamp(1 - (age - 4.5) / 1.1, 0, 1);
        const rad = clamp(unit * 0.11, 28, 52);
        g.globalCompositeOperation = isDark ? 'screen' : 'multiply';
        g.strokeStyle = isDark
          ? hslCss(40, 44, 90, fade * 0.78)
          : `rgba(18, 18, 18, ${(fade * 0.62).toFixed(3)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx, cy, rad, 0, TAU);
        g.stroke();

        g.globalCompositeOperation = 'source-over';
        g.fillStyle = isDark
          ? hslCss(40, 48, 92, fade * 0.92)
          : `rgba(18, 18, 18, ${(fade * 0.85).toFixed(3)})`;
        g.beginPath();
        g.arc(cx, cy, 1.8, 0, TAU);
        g.fill();
        g.restore();
        continue;
      }

      // Adaptive blend mode for the two hairline rings (screen cream+gilt on dark, multiply ink+accent on light)
      g.globalCompositeOperation = isDark ? 'screen' : 'multiply';

      // Ring 1: Primary smooth continuous 1px architectural hairline
      if (age <= 1.7) {
        const p1 = clamp(age / 1.7, 0, 1);
        const r1 = lerp(5, unit * 0.44, easeOutCubic(p1));
        const a1 = (1 - p1) * (isDark ? 0.86 : 0.74);
        g.strokeStyle = isDark
          ? hslCss(40, 44, 90, a1)
          : `rgba(18, 18, 18, ${a1.toFixed(3)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx, cy, r1, 0, TAU);
        g.stroke();
      }

      // Ring 2: Delayed smooth continuous 1px gilt/accent echo hairline
      const age2 = age - 0.14;
      if (age2 > 0 && age2 <= 1.8) {
        const p2 = clamp(age2 / 1.8, 0, 1);
        const r2 = lerp(5, unit * 0.38, easeOutCubic(p2));
        const a2 = (1 - p2) * (isDark ? 0.68 : 0.56);
        g.strokeStyle = isDark
          ? hslCss(43, 82, 74, a2)
          : hslCss(echoColor[0], echoColor[1], Math.min(echoColor[2], 36), a2);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx, cy, r2, 0, TAU);
        g.stroke();
      }

      // Tiny 3px origin dot in clean source-over with opposite polarity rim
      if (age <= 1.75) {
        const dotFade = age < 1.1 ? 1 : clamp(1 - (age - 1.1) / 0.65, 0, 1);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = isDark
          ? hslCss(40, 50, 92, dotFade * 0.92)
          : `rgba(18, 18, 18, ${(dotFade * 0.86).toFixed(3)})`;
        g.strokeStyle = isDark
          ? `rgba(12, 12, 14, ${(dotFade * 0.72).toFixed(3)})`
          : `rgba(250, 247, 240, ${(dotFade * 0.68).toFixed(3)})`;
        g.lineWidth = 0.75;
        g.beginPath();
        g.arc(cx, cy, 1.8, 0, TAU);
        g.fill();
        g.stroke();
      }

      g.restore();
    }
  }

  /** 2. stamp: Compact circular letterpress registration seal (FC / 2026) with adaptive local-luminance contrast. */
  function renderStampSeals(g: CanvasRenderingContext2D, cw: number, ch: number, t: number): void {
    const unit = Math.min(cw, ch);

    for (let i = stamps.length - 1; i >= 0; i--) {
      const st = stamps[i];
      const age = t - st.t0;
      if (age > 6.5) {
        stamps.splice(i, 1);
        continue;
      }

      const fade = age < 5.2 ? 1 : clamp(1 - (age - 5.2) / 1.3, 0, 1);
      const settle = reducedMotion
        ? 1
        : age < 0.16
          ? lerp(1.04, 1, easeOutCubic(age / 0.16))
          : 1;

      const cx = st.u * cw;
      const cy = st.v * ch;
      const r = clamp(unit * 0.068, 22, 36);
      const isDark = st.bgLum < 0.48;

      const tickIn = r * 0.72;
      const tickOut = r * 1.12;
      const monoSize = Math.max(8.5, Math.round(r * 0.36));
      const yearSize = Math.max(6.5, Math.round(r * 0.22));

      g.save();
      g.translate(cx, cy);
      g.scale(settle, settle);

      if (isDark) {
        // Dark grounds (< 0.48): deep-charcoal translucent ground wash + luminous embossed gilt/ivory foil seal
        const ivory: HSL = [40, 52, 92];
        const gilt: HSL = [43, 82, 74];

        g.globalCompositeOperation = 'source-over';
        g.fillStyle = `rgba(12, 12, 14, ${(fade * 0.36).toFixed(3)})`;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fill();

        // Crisp screen-blended glow pass & double concentric gilt/ivory hairline rings
        g.globalCompositeOperation = 'screen';

        // Subtle embossed gilt foil halo on outer ring
        g.strokeStyle = hslCss(gilt[0], gilt[1], gilt[2], fade * 0.24);
        g.lineWidth = 2.6;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.stroke();

        // Outer concentric gilt hairline ring
        g.strokeStyle = hslCss(gilt[0], gilt[1], gilt[2], fade * 0.92);
        g.lineWidth = 1.3;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.stroke();

        // Inner concentric archival ivory hairline ring
        g.strokeStyle = hslCss(ivory[0], ivory[1], ivory[2], fade * 0.8);
        g.lineWidth = 0.8;
        g.beginPath();
        g.arc(0, 0, r * 0.78, 0, TAU);
        g.stroke();

        // Cardinal registration crosshairs in burnished gilt
        g.strokeStyle = hslCss(gilt[0], gilt[1], gilt[2], fade * 0.86);
        g.lineWidth = 0.85;
        g.beginPath();
        g.moveTo(0, -tickOut);
        g.lineTo(0, -tickIn);
        g.moveTo(0, tickIn);
        g.lineTo(0, tickOut);
        g.moveTo(-tickOut, 0);
        g.lineTo(-tickIn, 0);
        g.moveTo(tickIn, 0);
        g.lineTo(tickOut, 0);
        g.stroke();

        // Razor-sharp ivory typography in source-over (>= 7:1 contrast against dark ground + charcoal wash)
        g.globalCompositeOperation = 'source-over';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = hslCss(ivory[0], ivory[1], ivory[2], fade * 0.96);
        g.font = `600 ${monoSize}px "Newsreader", Georgia, serif`;
        g.fillText('FC', 0, -r * 0.18);

        g.strokeStyle = hslCss(gilt[0], gilt[1], gilt[2], fade * 0.78);
        g.lineWidth = 0.75;
        g.beginPath();
        g.moveTo(-r * 0.3, r * 0.04);
        g.lineTo(r * 0.3, r * 0.04);
        g.stroke();

        g.fillStyle = hslCss(ivory[0], ivory[1], ivory[2], fade * 0.92);
        g.font = `500 ${yearSize}px "JetBrains Mono", ui-monospace, monospace`;
        g.fillText('2026', 0, r * 0.26);
      } else {
        // Light/mid grounds (>= 0.48): warm cotton-rag tint + multiply-blended deep letterpress ink
        const deepInkL = Math.min(st.accent[2] * 0.62, 26);
        const deepInkS = Math.min(st.accent[1], 72);
        const inkAlpha = fade * 0.9;

        g.globalCompositeOperation = 'source-over';
        g.fillStyle = `rgba(250, 247, 240, ${(fade * 0.72).toFixed(3)})`;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fill();

        // Letterpress double concentric hairline rings & crosshairs blended via multiply into the rag tint
        g.globalCompositeOperation = 'multiply';
        g.strokeStyle = hslCss(st.accent[0], deepInkS, deepInkL, inkAlpha);
        g.lineWidth = 1.25;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.stroke();

        g.strokeStyle = hslCss(st.accent[0], deepInkS, deepInkL, inkAlpha * 0.8);
        g.lineWidth = 0.75;
        g.beginPath();
        g.arc(0, 0, r * 0.78, 0, TAU);
        g.stroke();

        g.lineWidth = 0.8;
        g.strokeStyle = hslCss(st.accent[0], deepInkS, deepInkL, inkAlpha * 0.78);
        g.beginPath();
        g.moveTo(0, -tickOut);
        g.lineTo(0, -tickIn);
        g.moveTo(0, tickIn);
        g.lineTo(0, tickOut);
        g.moveTo(-tickOut, 0);
        g.lineTo(-tickIn, 0);
        g.moveTo(tickIn, 0);
        g.lineTo(tickOut, 0);
        g.stroke();

        // Crisp letterpress monogram ("FC" / hairline / "2026") in source-over
        g.globalCompositeOperation = 'source-over';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = hslCss(st.accent[0], deepInkS, Math.min(deepInkL, 22), fade * 0.94);
        g.font = `600 ${monoSize}px "Newsreader", Georgia, serif`;
        g.fillText('FC', 0, -r * 0.18);

        g.strokeStyle = hslCss(FC_OIL.pressBlack[0], FC_OIL.pressBlack[1], FC_OIL.pressBlack[2], fade * 0.52);
        g.lineWidth = 0.65;
        g.beginPath();
        g.moveTo(-r * 0.3, r * 0.04);
        g.lineTo(r * 0.3, r * 0.04);
        g.stroke();

        g.fillStyle = hslCss(FC_OIL.pressBlack[0], FC_OIL.pressBlack[1], FC_OIL.pressBlack[2], fade * 0.9);
        g.font = `500 ${yearSize}px "JetBrains Mono", ui-monospace, monospace`;
        g.fillText('2026', 0, r * 0.26);
      }

      g.restore();
    }
  }

  /** 3. coins: Whisper 1px gold hairline ring + 5-7 delicate flat rectangular gold-leaf foil flecks. */
  function renderGoldLeafLive(g: CanvasRenderingContext2D, cw: number, ch: number, t: number): void {
    const unit = Math.min(cw, ch);

    // Whisper-subtle expanding 1px gold/bronze hairline ring (0.6s)
    for (let i = goldPatches.length - 1; i >= 0; i--) {
      const patch = goldPatches[i];
      const age = t - patch.t0;
      if (age > 8.8) {
        goldPatches.splice(i, 1);
        continue;
      }
      if (age >= 0 && age <= 0.62) {
        const p = reducedMotion ? 0.5 : clamp(age / 0.62, 0, 1);
        const rad = lerp(6, unit * 0.18, easeOutCubic(p));
        const alpha = reducedMotion ? 0.52 : (1 - p) * 0.72;
        const isVeryLight = patch.bgLum > 0.72;
        const isDark = patch.bgLum < 0.45;

        g.save();
        if (isVeryLight) {
          g.globalCompositeOperation = 'multiply';
          g.strokeStyle = hslCss(35, 72, 38, alpha * 0.88);
        } else if (isDark) {
          g.globalCompositeOperation = 'screen';
          g.strokeStyle = hslCss(43, 84, 72, alpha * 0.9);
        } else {
          g.globalCompositeOperation = 'source-over';
          g.strokeStyle = hslCss(FC_OIL.bullionGold[0], 78, 54, alpha);
        }
        g.lineWidth = 1;
        g.beginPath();
        g.arc(patch.u * cw, patch.v * ch, rad, 0, TAU);
        g.stroke();
        g.restore();
      }
    }

    if (reducedMotion || foilFlecks.length === 0) return;

    // Delicate rectangular metallic gold-leaf foil flecks drifting gently (zero bouncing coins!)
    for (const f of foilFlecks) {
      const age = t - f.t0;
      if (age < 0 || age > f.life) continue;
      const inFade = clamp(age / 0.12, 0, 1);
      const outFade = age > f.life * 0.55 ? clamp(1 - (age - f.life * 0.55) / (f.life * 0.45), 0, 1) : 1;
      const alpha = inFade * outFade * 0.88;
      if (alpha <= 0.02) continue;

      const isVeryLight = f.bgLum > 0.72;
      const isDark = f.bgLum < 0.45;

      g.save();
      g.translate(f.u * cw, f.v * ch);
      g.rotate(f.rot);
      const shimmer = 0.5 + 0.5 * Math.cos(f.phase + age * 3.2);

      if (isVeryLight) {
        // Antique burnished bronze (~L 42%) with multiply rim edge so flecks stay legible on bright skies
        const l = f.pale ? lerp(42, 50, shimmer) : lerp(36, 44, shimmer);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = hslCss(36, 70, l, alpha);
        g.fillRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h);

        g.globalCompositeOperation = 'multiply';
        g.strokeStyle = hslCss(31, 66, 24, alpha * 0.75);
        g.lineWidth = 0.75;
        g.strokeRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h);
      } else if (isDark) {
        // Bright 24k bullion gold with subtle screen specular glint over dark dials/jackets
        const l = f.pale ? lerp(70, 84, shimmer) : lerp(56, 70, shimmer);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = hslCss(43, 84, l, alpha);
        g.fillRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h);

        g.globalCompositeOperation = 'screen';
        g.strokeStyle = hslCss(44, 72, 86, alpha * 0.52);
        g.lineWidth = 0.55;
        g.strokeRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h);
      } else {
        const l = f.pale ? lerp(64, 78, shimmer) : lerp(46, 62, shimmer);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = hslCss(43, 80, l, alpha);
        g.fillRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h);

        g.strokeStyle = hslCss(38, 66, 32, alpha * 0.52);
        g.lineWidth = 0.55;
        g.strokeRect(-f.w * 0.5, -f.h * 0.5, f.w, f.h);
      }

      g.restore();
    }
  }

  /** 4. redaction: Pure wet-lampblack initial brush sweep (zero floating text on the bar). */
  function renderRedactionLive(g: CanvasRenderingContext2D, cw: number, ch: number, t: number): void {
    if (reducedMotion) return;
    for (const bar of redactions) {
      const age = t - bar.t0;
      if (age >= 0 && age < 0.24) {
        const p = easeOutCubic(clamp(age / 0.22, 0, 1));
        const x0 = bar.u0 * cw;
        const x1 = lerp(bar.u0, bar.u1, p) * cw;
        const y0 = (bar.v - ((bar.u1 - bar.u0) * 0.5) * bar.tilt) * ch;
        const y1 = (bar.v + (lerp(bar.u0, bar.u1, p) - (bar.u0 + bar.u1) * 0.5) * bar.tilt) * ch;
        drawWetLampblackSweep(g, x0, y0, x1, y1, Math.max(7, bar.halfH * 2 * ch), 0.92);
      }
    }
  }

  /** 5. crash-line: Fine-nib NYT editorial engraving plunge curve across the lower canvas. */
  function renderEngravingPlunge(g: CanvasRenderingContext2D, cw: number, ch: number, t: number): void {
    if (!activeCrash) return;
    const age = t - activeCrash.t0;
    const totalDur = 6.52;
    if (age < 0 || age >= totalDur) {
      activeCrash = null;
      return;
    }

    const fade = age < 5.42 ? 1 : clamp(1 - (age - 5.42) / 1.1, 0, 1);
    const progress = reducedMotion ? 1 : easeOutCubic(clamp(age / 0.65, 0, 1));
    const pts = activeCrash.points;
    const peakPt = pts[activeCrash.peakIndex];
    const floorPt = pts[pts.length - 1];
    const peakY = Math.round(peakPt.v * ch) + 0.5;
    const startX = pts[0].u * cw;
    const endX = floorPt.u * cw;
    const isDark = activeCrash.bgLum < 0.45;

    g.save();

    // Subtle 0.75px dashed horizontal peak-baseline hairline adapted to local luminance
    g.setLineDash([4, 4]);
    g.lineWidth = 0.75;
    if (isDark) {
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(12, 12, 14, ${(fade * 0.42).toFixed(3)})`;
      g.beginPath();
      g.moveTo(startX, peakY + 0.75);
      g.lineTo(endX, peakY + 0.75);
      g.stroke();

      g.globalCompositeOperation = 'screen';
      g.strokeStyle = `rgba(250, 247, 240, ${(fade * 0.74).toFixed(3)})`;
      g.beginPath();
      g.moveTo(startX, peakY);
      g.lineTo(endX, peakY);
      g.stroke();
    } else {
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(250, 247, 240, ${(fade * 0.62).toFixed(3)})`;
      g.beginPath();
      g.moveTo(startX, peakY + 0.75);
      g.lineTo(endX, peakY + 0.75);
      g.stroke();

      g.globalCompositeOperation = 'multiply';
      g.strokeStyle = `rgba(18, 18, 18, ${(fade * 0.52).toFixed(3)})`;
      g.beginPath();
      g.moveTo(startX, peakY);
      g.lineTo(endX, peakY);
      g.stroke();
    }

    // Faint vertical drop tick at floor once curve lands
    if (progress >= 0.99) {
      const fx = Math.round(floorPt.u * cw) + 0.5;
      g.strokeStyle = isDark
        ? `rgba(250, 247, 240, ${(fade * 0.52).toFixed(3)})`
        : `rgba(18, 18, 18, ${(fade * 0.38).toFixed(3)})`;
      g.beginPath();
      g.moveTo(fx, peakY);
      g.lineTo(fx, floorPt.v * ch);
      g.stroke();
    }

    g.setLineDash([]);

    // Build progressive fine-nib polyline path
    const totalSegs = pts.length - 1;
    const drawnFloat = progress * totalSegs;
    const fullSegs = Math.floor(drawnFloat);
    const segFrac = drawnFloat - fullSegs;

    const tracePath = () => {
      g.beginPath();
      g.moveTo(pts[0].u * cw, pts[0].v * ch);
      for (let s = 1; s <= fullSegs; s++) {
        g.lineTo(pts[s].u * cw, pts[s].v * ch);
      }
      if (fullSegs < totalSegs && segFrac > 0) {
        const a = pts[fullSegs];
        const b = pts[fullSegs + 1];
        g.lineTo(lerp(a.u, b.u, segFrac) * cw, lerp(a.v, b.v, segFrac) * ch);
      }
    };

    g.lineCap = 'round';
    g.lineJoin = 'round';

    if (isDark) {
      // Dark ground: thin archival parchment micro-understroke + main crimson + screen-blended coral lift (L=62%)
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(250, 247, 240, ${(fade * 0.35).toFixed(3)})`;
      g.lineWidth = 2.5;
      tracePath();
      g.stroke();

      g.strokeStyle = hslCss(FC_OIL.verdictCrimson[0], 72, 46, fade * 0.96);
      g.lineWidth = 1.5;
      tracePath();
      g.stroke();

      g.globalCompositeOperation = 'screen';
      g.strokeStyle = hslCss(356, 76, 62, fade * 0.74);
      g.lineWidth = 1.3;
      tracePath();
      g.stroke();
    } else {
      // Light ground: whisper parchment contrast edge + multiply-blended Verdict Crimson engraving nib
      g.globalCompositeOperation = 'source-over';
      g.strokeStyle = `rgba(250, 247, 240, ${(fade * 0.38).toFixed(3)})`;
      g.lineWidth = 2.5;
      tracePath();
      g.stroke();

      g.globalCompositeOperation = 'multiply';
      g.strokeStyle = hslCss(FC_OIL.verdictCrimson[0], 72, 40, fade * 0.96);
      g.lineWidth = 1.5;
      tracePath();
      g.stroke();
    }

    // Tiny 3.5px solid crimson circles at peak & floor in clean source-over
    g.globalCompositeOperation = 'source-over';
    const drawPin = (px: number, py: number) => {
      g.fillStyle = isDark
        ? hslCss(356, 76, 58, fade * 0.98)
        : hslCss(FC_OIL.verdictCrimson[0], 72, 40, fade * 0.96);
      g.strokeStyle = `rgba(250, 247, 240, ${(fade * 0.92).toFixed(3)})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(px, py, 3.5, 0, TAU);
      g.fill();
      g.stroke();
    };

    if (drawnFloat >= activeCrash.peakIndex) {
      drawPin(peakPt.u * cw, peakPt.v * ch);
    }
    if (progress >= 0.99) {
      drawPin(floorPt.u * cw, floorPt.v * ch);
    }

    g.restore();
  }

  /** 6. envelopes: 3 delicate curved architectural ink routing arcs & ringed archival pinpoint nodes. */
  function renderForensicRoute(g: CanvasRenderingContext2D, cw: number, ch: number, t: number): void {
    if (!activeRoute) return;
    const age = t - activeRoute.t0;
    const totalDur = 6.52;
    if (age < 0 || age >= totalDur) {
      activeRoute = null;
      return;
    }

    const fade = age < 5.42 ? 1 : clamp(1 - (age - 5.42) / 1.1, 0, 1);
    const ox = activeRoute.u * cw;
    const oy = activeRoute.v * ch;
    const isDark = activeRoute.bgLum < 0.45;

    g.save();

    // 3 curved architectural ink routing arcs (De Casteljau quadratic Bezier subdivision)
    for (const arc of activeRoute.arcs) {
      const localAge = age - arc.delay;
      if (localAge <= 0 && !reducedMotion) continue;
      const p = reducedMotion ? 1 : easeOutCubic(clamp(localAge / 0.56, 0, 1));
      if (p <= 0.01) continue;

      const x0 = arc.x0 * cw;
      const y0 = arc.y0 * ch;
      const cx = arc.cx * cw;
      const cy = arc.cy * ch;
      const x1 = arc.x1 * cw;
      const y1 = arc.y1 * ch;

      // Exact quadratic Bezier sub-curve for parameter [0, p]
      const q0x = lerp(x0, cx, p);
      const q0y = lerp(y0, cy, p);
      const q1x = lerp(cx, x1, p);
      const q1y = lerp(cy, y1, p);
      const bx = lerp(q0x, q1x, p);
      const by = lerp(q0y, q1y, p);

      const strokeArc = () => {
        g.beginPath();
        g.moveTo(x0, y0);
        g.quadraticCurveTo(q0x, q0y, bx, by);
        g.stroke();
      };

      if (isDark) {
        // Dark grounds: subtle charcoal anchor + crisp screen-blended archival ivory (L=88%) + rose-crimson dashes
        g.setLineDash([]);
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = `rgba(12, 12, 14, ${(fade * 0.34).toFixed(3)})`;
        g.lineWidth = 2.2;
        strokeArc();

        g.globalCompositeOperation = 'screen';
        g.strokeStyle = hslCss(40, 44, 88, fade * 0.86);
        g.lineWidth = 1.05;
        strokeArc();

        g.globalCompositeOperation = 'source-over';
        g.setLineDash([5, 5]);
        g.strokeStyle = hslCss(352, 76, 64, fade * 0.94);
        g.lineWidth = 1.05;
        strokeArc();
        g.setLineDash([]);
      } else {
        // Light grounds: whisper parchment edge + multiply press-black + deep Verdict Crimson dashed overlay
        g.setLineDash([]);
        g.globalCompositeOperation = 'source-over';
        g.strokeStyle = `rgba(250, 247, 240, ${(fade * 0.36).toFixed(3)})`;
        g.lineWidth = 2.2;
        strokeArc();

        g.globalCompositeOperation = 'multiply';
        g.strokeStyle = `rgba(18, 18, 18, ${(fade * 0.76).toFixed(3)})`;
        g.lineWidth = 1;
        strokeArc();

        g.globalCompositeOperation = 'source-over';
        g.setLineDash([5, 5]);
        g.strokeStyle = hslCss(FC_OIL.verdictCrimson[0], 72, 40, fade * 0.9);
        g.lineWidth = 1;
        strokeArc();
        g.setLineDash([]);
      }

      // Ringed archival pinpoint node on arrival (clean source-over)
      if (p >= 0.98) {
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = `rgba(250, 247, 240, ${(fade * 0.96).toFixed(3)})`;
        g.strokeStyle = isDark
          ? hslCss(43, 82, 70, fade * 0.96)
          : hslCss(FC_OIL.verdictCrimson[0], 72, 40, fade * 0.94);
        g.lineWidth = 1.25;
        g.beginPath();
        g.arc(x1, y1, 3.5, 0, TAU);
        g.fill();
        g.stroke();

        // Tiny press-black center pinhole
        g.fillStyle = `rgba(18, 18, 18, ${(fade * 0.88).toFixed(3)})`;
        g.beginPath();
        g.arc(x1, y1, 1, 0, TAU);
        g.fill();

        // Delicate cardinal registration ticks
        g.strokeStyle = isDark
          ? hslCss(40, 44, 88, fade * 0.72)
          : `rgba(18, 18, 18, ${(fade * 0.48).toFixed(3)})`;
        g.lineWidth = 0.75;
        g.beginPath();
        g.moveTo(x1 - 6.5, y1);
        g.lineTo(x1 - 4.5, y1);
        g.moveTo(x1 + 4.5, y1);
        g.lineTo(x1 + 6.5, y1);
        g.moveTo(x1, y1 - 6.5);
        g.lineTo(x1, y1 - 4.5);
        g.moveTo(x1, y1 + 4.5);
        g.lineTo(x1, y1 + 6.5);
        g.stroke();
      }
    }

    // Crisp origin pinpoint + registration halo in clean source-over
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = isDark
      ? hslCss(43, 82, 72, fade * 0.72)
      : `rgba(18, 18, 18, ${(fade * 0.45).toFixed(3)})`;
    g.lineWidth = 0.75;
    g.beginPath();
    g.arc(ox, oy, 7, 0, TAU);
    g.stroke();

    g.fillStyle = isDark
      ? hslCss(40, 50, 92, fade * 0.94)
      : `rgba(18, 18, 18, ${(fade * 0.9).toFixed(3)})`;
    g.strokeStyle = isDark
      ? `rgba(12, 12, 14, ${(fade * 0.82).toFixed(3)})`
      : `rgba(250, 247, 240, ${(fade * 0.88).toFixed(3)})`;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(ox, oy, 2.5, 0, TAU);
    g.fill();
    g.stroke();

    g.restore();
  }

  return {
    ready: () => status === 'ready' || status === 'failed',
    revision: () => pixelRevision,
    resize(width: number, height: number) {
      if (width <= 0 || height <= 0) return;
      aspect = width / height;
      applyCrop();
    },
    busy: () =>
      Boolean(activePlate || activeCrash || activeRoute) ||
      stamps.length > 0 ||
      goldPatches.length > 0 ||
      foilFlecks.length > 0 ||
      redactions.length > 0 ||
      waves.length > 0,
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

      // Concentrate fine brushwork on active chiaroscuro wave crests + trailing color restoration
      for (const wv of waves) {
        const age = t - wv.t0;
        if (age >= 0 && age < 2.4 && !reducedMotion) {
          const p = clamp(age / 2.2, 0, 1);
          const waveRadius = lerp(0.03, 0.68, 1 - Math.pow(1 - p, 2.1));
          const bandWidth = lerp(0.085, 0.125, p);
          const count = 6;
          for (let k = 0; k < count; k++) {
            const a = (k / count) * TAU + age * 0.65;
            spots.push({
              u: clamp(wv.u + Math.cos(a) * (waveRadius / aspect), 0.02, 0.98),
              v: clamp(wv.v + Math.sin(a) * waveRadius, 0.02, 0.98),
              r: bandWidth / aspect,
              detail: 0.64,
            });
          }
          // Trailing restoration inside the wave so rich oil color repaints right behind it
          const trailR = Math.max(0.02, waveRadius - bandWidth * 1.15);
          spots.push({
            u: wv.u,
            v: wv.v,
            r: Math.min(0.28, trailR / aspect),
            detail: 0.68,
          });
        } else if (age >= 0 && age < 5.2) {
          // Gentle post-wave restoration pass
          spots.push({ u: wv.u, v: wv.v, r: 0.28, detail: 0.68 });
        }
      }

      // Concentrate brushwork on 24k gold-leaf gilding bloom & natural repaint restoration
      for (const patch of goldPatches) {
        const age = t - patch.t0;
        if (age >= 0 && age < 2.2) {
          spots.push({ u: patch.u, v: patch.v, r: 0.19 / aspect, detail: 0.52 });
        } else if (age >= 4.0 && age < 8.6) {
          spots.push({ u: patch.u, v: patch.v, r: 0.21 / aspect, detail: 0.58 });
        }
      }

      // Concentrate brushwork on local stamp wax-seal glaze & smooth healing
      for (const st of stamps) {
        const age = t - st.t0;
        if (age >= 0 && age < 1.8) {
          spots.push({ u: st.u, v: st.v, r: 0.1 / aspect, detail: 0.52 });
        } else if (age >= 3.6 && age < 7.2) {
          spots.push({ u: st.u, v: st.v, r: 0.11 / aspect, detail: 0.56 });
        }
      }

      // Focus extra brushwork over fresh redaction bars or recently rubbed-clean areas
      for (const bar of redactions) {
        if (t - bar.t0 < 1.8) {
          spots.push({ u: (bar.u0 + bar.u1) * 0.5, v: bar.v, r: 0.22, detail: 0.72 });
        }
      }
      for (let i = scratchHotspots.length - 1; i >= 0; i--) {
        const sc = scratchHotspots[i];
        if (t - sc.t0 > 1.8) {
          scratchHotspots.splice(i, 1);
        } else {
          spots.push({ u: sc.u, v: sc.v, r: 0.11, detail: 0.42 });
        }
      }

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

      // Advance delicate drifting gold-leaf foil flecks (buoyant gentle air drift, zero bounce)
      for (let i = foilFlecks.length - 1; i >= 0; i--) {
        const f = foilFlecks[i];
        const age = t - f.t0;
        if (age > f.life || f.v > 1.08) {
          foilFlecks.splice(i, 1);
          continue;
        }
        const drag = Math.exp(-dt * 1.15);
        f.vu *= drag;
        f.vv = f.vv * drag + 0.032 * dt;
        f.u += (f.vu + Math.sin(age * 2.1 + f.phase) * 0.008) * dt;
        f.v += f.vv * dt;
        f.rot += f.vrot * dt;
      }

      // Prune completed chiaroscuro waves after their repaint tail finishes
      for (let i = waves.length - 1; i >= 0; i--) {
        if (t - waves[i].t0 > 5.8) waves.splice(i, 1);
      }
    },
    live(g, width, height, t, dpr) {
      if (
        !activePlate &&
        stamps.length === 0 &&
        goldPatches.length === 0 &&
        foilFlecks.length === 0 &&
        redactions.length === 0 &&
        !activeCrash &&
        !activeRoute &&
        waves.length === 0
      ) {
        return false;
      }

      // Normalize to logical CSS pixels so 1px hairlines & typography are razor-sharp at 1x and 2x DPR
      const cw = width / dpr;
      const ch = height / dpr;

      g.save();
      g.scale(dpr, dpr);

      if (waves.length > 0) renderChiaroscuroWaves(g, cw, ch, t);
      if (stamps.length > 0) renderStampSeals(g, cw, ch, t);
      if (goldPatches.length > 0 || foilFlecks.length > 0) renderGoldLeafLive(g, cw, ch, t);
      if (redactions.length > 0) renderRedactionLive(g, cw, ch, t);
      if (activeCrash) renderEngravingPlunge(g, cw, ch, t);
      if (activeRoute) renderForensicRoute(g, cw, ch, t);

      // Shared bottom-left Archival Exhibit Plate always renders crisply last
      if (activePlate) drawArchivalPlate(g, cw, ch, t);

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

      if (kind === 'move' && interactive && toyKind === 'redaction') {
        return scratchRedactionsAt(u, v, at);
      }

      if (kind === 'down' && interactive) {
        switch (toyKind) {
          case 'stamp':
            triggerStamp(u, v, at);
            break;
          case 'coins':
            triggerCoins(u, v, at);
            break;
          case 'redaction':
            triggerRedaction(u, v, at);
            break;
          case 'crash-line':
            triggerCrashLine(u, v, at);
            break;
          case 'envelopes':
            triggerEnvelopes(u, v, at);
            break;
          case 'gavel-ripple':
            triggerGavelRipple(u, v, at);
            break;
        }
        return true;
      }
      return false;
    },
    reset() {
      activePlate = null;
      stamps.length = 0;
      goldPatches.length = 0;
      foilFlecks.length = 0;
      redactions.length = 0;
      activeCrash = null;
      activeRoute = null;
      waves.length = 0;
      scratchHotspots.length = 0;
      pointerTarget = null;
      if (status === 'failed' && config.refImage) {
        status = 'idle';
        startLoad();
      }
    },
  };
}
