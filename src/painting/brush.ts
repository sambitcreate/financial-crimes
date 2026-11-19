import type { Sample } from './types';
import type { Rand } from './noise';
import { clamp } from './color';

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

/** Same formatting as `hslCss` (1-decimal channels, 3-decimal alpha) without re-wrapping the hue per pass. */
const pct = (x: number): string => clamp(x, 0, 100).toFixed(1);

/**
 * Authentic 3-pass impasto oil brushstroke:
 * 1. Darker shadow edge offset (+0.25w, +0.35w) at l - 16
 * 2. Thick rounded oil body at l
 * 3. 70% impasto specular highlight ridge at l + 14
 * Plus 2% impressionist broken-color fleck in colour mode, or rich warm sepia/charcoal
 * oil chiaroscuro in monochrome Opinion mode.
 *
 * Hot path (thousands of calls per frame): positional args, no per-dab allocations.
 * The caller sets `g.lineCap = 'round'` once per batch.
 *
 * @param flowAngle Direction used when the sample gives no angle.
 */
export function paintDab(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  sample: Sample,
  flowAngle: number,
  rand: Rand,
): void {
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
  const angle = (sample.angle ?? flowAngle) + (rand() - 0.5) * angleSpread;
  const len = size * (1.1 + rand() * 1.1);
  const wid = size * (0.7 + rand() * 0.35);
  const dx = Math.cos(angle) * len * 0.5;
  const dy = Math.sin(angle) * len * 0.5;

  const huePrefix = `hsl(${(((h % 360) + 360) % 360).toFixed(1)} `;
  const sat = pct(s);

  g.lineWidth = wid;

  // Pass 1: Impasto cast shadow edge
  g.strokeStyle = `${huePrefix}${sat}% ${pct(l - 16)}% / 0.400)`;
  strokeSegment(
    g,
    x - dx + wid * 0.25,
    y - dy + wid * 0.35,
    x + dx + wid * 0.25,
    y + dy + wid * 0.35,
  );

  // Pass 2: Thick oil body
  g.strokeStyle = `${huePrefix}${sat}% ${pct(l)}% / 0.900)`;
  strokeSegment(g, x - dx, y - dy, x + dx, y + dy);

  // Pass 3: Impasto ridge specular highlight (70% of strokes)
  if (rand() < 0.7) {
    g.lineWidth = wid * 0.35;
    g.strokeStyle = `${huePrefix}${pct(s * 0.6)}% ${pct(Math.min(97, l + 14))}% / 0.600)`;
    strokeSegment(
      g,
      x - dx * 0.8 - wid * 0.15,
      y - dy * 0.8 - wid * 0.2,
      x + dx * 0.5 - wid * 0.15,
      y + dy * 0.5 - wid * 0.2,
    );
  }
}
