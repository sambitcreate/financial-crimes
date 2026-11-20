import type { HSL } from './types';
import { clamp, hslToRgb, lerp, rgbToHsl } from './color';
import type { MoodProfile } from './palette';

export const SAMPLE_WIDTH = 180;

export interface PixelField {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Sobel contour tangent angles (radians) so strokes follow cheekbones, hairlines & lapels. */
  angles: Float32Array;
  /** Normalized Sobel edge magnitude (0..1) controlling how tightly strokes lock to contours. */
  strength: Float32Array;
}

export interface CropWindow {
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

export function createDefaultCrop(focal: { u: number; v: number }): CropWindow {
  return {
    uStart: 0,
    winW: 1,
    vStart: 0,
    winH: 1,
    canvasU0: 0,
    canvasU1: 1,
    canvasFocalU: focal.u,
    canvasFocalV: focal.v,
  };
}

const pixelCache = new Map<string, Promise<PixelField>>();

/** Compute a 1-pass smoothed luminance buffer and Sobel contour tangent field. */
export function computeSobelField(
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

/** Compute an aspect-safe focal-point cover crop (extending painted studio wings on wide portrait frames). */
export function computeCoverCrop(
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
export function oilContrast(l01: number, strength: number): number {
  const centered = l01 - 0.5;
  const curved = 0.5 + centered * (1 + strength) - Math.pow(centered, 3) * strength * 1.4;
  return clamp(curved, 0, 1);
}

/** Smooth angular interpolation so Sobel tangents blend cleanly with flow angles. */
export function blendAngle(flow: number, contour: number, weight: number): number {
  // Brushstrokes are bidirectional (angle ≡ angle + π), so align to shortest half-turn
  let diff = (((contour - flow) % Math.PI) + Math.PI * 1.5) % Math.PI - Math.PI / 2;
  if (Number.isNaN(diff)) diff = 0;
  return flow + diff * weight;
}

export function easeOutCubic(p: number): number {
  const c = clamp(p, 0, 1);
  return 1 - Math.pow(1 - c, 3);
}

/** Pigment-accurate sRGB color mixing so blue + 24k gold yields warm antique bronze, never neon green. */
export function mixHslViaRgb(a: HSL, b: HSL, t: number): HSL {
  const f = clamp(t, 0, 1);
  const [ar, ag, ab] = hslToRgb(a);
  const [br, bg, bb] = hslToRgb(b);
  return rgbToHsl(lerp(ar, br, f), lerp(ag, bg, f), lerp(ab, bb, f));
}

/**
 * Measure local background luminance (0..1) via a 5-point cross sampled from the
 * cropped reference PixelField, accounting for crop window, wingFade, oil chiaroscuro,
 * and vignette darkening so surface overlays select the highest-contrast ink & blend mode.
 */
export function sampleLocalLuminance(
  pixels: PixelField | null,
  crop: CropWindow,
  mood: MoodProfile,
  monochrome: boolean,
  u: number,
  v: number,
  radius = 0.045,
): number {
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
