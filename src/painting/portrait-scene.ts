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
import { clamp, hslCss, lerp, mixHslShortest, rgbToHsl } from './color';
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

    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Timed out loading reference image ${url}`));
    }, LOAD_TIMEOUT_MS);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);

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
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
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
   Interactive Painterly Toy State Types
   ============================================================================ */

interface StampMark {
  u: number;
  v: number;
  t0: number;
  tilt: number;
  text: string;
  subtext: string;
  splatters: { angle: number; dist: number; size: number; len: number }[];
}

interface CoinParticle {
  u: number;
  v: number;
  vu: number;
  vv: number;
  r: number;
  spin: number;
  phase: number;
  t0: number;
  life: number;
  tone: HSL;
}

interface ShimmerArc {
  u: number;
  v: number;
  r: number;
  t0: number;
  angle0: number;
}

interface RedactionBar {
  u0: number;
  u1: number;
  v: number;
  halfH: number;
  tilt: number;
  t0: number;
  seed: number;
  /** Per-segment ink coverage (1 = solid black redaction, 0 = scratched clean back to portrait). */
  cells: Float32Array;
}

interface CrashStroke {
  t0: number;
  points: { u: number; v: number }[];
  sparks: { seg: number; du: number; dv: number; size: number; tone: HSL }[];
  label: string;
}

interface EnvelopeParticle {
  u: number;
  v: number;
  vu: number;
  vv: number;
  w: number;
  h: number;
  rot: number;
  vrot: number;
  swayFreq: number;
  swayAmp: number;
  phase: number;
  t0: number;
  life: number;
  hasText: boolean;
}

interface GavelRipple {
  u: number;
  v: number;
  t0: number;
  seed: number;
  label: string;
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

/** Draw a rough painterly line with subtle bristle offset for the live canvas layer. */
function drawImpastoLine(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  color: HSL,
  alpha: number,
): void {
  g.lineCap = 'round';
  g.lineWidth = width;
  g.strokeStyle = hslCss(color[0], color[1], color[2] - 16, alpha * 0.45);
  g.beginPath();
  g.moveTo(x0 + width * 0.22, y0 + width * 0.3);
  g.lineTo(x1 + width * 0.22, y1 + width * 0.3);
  g.stroke();

  g.strokeStyle = hslCss(color[0], color[1], color[2], alpha);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();

  g.lineWidth = Math.max(1, width * 0.34);
  g.strokeStyle = hslCss(color[0], color[1] * 0.6, Math.min(96, color[2] + 16), alpha * 0.55);
  g.beginPath();
  g.moveTo(x0 - width * 0.14, y0 - width * 0.16);
  g.lineTo(x1 - width * 0.14, y1 - width * 0.16);
  g.stroke();
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
  const aspect = config.aspect && config.aspect > 0 ? config.aspect : 16 / 10;
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

  const baseSeed = config.seed ?? hashString(config.slug || config.refImage || config.alt || 'fc-portrait');
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

  // Pointer focus & idle eye drift
  let pointerTarget: { u: number; v: number } | null = null;
  const focus = { u: focal.u, v: focal.v };
  let lastClock = 0;
  let reducedMotion = false;

  // Interactive toy states
  const stamps: StampMark[] = [];
  const coins: CoinParticle[] = [];
  const shimmerArcs: ShimmerArc[] = [];
  const redactions: RedactionBar[] = [];
  const crashes: CrashStroke[] = [];
  const envelopes: EnvelopeParticle[] = [];
  const ripples: GavelRipple[] = [];
  const scratchHotspots: { u: number; v: number; t0: number }[] = [];

  const startLoad = () => {
    if (status !== 'idle' || !config.refImage) return;
    status = 'loading';
    loadFn(config.refImage).then(
      (field) => {
        pixels = field;
        crop = computeCoverCrop(aspect, field.width, field.height, focal, isPortrait);
        focus.u = crop.canvasFocalU;
        focus.v = crop.canvasFocalV;
        status = 'ready';
      },
      () => {
        status = 'failed';
      },
    );
  };

  // Kick off image decode eagerly in browser environments
  if (typeof window !== 'undefined' && config.refImage) {
    startLoad();
  }

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

  function sample(u: number, v: number, t: number): Sample | null {
    // 1. Check painted redaction oil bars on the ground layer first
    if (redactions.length > 0) {
      const redacted = sampleRedactionOverlay(u, v);
      if (redacted) return redacted;
    }

    // 2. Graceful procedural impressionist portrait fallback if image failed or absent
    if (!pixels) {
      if (status === 'failed') {
        return sampleFallbackPortrait(u, v, t);
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
    const contourAngle = pixels.angles[idx];
    const flowAngle = (fbm(u * 2.4 + 7.3, v * 2.4 + 1.9) - 0.5) * 1.4;

    // Curve oil brushstrokes organically along cheekbones, hairlines, lapels & facades
    const contourWeight = edgeStrength > 0.12 ? clamp((edgeStrength - 0.12) * 1.15, 0, 0.94) : 0;
    const angle = contourWeight > 0 ? blendAngle(flowAngle, contourAngle, contourWeight) : undefined;

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

    // Subtle golden oil glint on ground strokes immediately after a coin burst
    if (toyKind === 'coins' && shimmerArcs.length > 0) {
      const latest = shimmerArcs[shimmerArcs.length - 1];
      const age = t - latest.t0;
      if (age >= 0 && age < 1.3) {
        const d = Math.hypot((u - latest.u) * aspect, v - latest.v);
        if (d < 0.14) {
          const glow = (1 - age / 1.3) * (1 - d / 0.14) * 0.42;
          graded = mixHslShortest(graded, FC_OIL.bullionGold, glow);
          return { color: graded, angle, jitter: jitter * 0.85, monochrome: false };
        }
      }
    }

    return { color: graded, angle, jitter, monochrome };
  }

  /* ============================================================================
     Interactive Toy Triggers (Click / Poke)
     ============================================================================ */

  function triggerStamp(u: number, v: number, t: number): void {
    const safeU = clamp(u, 0.24, 0.76);
    const safeV = clamp(v, 0.22, 0.78);
    const tilt = (stamps.length % 2 === 0 ? -1 : 1) * (0.09 + rand() * 0.08) - 0.05;
    const splatters: StampMark['splatters'] = [];
    for (let i = 0; i < 16; i++) {
      splatters.push({
        angle: (i / 16) * TAU + (rand() - 0.5) * 0.35,
        dist: 0.72 + rand() * 0.58,
        size: 1.8 + rand() * 3.8,
        len: 3 + rand() * 9,
      });
    }
    stamps.push({ u: safeU, v: safeV, t0: t, tilt, text: toyText, subtext: toySubtext, splatters });
    if (stamps.length > 3) stamps.shift();
  }

  function triggerCoins(u: number, v: number, t: number): void {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * 0.92 + rand() * Math.PI * 0.84;
      const speed = 0.28 + rand() * 0.52;
      const tone: HSL =
        rand() < 0.25
          ? [46, 86, 62]
          : rand() < 0.65
            ? FC_OIL.bullionGold
            : [36, 70, 44];
      coins.push({
        u,
        v,
        vu: (Math.cos(a) * speed) / Math.max(0.7, aspect),
        vv: Math.sin(a) * speed - 0.22,
        r: 0.015 + rand() * 0.014,
        spin: (rand() < 0.5 ? -1 : 1) * (5 + rand() * 7),
        phase: rand() * TAU,
        t0: t,
        life: 2.3 + rand() * 1.1,
        tone,
      });
    }
    if (coins.length > 72) coins.splice(0, coins.length - 72);
    shimmerArcs.push({ u, v, r: 0.04, t0: t, angle0: rand() * TAU });
    if (shimmerArcs.length > 5) shimmerArcs.shift();
  }

  function triggerRedaction(u: number, v: number, t: number): void {
    const span = 0.52 + rand() * 0.2;
    const centerU = clamp(u, 0.3, 0.7);
    const u0 = clamp(centerU - span * 0.5, 0.05, 0.45);
    const u1 = clamp(u0 + span, 0.55, 0.95);
    const cells = new Float32Array(24);
    cells.fill(1);
    redactions.push({
      u0,
      u1,
      v: clamp(v, 0.14, 0.86),
      halfH: 0.038 + rand() * 0.014,
      tilt: (rand() - 0.5) * 0.06,
      t0: t,
      seed: rand() * 90,
      cells,
    });
    if (redactions.length > 4) redactions.shift();
  }

  function triggerCrashLine(u: number, v: number, t: number): void {
    const startU = clamp(u * 0.35 + 0.06, 0.06, 0.22);
    const startV = clamp(v * 0.55 + 0.12, 0.14, 0.36);
    const endU = 0.92;
    const endV = 0.86;
    const steps = 11;
    const points: { u: number; v: number }[] = [{ u: startU, v: startV }];

    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      // Early hubris plateau, then steep cliff with a brief dead-cat bounce
      const curve = f < 0.24 ? Math.pow(f / 0.24, 1.5) * 0.06 - 0.03 : Math.pow((f - 0.2) / 0.8, 1.35);
      const bounce = i === 6 ? -0.09 : (rand() - 0.5) * 0.1;
      points.push({
        u: lerp(startU, endU, f) + (rand() - 0.5) * 0.025,
        v: clamp(lerp(startV, endV, curve) + bounce, 0.1, 0.9),
      });
    }
    points.push({ u: endU, v: endV });

    const sparks: CrashStroke['sparks'] = [];
    for (let i = 0; i < 18; i++) {
      sparks.push({
        seg: Math.floor(rand() * (points.length - 1)),
        du: (rand() - 0.5) * 0.06,
        dv: (rand() - 0.5) * 0.07,
        size: 1.5 + rand() * 3.2,
        tone: rand() < 0.35 ? FC_OIL.bullionGold : FC_OIL.verdictCrimson,
      });
    }

    crashes.push({ t0: t, points, sparks, label: toyText });
    if (crashes.length > 2) crashes.shift();
  }

  function triggerEnvelopes(u: number, v: number, t: number): void {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI * 0.95 + rand() * Math.PI * 0.9;
      const speed = 0.14 + rand() * 0.26;
      envelopes.push({
        u,
        v,
        vu: (Math.cos(a) * speed) / Math.max(0.75, aspect),
        vv: Math.sin(a) * speed - 0.12,
        w: 0.072 + rand() * 0.026,
        h: 0.048 + rand() * 0.016,
        rot: (rand() - 0.5) * 0.7,
        vrot: (rand() - 0.5) * 2.2,
        swayFreq: 2.6 + rand() * 2.4,
        swayAmp: 0.06 + rand() * 0.08,
        phase: rand() * TAU,
        t0: t,
        life: 3.4 + rand() * 1.4,
        hasText: i === 0,
      });
    }
    if (envelopes.length > 28) envelopes.splice(0, envelopes.length - 28);
  }

  function triggerGavelRipple(u: number, v: number, t: number): void {
    ripples.push({
      u: clamp(u, 0.08, 0.92),
      v: clamp(v, 0.1, 0.9),
      t0: t,
      seed: rand() * 100,
      label: toyText,
    });
    if (ripples.length > 4) ripples.shift();
  }

  function scratchRedactionsAt(u: number, v: number, t: number): void {
    if (redactions.length === 0) return;
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
  }

  /* ============================================================================
     Live Layer Rendering (6 Tactile Painterly Toys)
     ============================================================================ */

  function renderStamps(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const unit = Math.min(w, h);
    const ink: HSL = monochrome ? FC_OIL.verdictCrimson : mood.accent;

    for (let i = stamps.length - 1; i >= 0; i--) {
      const st = stamps[i];
      const age = t - st.t0;
      if (age > 11) {
        stamps.splice(i, 1);
        continue;
      }

      const fade = age < 7.5 ? 1 : clamp(1 - (age - 7.5) / 3.5, 0, 1);
      const slam = age < 0.16 ? lerp(1.24, 1, Math.sin((age / 0.16) * (Math.PI / 2))) : 1;

      const cx = st.u * w;
      const cy = st.v * h;

      const fontSize = Math.max(12, Math.round(unit * 0.068));
      const subSize = Math.max(9, Math.round(unit * 0.036));

      g.save();
      g.translate(cx, cy);
      g.rotate(st.tilt);
      g.scale(slam, slam);

      g.font = `800 ${fontSize}px "Libre Franklin", system-ui, sans-serif`;
      const mainMetrics = g.measureText(st.text);
      let subW = 0;
      if (st.subtext) {
        g.font = `700 ${subSize}px "JetBrains Mono", ui-monospace, monospace`;
        subW = g.measureText(st.subtext).width;
      }

      const maxBoxW = w * 0.72;
      const padX = unit * 0.045;
      const padY = unit * 0.026;
      const rawW = Math.max(mainMetrics.width, subW) + padX * 2;
      const scaleFit = rawW > maxBoxW ? maxBoxW / rawW : 1;
      const boxW = rawW * scaleFit;
      const boxH = (fontSize + (st.subtext ? subSize + padY * 0.65 : 0) + padY * 2) * scaleFit;

      // Soft parchment-ink backing wash so stamp reads crisply over busy oil brushwork
      g.fillStyle = hslCss(FC_OIL.newsprintCream[0], FC_OIL.newsprintCream[1], FC_OIL.newsprintCream[2], fade * 0.76);
      g.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

      // Rough double-bordered hand-stamped impasto frame
      const bw = Math.max(2, unit * 0.0085);
      const hw = boxW / 2;
      const hh = boxH / 2;
      drawImpastoLine(g, -hw, -hh, hw, -hh, bw, ink, fade * 0.92);
      drawImpastoLine(g, hw, -hh, hw, hh, bw, ink, fade * 0.92);
      drawImpastoLine(g, hw, hh, -hw, hh, bw, ink, fade * 0.92);
      drawImpastoLine(g, -hw, hh, -hw, -hh, bw, ink, fade * 0.92);

      // Inner hairline border
      const inset = Math.max(4, unit * 0.015);
      g.strokeStyle = hslCss(ink[0], ink[1], ink[2], fade * 0.65);
      g.lineWidth = Math.max(1, bw * 0.42);
      g.strokeRect(-hw + inset, -hh + inset, boxW - inset * 2, boxH - inset * 2);

      // Stamp text with slight ink offset shadow for tactile press depth
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const scaledFont = Math.max(10, fontSize * scaleFit);
      const scaledSub = Math.max(8, subSize * scaleFit);
      const mainY = st.subtext ? -scaledSub * 0.56 : 0;

      g.font = `800 ${scaledFont}px "Libre Franklin", system-ui, sans-serif`;
      g.fillStyle = hslCss(ink[0], ink[1], ink[2] - 14, fade * 0.45);
      g.fillText(st.text, 1.4, mainY + 1.4);
      g.fillStyle = hslCss(ink[0], ink[1], ink[2], fade * 0.94);
      g.fillText(st.text, 0, mainY);

      if (st.subtext) {
        const subY = scaledFont * 0.52;
        g.font = `700 ${scaledSub}px "JetBrains Mono", ui-monospace, monospace`;
        g.fillStyle = hslCss(FC_OIL.pressBlack[0], FC_OIL.pressBlack[1], FC_OIL.pressBlack[2], fade * 0.85);
        g.fillText(st.subtext, 0, subY);
      }

      // Ink-splatter oil flecks bursting outward from stamp impact
      const splatGrow = clamp(age / 0.14, 0, 1);
      for (const sp of st.splatters) {
        const rx = Math.cos(sp.angle) * (hw * 0.82 + sp.dist * unit * 0.08 * splatGrow);
        const ry = Math.sin(sp.angle) * (hh * 0.82 + sp.dist * unit * 0.08 * splatGrow);
        const ex = rx + Math.cos(sp.angle) * sp.len * (unit / 420);
        const ey = ry + Math.sin(sp.angle) * sp.len * (unit / 420);
        g.strokeStyle = hslCss(ink[0], ink[1], ink[2], fade * 0.72);
        g.lineWidth = Math.max(1.2, sp.size * (unit / 420));
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(rx, ry);
        g.lineTo(ex, ey);
        g.stroke();
      }

      g.restore();
    }
  }

  function renderCoins(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const unit = Math.min(w, h);

    // Expanding golden impasto shimmer arcs
    for (let i = shimmerArcs.length - 1; i >= 0; i--) {
      const arc = shimmerArcs[i];
      const age = t - arc.t0;
      if (age > 0.9) {
        shimmerArcs.splice(i, 1);
        continue;
      }
      const f = age / 0.9;
      const rad = (0.04 + f * 0.24) * unit;
      const alpha = (1 - f) * 0.7;
      g.lineCap = 'round';
      for (let s = 0; s < 10; s++) {
        const a = arc.angle0 + (s / 10) * TAU + f * 0.8;
        g.strokeStyle = hslCss(FC_OIL.bullionGold[0], 86, 60, alpha);
        g.lineWidth = Math.max(1.5, (1 - f) * unit * 0.011);
        g.beginPath();
        g.arc(arc.u * w, arc.v * h, rad, a, a + 0.26);
        g.stroke();
      }
    }

    // Tumbling golden bullion coins
    for (const c of coins) {
      const age = t - c.t0;
      const fade = age > c.life * 0.7 ? clamp(1 - (age - c.life * 0.7) / (c.life * 0.3), 0, 1) : 1;
      const x = c.u * w;
      const y = c.v * h;
      const rad = Math.max(3.5, c.r * unit);
      const squash = Math.max(0.24, Math.abs(Math.cos(c.phase + age * c.spin)));

      g.save();
      g.translate(x, y);
      g.rotate(c.vu * 1.4);

      // Impasto drop shadow
      g.fillStyle = hslCss(32, 42, 16, fade * 0.42);
      g.beginPath();
      g.ellipse(rad * 0.22, rad * 0.3, rad, rad * squash, 0, 0, TAU);
      g.fill();

      // Thick metallic gold body
      g.fillStyle = hslCss(c.tone[0], c.tone[1], c.tone[2], fade * 0.95);
      g.beginPath();
      g.ellipse(0, 0, rad, rad * squash, 0, 0, TAU);
      g.fill();

      // Burnished rim
      g.strokeStyle = hslCss(34, 65, 32, fade * 0.8);
      g.lineWidth = Math.max(1, rad * 0.2);
      g.stroke();

      // Specular impasto gold highlight arc
      g.strokeStyle = hslCss(48, 92, 86, fade * 0.82);
      g.lineWidth = Math.max(1, rad * 0.24);
      g.beginPath();
      g.ellipse(-rad * 0.14, -rad * 0.12 * squash, rad * 0.56, rad * 0.56 * squash, 0, Math.PI * 1.1, Math.PI * 1.75);
      g.stroke();

      g.restore();
    }
  }

  function renderRedactionLive(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const unit = Math.min(w, h);
    for (const bar of redactions) {
      const age = t - bar.t0;
      // Wet ink brush sweep animation during the first 0.26s
      if (age < 0.28) {
        const p = clamp(age / 0.26, 0, 1);
        const x0 = bar.u0 * w;
        const x1 = lerp(bar.u0, bar.u1, p) * w;
        const y0 = (bar.v - ((bar.u1 - bar.u0) * 0.5) * bar.tilt) * h;
        const y1 = (bar.v + (lerp(bar.u0, bar.u1, p) - (bar.u0 + bar.u1) * 0.5) * bar.tilt) * h;
        drawImpastoLine(g, x0, y0, x1, y1, Math.max(8, bar.halfH * 2 * h), FC_OIL.pressBlack, 0.92);
      }

      // Faint chalk-crimson [REDACTED] hint on intact center segments
      const midCell = bar.cells[Math.floor(bar.cells.length / 2)];
      if (midCell > 0.55) {
        const cx = ((bar.u0 + bar.u1) * 0.5) * w;
        const cy = bar.v * h;
        g.save();
        g.translate(cx, cy);
        g.rotate(bar.tilt);
        g.font = `700 ${Math.max(9, Math.round(unit * 0.032))}px "JetBrains Mono", ui-monospace, monospace`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = hslCss(FC_OIL.newsprintCream[0], 30, 88, midCell * 0.55);
        g.fillText(toyText.length <= 22 ? toyText : 'REDACTED · HOVER TO REVEAL', 0, 0);
        g.restore();
      }
    }
  }

  function renderCrashLines(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const unit = Math.min(w, h);
    const strokeW = Math.max(3, unit * 0.014);

    for (let i = crashes.length - 1; i >= 0; i--) {
      const cr = crashes[i];
      const age = t - cr.t0;
      if (age > 9) {
        crashes.splice(i, 1);
        continue;
      }

      const fade = age < 6.4 ? 1 : clamp(1 - (age - 6.4) / 2.6, 0, 1);
      const progress = clamp(age / 0.72, 0, 1);
      const totalSegs = cr.points.length - 1;
      const drawnFloat = progress * totalSegs;
      const fullSegs = Math.floor(drawnFloat);
      const segFrac = drawnFloat - fullSegs;

      let headX = cr.points[0].u * w;
      let headY = cr.points[0].v * h;

      for (let s = 0; s < fullSegs; s++) {
        const a = cr.points[s];
        const b = cr.points[s + 1];
        drawImpastoLine(g, a.u * w, a.v * h, b.u * w, b.v * h, strokeW, FC_OIL.verdictCrimson, fade * 0.94);
        headX = b.u * w;
        headY = b.v * h;
      }

      if (fullSegs < totalSegs && segFrac > 0) {
        const a = cr.points[fullSegs];
        const b = cr.points[fullSegs + 1];
        headX = lerp(a.u, b.u, segFrac) * w;
        headY = lerp(a.v, b.v, segFrac) * h;
        drawImpastoLine(g, a.u * w, a.v * h, headX, headY, strokeW, FC_OIL.verdictCrimson, fade * 0.96);
      }

      // Hot oil sparks flying off segments as they break downward
      for (const sp of cr.sparks) {
        if (sp.seg > fullSegs) continue;
        const p = cr.points[sp.seg + 1];
        const segAge = clamp(age - (sp.seg / totalSegs) * 0.72, 0, 1.2);
        const spAlpha = clamp(1 - segAge / 1.2, 0, 1) * fade;
        if (spAlpha <= 0.02) continue;
        const sx = (p.u + sp.du * (0.4 + segAge * 1.4)) * w;
        const sy = (p.v + sp.dv * (0.4 + segAge * 1.4) + segAge * segAge * 0.06) * h;
        g.fillStyle = hslCss(sp.tone[0], sp.tone[1], sp.tone[2] + 10, spAlpha * 0.9);
        g.beginPath();
        g.arc(sx, sy, Math.max(1.5, sp.size * (unit / 420)), 0, TAU);
        g.fill();
      }

      // Glowing brush tip during draw
      if (progress < 1) {
        g.fillStyle = hslCss(FC_OIL.bullionGold[0], 92, 68, 0.95);
        g.beginPath();
        g.arc(headX, headY, strokeW * 0.85, 0, TAU);
        g.fill();
      } else {
        // Landed painted callout at the bottom of the plunge
        const last = cr.points[cr.points.length - 1];
        const lx = clamp(last.u * w - unit * 0.14, unit * 0.22, w - unit * 0.18);
        const ly = clamp(last.v * h - unit * 0.06, unit * 0.14, h - unit * 0.08);
        const fontSize = Math.max(10, Math.round(unit * 0.044));
        g.font = `800 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
        const tw = g.measureText(cr.label).width + 14;
        const th = fontSize + 10;
        g.fillStyle = hslCss(FC_OIL.verdictCrimson[0], FC_OIL.verdictCrimson[1], FC_OIL.verdictCrimson[2], fade * 0.92);
        g.fillRect(lx - tw / 2, ly - th / 2, tw, th);
        g.fillStyle = hslCss(FC_OIL.newsprintCream[0], 32, 95, fade * 0.96);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(cr.label, lx, ly + 0.5);
      }
    }
  }

  function renderEnvelopes(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const unit = Math.min(w, h);
    for (const env of envelopes) {
      const age = t - env.t0;
      const fade = age > env.life * 0.72 ? clamp(1 - (age - env.life * 0.72) / (env.life * 0.28), 0, 1) : 1;
      const ew = Math.max(18, env.w * unit);
      const eh = Math.max(12, env.h * unit);

      g.save();
      g.translate(env.u * w, env.v * h);
      g.rotate(env.rot + Math.sin(age * env.swayFreq + env.phase) * 0.22);

      // Soft drop shadow
      g.fillStyle = hslCss(FC_OIL.pressBlack[0], 14, 10, fade * 0.28);
      g.fillRect(-ew / 2 + 2.5, -eh / 2 + 3, ew, eh);

      // Painted newsprint cream paper body
      g.fillStyle = hslCss(FC_OIL.newsprintCream[0], 36, 93, fade * 0.96);
      g.fillRect(-ew / 2, -eh / 2, ew, eh);

      // Hand-inked charcoal envelope border & triangular flap
      g.strokeStyle = hslCss(FC_OIL.pressBlack[0], 14, 18, fade * 0.85);
      g.lineWidth = Math.max(1.2, unit * 0.004);
      g.strokeRect(-ew / 2, -eh / 2, ew, eh);
      g.beginPath();
      g.moveTo(-ew / 2, -eh / 2);
      g.lineTo(0, eh * 0.14);
      g.lineTo(ew / 2, -eh / 2);
      g.stroke();

      // Verdict-crimson wax seal impasto dab
      const sealR = Math.max(2.6, eh * 0.17);
      g.fillStyle = hslCss(FC_OIL.verdictCrimson[0], 72, 42, fade * 0.94);
      g.beginPath();
      g.arc(0, eh * 0.12, sealR, 0, TAU);
      g.fill();
      g.fillStyle = hslCss(FC_OIL.scandalRose[0], 64, 68, fade * 0.7);
      g.beginPath();
      g.arc(-sealR * 0.25, eh * 0.12 - sealR * 0.25, sealR * 0.36, 0, TAU);
      g.fill();

      if (env.hasText && toyText.length <= 18) {
        g.font = `700 ${Math.max(8, Math.round(unit * 0.026))}px "JetBrains Mono", ui-monospace, monospace`;
        g.textAlign = 'center';
        g.textBaseline = 'bottom';
        g.fillStyle = hslCss(FC_OIL.verdictCrimson[0], 72, 38, fade * 0.9);
        g.fillText(toyText, 0, -eh / 2 - 4);
      }

      g.restore();
    }
  }

  function renderGavelRipples(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const unit = Math.min(w, h);
    const ringInk: HSL = monochrome ? FC_OIL.verdictCrimson : mood.accent;

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      const age = t - rp.t0;
      if (age > 2.2) {
        ripples.splice(i, 1);
        continue;
      }

      const cx = rp.u * w;
      const cy = rp.v * h;

      // Brief courtroom spotlight impact flash
      if (age < 0.24) {
        const flashAlpha = (1 - age / 0.24) * 0.45;
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.22);
        grad.addColorStop(0, hslCss(FC_OIL.newsprintCream[0], 50, 96, flashAlpha));
        grad.addColorStop(1, hslCss(FC_OIL.bullionGold[0], 70, 56, 0));
        g.fillStyle = grad;
        g.beginPath();
        g.arc(cx, cy, unit * 0.22, 0, TAU);
        g.fill();
      }

      // 3 concentric broken impasto ink shockwave rings
      g.lineCap = 'round';
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const localAge = age - rIdx * 0.14;
        if (localAge <= 0 || localAge > 1.7) continue;
        const f = localAge / 1.7;
        const rad = (0.03 + Math.pow(f, 0.72) * 0.44) * unit;
        const alpha = (1 - f) * (rIdx === 0 ? 0.85 : 0.65);
        const col = rIdx === 1 ? FC_OIL.bullionGold : ringInk;
        const segments = 16;

        g.lineWidth = Math.max(1.8, (1 - f * 0.65) * unit * 0.013);
        g.strokeStyle = hslCss(col[0], col[1], col[2], alpha);

        for (let s = 0; s < segments; s++) {
          const a = (s / segments) * TAU + rp.seed + localAge * (rIdx % 2 === 0 ? 0.45 : -0.35);
          g.beginPath();
          g.arc(cx, cy, rad, a, a + 0.23);
          g.stroke();
        }
      }

      // Rising painted verdict echo text
      if (age < 1.85) {
        const textFade = age < 1.1 ? 1 : clamp(1 - (age - 1.1) / 0.75, 0, 1);
        const rise = age * unit * 0.045;
        const fontSize = Math.max(11, Math.round(unit * 0.048));
        g.save();
        g.font = `800 ${fontSize}px "Libre Franklin", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const tx = clamp(cx, unit * 0.24, w - unit * 0.24);
        const ty = clamp(cy - rise, unit * 0.12, h - unit * 0.12);
        g.fillStyle = hslCss(FC_OIL.pressBlack[0], 14, 12, textFade * 0.55);
        g.fillText(rp.label, tx + 1.5, ty + 1.5);
        g.fillStyle = hslCss(ringInk[0], ringInk[1], Math.min(62, ringInk[2] + 8), textFade * 0.96);
        g.fillText(rp.label, tx, ty);
        g.restore();
      }
    }
  }

  return {
    aspect,
    alt:
      config.alt ||
      (config.subject
        ? `Impressionist oil painting of ${config.subject}`
        : 'Impressionist editorial oil painting by The Financial Crimes'),
    ready: () => status === 'ready' || status === 'failed',
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

      // Focus extra brushwork over fresh redaction bars or recently scratched areas
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

      // Advance coin physics
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i];
        if (t - c.t0 > c.life) {
          coins.splice(i, 1);
          continue;
        }
        c.vv += 1.65 * dt;
        c.u += c.vu * dt;
        c.v += c.vv * dt;
        if (c.v > 0.94 && c.vv > 0) {
          c.v = 0.94;
          c.vv *= -0.44;
          c.vu *= 0.82;
        }
      }

      // Advance fluttering subpoena / bounced-email envelopes
      for (let i = envelopes.length - 1; i >= 0; i--) {
        const env = envelopes[i];
        const age = t - env.t0;
        if (age > env.life || env.v > 1.15) {
          envelopes.splice(i, 1);
          continue;
        }
        env.vv = Math.min(0.28, env.vv + 0.32 * dt);
        env.u += (env.vu + Math.sin(age * env.swayFreq + env.phase) * env.swayAmp) * dt;
        env.v += env.vv * dt;
        env.rot += env.vrot * dt * 0.35;
        env.vu *= Math.exp(-dt * 0.8);
      }
    },
    live(g, width, height, t) {
      // Even under reduced motion, show active interactive stamps/marks if the viewer explicitly clicked!
      if (reducedMotion && stamps.length === 0 && redactions.length === 0 && crashes.length === 0 && ripples.length === 0) {
        return;
      }
      if (stamps.length > 0) renderStamps(g, width, height, t);
      if (coins.length > 0 || shimmerArcs.length > 0) renderCoins(g, width, height, t);
      if (redactions.length > 0) renderRedactionLive(g, width, height, t);
      if (crashes.length > 0) renderCrashLines(g, width, height, t);
      if (envelopes.length > 0) renderEnvelopes(g, width, height, t);
      if (ripples.length > 0) renderGavelRipples(g, width, height, t);
    },
    pointer(kind: PointerKind, u: number, v: number, t: number) {
      const at = Number.isFinite(t) ? t : lastClock;
      if (kind === 'leave') {
        pointerTarget = null;
        return;
      }

      pointerTarget = { u: clamp(u, 0, 1), v: clamp(v, 0, 1) };

      if (kind === 'move' && interactive && toyKind === 'redaction') {
        scratchRedactionsAt(u, v, at);
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
      }
    },
    reset() {
      stamps.length = 0;
      coins.length = 0;
      shimmerArcs.length = 0;
      redactions.length = 0;
      crashes.length = 0;
      envelopes.length = 0;
      ripples.length = 0;
      scratchHotspots.length = 0;
      pointerTarget = null;
      if (status === 'failed' && config.refImage) {
        status = 'idle';
        startLoad();
      }
    },
  };
}
