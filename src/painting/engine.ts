import type { Hotspot, PaintMode, PointerKind, Scene } from './types';
import { fbm, type Rand } from './noise';
import { clamp, hslCss, lerp } from './color';
import { paintDab } from './brush';

export interface PainterOptions {
  /** Fine dab size as a fraction of canvas width. */
  fineFraction?: number;
  /** Smallest fine dab in device pixels. */
  minFine?: number;
  /** Dabs per frame once the underpainting is done. */
  maintenance?: number;
  /** Finish the underpainting in this many seconds (paces by dt). */
  buildSeconds?: number;
  /** First underpainting dabs are this many times the fine size (easing down to 1). */
  coarse?: number;
  /** Cap total underpainting dabs so huge HiDPI frames stay responsive. */
  maxBuildTarget?: number;
  reducedMotion?: boolean;
  random?: Rand;
}

export const HOTSPOT_SHARE = 0.62;
/** Under reduced motion, keep repainting this many seconds after a click/poke. */
export const INTERACTION_GRACE = 4;
/** Once built and untouched for this many seconds, a painting drops to idle maintenance. */
export const IDLE_AFTER = 2;
/** Idle paintings lay one maintenance batch per this many seconds instead of every frame (battery). */
export const IDLE_INTERVAL = 1;
/** Under reduced motion the underpainting lands in a few frames; cap each frame's main-thread slice. */
const REDUCED_MOTION_BUDGET_MS = 10;

/** Tuned presets so hero portraits shine at fine detail while 20+ thumbs glide at 60fps. */
export function painterOptionsForMode(
  mode: PaintMode,
  reducedMotion: boolean,
  random?: Rand,
): PainterOptions {
  if (mode === 'thumb') {
    return {
      coarse: 4.0,
      fineFraction: 0.0115,
      minFine: 2.2,
      buildSeconds: 0.7,
      maintenance: 34,
      maxBuildTarget: 7500,
      reducedMotion,
      random,
    };
  }
  if (mode === 'inline') {
    return {
      coarse: 4.0,
      fineFraction: 0.0062,
      minFine: 2,
      buildSeconds: 1.15,
      maintenance: 155,
      maxBuildTarget: 18000,
      reducedMotion,
      random,
    };
  }
  // hero
  return {
    coarse: 4.0,
    fineFraction: 0.0054,
    minFine: 2,
    buildSeconds: 1.35,
    maintenance: 220,
    maxBuildTarget: 24000,
    reducedMotion,
    random,
  };
}

export class Painter {
  visible = false;
  lastPlayed = -Infinity;
  built = 0;
  buildTarget = 0;
  width = 0;
  height = 0;
  fine = 0;
  failed = false;
  /** Device-pixel ratio the canvases were last sized for. */
  dpr = 1;
  reducedMotion: boolean;

  private washed = false;
  /** Loop time of the last pointer press/move over the painting. */
  private lastActive = -Infinity;
  private lastIdleBatch = -Infinity;
  private liveDirty = false;
  private revision = 0;
  private readonly fineFraction: number;
  private readonly minFine: number;
  private readonly maintenance: number;
  private readonly buildSeconds: number;
  private readonly coarse: number;
  private readonly maxBuildTarget: number;
  private readonly rand: Rand;

  constructor(
    readonly scene: Scene,
    private readonly ground: CanvasRenderingContext2D,
    private readonly live: CanvasRenderingContext2D | null,
    options: PainterOptions = {},
  ) {
    this.fineFraction = options.fineFraction ?? 0.0054;
    this.minFine = options.minFine ?? 2;
    this.maintenance = options.maintenance ?? 220;
    this.buildSeconds = options.buildSeconds ?? 1.35;
    this.coarse = options.coarse ?? 4.0;
    this.maxBuildTarget = options.maxBuildTarget ?? 24000;
    this.reducedMotion = options.reducedMotion ?? false;
    this.rand = options.random ?? Math.random;
  }

  /** Reallocate for a new canvas size (device px) and restart the underpainting. */
  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.guard(() => this.scene.resize?.(width, height));
    this.fine = Math.max(this.minFine, width * this.fineFraction);
    const rawTarget = Math.round(((width * height) / (this.fine * this.fine)) * 1.25);
    this.buildTarget = Math.min(this.maxBuildTarget, Math.max(1200, rawTarget));
    this.built = 0;
    this.washed = false;

