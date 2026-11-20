import type { HSL } from './types';
import { clamp, hslCss } from './color';
import { easeOutCubic } from './pixel-field';

export interface ArchivalPlateState {
  t0: number;
  title: string;
  subtitle: string;
  accent: HSL;
}

const FADE_IN_DUR = 0.22;
const HOLD_DUR = 5.2;
const FADE_OUT_DUR = 1.1;
export const ARCHIVAL_PLATE_DURATION = FADE_IN_DUR + HOLD_DUR + FADE_OUT_DUR;

/** Measure editorial tracked text cleanly across Unicode symbols (₹, €, ≈, ·). */
export function measureTrackedText(
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
export function fillTrackedText(
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

/**
 * Render the shared lower-left cotton-rag Archival Exhibit Plate (museum / broadsheet print).
 * Always locked to `'source-over'`, DPR-normalized (caller scales ctx by DPR and passes logical cw/ch),
 * with a 220ms `6px` settle → 5.2s hold → 1.1s fade.
 *
 * Returns `true` while the plate remains active, or `false` once expired so callers can clear it.
 */
export function drawArchivalPlate(
  g: CanvasRenderingContext2D,
  plate: ArchivalPlateState | null,
  cw: number,
  ch: number,
  t: number,
  reducedMotion: boolean,
): boolean {
  if (!plate) return false;
  const age = t - plate.t0;

  if (age < 0 || age >= ARCHIVAL_PLATE_DURATION) {
    return false;
  }

  let alpha = 1;
  let glideY = 0;
  if (age < FADE_IN_DUR) {
    const ease = reducedMotion ? 1 : easeOutCubic(age / FADE_IN_DUR);
    alpha = reducedMotion ? 1 : ease;
    glideY = reducedMotion ? 0 : (1 - ease) * 6;
  } else if (age > FADE_IN_DUR + HOLD_DUR) {
    const outP = clamp((age - FADE_IN_DUR - HOLD_DUR) / FADE_OUT_DUR, 0, 1);
    alpha = 1 - outP * outP;
  }

  if (alpha <= 0.01) return true;

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
    const mainW = measureTrackedText(g, plate.title, mainTrack);
    let subW = 0;
    if (plate.subtitle) {
      g.font = `500 ${subSize.toFixed(1)}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
      subW = measureTrackedText(g, plate.subtitle, subTrack);
    }
    return { mainW, subW, mainTrack, subTrack };
  };

  let metrics = measureFonts();
  const rawW = accentBarW + padLeft + Math.max(metrics.mainW, metrics.subW) + padRight;
  if (rawW > maxPlateW) {
    const fit = Math.max(
      0.72,
      (maxPlateW - accentBarW - padLeft - padRight) / Math.max(1, Math.max(metrics.mainW, metrics.subW)),
    );
    mainSize = Math.max(10.5, mainSize * fit);
    subSize = Math.max(8, subSize * fit);
    metrics = measureFonts();
  }

  const plateW = Math.round(
    Math.min(maxPlateW, accentBarW + padLeft + Math.max(metrics.mainW, metrics.subW) + padRight),
  );
  const lineGap = plate.subtitle ? Math.round(clamp(mainSize * 0.34, 4, 6)) : 0;
  const plateH = Math.round(padY * 2 + mainSize + (plate.subtitle ? lineGap + subSize : 0));

  const plateX = margin;
  const plateY = Math.round(ch - margin - plateH + glideY);

  g.save();
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = alpha;

  // Warm cotton-rag paper surface (sharp flat 0px corners, zero drop shadow)
  g.fillStyle = 'rgba(250, 247, 240, 0.94)';
  g.fillRect(plateX, plateY, plateW, plateH);

  // 3px vertical left accent bar in the story's pigment
  const [ah, as, al] = plate.accent;
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
  fillTrackedText(g, plate.title, textX, plateY + padY, metrics.mainTrack);

  // Archival monospace sub-line
  if (plate.subtitle) {
    g.font = `500 ${subSize.toFixed(1)}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    g.fillStyle = '#4a4843';
    fillTrackedText(
      g,
      plate.subtitle,
      textX,
      plateY + padY + mainSize + lineGap,
      metrics.subTrack,
    );
  }

  g.restore();
  return true;
}
