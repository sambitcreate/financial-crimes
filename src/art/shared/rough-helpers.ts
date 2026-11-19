import type { EditorialPalette } from './palette';
import { EDITORIAL_FONTS } from './palette';
import type { PRNG } from './prng';

export function escapeXml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function truncate(text: string, max: number): string {
  const str = String(text ?? '').trim();
  if (str.length <= max) return str;
  return `${str.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function f(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : '0';
}

/**
 * Generates a single hand-drawn editorial ink stroke path between two points.
 * Zero DOM dependencies — pure Node-safe string output.
 */
export function sketchLinePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: PRNG,
  roughness = 1.25
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return `M ${f(x1)} ${f(y1)}`;
  const bow = Math.min(roughness * 1.4, dist * 0.03) * rng.jitter(1);
  const mx = (x1 + x2) / 2 - (dy / dist) * bow + rng.jitter(roughness * 0.45);
  const my = (y1 + y2) / 2 + (dx / dist) * bow + rng.jitter(roughness * 0.45);
  const sx = x1 + rng.jitter(roughness * 0.35);
  const sy = y1 + rng.jitter(roughness * 0.35);
  const ex = x2 + rng.jitter(roughness * 0.35);
  const ey = y2 + rng.jitter(roughness * 0.35);
  return `M ${f(sx)} ${f(sy)} Q ${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`;
}

/**
 * Double-pass pen-and-ink line SVG element.
 */
export function sketchLineSvg(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: PRNG,
  opts: {
    stroke?: string;
    strokeWidth?: number;
    roughness?: number;
    doublePass?: boolean;
    dasharray?: string;
    opacity?: number;
  } = {}
): string {
  const stroke = opts.stroke ?? '#121212';
  const sw = opts.strokeWidth ?? 1.4;
  const rough = opts.roughness ?? 1.1;
  const dash = opts.dasharray ? ` stroke-dasharray="${opts.dasharray}"` : '';
  const op = opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : '';
  const p1 = sketchLinePath(x1, y1, x2, y2, rng, rough);
  if (!opts.doublePass) {
    return `<path d="${p1}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linecap="round"${dash}${op}/>`;
  }
  const p2 = sketchLinePath(x1, y1, x2, y2, rng, rough * 1.35);
  return `<path d="${p1}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linecap="round"${dash}${op}/><path d="${p2}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 0.65)}" stroke-linecap="round" opacity="${f((opts.opacity ?? 1) * 0.6)}"${dash}/>`;
}

/**
 * Hand-inked rectangle with subtle overshoot & double-pass strokes.
 */
export function sketchRectSvg(
  x: number,
  y: number,
  w: number,
  h: number,
  rng: PRNG,
  opts: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    roughness?: number;
    hachure?: boolean;
    hachureColor?: string;
    hachureGap?: number;
    crossHatch?: boolean;
    doubleBorder?: boolean;
  } = {}
): string {
  const fill = opts.fill ?? 'none';
  const stroke = opts.stroke ?? '#121212';
  const sw = opts.strokeWidth ?? 1.35;
  const rough = opts.roughness ?? 1.05;
  const parts: string[] = [];

  if (fill !== 'none') {
    parts.push(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}"/>`);
  }

  if (opts.hachure) {
    parts.push(
      hachureRectSvg(x + 2, y + 2, Math.max(0, w - 4), Math.max(0, h - 4), rng, {
        stroke: opts.hachureColor ?? stroke,
        gap: opts.hachureGap ?? 7,
        crossHatch: opts.crossHatch,
        opacity: 0.22,
      })
    );
  }

  const top = sketchLinePath(x - 1, y, x + w + 1, y, rng, rough);
  const right = sketchLinePath(x + w, y - 1, x + w, y + h + 1, rng, rough);
  const bottom = sketchLinePath(x + w + 1, y + h, x - 1, y + h, rng, rough);
  const left = sketchLinePath(x, y + h + 1, x, y - 1, rng, rough);
  parts.push(
    `<path d="${top} ${right} ${bottom} ${left}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`
  );

  if (opts.doubleBorder) {
    const pad = 3.5;
    if (w > pad * 3 && h > pad * 3) {
      parts.push(
        `<rect x="${f(x + pad)}" y="${f(y + pad)}" width="${f(w - pad * 2)}" height="${f(h - pad * 2)}" fill="none" stroke="${stroke}" stroke-width="0.7" opacity="0.55"/>`
      );
    }
  }
  return parts.join('');
}

/**
 * Diagonal hachure / cross-hatching clipped cleanly to a rectangle.
 */