    const g = this.ground;
    g.clearRect(0, 0, width, height);
    // Warm archival linen ground before the first oil stroke lands
    g.fillStyle = '#f6f3ec';
    g.fillRect(0, 0, width, height);
  }

  /** Wipe and freshly repaint the portrait from coarse wash to fine brushstrokes. */
  repaint(): void {
    if (this.width <= 0 || this.height <= 0) return;
    this.failed = false;
    this.guard(() => {
      this.scene.reset?.();
    });
    if (this.live) {
      this.live.clearRect(0, 0, this.width, this.height);
      this.liveDirty = false;
    }
    this.resize(this.width, this.height);
  }

  play(t: number): void {
    this.lastPlayed = t;
  }

  pointer(kind: PointerKind, u: number, v: number, t: number): void {
    if (this.failed) return;
    if (kind !== 'leave') this.lastActive = t;
    this.guard(() => {
      const changed = this.scene.pointer?.(kind, u, v, t);
      if (kind === 'down' || changed) this.play(t);
    });
  }

  step(t: number, dt: number): void {
    if (this.failed || !this.visible || this.width === 0) return;
    this.guard(() => {
      const { scene } = this;
      scene.update?.(t, dt, { reducedMotion: this.reducedMotion });

      // Source pixels changed (late image load): restart the underpainting from them
      const revision = scene.revision?.() ?? 0;
      if (revision !== this.revision) {
        this.revision = revision;
        this.resize(this.width, this.height);
      }

      const isReady = !scene.ready || scene.ready();
      if (isReady) {
        if (!this.washed) {
          this.applyBaseWash(t);
        }
        if (this.built < this.buildTarget) {
          this.underpaint(t, dt);
        } else if (this.reducedMotion) {
          if (t - this.lastPlayed < INTERACTION_GRACE || scene.busy?.()) this.maintain(t);
        } else if (t - this.lastActive < IDLE_AFTER || scene.busy?.()) {
          // Hover sharpening and live effects keep full frame-rate brushwork
          this.maintain(t);
        } else if (t - this.lastIdleBatch >= IDLE_INTERVAL) {
          this.lastIdleBatch = t;
          this.maintain(t);
        }
      }

      if (this.live && scene.live) {
        // Only clear when the previous frame drew something; idle frames cost nothing
        if (this.liveDirty) this.live.clearRect(0, 0, this.width, this.height);
        this.liveDirty = scene.live(this.live, this.width, this.height, t, this.dpr);
      }
    });
  }

  private applyBaseWash(t: number): void {
    this.washed = true;
    const base = this.scene.sample(0.5, 0.5, t);
    if (!base) return;
    const g = this.ground;
    g.fillStyle = hslCss(base.color[0], base.color[1] * 0.75, clamp(base.color[2] + 8, 18, 94));
    g.fillRect(0, 0, this.width, this.height);
  }

  private underpaint(t: number, dt: number): void {
    const remaining = this.buildTarget - this.built;
    const deadline = this.reducedMotion ? performance.now() + REDUCED_MOTION_BUDGET_MS : Infinity;
    const n = this.reducedMotion
      ? remaining
      : Math.max(24, Math.ceil((this.buildTarget * Math.max(dt, 1 / 120)) / this.buildSeconds));

    const hot: Hotspot[] = this.scene.hotspots?.(t) ?? [];
    const aspect = this.width / this.height;
    this.ground.lineCap = 'round';

    for (let i = 0; i < n && this.built < this.buildTarget; i++, this.built++) {
      const p = this.built / this.buildTarget;
      const baseSize = this.fine * lerp(this.coarse, 1, Math.pow(p, 0.55));

      // During the finishing quarter of the underpainting, pull detail strokes onto focal landmarks
      if (p > 0.72 && hot.length > 0 && this.rand() < 0.45) {
        const h = hot[Math.floor(this.rand() * hot.length)];
        const a = this.rand() * Math.PI * 2;
        const r = Math.sqrt(this.rand()) * h.r;
        const u = clamp(h.u + Math.cos(a) * r, 0, 1);
        const v = clamp(h.v + Math.sin(a) * r * aspect, 0, 1);
        this.dabAt(u, v, baseSize * (h.detail ?? 0.65), t);
      } else {
        this.dabAt(this.rand(), this.rand(), baseSize, t);
      }
      // Reduced motion: no visible build animation, but never one giant main-thread task
      if ((i & 255) === 255 && performance.now() > deadline) {
        this.built++;
        break;
      }
    }
  }

  private maintain(t: number): void {
    const hot: Hotspot[] = this.scene.hotspots?.(t) ?? [];
    const aspect = this.width / this.height;
    this.ground.lineCap = 'round';

    for (let i = 0; i < this.maintenance; i++) {
      if (hot.length > 0 && this.rand() < HOTSPOT_SHARE) {
        const h = hot[Math.floor(this.rand() * hot.length)];
        const a = this.rand() * Math.PI * 2;
        const r = Math.sqrt(this.rand()) * h.r;
        const u = clamp(h.u + Math.cos(a) * r, 0, 1);
        const v = clamp(h.v + Math.sin(a) * r * aspect, 0, 1);
        this.dabAt(u, v, this.fine * (h.detail ?? 1) * (0.8 + this.rand() * 0.55), t);
      } else {
        this.dabAt(this.rand(), this.rand(), this.fine * (0.9 + this.rand() * 0.68), t);
      }
    }
  }

  private dabAt(u: number, v: number, size: number, t: number): void {
    const sample = this.scene.sample(u, v, t);
    if (!sample) return;
    // The flow field only steers strokes whose sample carries no contour angle
    const flowAngle = sample.angle === undefined ? (fbm(u * 2.2 + 11, v * 2.2) - 0.5) * 1.6 : 0;
    paintDab(this.ground, u * this.width, v * this.height, size, sample, flowAngle, this.rand);
  }

  private guard(fn: () => void): void {
    if (this.failed) return;
    try {
      fn();
    } catch (error) {
      this.failed = true;
      console.error('[painting] scene stopped after an error', error);
    }
  }
}
