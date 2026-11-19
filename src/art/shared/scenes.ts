import type { EditorialPalette } from './palette';
import { EDITORIAL_FONTS } from './palette';
import type { PRNG } from './prng';
import {
  f,
  isoBoxSvg,
  sketchEllipseSvg,
  sketchLineSvg,
  stippleFieldSvg,
} from './rough-helpers';
import type { VignetteScene } from './types';

/**
 * Renders one of the 6 curated isometric pen-and-ink editorial diorama scenes.
 * Pure Node-safe SVG — shared by SSR static SVG and interactive editorial-vignette archetype.
 */
export function renderVignetteSceneSvg(
  scene: VignetteScene,
  box: { x: number; y: number; w: number; h: number },
  pal: EditorialPalette,
  rng: PRNG,
  uid: string,
  xrayMode = false
): string {
  const cx = box.x + box.w * 0.5;
  const cy = box.y + box.h * 0.56;
  const sc = Math.min(box.w / 620, box.h / 360);
  const hatch = `hatch-${uid}`;
  const hatchAcc = `hatch-accent-${uid}`;

  // Subtle isometric architectural ground grid
  const grid: string[] = [];
  for (let i = -4; i <= 4; i++) {
    const ox = cx + i * 48 * sc;
    grid.push(
      `<line x1="${f(ox - 160 * sc)}" y1="${f(cy + 92 * sc)}" x2="${f(ox + 160 * sc)}" y2="${f(cy - 92 * sc)}" stroke="${pal.ruleLight}" stroke-width="0.7" opacity="0.65"/>`,
      `<line x1="${f(ox - 160 * sc)}" y1="${f(cy - 92 * sc)}" x2="${f(ox + 160 * sc)}" y2="${f(cy + 92 * sc)}" stroke="${pal.ruleLight}" stroke-width="0.7" opacity="0.65"/>`
    );
  }

  const body: string[] = [`<g opacity="0.8">${grid.join('')}</g>`];

  switch (scene) {
    case 'marina_yacht': {
      // Water basin diamond
      body.push(
        `<polygon points="${f(cx)},${f(cy - 115 * sc)} ${f(cx + 250 * sc)},${f(cy + 15 * sc)} ${f(cx)},${f(cy + 140 * sc)} ${f(cx - 250 * sc)},${f(cy + 15 * sc)}" fill="${pal.paperAlt}" stroke="${pal.rule}" stroke-width="1.2"/>`,
        stippleFieldSvg(cx, cy + 25 * sc, 180 * sc, 72 * sc, 75, rng, pal.slate, 0.25)
      );
      // Wooden marina dock pier on left
      body.push(
        isoBoxSvg(cx - 105 * sc, cy + 52 * sc, 80 * sc, 130 * sc, 18 * sc, {
          topFill: pal.paperCard,
          leftFill: pal.paperAlt,
          rightFill: pal.paperAlt,
          stroke: pal.ink,
          hatchId: hatch,
        }),
        // Phantom medical billing crates stacked on pier
        isoBoxSvg(cx - 125 * sc, cy + 12 * sc, 28 * sc, 28 * sc, 26 * sc, {
          topFill: pal.paperCard,
          leftFill: pal.paper,
          rightFill: pal.accentWash,
          stroke: pal.ink,
          hatchId: hatchAcc,
        }),
        isoBoxSvg(cx - 94 * sc, cy - 4 * sc, 24 * sc, 24 * sc, 22 * sc, {
          topFill: pal.paperCard,
          leftFill: pal.paper,
          rightFill: pal.paperAlt,
          stroke: pal.ink,
          hatchId: hatch,
        })
      );
      // 47-ft Yacht "THE ROGUE SHARK" in isometric perspective
      const yx = cx + 24 * sc;
      const yy = cy + 22 * sc;
      body.push(
        // Hull silhouette
        `<polygon points="${f(yx - 110 * sc)},${f(yy + 18 * sc)} ${f(yx + 125 * sc)},${f(yy - 56 * sc)} ${f(yx + 160 * sc)},${f(yy - 40 * sc)} ${f(yx + 115 * sc)},${f(yy + 4 * sc)} ${f(yx - 80 * sc)},${f(yy + 58 * sc)}" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="1.9" stroke-linejoin="round"/>`,
        // Accent racing stripe
        `<line x1="${f(yx - 92 * sc)}" y1="${f(yy + 32 * sc)}" x2="${f(yx + 132 * sc)}" y2="${f(yy - 35 * sc)}" stroke="${pal.accent}" stroke-width="3.2"/>`,
        // Cabin superstructure
        `<polygon points="${f(yx - 65 * sc)},${f(yy + 2 * sc)} ${f(yx + 62 * sc)},${f(yy - 40 * sc)} ${f(yx + 34 * sc)},${f(yy - 72 * sc)} ${f(yx - 55 * sc)},${f(yy - 40 * sc)}" fill="${pal.paper}" stroke="${pal.ink}" stroke-width="1.6" stroke-linejoin="round"/>`,
        // Bridge dark windows
        `<polygon points="${f(yx - 38 * sc)},${f(yy - 26 * sc)} ${f(yx + 36 * sc)},${f(yy - 50 * sc)} ${f(yx + 26 * sc)},${f(yy - 62 * sc)} ${f(yx - 35 * sc)},${f(yy - 40 * sc)}" fill="${pal.inkSoft}"/>`,
        // Flybridge radar arch
        sketchLineSvg(yx - 10 * sc, yy - 58 * sc, yx + 12 * sc, yy - 94 * sc, rng, { stroke: pal.ink, strokeWidth: 2 }),
        `<text x="${f(yx + 18 * sc)}" y="${f(yy + 24 * sc)}" transform="rotate(-17 ${f(yx + 18 * sc)} ${f(yy + 24 * sc)})" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="${f(9.5 * sc)}" font-weight="700" letter-spacing="0.8">THE ROGUE SHARK</text>`,
        // Water ripple strokes
        sketchLineSvg(yx - 125 * sc, yy + 68 * sc, yx + 95 * sc, yy + 22 * sc, rng, { stroke: pal.slate, strokeWidth: 1.1, opacity: 0.6 }),
        sketchLineSvg(yx - 60 * sc, yy + 84 * sc, yx + 120 * sc, yy + 42 * sc, rng, { stroke: pal.slate, strokeWidth: 1.0, opacity: 0.45 })
      );
      break;
    }

    case 'boardroom_shredder': {
      // Executive isometric desk
      body.push(
        isoBoxSvg(cx - 25 * sc, cy + 45 * sc, 155 * sc, 85 * sc, 44 * sc, {
          topFill: pal.paperCard,
          leftFill: pal.paperAlt,
          rightFill: pal.paperAlt,
          stroke: pal.ink,
          hatchId: hatch,
        }),
        // Stack of sealed ledgers on desk
        isoBoxSvg(cx - 62 * sc, cy + 6 * sc, 36 * sc, 28 * sc, 24 * sc, {
          topFill: pal.paper,
          leftFill: pal.paperCard,
          rightFill: pal.accentWash,
          stroke: pal.ink,
          hatchId: hatchAcc,
        }),
        // Industrial shredder beside desk
        isoBoxSvg(cx + 108 * sc, cy + 56 * sc, 54 * sc, 48 * sc, 86 * sc, {
          topFill: pal.inkSoft,
          leftFill: pal.paperCard,
          rightFill: pal.paperAlt,
          stroke: pal.ink,
          hatchId: hatch,
        }),
        // Paper feeding into shredder
        `<polygon points="${f(cx + 106 * sc)},${f(cy - 18 * sc)} ${f(cx + 136 * sc)},${f(cy - 32 * sc)} ${f(cx + 132 * sc)},${f(cy - 78 * sc)} ${f(cx + 102 * sc)},${f(cy - 64 * sc)}" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="1.4"/>`,
        // Redacted bar on incoming paper
        `<line x1="${f(cx + 109 * sc)}" y1="${f(cy - 52 * sc)}" x2="${f(cx + 127 * sc)}" y2="${f(cy - 60 * sc)}" stroke="${pal.accent}" stroke-width="3.2"/>`,
        // Overflowing confetti shreds around shredder base
        stippleFieldSvg(cx + 125 * sc, cy + 128 * sc, 46 * sc, 18 * sc, 65, rng, pal.ink, 0.2)
      );
      break;
    }

    case 'server_vault': {
      // Isometric "AI Neural Network" Glass Rack + X-Ray human manual checkout reveal!
      const rx = cx - 40 * sc;
      const ry = cy + 64 * sc;
      // Glass server monolith
      body.push(
        isoBoxSvg(rx, ry, 92 * sc, 78 * sc, 148 * sc, {
          topFill: pal.paperCard,
          leftFill: xrayMode ? pal.paper : pal.inkSoft,
          rightFill: xrayMode ? pal.accentWash : pal.paperAlt,
          stroke: pal.ink,
          hatchId: xrayMode ? hatchAcc : hatch,
        })
      );

      if (xrayMode) {
        // X-RAY MODE: Reveals manual desk operator typing orders!
        body.push(
          `<text x="${f(rx - 30 * sc)}" y="${f(ry - 132 * sc)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="${f(10 * sc)}" font-weight="700">X-RAY: 0% AI</text>`,
          // Desk inside rack
          isoBoxSvg(rx - 8 * sc, ry - 18 * sc, 48 * sc, 34 * sc, 24 * sc, {
            topFill: pal.paperCard,
            leftFill: pal.paperAlt,
            rightFill: pal.paperAlt,
            stroke: pal.accent,
          }),
          // Stylized operator silhouette + laptop
          sketchEllipseSvg(rx - 14 * sc, ry - 86 * sc, 11 * sc, 11 * sc, rng, { fill: pal.accent, stroke: pal.ink, strokeWidth: 1.4 }),
          `<path d="M ${f(rx - 28 * sc)} ${f(ry - 50 * sc)} Q ${f(rx - 14 * sc)} ${f(ry - 74 * sc)} ${f(rx)} ${f(ry - 50 * sc)} Z" fill="${pal.inkSoft}"/>`,
          `<text x="${f(rx + 28 * sc)}" y="${f(ry - 68 * sc)}" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="${f(8.5 * sc)}">MANUAL SHIFT</text>`
        );
      } else {
        // Polished server LED rows
        for (let i = 0; i < 6; i++) {
          const ly = ry - 122 * sc + i * 21 * sc;
          body.push(
            `<line x1="${f(rx - 54 * sc)}" y1="${f(ly)}" x2="${f(rx - 12 * sc)}" y2="${f(ly + 20 * sc)}" stroke="${i === 1 ? pal.accent : pal.paper}" stroke-width="2.2"/>`,
            `<circle cx="${f(rx - 16 * sc)}" cy="${f(ly + 18 * sc)}" r="${f(2.4 * sc)}" fill="${i % 2 === 0 ? pal.accent : pal.gold}"/>`
          );
        }
      }

      // Secondary vault / manual terminal workstation right
      body.push(
        isoBoxSvg(cx + 95 * sc, cy + 72 * sc, 72 * sc, 54 * sc, 52 * sc, {
          topFill: pal.paperCard,
          leftFill: pal.paperAlt,
          rightFill: pal.paper,
          stroke: pal.ink,
          hatchId: hatch,
        }),
        // Connecting cable between "AI Cloud" and back-office terminal
        `<path d="M ${f(rx + 60 * sc)} ${f(ry + 36 * sc)} Q ${f(cx + 42 * sc)} ${f(cy + 104 * sc)} ${f(cx + 84 * sc)} ${f(cy + 78 * sc)}" fill="none" stroke="${pal.accent}" stroke-width="2" stroke-dasharray="5 3"/>`
      );
      break;
    }

    case 'courthouse': {
      // Grand neoclassical plinth & steps
      body.push(
        isoBoxSvg(cx, cy + 84 * sc, 175 * sc, 130 * sc, 24 * sc, {
          topFill: pal.paperCard,
          leftFill: pal.paperAlt,
          rightFill: pal.paperAlt,
          stroke: pal.ink,
          hatchId: hatch,
        }),
        // Main courthouse body
        isoBoxSvg(cx + 6 * sc, cy + 52 * sc, 135 * sc, 96 * sc, 82 * sc, {
          topFill: pal.paperCard,
          leftFill: pal.paper,
          rightFill: pal.paperAlt,
          stroke: pal.ink,
          hatchId: hatch,
        })
      );
      // Classical columns along front-left facade
      for (let i = 0; i < 4; i++) {
        const colX = cx - 22 * sc - i * 24 * sc;
        const colY = cy + 44 * sc - i * 13 * sc;
        body.push(
          `<rect x="${f(colX)}" y="${f(colY - 72 * sc)}" width="${f(11 * sc)}" height="${f(72 * sc)}" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="1.3"/>`
        );
      }
      // Roof pediment + dome
      body.push(
        `<polygon points="${f(cx - 105 * sc)},${f(cy - 68 * sc)} ${f(cx - 28 * sc)},${f(cy - 118 * sc)} ${f(cx + 12 * sc)},${f(cy - 28 * sc)}" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="1.6" stroke-linejoin="round"/>`,
        sketchEllipseSvg(cx + 38 * sc, cy - 82 * sc, 36 * sc, 22 * sc, rng, { fill: pal.accentWash, stroke: pal.ink, strokeWidth: 1.6 }),
        sketchLineSvg(cx + 38 * sc, cy - 104 * sc, cx + 38 * sc, cy - 126 * sc, rng, { stroke: pal.accent, strokeWidth: 2 })
      );
      break;
    }

    case 'trading_desk': {
      // Wide L-shaped institutional trading desk
      body.push(
        isoBoxSvg(cx - 10 * sc, cy + 68 * sc, 185 * sc, 78 * sc, 42 * sc, {
          topFill: pal.paperCard,
          leftFill: pal.paperAlt,
          rightFill: pal.paperAlt,
          stroke: pal.ink,
          hatchId: hatch,
        })
      );
      // 3 angled CRT / Bloomberg monitors
      for (let i = 0; i < 3; i++) {
        const mx = cx - 42 * sc + i * 54 * sc;
        const my = cy + 6 * sc - i * 24 * sc;
        body.push(
          isoBoxSvg(mx, my, 38 * sc, 12 * sc, 36 * sc, {
            topFill: pal.inkSoft,
            leftFill: pal.inkSoft,
            rightFill: pal.paperCard,
            stroke: pal.ink,
          }),
          // Price spike line on monitor
          `<polyline points="${f(mx + 4 * sc)},${f(my - 10 * sc)} ${f(mx + 14 * sc)},${f(my - 22 * sc)} ${f(mx + 22 * sc)},${f(my - 28 * sc)} ${f(mx + 30 * sc)},${f(my - 6 * sc)}" fill="none" stroke="${i === 1 ? pal.accent : pal.ink}" stroke-width="1.6"/>`
        );
      }
      // Red compliance telephone + ticking clock
      body.push(
        sketchEllipseSvg(cx - 108 * sc, cy - 52 * sc, 28 * sc, 28 * sc, rng, { fill: pal.paperCard, stroke: pal.ink, strokeWidth: 1.7, doublePass: true }),
        sketchLineSvg(cx - 108 * sc, cy - 52 * sc, cx - 108 * sc, cy - 70 * sc, rng, { stroke: pal.ink, strokeWidth: 1.8 }),
        sketchLineSvg(cx - 108 * sc, cy - 52 * sc, cx - 93 * sc, cy - 48 * sc, rng, { stroke: pal.accent, strokeWidth: 1.8 })
      );
      break;
    }

    case 'matryoshka': {
      // 4 Nested Enforcement Russian Dolls stepping down in scale!
      const dolls = [
        { x: cx - 155 * sc, r: 46 * sc, h: 108 * sc, label: 'FRAUD', fill: pal.paperCard },
        { x: cx - 45 * sc, r: 38 * sc, h: 88 * sc, label: 'AGENCY', fill: pal.paperAlt },
        { x: cx + 52 * sc, r: 30 * sc, h: 70 * sc, label: 'BRIBE', fill: pal.accentWash },
        { x: cx + 132 * sc, r: 22 * sc, h: 52 * sc, label: 'STING', fill: pal.paperCard },
      ];
      // Connecting dashed nesting line
      body.push(
        `<line x1="${f(dolls[0].x)}" y1="${f(cy + 68 * sc)}" x2="${f(dolls[3].x)}" y2="${f(cy + 68 * sc)}" stroke="${pal.rule}" stroke-width="1.2" stroke-dasharray="4 3"/>`
      );
      dolls.forEach((d, idx) => {
        const baseY = cy + 68 * sc;
        const headY = baseY - d.h * 0.78;
        body.push(
          // Shadow ellipse
          `<ellipse cx="${f(d.x)}" cy="${f(baseY)}" rx="${f(d.r * 0.85)}" ry="${f(d.r * 0.28)}" fill="${pal.ruleLight}" opacity="0.7"/>`,
          // Lower body
          `<path d="M ${f(d.x - d.r)} ${f(baseY - d.h * 0.32)} C ${f(d.x - d.r)} ${f(baseY + 4)}, ${f(d.x + d.r)} ${f(baseY + 4)}, ${f(d.x + d.r)} ${f(baseY - d.h * 0.32)} C ${f(d.x + d.r * 0.88)} ${f(baseY - d.h * 0.65)}, ${f(d.x - d.r * 0.88)} ${f(baseY - d.h * 0.65)}, ${f(d.x - d.r)} ${f(baseY - d.h * 0.32)} Z" fill="${d.fill}" stroke="${pal.ink}" stroke-width="1.6"/>`,
          // Split seam
          `<line x1="${f(d.x - d.r * 0.92)}" y1="${f(baseY - d.h * 0.34)}" x2="${f(d.x + d.r * 0.92)}" y2="${f(baseY - d.h * 0.34)}" stroke="${idx === 2 ? pal.accent : pal.ink}" stroke-width="${idx === 2 ? 2.2 : 1.2}"/>`,
          // Head
          sketchEllipseSvg(d.x, headY, d.r * 0.56, d.r * 0.54, rng, { fill: pal.paperCard, stroke: pal.ink, strokeWidth: 1.5 }),
          `<text x="${f(d.x)}" y="${f(baseY - d.h * 0.14)}" text-anchor="middle" fill="${idx === 2 ? pal.accent : pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="${f(Math.max(8, 10.5 - idx) * sc)}" font-weight="700">${d.label}</text>`
        );
      });
      break;
    }
  }

  return `<g class="fc-vignette-scene">${body.join('')}</g>`;
}