export function hachureRectSvg(
  x: number,
  y: number,
  w: number,
  h: number,
  rng: PRNG,
  opts: {
    stroke?: string;
    strokeWidth?: number;
    gap?: number;
    crossHatch?: boolean;
    opacity?: number;
  } = {}
): string {
  if (w <= 2 || h <= 2) return '';
  const stroke = opts.stroke ?? '#121212';
  const sw = opts.strokeWidth ?? 0.85;
  const gap = Math.max(4, opts.gap ?? 7);
  const op = opts.opacity ?? 0.25;
  const segs: string[] = [];

  for (let d = -h; d < w; d += gap) {
    const sx = x + Math.max(0, d);
    const sy = y + Math.max(0, -d);
    const ex = x + Math.min(w, d + h);
    const ey = y + Math.min(h, w - d);
    if (ex - sx > 1 && ey - sy > 1) {
      segs.push(`M ${f(sx + rng.jitter(0.5))} ${f(sy + rng.jitter(0.5))} L ${f(ex + rng.jitter(0.5))} ${f(ey + rng.jitter(0.5))}`);
    }
  }

  if (opts.crossHatch) {
    for (let d = 0; d < w + h; d += gap * 1.25) {
      const sx = x + Math.min(w, d);
      const sy = y + Math.max(0, d - w);
      const ex = x + Math.max(0, d - h);
      const ey = y + Math.min(h, d);
      if (sx - ex > 1 && ey - sy > 1) {
        segs.push(`M ${f(sx + rng.jitter(0.5))} ${f(sy + rng.jitter(0.5))} L ${f(ex + rng.jitter(0.5))} ${f(ey + rng.jitter(0.5))}`);
      }
    }
  }

  return `<path d="${segs.join(' ')}" fill="none" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linecap="round" opacity="${f(op)}"/>`;
}

/**
 * Hand-drawn ellipse/circle path using 12 perturbed cubic segments.
 */
export function sketchEllipseSvg(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: PRNG,
  opts: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    roughness?: number;
    doublePass?: boolean;
  } = {}
): string {
  const stroke = opts.stroke ?? '#121212';
  const fill = opts.fill ?? 'none';
  const sw = opts.strokeWidth ?? 1.4;
  const rough = opts.roughness ?? 1.1;

  const makeRing = (scale: number): string => {
    const steps = 16;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const rJitter = 1 + rng.jitter(0.028 * rough);
      pts.push([
        cx + Math.cos(angle) * rx * scale * rJitter,
        cy + Math.sin(angle) * ry * scale * rJitter,
      ]);
    }
    let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const mx = (prev[0] + curr[0]) / 2;
      const my = (prev[1] + curr[1]) / 2;
      d += ` Q ${f(prev[0])} ${f(prev[1])} ${f(mx)} ${f(my)}`;
    }
    return `${d} Z`;
  };

  const p1 = makeRing(1);
  let out = `<path d="${p1}" fill="${fill}" stroke="${stroke}" stroke-width="${f(sw)}" stroke-linecap="round"/>`;
  if (opts.doublePass) {
    const p2 = makeRing(1.015);
    out += `<path d="${p2}" fill="none" stroke="${stroke}" stroke-width="${f(sw * 0.6)}" opacity="0.55"/>`;
  }
  return out;
}

/**
 * Procedural engraving stipple dot field within a circle or ellipse.
 */
export function stippleFieldSvg(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  rng: PRNG,
  color = '#121212',
  biasRight = 0.25
): string {
  const circles: string[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng.next() * Math.PI * 2;
    const rad = Math.sqrt(rng.next());
    const x = cx + Math.cos(angle) * rx * rad;
    const y = cy + Math.sin(angle) * ry * rad;
    const normX = (x - (cx - rx)) / (rx * 2 || 1);
    if (rng.next() < 0.28 + normX * biasRight * 2.2) {
      const r = rng.range(0.65, 1.55);
      circles.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${color}" opacity="${f(rng.range(0.35, 0.82))}"/>`);
    }
  }
  return circles.join('');
}

/**
 * Editorial letterpress ink stamp (rotated bordered box).
 */
export function letterpressStampSvg(
  cx: number,
  cy: number,
  text: string,
  color: string,
  angleDeg = -8,
  fontSize = 15
): string {
  const clean = escapeXml(text.toUpperCase());
  const estWidth = Math.max(96, text.length * fontSize * 0.66 + 24);
  const estHeight = fontSize + 18;
  return `
    <g transform="translate(${f(cx)},${f(cy)}) rotate(${f(angleDeg)})">
      <rect x="${f(-estWidth / 2)}" y="${f(-estHeight / 2)}" width="${f(estWidth)}" height="${f(estHeight)}" fill="rgba(246,243,236,0.9)" stroke="${color}" stroke-width="2.2" rx="1"/>
      <rect x="${f(-estWidth / 2 + 3)}" y="${f(-estHeight / 2 + 3)}" width="${f(estWidth - 6)}" height="${f(estHeight - 6)}" fill="none" stroke="${color}" stroke-width="0.8" stroke-dasharray="3 2"/>
      <text x="0" y="${f(fontSize * 0.34)}" text-anchor="middle" fill="${color}" font-family="${EDITORIAL_FONTS.mono}" font-size="${f(fontSize)}" font-weight="700" letter-spacing="1.4">${clean}</text>
    </g>
  `;
}

