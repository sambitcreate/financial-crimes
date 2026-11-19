/** Hue (degrees 0..360), saturation (0..100), lightness (0..100). */
export type HSL = readonly [h: number, s: number, l: number];

export interface Sample {
  color: HSL;
  /** Stroke direction in radians. Omit to use the painter's gentle default flow field. */
  angle?: number;
  /** Scales colour jitter. 1 = default; lower is smoother, higher is more broken colour. */
  jitter?: number;
  /** Keep brush strokes in rich charcoal/sepia chiaroscuro without chromatic flecks. */
  monochrome?: boolean;
}

export interface Hotspot {
  /** Centre in normalised coordinates (0..1). */
  u: number;
  v: number;
  /** Radius as a fraction of the painting width. */
  r: number;
  /** Dab size multiplier inside the hotspot (default 1). Lower paints finer detail. */
  detail?: number;
}

export interface SceneContext {
  visible: boolean;
  /** Loop-clock seconds when the viewer last poked this painting; -Infinity if never. */
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

export type PaintMode = 'hero' | 'inline' | 'thumb';

export interface PaintRefManifestEntry {
  refImage: string;
  subject?: string;
  sourceUrl?: string;
  sourceLicense?: string;
  isPortrait?: boolean;
  focalPoint?: { u: number; v: number };
  paletteMood?: PaletteMood;
  toyKind?: ToyKind;
  toyText?: string;
  toySubtext?: string;
  alt?: string;
}

export interface PaintRefConfig {
  slug?: string;
  refImage?: string;
  subject?: string;
  isPortrait?: boolean;
  focalPoint?: { u: number; v: number };
  paletteMood?: PaletteMood;
  toyKind?: ToyKind;
  toyText?: string;
  toySubtext?: string;
  monochrome?: boolean;
  aspect?: number;
  mode?: PaintMode;
  alt?: string;
  seed?: number;
}

/** Describes a painting as colour fields. The painter keeps sampling it, so changes get painted in. */
export interface Scene {
  /** width / height */
  aspect: number;
  /** Accessible description of the painting. */
  alt: string;
  /** Colour at (u, v) in 0..1 at loop time t, or null for "leave this spot unpainted". */
  sample(u: number, v: number, t: number): Sample | null;
  /** Where maintenance dabs should concentrate right now. */
  hotspots?(t: number): Hotspot[];
  update?(t: number, dt: number, ctx: SceneContext): void;
  /** Redrawn from scratch every frame on the live layer (fast-moving marks, stamps, particles). */
  live?(g: CanvasRenderingContext2D, width: number, height: number, t: number): void;
  pointer?(kind: PointerKind, u: number, v: number, t: number): void;
  /**
   * Hear the pointer anywhere on the page, not only over the painting.
   */
  pointerEverywhere?: boolean;
  /** When defined, the painter waits for true before painting (image-based scenes). */
  ready?(): boolean;
  /** Optional reset hook when the viewer clicks Repaint. */
  reset?(): void;
}
