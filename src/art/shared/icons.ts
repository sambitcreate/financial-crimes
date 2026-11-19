import type { EditorialPalette } from './palette';
import { EDITORIAL_FONTS } from './palette';
import type { PRNG } from './prng';
import {
  f,
  hachureRectSvg,
  sketchEllipseSvg,
  sketchLineSvg,
  sketchRectSvg,
  stippleFieldSvg,
} from './rough-helpers';
import type { DossierIcon } from './types';

/**
 * Renders a bespoke pen-and-ink + stipple engraving icon centered at (cx, cy) within size `s`.
 * Pure Node-safe SVG string — zero external assets.
 */
export function renderStippleIconSvg(
  icon: DossierIcon,
  cx: number,
  cy: number,
  size: number,
  pal: EditorialPalette,
  rng: PRNG
): string {
  const r = size * 0.46;
  const parts: string[] = [];

  // Archival circular engraving medallion backing
  parts.push(
    sketchEllipseSvg(cx, cy, r * 1.04, r * 1.04, rng, {
      fill: pal.paperAlt,
      stroke: pal.rule,
      strokeWidth: 1.2,
      doublePass: true,
    }),
    stippleFieldSvg(cx + r * 0.08, cy + r * 0.06, r * 0.92, r * 0.92, 95, rng, pal.ink, 0.35)
  );

  const ink = pal.ink;
  const acc = pal.accent;

  switch (icon) {
    case 'briefcase': {
      const w = size * 0.56;
      const h = size * 0.38;
      const x = cx - w / 2;
      const y = cy - h / 2 + size * 0.04;
      // Handle
      parts.push(
        `<path d="M ${f(cx - w * 0.2)} ${f(y)} L ${f(cx - w * 0.2)} ${f(y - h * 0.28)} Q ${f(cx)} ${f(y - h * 0.38)} ${f(cx + w * 0.2)} ${f(y - h * 0.28)} L ${f(cx + w * 0.2)} ${f(y)}" fill="none" stroke="${ink}" stroke-width="2.4"/>`,
        sketchRectSvg(x, y, w, h, rng, { fill: pal.paperCard, stroke: ink, strokeWidth: 1.7, hachure: true, hachureGap: 6 }),
        sketchLineSvg(x, y + h * 0.36, x + w, y + h * 0.36, rng, { stroke: ink, strokeWidth: 1.4 }),
        sketchRectSvg(cx - w * 0.09, y + h * 0.27, w * 0.18, h * 0.22, rng, { fill: acc, stroke: ink, strokeWidth: 1.2 }),
        // Cash bills peeking out
        sketchRectSvg(x + w * 0.58, y - h * 0.14, w * 0.28, h * 0.16, rng, { fill: pal.sage, stroke: ink, strokeWidth: 1.0 })
      );
      break;
    }

    case 'shredder': {
      const w = size * 0.48;
      const h = size * 0.32;
      const x = cx - w / 2;
      const y = cy - size * 0.02;
      // Incoming document
      parts.push(
        sketchRectSvg(cx - w * 0.32, y - h * 0.85, w * 0.64, h * 0.86, rng, { fill: pal.paperCard, stroke: ink, strokeWidth: 1.4 }),
        sketchLineSvg(cx - w * 0.22, y - h * 0.62, cx + w * 0.2, y - h * 0.62, rng, { stroke: acc, strokeWidth: 2 }),
        sketchLineSvg(cx - w * 0.22, y - h * 0.42, cx + w * 0.18, y - h * 0.42, rng, { stroke: ink, strokeWidth: 1.1 }),
        sketchLineSvg(cx - w * 0.22, y - h * 0.24, cx + w * 0.12, y - h * 0.24, rng, { stroke: ink, strokeWidth: 1.1 }),
        // Shredder housing
        sketchRectSvg(x, y, w, h * 0.58, rng, { fill: pal.inkSoft, stroke: ink, strokeWidth: 1.6 }),
        `<line x1="${f(x + 6)}" y1="${f(y + h * 0.2)}" x2="${f(x + w - 6)}" y2="${f(y + h * 0.2)}" stroke="${pal.paper}" stroke-width="2"/>`
      );
      // Shredded strips
      for (let i = 0; i < 6; i++) {
        const sx = x + w * 0.14 + i * (w * 0.14);
        const len = h * rng.range(0.55, 0.92);
        parts.push(
          `<path d="M ${f(sx)} ${f(y + h * 0.58)} Q ${f(sx + rng.jitter(5))} ${f(y + h * 0.58 + len * 0.5)} ${f(sx + rng.jitter(6))} ${f(y + h * 0.58 + len)}" fill="none" stroke="${ink}" stroke-width="2.2"/>`
        );
      }
      break;
    }

    case 'vault': {
      const s = size * 0.52;
      parts.push(
        sketchRectSvg(cx - s / 2, cy - s / 2, s, s, rng, { fill: pal.paperCard, stroke: ink, strokeWidth: 2, doubleBorder: true, hachure: true }),
        sketchEllipseSvg(cx, cy, s * 0.3, s * 0.3, rng, { fill: pal.paper, stroke: ink, strokeWidth: 1.8, doublePass: true }),
        sketchEllipseSvg(cx, cy, s * 0.1, s * 0.1, rng, { fill: acc, stroke: ink, strokeWidth: 1.3 })
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(
          sketchLineSvg(cx + Math.cos(a) * s * 0.1, cy + Math.sin(a) * s * 0.1, cx + Math.cos(a) * s * 0.28, cy + Math.sin(a) * s * 0.28, rng, { stroke: ink, strokeWidth: 1.7 })
        );
      }
      break;
    }

    case 'gavel': {
      parts.push(
        `<g transform="translate(${f(cx)},${f(cy)}) rotate(-32)">`,
        sketchRectSvg(-size * 0.24, -size * 0.2, size * 0.28, size * 0.14, rng, { fill: pal.paperCard, stroke: ink, strokeWidth: 1.8, hachure: true }),
        sketchRectSvg(-size * 0.27, -size * 0.22, size * 0.05, size * 0.18, rng, { fill: acc, stroke: ink, strokeWidth: 1.3 }),
        sketchRectSvg(size * 0.02, -size * 0.22, size * 0.05, size * 0.18, rng, { fill: acc, stroke: ink, strokeWidth: 1.3 }),
        sketchRectSvg(-size * 0.12, -size * 0.06, size * 0.055, size * 0.34, rng, { fill: pal.paperCard, stroke: ink, strokeWidth: 1.6 }),
        `</g>`,
        sketchRectSvg(cx - size * 0.24, cy + size * 0.2, size * 0.48, size * 0.08, rng, { fill: pal.inkSoft, stroke: ink, strokeWidth: 1.4 })
      );
      break;
    }

    case 'skyscraper': {
      const w = size * 0.34;
      const h = size * 0.62;
      const x = cx - w / 2;
      const y = cy - h / 2 + size * 0.04;
      parts.push(
        sketchRectSvg(x - w * 0.45, y + h * 0.28, w * 0.45, h * 0.72, rng, { fill: pal.paperAlt, stroke: ink, strokeWidth: 1.3, hachure: true }),
        sketchRectSvg(x + w, y + h * 0.38, w * 0.42, h * 0.62, rng, { fill: pal.paperAlt, stroke: ink, strokeWidth: 1.3, hachure: true }),
        sketchRectSvg(x, y, w, h, rng, { fill: pal.paperCard, stroke: ink, strokeWidth: 1.8 }),
        sketchLineSvg(cx, y, cx, y - size * 0.11, rng, { stroke: ink, strokeWidth: 1.8 })
      );
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          const wx = x + 6 + col * ((w - 12) / 3);
          const wy = y + 8 + row * ((h - 18) / 5);
          const lit = row === 1 && col === 1;
          parts.push(`<rect x="${f(wx)}" y="${f(wy)}" width="${f((w - 20) / 3)}" height="6" fill="${lit ? acc : ink}" opacity="${lit ? 0.9 : 0.72}"/>`);
        }
      }
      break;
    }

    case 'yacht': {
      const yBase = cy + size * 0.14;
      parts.push(
        // Hull
        `<polygon points="${f(cx - size * 0.34)},${f(yBase - size * 0.06)} ${f(cx + size * 0.36)},${f(yBase - size * 0.09)} ${f(cx + size * 0.26)},${f(yBase + size * 0.08)} ${f(cx - size * 0.28)},${f(yBase + size * 0.08)}" fill="${pal.paperCard}" stroke="${ink}" stroke-width="1.8" stroke-linejoin="round"/>`,
        // Accent stripe
        `<line x1="${f(cx - size * 0.3)}" y1="${f(yBase)}" x2="${f(cx + size * 0.31)}" y2="${f(yBase - size * 0.02)}" stroke="${acc}" stroke-width="2.4"/>`,
        // Upper deck cabin
        `<polygon points="${f(cx - size * 0.2)},${f(yBase - size * 0.07)} ${f(cx + size * 0.16)},${f(yBase - size * 0.08)} ${f(cx + size * 0.06)},${f(yBase - size * 0.22)} ${f(cx - size * 0.18)},${f(yBase - size * 0.22)}" fill="${pal.paper}" stroke="${ink}" stroke-width="1.5"/>`,
        // Mast / radar
        sketchLineSvg(cx - size * 0.04, yBase - size * 0.22, cx - size * 0.08, yBase - size * 0.36, rng, { stroke: ink, strokeWidth: 1.6 }),
        // Water waves
        `<path d="M ${f(cx - size * 0.36)} ${f(yBase + size * 0.14)} Q ${f(cx - size * 0.18)} ${f(yBase + size * 0.09)} ${f(cx)} ${f(yBase + size * 0.14)} T ${f(cx + size * 0.36)} ${f(yBase + size * 0.14)}" fill="none" stroke="${ink}" stroke-width="1.4"/>`
      );
      break;
    }

    case 'jet': {
      parts.push(
        `<g transform="translate(${f(cx)},${f(cy)}) rotate(-18)">`,
        // Fuselage
        `<path d="M ${f(-size * 0.34)} 0 Q ${f(-size * 0.1)} ${f(-size * 0.08)} ${f(size * 0.34)} 0 Q ${f(-size * 0.1)} ${f(size * 0.08)} ${f(-size * 0.34)} 0 Z" fill="${pal.paperCard}" stroke="${ink}" stroke-width="1.7"/>`,
        // Swept wings
        `<polygon points="${f(-size * 0.06)},0 ${f(size * 0.06)},0 ${f(-size * 0.12)},${f(-size * 0.28)} ${f(-size * 0.2)},${f(-size * 0.26)}" fill="${pal.paperAlt}" stroke="${ink}" stroke-width="1.5"/>`,
        `<polygon points="${f(-size * 0.06)},0 ${f(size * 0.06)},0 ${f(-size * 0.12)},${f(size * 0.28)} ${f(-size * 0.2)},${f(size * 0.26)}" fill="${pal.paperAlt}" stroke="${ink}" stroke-width="1.5"/>`,
        // Engine turbine ring
        sketchEllipseSvg(-size * 0.05, size * 0.14, size * 0.055, size * 0.04, rng, { fill: acc, stroke: ink, strokeWidth: 1.3 }),
        `</g>`
      );
      break;
    }

    case 'chip': {
      const s = size * 0.42;
      const x = cx - s / 2;
      const y = cy - s / 2;
      // Pins
      for (let i = 0; i < 4; i++) {
        const off = (i + 0.5) * (s / 4);
        parts.push(
          sketchLineSvg(x + off, y - size * 0.09, x + off, y, rng, { stroke: ink, strokeWidth: 1.5 }),
          sketchLineSvg(x + off, y + s, x + off, y + s + size * 0.09, rng, { stroke: ink, strokeWidth: 1.5 }),
          sketchLineSvg(x - size * 0.09, y + off, x, y + off, rng, { stroke: ink, strokeWidth: 1.5 }),
          sketchLineSvg(x + s, y + off, x + s + size * 0.09, y + off, rng, { stroke: ink, strokeWidth: 1.5 })
        );
      }
      parts.push(
        sketchRectSvg(x, y, s, s, rng, { fill: pal.paperCard, stroke: ink, strokeWidth: 1.8, doubleBorder: true }),
        `<text x="${f(cx)}" y="${f(cy + 5)}" text-anchor="middle" fill="${acc}" font-family="${EDITORIAL_FONTS.mono}" font-size="${f(size * 0.14)}" font-weight="700">AI?</text>`
      );
      break;
    }

    case 'bank': {
      const w = size * 0.56;
      const h = size * 0.44;
      const x = cx - w / 2;
      const y = cy - h / 2 + size * 0.06;
      parts.push(
        // Pediment triangle
        `<polygon points="${f(x - 4)},${f(y)} ${f(cx)},${f(y - h * 0.42)} ${f(x + w + 4)},${f(y)}" fill="${pal.paperCard}" stroke="${ink}" stroke-width="1.7" stroke-linejoin="round"/>`,
        hachureRectSvg(x + w * 0.18, y - h * 0.2, w * 0.64, h * 0.16, rng, { stroke: acc, gap: 5, opacity: 0.45 }),
        // Base steps
        sketchRectSvg(x - 4, y + h * 0.72, w + 8, h * 0.14, rng, { fill: pal.inkSoft, stroke: ink, strokeWidth: 1.3 })
      );
      // 4 Columns
      for (let i = 0; i < 4; i++) {
        const colX = x + w * 0.1 + i * (w * 0.24);
        parts.push(
          sketchRectSvg(colX, y + 2, w * 0.1, h * 0.7, rng, { fill: pal.paperCard, stroke: ink, strokeWidth: 1.3 })
        );
      }
      break;
    }

    case 'scales': {
      parts.push(
        sketchLineSvg(cx, cy - size * 0.28, cx, cy + size * 0.24, rng, { stroke: ink, strokeWidth: 2 }),
        sketchRectSvg(cx - size * 0.16, cy + size * 0.22, size * 0.32, size * 0.07, rng, { fill: pal.inkSoft, stroke: ink, strokeWidth: 1.3 }),
        // Tilted beam
        sketchLineSvg(cx - size * 0.3, cy - size * 0.12, cx + size * 0.3, cy - size * 0.26, rng, { stroke: ink, strokeWidth: 2.1 }),
        // Left heavy pan
        sketchLineSvg(cx - size * 0.3, cy - size * 0.12, cx - size * 0.35, cy + size * 0.08, rng, { stroke: ink, strokeWidth: 1.1 }),
        sketchLineSvg(cx - size * 0.3, cy - size * 0.12, cx - size * 0.22, cy + size * 0.08, rng, { stroke: ink, strokeWidth: 1.1 }),
        `<path d="M ${f(cx - size * 0.38)} ${f(cy + size * 0.08)} Q ${f(cx - size * 0.29)} ${f(cy + size * 0.2)} ${f(cx - size * 0.19)} ${f(cy + size * 0.08)} Z" fill="${acc}" stroke="${ink}" stroke-width="1.3"/>`,
        // Right light pan
        sketchLineSvg(cx + size * 0.3, cy - size * 0.26, cx + size * 0.24, cy - size * 0.06, rng, { stroke: ink, strokeWidth: 1.1 }),
        sketchLineSvg(cx + size * 0.3, cy - size * 0.26, cx + size * 0.36, cy - size * 0.06, rng, { stroke: ink, strokeWidth: 1.1 }),
        `<path d="M ${f(cx + size * 0.21)} ${f(cy - size * 0.06)} Q ${f(cx + size * 0.3)} ${f(cy + size * 0.04)} ${f(cx + size * 0.39)} ${f(cy - size * 0.06)} Z" fill="${pal.paperCard}" stroke="${ink}" stroke-width="1.3"/>`
      );
      break;
    }
  }

  return `<g class="fc-stipple-icon">${parts.join('')}</g>`;
}
