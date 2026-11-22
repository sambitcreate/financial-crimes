import type { HSL, Hotspot, Sample, ToyKind } from './types';
import { fbm, type Rand } from './noise';
import { clamp, hslCss, lerp, mixHslShortest } from './color';
import { FC_OIL } from './palette';
import { easeOutCubic, isDarkGround, mixHslViaRgb, oilContrast } from './pixel-field';

const TAU = Math.PI * 2;

/* ============================================================================
   Wet-Oil & Archival Exhibit Interaction State Types
   ============================================================================ */

export interface RegistrationStamp {
  u: number;
  v: number;
  t0: number;
  seed: number;
  accent: HSL;
  bgLum: number;
}

export interface GoldLeafPatch {
  u: number;
  v: number;
  t0: number;
  seed: number;
  bgLum: number;
}

export interface GoldFoilFleck {
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

export interface RedactionBar {
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

export interface EngravingPlunge {
  t0: number;
  points: { u: number; v: number }[];
  peakIndex: number;
  bgLum: number;
}

export interface RoutingArc {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  delay: number;
}

export interface ForensicRoute {
  u: number;
  v: number;
  t0: number;
  arcs: RoutingArc[];
  bgLum: number;
}

export interface ChiaroscuroWave {
  u: number;
  v: number;
  t0: number;
  bgLum: number;
}

export interface ScratchHotspot {
  u: number;
  v: number;
  t0: number;
}

export interface ToyState {
  stamps: RegistrationStamp[];
  goldPatches: GoldLeafPatch[];
  foilFlecks: GoldFoilFleck[];
  redactions: RedactionBar[];
  activeCrash: EngravingPlunge | null;
  activeRoute: ForensicRoute | null;
  waves: ChiaroscuroWave[];
  scratchHotspots: ScratchHotspot[];
}

export interface ToyTriggerContext {
  aspect: number;
  isPortrait: boolean;
  reducedMotion: boolean;
  accentPigment: HSL;
  rand: Rand;
  sampleLuminance: (u: number, v: number, radius?: number) => number;
  toySubtext: string;
}

export function createToyState(): ToyState {
  return {
    stamps: [],
    goldPatches: [],
    foilFlecks: [],
    redactions: [],
    activeCrash: null,
    activeRoute: null,
    waves: [],
    scratchHotspots: [],
  };
}

export function resetToyState(state: ToyState): void {
  state.stamps.length = 0;
  state.goldPatches.length = 0;
  state.foilFlecks.length = 0;
  state.redactions.length = 0;
  state.activeCrash = null;
  state.activeRoute = null;
  state.waves.length = 0;
  state.scratchHotspots.length = 0;
}

export function hasActiveToys(state: ToyState, lastClock: number): boolean {
  return (
    Boolean(state.activeCrash || state.activeRoute) ||
    state.stamps.length > 0 ||
    state.goldPatches.length > 0 ||
    state.foilFlecks.length > 0 ||
    // Bars persist until scratched off; only a freshly dropped one needs full-rate brushwork
    state.redactions.some((bar) => lastClock - bar.t0 < 2.5) ||
    state.waves.length > 0
  );
}

export function hasLiveToys(state: ToyState): boolean {
  return (
    state.stamps.length > 0 ||
    state.goldPatches.length > 0 ||
    state.foilFlecks.length > 0 ||
    state.redactions.length > 0 ||
    Boolean(state.activeCrash || state.activeRoute) ||
    state.waves.length > 0
  );
}

/* ============================================================================
   Ground-Layer Impasto Sampling Helpers
   ============================================================================ */

/** Apply redaction oil bars onto the sampled color field (scratched clean on hover). */
export function sampleRedactionOverlay(
  redactions: readonly RedactionBar[],
  u: number,
  v: number,
): Sample | null {
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

/** 1. Optical Chiaroscuro Wave (gavel-ripple): expanding annular charcoal band in real oil strokes. */
export function sampleRippleChiaroscuro(
  waves: readonly ChiaroscuroWave[],
  u: number,
  v: number,
  t: number,
  aspect: number,
  reducedMotion: boolean,
  base: Sample,
): Sample {
  if (waves.length === 0) return base;
  let color = base.color;
  let isMono = Boolean(base.monochrome);
  let jitter = base.jitter ?? 0.72;
  let touched = false;

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
          touched = true;
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
        touched = true;
      }
    }
  }