/**
 * Shared SVG <defs> for archival newsprint texture, fine crosshatch patterns, and arrow markers.
 */
export function buildEditorialDefs(uid: string, pal: EditorialPalette): string {
  return `
    <defs>
      <pattern id="hatch-${uid}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(42)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="${pal.ink}" stroke-width="0.8" opacity="0.22"/>
      </pattern>
      <pattern id="hatch-accent-${uid}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-40)">
        <line x1="0" y1="0" x2="0" y2="7" stroke="${pal.accent}" stroke-width="1.0" opacity="0.32"/>
      </pattern>
      <pattern id="crosshatch-${uid}" width="9" height="9" patternUnits="userSpaceOnUse">
        <path d="M 0 9 L 9 0 M -2 2 L 2 -2 M 7 11 L 11 7" stroke="${pal.ink}" stroke-width="0.65" opacity="0.16"/>
        <path d="M 0 0 L 9 9 M -2 7 L 2 11 M 7 -2 L 11 2" stroke="${pal.ink}" stroke-width="0.55" opacity="0.11"/>
      </pattern>
      <pattern id="stipple-${uid}" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="0.7" fill="${pal.ink}" opacity="0.16"/>
        <circle cx="4.5" cy="4.2" r="0.55" fill="${pal.ink}" opacity="0.12"/>
      </pattern>
      <marker id="arrow-${uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
        <path d="M 1 1.5 L 8.5 5 L 1 8.5 Z" fill="${pal.ink}"/>
      </marker>
      <marker id="arrow-accent-${uid}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 1 1.5 L 8.5 5 L 1 8.5 Z" fill="${pal.accent}"/>
      </marker>
    </defs>
  `;
}

/**
 * Archival broadsheet plate frame: warm rag paper ground, subtle rule frame, registration marks, optional plate header.
 */
export function buildPlateFrame(
  width: number,
  height: number,
  pal: EditorialPalette,
  opts: {
    compact?: boolean;
    kicker?: string;
    title?: string;
    subtitle?: string;
    plateNo?: string;
  } = {}
): string {
  const pad = opts.compact ? 10 : 18;
  const inner = pad + 4;
  const pieces: string[] = [
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${pal.paper}"/>`,
    `<rect x="${pad}" y="${pad}" width="${width - pad * 2}" height="${height - pad * 2}" fill="none" stroke="${pal.rule}" stroke-width="${opts.compact ? 1.1 : 1.3}"/>`,
  ];

  if (!opts.compact) {
    pieces.push(
      `<rect x="${inner}" y="${inner}" width="${width - inner * 2}" height="${height - inner * 2}" fill="none" stroke="${pal.ruleLight}" stroke-width="0.8"/>`
    );
    // Corner archival crop/registration marks
    const m = 8;
    const corners: Array<[number, number, number, number]> = [
      [pad - 5, pad, pad - 5 - m, pad],
      [pad, pad - 5, pad, pad - 5 - m],
      [width - pad + 5, pad, width - pad + 5 + m, pad],
      [width - pad, height - pad + 5, width - pad, height - pad + 5 + m],
    ];
    for (const [x1, y1, x2, y2] of corners) {
      pieces.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${pal.inkFaint}" stroke-width="0.8"/>`);
    }

    if (opts.kicker || opts.title || opts.plateNo) {
      const headerY = inner + 22;
      if (opts.kicker) {
        pieces.push(
          `<text x="${inner + 14}" y="${headerY}" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.sans}" font-size="10.5" font-weight="700" letter-spacing="1.4">${escapeXml(opts.kicker.toUpperCase())}</text>`
        );
      }
      if (opts.plateNo) {
        pieces.push(
          `<text x="${width - inner - 14}" y="${headerY}" text-anchor="end" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.mono}" font-size="10" letter-spacing="0.8">${escapeXml(opts.plateNo)}</text>`
        );
      }
      if (opts.title) {
        pieces.push(
          `<text x="${inner + 14}" y="${headerY + 23}" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.serif}" font-size="19" font-weight="700">${escapeXml(truncate(opts.title, width < 700 ? 44 : 68))}</text>`
        );
      }
      if (opts.subtitle) {
        pieces.push(
          `<text x="${inner + 14}" y="${headerY + 40}" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.sans}" font-size="11.5">${escapeXml(truncate(opts.subtitle, width < 700 ? 58 : 88))}</text>`
        );
      }
      const dividerY = opts.subtitle ? headerY + 50 : opts.title ? headerY + 34 : headerY + 12;
      pieces.push(
        `<line x1="${inner + 14}" y1="${dividerY}" x2="${width - inner - 14}" y2="${dividerY}" stroke="${pal.rule}" stroke-width="0.9"/>`,
        `<line x1="${inner + 14}" y1="${dividerY + 3}" x2="${width - inner - 14}" y2="${dividerY + 3}" stroke="${pal.ruleLight}" stroke-width="0.7"/>`
      );
    }
  }

  return pieces.join('');
}

