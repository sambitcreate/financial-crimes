import type { Sample } from './types';
import type { Rand } from './noise';
import { clamp, hslCss } from './color';

export interface Dab {
  x: number;
  y: number;
  size: number;
  sample: Sample;
  /** Direction used when the sample gives no angle. */
  flowAngle: number;
  rand: Rand;
}

function strokeSegment(
  g: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

/**
 * Authentic 3-pass impasto oil brushstroke:
 * 1. Darker shadow edge offset (+0.25w, +0.35w) at l - 16
 * 2. Thick rounded oil body at l
 * 3. 70% impasto specular highlight ridge at l + 14
 * Plus 2% impressionist broken-color fleck in colour mode, or rich warm sepia/charcoal
 * oil chiaroscuro in monochrome Opinion mode.
 */
export function paintDab(g: CanvasRenderingContext2D, d: Dab): void {
  const { rand, sample } = d;
  const jitter = sample.jitter ?? 1;
  let [h, s, l] = sample.color;

  if (sample.monochrome) {
    // Rich sepia-charcoal / broadsheet chiaroscuro oil without stray chromatic rainbow flecks
    h += (rand() - 0.5) * 5 * jitter;
    s = clamp(s + (rand() - 0.5) * 4 * jitter, 2, 19);
    l += (rand() - 0.5) * 13 * jitter;
  } else {
    s = Math.min(94, s * 1.1);
    h += (rand() - 0.5) * 15 * jitter;
    s += (rand() - 0.5) * 14 * jitter;
    l += (rand() - 0.5) * 13 * jitter;
    if (rand() < 0.02) {
      // Stray impressionist broken-color fleck of neighbouring pigment, gentler on tight facial features
      const fleckScale = clamp(jitter, 0.42, 1.1);
      h += (rand() < 0.5 ? -1 : 1) * (16 + rand() * 24) * fleckScale;
      s += 7 * fleckScale;
    }
  }

  const angleSpread = sample.angle !== undefined ? 0.34 : 0.6;
  const angle = (sample.angle ?? d.flowAngle) + (rand() - 0.5) * angleSpread;
  const len = d.size * (1.1 + rand() * 1.1);
  const wid = d.size * (0.7 + rand() * 0.35);
  const dx = Math.cos(angle) * len * 0.5;
  const dy = Math.sin(angle) * len * 0.5;

  g.lineCap = 'round';
  g.lineWidth = wid;

  // Pass 1: Impasto cast shadow edge
  g.strokeStyle = hslCss(h, s, l - 16, 0.4);
  strokeSegment(
    g,
    d.x - dx + wid * 0.25,
    d.y - dy + wid * 0.35,
    d.x + dx + wid * 0.25,
    d.y + dy + wid * 0.35,
  );

  // Pass 2: Thick oil body
  g.strokeStyle = hslCss(h, s, l, 0.9);
  strokeSegment(g, d.x - dx, d.y - dy, d.x + dx, d.y + dy);

  // Pass 3: Impasto ridge specular highlight (70% of strokes)
  if (rand() < 0.7) {
    g.lineWidth = wid * 0.35;
    g.strokeStyle = hslCss(h, s * 0.6, Math.min(97, l + 14), 0.6);
    strokeSegment(
      g,
      d.x - dx * 0.8 - wid * 0.15,
      d.y - dy * 0.8 - wid * 0.2,
      d.x + dx * 0.5 - wid * 0.15,
      d.y + dy * 0.5 - wid * 0.2,
    );
  }
}