  return touched ? { color, angle: base.angle, jitter, monochrome: isMono } : base;
}

/** 2. 24k Gold-Leaf Impasto Gilding (coins): Klimt-style organic fbm gold leaf along Sobel contours. */
export function sampleGildingOverlay(
  goldPatches: readonly GoldLeafPatch[],
  u: number,
  v: number,
  t: number,
  aspect: number,
  reducedMotion: boolean,
  base: Sample,
): Sample {
  if (goldPatches.length === 0) return base;
  let color = base.color;
  let isMono = Boolean(base.monochrome);
  let jitter = base.jitter ?? 0.72;
  let touched = false;

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
        touched = true;
      }
    }
  }

  return touched ? { color, angle: base.angle, jitter, monochrome: isMono } : base;
}

/** 3. Local Oil Wax-Seal Glaze (stamp): compact tactile pigment wash painted into impasto brushwork. */
export function sampleStampGlazeOverlay(
  stamps: readonly RegistrationStamp[],
  u: number,
  v: number,
  t: number,
  aspect: number,
  base: Sample,
): Sample {
  if (stamps.length === 0) return base;
  let color = base.color;
  let isMono = Boolean(base.monochrome);
  let jitter = base.jitter ?? 0.72;
  let touched = false;

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
        touched = true;
      }
    }
  }

  return touched ? { color, angle: base.angle, jitter, monochrome: isMono } : base;
}

/** Apply all active wet-oil surface transformations directly into the portrait's impasto dabs. */
export function applySurfacePigmentEffects(
  state: ToyState,
  u: number,
  v: number,
  t: number,
  aspect: number,
  reducedMotion: boolean,
  base: Sample,
): Sample {
  if (state.waves.length === 0 && state.goldPatches.length === 0 && state.stamps.length === 0) {
    return base;
  }
  let current = base;
  if (state.waves.length > 0) {
    current = sampleRippleChiaroscuro(state.waves, u, v, t, aspect, reducedMotion, current);
  }
  if (state.goldPatches.length > 0) {
    current = sampleGildingOverlay(state.goldPatches, u, v, t, aspect, reducedMotion, current);
  }
  if (state.stamps.length > 0) {
    current = sampleStampGlazeOverlay(state.stamps, u, v, t, aspect, current);
  }
  return current;
}

/* ============================================================================
   Wet-Oil & Archival Exhibit Interaction Triggers & Physics
   ============================================================================ */

export function triggerStamp(
  state: ToyState,
  u: number,
  v: number,
  t: number,
  ctx: ToyTriggerContext,
): void {
  const safeU = clamp(u, 0.12, 0.88);
  const safeV = clamp(v, 0.12, 0.84);
  const bgLum = ctx.sampleLuminance(safeU, safeV, 0.06);
  state.stamps.push({
    u: safeU,
    v: safeV,
    t0: t,
    seed: ctx.rand() * 80,
    accent: ctx.accentPigment,
    bgLum,
  });
  if (state.stamps.length > 2) state.stamps.shift();
}

export function triggerCoins(
  state: ToyState,
  u: number,
  v: number,
  t: number,
  ctx: ToyTriggerContext,
): void {
  const safeU = clamp(u, 0.08, 0.92);
  const safeV = clamp(v, 0.08, 0.92);
  const bgLum = ctx.sampleLuminance(safeU, safeV, 0.06);
  state.goldPatches.push({
    u: safeU,
    v: safeV,
    t0: t,
    seed: ctx.rand() * 90,
    bgLum,
  });
  if (state.goldPatches.length > 2) state.goldPatches.shift();

  if (!ctx.reducedMotion) {
    const count = 5 + Math.floor(ctx.rand() * 3); // 5-7 delicate gold-leaf foil flecks
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + (ctx.rand() - 0.5) * 0.7;
      const speed = 0.028 + ctx.rand() * 0.042;
      state.foilFlecks.push({
        u: safeU + (ctx.rand() - 0.5) * 0.03,
        v: safeV + (ctx.rand() - 0.5) * 0.03,
        vu: (Math.cos(angle) * speed) / Math.max(0.75, ctx.aspect),
        vv: Math.sin(angle) * speed - 0.018,
        w: 4.2 + ctx.rand() * 2.8,
        h: 2.2 + ctx.rand() * 1.8,
        rot: ctx.rand() * TAU,
        vrot: (ctx.rand() - 0.5) * 1.4,
        phase: ctx.rand() * TAU,
        t0: t,
        life: 1.9 + ctx.rand() * 0.9,
        pale: ctx.rand() < 0.38,
        bgLum,
      });
    }
    if (state.foilFlecks.length > 14) {
      state.foilFlecks.splice(0, state.foilFlecks.length - 14);
    }
  }
}