/**
 * Isometric 3D box generator (top, left, right faces) with optional hatching.
 */
export function isoBoxSvg(
  cx: number,
  cy: number,
  wx: number,
  wy: number,
  hz: number,
  opts: {
    topFill: string;
    leftFill: string;
    rightFill: string;
    stroke: string;
    hatchId?: string;
    strokeWidth?: number;
  }
): string {
  const cos30 = 0.866;
  const sin30 = 0.5;
  const sw = opts.strokeWidth ?? 1.25;

  const p0 = [cx, cy]; // top front
  const p1 = [cx + wx * cos30, cy - wx * sin30]; // top right
  const p2 = [cx + (wx - wy) * cos30, cy - (wx + wy) * sin30]; // top back
  const p3 = [cx - wy * cos30, cy - wy * sin30]; // top left

  const b0 = [p0[0], p0[1] + hz];
  const b1 = [p1[0], p1[1] + hz];
  const b3 = [p3[0], p3[1] + hz];

  const poly = (pts: number[][]) => pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');

  return `
    <g>
      <polygon points="${poly([p0, p3, b3, b0])}" fill="${opts.leftFill}" stroke="${opts.stroke}" stroke-width="${f(sw)}" stroke-linejoin="round"/>
      <polygon points="${poly([p0, p1, b1, b0])}" fill="${opts.rightFill}" stroke="${opts.stroke}" stroke-width="${f(sw)}" stroke-linejoin="round"/>
      ${opts.hatchId ? `<polygon points="${poly([p0, p1, b1, b0])}" fill="url(#${opts.hatchId})" stroke="none"/>` : ''}
      <polygon points="${poly([p0, p1, p2, p3])}" fill="${opts.topFill}" stroke="${opts.stroke}" stroke-width="${f(sw)}" stroke-linejoin="round"/>
    </g>
  `;
}

/**
 * Canvas 2D helper: draws a hand-inked sketchy line for physics/interactive canvas archetypes.
 */
export function drawCanvasSketchLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rng: PRNG,
  stroke = '#121212',
  lineWidth = 1.4,
  roughness = 1.1
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  const bow = Math.min(roughness * 1.4, dist * 0.03) * rng.jitter(1);
  const mx = (x1 + x2) / 2 - (dy / dist) * bow;
  const my = (y1 + y2) / 2 + (dx / dist) * bow;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1 + rng.jitter(roughness * 0.3), y1 + rng.jitter(roughness * 0.3));
  ctx.quadraticCurveTo(mx, my, x2 + rng.jitter(roughness * 0.3), y2 + rng.jitter(roughness * 0.3));
  ctx.stroke();
  ctx.restore();
}

export function drawCanvasSketchRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rng: PRNG,
  opts: { fill?: string; stroke?: string; lineWidth?: number; hatch?: boolean; hatchColor?: string } = {}
): void {
  ctx.save();
  if (opts.fill) {
    ctx.fillStyle = opts.fill;
    ctx.fillRect(x, y, w, h);
  }
  if (opts.hatch) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, Math.max(0, w - 4), Math.max(0, h - 4));
    ctx.clip();
    ctx.strokeStyle = opts.hatchColor ?? opts.stroke ?? '#121212';
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 0.8;
    for (let d = -h; d < w + h; d += 7) {
      ctx.beginPath();
      ctx.moveTo(x + d, y);
      ctx.lineTo(x + d + h, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }
  const stroke = opts.stroke ?? '#121212';
  const lw = opts.lineWidth ?? 1.4;
  drawCanvasSketchLine(ctx, x, y, x + w, y, rng, stroke, lw);
  drawCanvasSketchLine(ctx, x + w, y, x + w, y + h, rng, stroke, lw);
  drawCanvasSketchLine(ctx, x + w, y + h, x, y + h, rng, stroke, lw);
  drawCanvasSketchLine(ctx, x, y + h, x, y, rng, stroke, lw);
  ctx.restore();
}