export function triggerRedaction(
  state: ToyState,
  u: number,
  v: number,
  t: number,
  ctx: ToyTriggerContext,
): void {
  const span = 0.46 + ctx.rand() * 0.18;
  const centerU = clamp(u, 0.28, 0.72);
  const u0 = clamp(centerU - span * 0.5, 0.06, 0.46);
  const u1 = clamp(u0 + span, 0.52, 0.94);
  const cells = new Float32Array(24);
  cells.fill(1);
  state.redactions.push({
    u0,
    u1,
    v: clamp(v, 0.14, 0.76),
    halfH: 0.034 + ctx.rand() * 0.011,
    tilt: (ctx.rand() - 0.5) * 0.045,
    t0: t,
    seed: ctx.rand() * 90,
    cells,
  });
  if (state.redactions.length > 3) state.redactions.shift();
}

export function triggerCrashLine(
  state: ToyState,
  _u: number,
  v: number,
  t: number,
  ctx: ToyTriggerContext,
): void {
  // Anchor smoothly in the lower portion of the canvas, staying cleanly below faces on portraits
  const peakV = ctx.isPortrait
    ? clamp(0.61 + (v - 0.5) * 0.08, 0.58, 0.65)
    : clamp(0.49 + (v - 0.5) * 0.12, 0.47, 0.56);
  const floorV = 0.87;
  const j = () => (ctx.rand() - 0.5) * 0.014;

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
    lumSum += ctx.sampleLuminance(pt.u, pt.v, 0.045);
  }
  const bgLum = lumSum / points.length;

  state.activeCrash = { t0: t, points, peakIndex: 2, bgLum };
}

export function triggerEnvelopes(
  state: ToyState,
  u: number,
  v: number,
  t: number,
  ctx: ToyTriggerContext,
): void {
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
      const zu = lerp(z.u0, z.u1, 0.25 + ctx.rand() * 0.5);
      const zv = lerp(z.v0, z.v1, 0.25 + ctx.rand() * 0.5);
      const dist = Math.hypot((zu - ox) * ctx.aspect, zv - oy);
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
    const bow = (idx % 2 === 0 ? -1 : 1) * (0.08 + ctx.rand() * 0.055);
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

  let lumSum = ctx.sampleLuminance(ox, oy, 0.045);
  let lumCount = 1;
  for (const arc of arcs) {
    lumSum += ctx.sampleLuminance(arc.cx, arc.cy, 0.045);
    lumSum += ctx.sampleLuminance(arc.x1, arc.y1, 0.045);
    lumCount += 2;
  }
  const bgLum = lumSum / lumCount;

  state.activeRoute = { u: ox, v: oy, t0: t, arcs, bgLum };
}

export function triggerGavelRipple(
  state: ToyState,
  u: number,
  v: number,
  t: number,
  ctx: ToyTriggerContext,
): void {
  const safeU = clamp(u, 0.08, 0.92);
  const safeV = clamp(v, 0.08, 0.88);
  const bgLum = ctx.sampleLuminance(safeU, safeV, 0.12);
  state.waves.push({
    u: safeU,
    v: safeV,
    t0: t,
    bgLum,
  });
  if (state.waves.length > 2) state.waves.shift();
}

/** Dispatch the active toy interaction and return the subtitle to show on the Archival Exhibit Plate. */
export function triggerToy(
  state: ToyState,
  kind: ToyKind,
  u: number,
  v: number,
  t: number,
  ctx: ToyTriggerContext,
): string {
  switch (kind) {
    case 'stamp':
      triggerStamp(state, u, v, t, ctx);
      return ctx.toySubtext;
    case 'coins':
      triggerCoins(state, u, v, t, ctx);
      return ctx.toySubtext;
    case 'redaction':
      triggerRedaction(state, u, v, t, ctx);
      return 'HOVER BAR TO REVEAL';
    case 'crash-line':
      triggerCrashLine(state, u, v, t, ctx);
      return ctx.toySubtext;
    case 'envelopes':
      triggerEnvelopes(state, u, v, t, ctx);
      return ctx.toySubtext;
    case 'gavel-ripple':
      triggerGavelRipple(state, u, v, t, ctx);
      return ctx.toySubtext;
  }
}

export function scratchRedactionsAt(state: ToyState, u: number, v: number, t: number): boolean {
  if (state.redactions.length === 0) return false;
  let scratched = false;
  for (let i = state.redactions.length - 1; i >= 0; i--) {
    const bar = state.redactions[i];
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
      state.redactions.splice(i, 1);
    }
  }

  if (scratched) {
    state.scratchHotspots.push({ u, v, t0: t });
    if (state.scratchHotspots.length > 6) state.scratchHotspots.shift();
  }
  return scratched;
}

/** Advance drifting gold-leaf foil flecks and prune completed chiaroscuro waves. */
export function updateToys(state: ToyState, t: number, dt: number): void {
  for (let i = state.foilFlecks.length - 1; i >= 0; i--) {
    const f = state.foilFlecks[i];
    const age = t - f.t0;
    if (age > f.life || f.v > 1.08) {
      state.foilFlecks.splice(i, 1);
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
  for (let i = state.waves.length - 1; i >= 0; i--) {
    if (t - state.waves[i].t0 > 5.8) state.waves.splice(i, 1);
  }
}

/** Append maintenance-brushwork hotspots for active wet-oil surface effects. */
export function collectToyHotspots(
  state: ToyState,
  t: number,
  aspect: number,
  reducedMotion: boolean,
  spots: Hotspot[],
): void {
  // Concentrate fine brushwork on active chiaroscuro wave crests + trailing color restoration
  for (const wv of state.waves) {
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
  for (const patch of state.goldPatches) {
    const age = t - patch.t0;
    if (age >= 0 && age < 2.2) {
      spots.push({ u: patch.u, v: patch.v, r: 0.19 / aspect, detail: 0.52 });
    } else if (age >= 4.0 && age < 8.6) {
      spots.push({ u: patch.u, v: patch.v, r: 0.21 / aspect, detail: 0.58 });
    }
  }

  // Concentrate brushwork on local stamp wax-seal glaze & smooth healing
  for (const st of state.stamps) {
    const age = t - st.t0;
    if (age >= 0 && age < 1.8) {
      spots.push({ u: st.u, v: st.v, r: 0.1 / aspect, detail: 0.52 });
    } else if (age >= 3.6 && age < 7.2) {
      spots.push({ u: st.u, v: st.v, r: 0.11 / aspect, detail: 0.56 });
    }
  }

  // Focus extra brushwork over fresh redaction bars or recently rubbed-clean areas
  for (const bar of state.redactions) {
    if (t - bar.t0 < 1.8) {
      spots.push({ u: (bar.u0 + bar.u1) * 0.5, v: bar.v, r: 0.22, detail: 0.72 });
    }
  }
  for (let i = state.scratchHotspots.length - 1; i >= 0; i--) {
    const sc = state.scratchHotspots[i];
    if (t - sc.t0 > 1.8) {
      state.scratchHotspots.splice(i, 1);
    } else {
      spots.push({ u: sc.u, v: sc.v, r: 0.11, detail: 0.42 });
    }
  }
}

/* ============================================================================
   Live-Layer Renderers (Adaptive Local-Luminance 'screen' / 'multiply' Contrast)
   ============================================================================ */

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

/** 1. gavel-ripple: Razor-thin architectural hairline rings + tiny 3px ink origin dot. */
export function renderGavelRipples(
  g: CanvasRenderingContext2D,
  waves: ChiaroscuroWave[],
  cw: number,
  ch: number,
  t: number,
  reducedMotion: boolean,
  echoColor: HSL,
): void {
  const unit = Math.min(cw, ch);

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
    const isDark = isDarkGround(wv.bgLum);

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
export function renderStamps(
  g: CanvasRenderingContext2D,
  stamps: RegistrationStamp[],
  cw: number,
  ch: number,
  t: number,
  reducedMotion: boolean,
): void {
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
    const isDark = isDarkGround(st.bgLum);

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
export function renderCoins(
  g: CanvasRenderingContext2D,
  goldPatches: GoldLeafPatch[],
  foilFlecks: readonly GoldFoilFleck[],
  cw: number,
  ch: number,
  t: number,
  reducedMotion: boolean,
): void {
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
      const isDark = isDarkGround(patch.bgLum);

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

  // Delicate rectangular metallic gold-leaf foil flecks drifting gently (zero bouncing coins)
  for (const f of foilFlecks) {
    const age = t - f.t0;
    if (age < 0 || age > f.life) continue;
    const inFade = clamp(age / 0.12, 0, 1);
    const outFade = age > f.life * 0.55 ? clamp(1 - (age - f.life * 0.55) / (f.life * 0.45), 0, 1) : 1;
    const alpha = inFade * outFade * 0.88;
    if (alpha <= 0.02) continue;

    const isVeryLight = f.bgLum > 0.72;
    const isDark = isDarkGround(f.bgLum);

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
export function renderRedactionLive(
  g: CanvasRenderingContext2D,
  redactions: readonly RedactionBar[],
  cw: number,
  ch: number,
  t: number,
  reducedMotion: boolean,
): void {
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

/**
 * 5. crash-line: Fine-nib NYT editorial engraving plunge curve across the lower canvas.
 * Returns `true` while active, or `false` once expired.
 */
export function renderCrashLines(
  g: CanvasRenderingContext2D,
  activeCrash: EngravingPlunge | null,
  cw: number,
  ch: number,
  t: number,
  reducedMotion: boolean,
): boolean {
  if (!activeCrash) return false;
  const age = t - activeCrash.t0;
  const totalDur = 6.52;
  if (age < 0 || age >= totalDur) {
    return false;
  }

  const fade = age < 5.42 ? 1 : clamp(1 - (age - 5.42) / 1.1, 0, 1);
  const progress = reducedMotion ? 1 : easeOutCubic(clamp(age / 0.65, 0, 1));
  const pts = activeCrash.points;
  const peakPt = pts[activeCrash.peakIndex];
  const floorPt = pts[pts.length - 1];
  const peakY = Math.round(peakPt.v * ch) + 0.5;
  const startX = pts[0].u * cw;
  const endX = floorPt.u * cw;
  const isDark = isDarkGround(activeCrash.bgLum);

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
  return true;
}

/**
 * 6. envelopes: 3 delicate curved architectural ink routing arcs & ringed archival pinpoint nodes.
 * Returns `true` while active, or `false` once expired.
 */
export function renderEnvelopes(
  g: CanvasRenderingContext2D,
  activeRoute: ForensicRoute | null,
  cw: number,
  ch: number,
  t: number,
  reducedMotion: boolean,
): boolean {
  if (!activeRoute) return false;
  const age = t - activeRoute.t0;
  const totalDur = 6.52;
  if (age < 0 || age >= totalDur) {
    return false;
  }

  const fade = age < 5.42 ? 1 : clamp(1 - (age - 5.42) / 1.1, 0, 1);
  const ox = activeRoute.u * cw;
  const oy = activeRoute.v * ch;
  const isDark = isDarkGround(activeRoute.bgLum);

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
  return true;
}

/** Render all active live-layer toys in canonical z-order (prior to the Archival Exhibit Plate). */
export function renderLiveToys(
  g: CanvasRenderingContext2D,
  state: ToyState,
  cw: number,
  ch: number,
  t: number,
  reducedMotion: boolean,
  echoColor: HSL,
): void {
  if (state.waves.length > 0) {
    renderGavelRipples(g, state.waves, cw, ch, t, reducedMotion, echoColor);
  }
  if (state.stamps.length > 0) {
    renderStamps(g, state.stamps, cw, ch, t, reducedMotion);
  }
  if (state.goldPatches.length > 0 || state.foilFlecks.length > 0) {
    renderCoins(g, state.goldPatches, state.foilFlecks, cw, ch, t, reducedMotion);
  }
  if (state.redactions.length > 0) {
    renderRedactionLive(g, state.redactions, cw, ch, t, reducedMotion);
  }
  if (state.activeCrash && !renderCrashLines(g, state.activeCrash, cw, ch, t, reducedMotion)) {
    state.activeCrash = null;
  }
  if (state.activeRoute && !renderEnvelopes(g, state.activeRoute, cw, ch, t, reducedMotion)) {
    state.activeRoute = null;
  }
}
