import { renderStippleIconSvg } from '../shared/icons';
import {
  normalizeEditorialVignette,
  normalizeFlightMap,
  normalizePenaltyWheel,
  normalizePonziPyramid,
  normalizePumpDumpTicker,
  normalizeRedactedDossier,
  normalizeScaleOfImpunity,
  normalizeShellNetwork,
  resolveArchetype,
} from '../shared/normalize';
import { EDITORIAL_FONTS, getPalette, getViewBox } from '../shared/palette';
import { createPrng, hashString } from '../shared/prng';
import {
  buildEditorialDefs,
  buildPlateFrame,
  escapeXml,
  f,
  letterpressStampSvg,
  sketchEllipseSvg,
  sketchLineSvg,
  sketchRectSvg,
  truncate,
} from '../shared/rough-helpers';
import { renderVignetteSceneSvg } from '../shared/scenes';
import type { ArtAspect, ArtMode, InteractiveArtSpec } from '../shared/types';
import { continentPathsSvg, createMapProjection } from '../shared/world-map';

/**
 * Pure Node-safe build-time static SVG renderer for all 8 interactive archetypes.
 * Guarantees CLS = 0.000, <noscript> support, and 0ms JS cost on mode="thumb" cards.
 */
export function renderStaticArtSvg(
  spec: InteractiveArtSpec,
  seed: string,
  mode: ArtMode = 'inline',
  aspect: ArtAspect = '16/9'
): string {
  const archetype = resolveArchetype(spec?.archetype);
  const pal = getPalette(spec?.accent, spec?.theme);
  const { width, height } = getViewBox(aspect);
  const rng = createPrng(`${seed}:${archetype}`);
  const uid = hashString(`${seed}:${archetype}:${mode}:${aspect}`).toString(36).slice(0, 7);
  const compact = mode === 'thumb';

  const defs = buildEditorialDefs(uid, pal);
  const contentBox = compact
    ? { x: 24, y: 24, w: width - 48, h: height - 48 }
    : { x: 40, y: 112, w: width - 80, h: height - 150 };

  let frame = '';
  let artwork = '';

  switch (archetype) {
    case 'shell-network': {
      const data = normalizeShellNetwork(spec);
      frame = buildPlateFrame(width, height, pal, {
        compact,
        kicker: 'FORENSIC ENTITY GRAPH',
        title: data.title,
        subtitle: data.subtitle,
        plateNo: 'FIG. I',
      });
      artwork = renderShellNetworkStatic(data, contentBox, pal, rng, uid, compact);
      break;
    }
    case 'scale-of-impunity': {
      const data = normalizeScaleOfImpunity(spec);
      frame = buildPlateFrame(width, height, pal, {
        compact,
        kicker: 'BALANCE OF PENALTIES',
        title: data.title,
        subtitle: data.subtitle,
        plateNo: 'FIG. II',
      });
      artwork = renderScaleStatic(data, contentBox, pal, rng, uid, compact);
      break;
    }
    case 'redacted-dossier': {
      const data = normalizeRedactedDossier(spec);
      frame = buildPlateFrame(width, height, pal, {
        compact,
        kicker: data.exhibitLabel,
        title: data.subject,
        subtitle: data.subtitle,
        plateNo: data.docketNumber,
      });
      artwork = renderDossierStatic(data, contentBox, pal, rng, compact);
      break;
    }
    case 'pump-dump-ticker': {
      const data = normalizePumpDumpTicker(spec);
      frame = buildPlateFrame(width, height, pal, {
        compact,
        kicker: `MARKET FORENSICS // ${data.ticker}`,
        title: data.title,
        subtitle: data.drawdownLabel,
        plateNo: 'FIG. IV',
      });
      artwork = renderTickerStatic(data, contentBox, pal, rng, uid, compact);
      break;
    }
    case 'ponzi-pyramid': {
      const data = normalizePonziPyramid(spec);
      frame = buildPlateFrame(width, height, pal, {
        compact,
        kicker: 'LIQUIDITY STRUCTURE',
        title: data.title,
        subtitle: `${data.promisedReturn} · ${data.totalRaised}`,
        plateNo: 'FIG. V',
      });
      artwork = renderPonziStatic(data, contentBox, pal, rng, uid, compact);
      break;
    }
    case 'offshore-flight-map': {
      const data = normalizeFlightMap(spec);
      frame = buildPlateFrame(width, height, pal, {
        compact,
        kicker: 'CROSS-BORDER WIRE & ASSET TRACE',
        title: data.title,
        subtitle: data.subtitle,
        plateNo: 'FIG. VI',
      });
      artwork = renderMapStatic(data, contentBox, pal, rng, uid, compact);
      break;
    }
    case 'editorial-vignette': {
      const data = normalizeEditorialVignette(spec);
      frame = buildPlateFrame(width, height, pal, {
        compact,
        kicker: 'ISOMETRIC DOCKET PLATE',
        title: data.title,
        subtitle: data.subtitle,
        plateNo: 'FIG. VII',
      });
      artwork = renderVignetteStatic(data, contentBox, pal, rng, uid, compact);
      break;
    }
    case 'penalty-wheel': {
      const data = normalizePenaltyWheel(spec);
      frame = buildPlateFrame(width, height, pal, {
        compact,
        kicker: 'DETERRENCE PRESSURE GAUGE',
        title: data.title,
        subtitle: data.subtitle,
        plateNo: 'FIG. VIII',
      });
      artwork = renderPenaltyWheelStatic(data, contentBox, pal, rng, compact);
      break;
    }
  }

  const ariaLabel = escapeXml(spec?.caption || `${archetype} editorial illustration`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="fc-art-svg" role="img" aria-label="${ariaLabel}" preserveAspectRatio="xMidYMid meet">${defs}${frame}${artwork}</svg>`;
}

// ---------------------------------------------------------------------------
// 1. SHELL NETWORK STATIC
// ---------------------------------------------------------------------------
function renderShellNetworkStatic(
  data: ReturnType<typeof normalizeShellNetwork>,
  box: { x: number; y: number; w: number; h: number },
  pal: ReturnType<typeof getPalette>,
  rng: ReturnType<typeof createPrng>,
  uid: string,
  compact: boolean
): string {
  const nodes = data.nodes.slice(0, compact ? 4 : 7);
  const cols = Math.min(3, Math.max(2, Math.ceil(nodes.length / 2)));
  const rows = Math.ceil(nodes.length / cols);
  const nodeW = compact ? Math.min(180, box.w * 0.38) : Math.min(186, (box.w - 40) / cols - 22);
  const nodeH = compact ? Math.min(82, box.h * 0.25) : Math.min(76, (box.h - 32) / rows - 26);

  const posMap = new Map<string, { cx: number; cy: number }>();
  nodes.forEach((n, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const colCount = row === rows - 1 ? nodes.length - row * cols : cols;
    const cellW = box.w / Math.max(1, colCount);
    const cellH = box.h / Math.max(1, rows);
    const cx = typeof n.x === 'number' ? box.x + (n.x / 100) * box.w : box.x + cellW * (col + 0.5) + rng.jitter(10);
    const cy = typeof n.y === 'number' ? box.y + (n.y / 100) * box.h : box.y + cellH * (row + 0.5) + rng.jitter(8);
    posMap.set(n.id, { cx, cy });
  });

  const edgesSvg = data.edges
    .map((e, idx) => {
      const a = posMap.get(e.from);
      const b = posMap.get(e.to);
      if (!a || !b) return '';
      const mx = (a.cx + b.cx) / 2;
      const my = (a.cy + b.cy) / 2 - (idx % 2 === 0 ? 24 : -24);
      const isAcc = idx === 0 || Boolean(e.amount);
      return `
        <path d="M ${f(a.cx)} ${f(a.cy)} Q ${f(mx)} ${f(my)} ${f(b.cx)} ${f(b.cy)}" fill="none" stroke="${isAcc ? pal.accent : pal.ink}" stroke-width="${compact ? 2.2 : 1.7}" stroke-dasharray="${e.dashed ? '6 4' : '8 4'}" marker-end="url(#${isAcc ? 'arrow-accent' : 'arrow'}-${uid})" opacity="0.88"/>
        ${!compact && e.amount ? `<rect x="${f(mx - 34)}" y="${f(my - 10)}" width="68" height="17" fill="${pal.paper}" stroke="${pal.ruleLight}" stroke-width="0.7"/><text x="${f(mx)}" y="${f(my + 2)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700">${escapeXml(truncate(e.amount, 11))}</text>` : ''}
      `;
    })
    .join('');

  const nodesSvg = nodes
    .map((n, idx) => {
      const p = posMap.get(n.id)!;
      const x = p.cx - nodeW / 2;
      const y = p.cy - nodeH / 2;
      const isPrimary = idx === 0 || n.kind === 'asset';
      return `
        <g>
          ${sketchRectSvg(x, y, nodeW, nodeH, rng, {
            fill: isPrimary ? pal.paperCard : pal.paper,
            stroke: isPrimary ? pal.accent : pal.ink,
            strokeWidth: isPrimary ? 1.8 : 1.35,
            hachure: n.kind === 'shell' || idx === 1,
            hachureColor: isPrimary ? pal.accent : pal.ink,
            doubleBorder: isPrimary,
          })}
          <text x="${f(p.cx)}" y="${f(y + (compact ? nodeH * 0.48 : 26))}" text-anchor="middle" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.serif}" font-size="${compact ? 16 : 13}" font-weight="700">${escapeXml(truncate(n.label, compact ? 15 : 22))}</text>
          ${
            !compact
              ? `<text x="${f(p.cx)}" y="${f(y + 44)}" text-anchor="middle" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.sans}" font-size="9.5" letter-spacing="0.4">${escapeXml(truncate(n.jurisdiction || n.role || 'ENTITY', 22).toUpperCase())}</text>`
              : ''
          }
          ${
            n.amount
              ? `<text x="${f(p.cx)}" y="${f(y + (compact ? nodeH * 0.78 : 61))}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="${compact ? 14 : 11}" font-weight="700">${escapeXml(truncate(n.amount, 16))}</text>`
              : ''
          }
        </g>
      `;
    })
    .join('');

  return `<g>${edgesSvg}${nodesSvg}</g>`;
}

// ---------------------------------------------------------------------------
// 2. SCALE OF IMPUNITY STATIC
// ---------------------------------------------------------------------------
function renderScaleStatic(
  data: ReturnType<typeof normalizeScaleOfImpunity>,
  box: { x: number; y: number; w: number; h: number },
  pal: ReturnType<typeof getPalette>,
  rng: ReturnType<typeof createPrng>,
  uid: string,
  compact: boolean
): string {
  const cx = box.x + box.w * 0.5;
  const baseY = box.y + box.h * (compact ? 0.84 : 0.8);
  const pillarTopY = box.y + box.h * (compact ? 0.2 : 0.22);
  const beamHalf = Math.min(box.w * 0.34, 210);

  // Tilt dramatically based on loot vs fine ratio (heavier left = negative angle)
  const ratio = Math.min(1, Math.max(0.01, data.ratioPct / 100));
  const tiltRad = -(0.16 + (1 - Math.sqrt(ratio)) * 0.16);
  const lx = cx - Math.cos(tiltRad) * beamHalf;
  const ly = pillarTopY + 18 - Math.sin(tiltRad) * beamHalf;
  const rx = cx + Math.cos(tiltRad) * beamHalf;
  const ry = pillarTopY + 18 + Math.sin(tiltRad) * beamHalf;

  const chainLen = box.h * 0.24;
  const panW = compact ? 105 : 136;

  return `
    <g>
      <!-- Plinth base -->
      ${sketchRectSvg(cx - 72, baseY - 14, 144, 16, rng, { fill: pal.inkSoft, stroke: pal.ink })}
      ${sketchRectSvg(cx - 48, baseY - 28, 96, 14, rng, { fill: pal.paperAlt, stroke: pal.ink, hachure: true })}
      <!-- Central brass-and-ink column -->
      ${sketchRectSvg(cx - 8, pillarTopY, 16, baseY - 28 - pillarTopY, rng, { fill: pal.paperCard, stroke: pal.ink, hachure: true, hachureColor: pal.brass })}
      ${sketchEllipseSvg(cx, pillarTopY, 14, 14, rng, { fill: pal.brassLight, stroke: pal.ink, strokeWidth: 1.6 })}

      <!-- Tilted Balance Beam -->
      ${sketchLineSvg(lx, ly, rx, ry, rng, { stroke: pal.ink, strokeWidth: 4.5, doublePass: true })}
      <circle cx="${f(lx)}" cy="${f(ly)}" r="5" fill="${pal.brass}" stroke="${pal.ink}" stroke-width="1.3"/>
      <circle cx="${f(rx)}" cy="${f(ry)}" r="5" fill="${pal.brass}" stroke="${pal.ink}" stroke-width="1.3"/>

      <!-- Left Pan (Heavy Loot Stack) -->
      ${sketchLineSvg(lx, ly, lx - panW * 0.4, ly + chainLen, rng, { stroke: pal.ink, strokeWidth: 1.2 })}
      ${sketchLineSvg(lx, ly, lx + panW * 0.4, ly + chainLen, rng, { stroke: pal.ink, strokeWidth: 1.2 })}
      ${sketchRectSvg(lx - panW * 0.34, ly + chainLen - 54, panW * 0.68, 52, rng, { fill: pal.paperCard, stroke: pal.ink, strokeWidth: 1.7, hachure: true, crossHatch: true })}
      ${sketchRectSvg(lx - panW * 0.26, ly + chainLen - 78, panW * 0.52, 24, rng, { fill: pal.paperAlt, stroke: pal.ink, strokeWidth: 1.5, hachure: true })}
      <path d="M ${f(lx - panW * 0.48)} ${f(ly + chainLen)} Q ${f(lx)} ${f(ly + chainLen + 26)} ${f(lx + panW * 0.48)} ${f(ly + chainLen)} Z" fill="${pal.brassLight}" stroke="${pal.ink}" stroke-width="1.6"/>
      <text x="${f(lx)}" y="${f(ly + chainLen - 22)}" text-anchor="middle" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="${compact ? 16 : 15}" font-weight="700">${escapeXml(truncate(data.lootDisplay, 12))}</text>
      ${!compact ? `<text x="${f(lx)}" y="${f(ly + chainLen + 38)}" text-anchor="middle" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.sans}" font-size="10.5" font-weight="700">${escapeXml(truncate(data.lootLabel.toUpperCase(), 24))}</text>` : ''}

      <!-- Right Pan (Light Fine Weight) -->
      ${sketchLineSvg(rx, ry, rx - panW * 0.4, ry + chainLen, rng, { stroke: pal.ink, strokeWidth: 1.2 })}
      ${sketchLineSvg(rx, ry, rx + panW * 0.4, ry + chainLen, rng, { stroke: pal.ink, strokeWidth: 1.2 })}
      ${sketchRectSvg(rx - 22, ry + chainLen - 20, 44, 18, rng, { fill: pal.accentWash, stroke: pal.accent, strokeWidth: 1.7 })}
      <path d="M ${f(rx - panW * 0.48)} ${f(ry + chainLen)} Q ${f(rx)} ${f(ry + chainLen + 26)} ${f(rx + panW * 0.48)} ${f(ry + chainLen)} Z" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="1.6"/>
      <text x="${f(rx)}" y="${f(ry + chainLen - 28)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="${compact ? 15 : 14}" font-weight="700">${escapeXml(truncate(data.fineDisplay, 12))}</text>
      ${!compact ? `<text x="${f(rx)}" y="${f(ry + chainLen + 38)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.sans}" font-size="10.5" font-weight="700">${escapeXml(truncate(data.fineLabel.toUpperCase(), 24))}</text>` : ''}

      <!-- Crimson Ratio Stamp -->
      ${letterpressStampSvg(cx + (compact ? 0 : box.w * 0.14), compact ? box.y + 42 : baseY - 56, compact ? data.ratioDisplay : `${data.ratioDisplay}`, pal.accent, -6, compact ? 14 : 13)}

      <!-- Subtle architectural backing pattern -->
      <rect x="${f(box.x)}" y="${f(baseY + 2)}" width="${f(box.w)}" height="4" fill="url(#hatch-${uid})"/>
    </g>
  `;
}

// ---------------------------------------------------------------------------
// 3. REDACTED DOSSIER STATIC
// ---------------------------------------------------------------------------
function renderDossierStatic(
  data: ReturnType<typeof normalizeRedactedDossier>,
  box: { x: number; y: number; w: number; h: number },
  pal: ReturnType<typeof getPalette>,
  rng: ReturnType<typeof createPrng>,
  compact: boolean
): string {
  if (compact) {
    const iconSize = Math.min(box.w, box.h) * 0.56;
    const cx = box.x + box.w * 0.5;
    const cy = box.y + box.h * 0.42;
    return `
      <g>
        ${renderStippleIconSvg(data.icon, cx, cy, iconSize, pal, rng)}
        <rect x="${f(box.x + box.w * 0.14)}" y="${f(box.y + box.h * 0.77)}" width="${f(box.w * 0.72)}" height="16" fill="${pal.ink}"/>
        <rect x="${f(box.x + box.w * 0.22)}" y="${f(box.y + box.h * 0.85)}" width="${f(box.w * 0.48)}" height="12" fill="${pal.accent}"/>
      </g>
    `;
  }

  const isTall = box.h > box.w * 0.9;
  const iconSize = isTall ? Math.min(185, box.w * 0.38) : Math.min(195, box.h * 0.54);
  const iconCx = isTall ? box.x + box.w * 0.5 : box.x + iconSize * 0.64;
  const iconCy = isTall ? box.y + iconSize * 0.54 : box.y + box.h * 0.46;

  const textX = isTall ? box.x + 18 : box.x + iconSize + 36;
  const textY = isTall ? box.y + iconSize + 34 : box.y + 18;
  const textW = isTall ? box.w - 36 : box.w - iconSize - 46;

  const lines: string[] = [];
  const visibleExcerpts = data.excerpts.slice(0, isTall ? 3 : 3);
  const rowH = Math.min(92, (box.y + box.h - textY - 24) / Math.max(1, visibleExcerpts.length));

  visibleExcerpts.forEach((ex, i) => {
    const y = textY + i * rowH;
    const fullPrefix = truncate(ex.prefix || '', 38);
    const barW = Math.min(textW - 24, Math.max(130, ex.redacted.length * 6.5));
    lines.push(`
      <g>
        <text x="${f(textX)}" y="${f(y + 12)}" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700" letter-spacing="0.8">${escapeXml(ex.label || `EXHIBIT ${i + 1}`)}</text>
        ${fullPrefix ? `<text x="${f(textX)}" y="${f(y + 30)}" fill="${pal.inkSoft}" font-family="${EDITORIAL_FONTS.serif}" font-size="12.5">${escapeXml(fullPrefix)}</text>` : ''}
        <rect x="${f(textX)}" y="${f(y + (fullPrefix ? 37 : 20))}" width="${f(barW)}" height="20" fill="${pal.ink}" rx="1"/>
        <text x="${f(textX + 8)}" y="${f(y + (fullPrefix ? 51 : 34))}" fill="${pal.paperAlt}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" letter-spacing="1.2" opacity="0.72">[ REDACTED — HOVER TO DECLASSIFY ]</text>
        <line x1="${f(textX)}" y1="${f(y + rowH - 10)}" x2="${f(textX + textW)}" y2="${f(y + rowH - 10)}" stroke="${pal.ruleLight}" stroke-width="0.8" stroke-dasharray="3 3"/>
      </g>
    `);
  });

  return `
    <g>
      ${renderStippleIconSvg(data.icon, iconCx, iconCy, iconSize, pal, rng)}
      ${lines.join('')}
      ${letterpressStampSvg(box.x + box.w - 86, box.y + box.h - 28, data.stamp, pal.accent, -7, 11.5)}
    </g>
  `;
}

// ---------------------------------------------------------------------------
// 4. PUMP-DUMP TICKER STATIC
// ---------------------------------------------------------------------------
function renderTickerStatic(
  data: ReturnType<typeof normalizePumpDumpTicker>,
  box: { x: number; y: number; w: number; h: number },
  pal: ReturnType<typeof getPalette>,
  rng: ReturnType<typeof createPrng>,
  uid: string,
  compact: boolean
): string {
  const padL = compact ? 12 : 52;
  const padR = compact ? 12 : 24;
  const padT = compact ? 22 : 24;
  const padB = compact ? 18 : 42;
  const cw = box.w - padL - padR;
  const ch = box.h - padT - padB;
  const ox = box.x + padL;
  const oy = box.y + padT;

  const vals = data.points.map((p) => p.value);
  const minV = Math.min(...vals) * 0.94;
  const maxV = Math.max(...vals) * 1.06;
  const span = Math.max(0.001, maxV - minV);

  const coords = data.points.map((p, i) => {
    const x = ox + (i / Math.max(1, data.points.length - 1)) * cw;
    const y = oy + (1 - (p.value - minV) / span) * ch;
    return { x, y, ...p };
  });

  // Gridlines
  const grid: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const gy = oy + (i / 4) * ch;
    const gv = maxV - (i / 4) * span;
    grid.push(`<line x1="${f(ox)}" y1="${f(gy)}" x2="${f(ox + cw)}" y2="${f(gy)}" stroke="${pal.ruleLight}" stroke-width="0.8"/>`);
    if (!compact) {
      grid.push(
        `<text x="${f(ox - 8)}" y="${f(gy + 3.5)}" text-anchor="end" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5">${escapeXml(data.currency + Math.round(gv).toLocaleString())}</text>`
      );
    }
  }

  // Drawdown crosshatch fill polygon between peak and trough
  const peak = coords[data.peakIndex] || coords[0];
  const trough = coords[data.troughIndex] || coords[coords.length - 1];
  const dropSlice = coords.slice(data.peakIndex, data.troughIndex + 1);
  const dropPoly =
    dropSlice.length >= 2
      ? `${dropSlice.map((p) => `${f(p.x)},${f(p.y)}`).join(' ')} ${f(trough.x)},${f(oy + ch)} ${f(peak.x)},${f(oy + ch)}`
      : '';

  const lineD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`).join(' ');

  const pins = compact
    ? `<circle cx="${f(peak.x)}" cy="${f(peak.y)}" r="7" fill="${pal.accent}" stroke="${pal.paper}" stroke-width="2"/>`
    : data.events
        .slice(0, 4)
        .map((ev, idx) => {
          const pt = coords[ev.index] || coords[0];
          const stemUp = pt.y > oy + ch * 0.36;
          const ly = stemUp ? Math.max(oy + 14, pt.y - 42 - (idx % 2) * 16) : Math.min(oy + ch - 18, pt.y + 38);
          const alignRight = pt.x > ox + cw * 0.72;
          return `
            <g>
              <line x1="${f(pt.x)}" y1="${f(pt.y)}" x2="${f(pt.x)}" y2="${f(ly)}" stroke="${pal.accent}" stroke-width="1.2" stroke-dasharray="3 2"/>
              <circle cx="${f(pt.x)}" cy="${f(pt.y)}" r="4.5" fill="${pal.accent}" stroke="${pal.paper}" stroke-width="1.5"/>
              <text x="${f(pt.x + (alignRight ? -6 : 6))}" y="${f(ly + 3)}" text-anchor="${alignRight ? 'end' : 'start'}" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.sans}" font-size="10.5" font-weight="700">${escapeXml(truncate(ev.label, 22))}</text>
            </g>
          `;
        })
        .join('');

  const xTicks = compact
    ? ''
    : [0, Math.floor((coords.length - 1) / 2), coords.length - 1]
        .map(
          (i) =>
            `<text x="${f(coords[i].x)}" y="${f(oy + ch + 18)}" text-anchor="${i === 0 ? 'start' : i === coords.length - 1 ? 'end' : 'middle'}" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5">${escapeXml(coords[i].label)}</text>`
        )
        .join('');

  return `
    <g>
      ${grid.join('')}
      ${dropPoly ? `<polygon points="${dropPoly}" fill="url(#hatch-accent-${uid})" opacity="0.85"/>` : ''}
      ${sketchLineSvg(ox, oy + ch, ox + cw, oy + ch, rng, { stroke: pal.rule, strokeWidth: 1.4 })}
      <path d="${lineD}" fill="none" stroke="${pal.ink}" stroke-width="${compact ? 3.2 : 2.3}" stroke-linejoin="round" stroke-linecap="round"/>
      ${pins}
      ${xTicks}
    </g>
  `;
}

// ---------------------------------------------------------------------------
// 5. PONZI PYRAMID STATIC
// ---------------------------------------------------------------------------
function renderPonziStatic(
  data: ReturnType<typeof normalizePonziPyramid>,
  box: { x: number; y: number; w: number; h: number },
  pal: ReturnType<typeof getPalette>,
  rng: ReturnType<typeof createPrng>,
  uid: string,
  compact: boolean
): string {
  const tiers = data.tiers;
  const count = tiers.length;
  const gap = compact ? 6 : 8;
  const tierH = (box.h - (count - 1) * gap - (compact ? 6 : 26)) / count;
  const cx = box.x + box.w * 0.5;
  const maxW = box.w * 0.9;
  const minW = box.w * 0.34;

  const blocks = tiers
    .map((t, i) => {
      const frac = count > 1 ? i / (count - 1) : 1;
      const w = minW + (maxW - minW) * frac;
      const x = cx - w / 2;
      const y = box.y + i * (tierH + gap);
      const isTop = i === 0;
      const isBase = i === count - 1;
      return `
        <g>
          ${sketchRectSvg(x, y, w, tierH, rng, {
            fill: isTop ? pal.accentWash : isBase ? pal.paperAlt : pal.paperCard,
            stroke: isTop ? pal.accent : pal.ink,
            strokeWidth: isTop || isBase ? 1.8 : 1.35,
            hachure: isBase,
            hachureColor: pal.ink,
          })}
          <text x="${f(cx)}" y="${f(y + tierH * (compact ? 0.58 : 0.44))}" text-anchor="middle" fill="${isTop ? pal.accent : pal.ink}" font-family="${EDITORIAL_FONTS.serif}" font-size="${compact ? 14 : 13.5}" font-weight="700">${escapeXml(truncate(t.label, compact ? 18 : 30))}</text>
          ${
            !compact
              ? `<text x="${f(cx)}" y="${f(y + tierH * 0.76)}" text-anchor="middle" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.mono}" font-size="10.5">IN: ${escapeXml(t.inflow)}  ·  OUT: ${escapeXml(t.payout)}</text>`
              : ''
          }
        </g>
      `;
    })
    .join('');

  return `
    <g>
      ${blocks}
      ${!compact ? `<line x1="${f(box.x + 12)}" y1="${f(box.y + box.h - 10)}" x2="${f(box.x + box.w - 12)}" y2="${f(box.y + box.h - 10)}" stroke="${pal.rule}" stroke-width="1.3"/>` : ''}
      <rect x="${f(box.x + 12)}" y="${f(box.y + box.h - 8)}" width="${f(box.w - 24)}" height="5" fill="url(#hatch-${uid})"/>
    </g>
  `;
}

// ---------------------------------------------------------------------------
// 6. OFFSHORE FLIGHT MAP STATIC
// ---------------------------------------------------------------------------
function renderMapStatic(
  data: ReturnType<typeof normalizeFlightMap>,
  box: { x: number; y: number; w: number; h: number },
  pal: ReturnType<typeof getPalette>,
  rng: ReturnType<typeof createPrng>,
  uid: string,
  compact: boolean
): string {
  const proj = createMapProjection(data.waypoints, data.region, box);
  const clipId = `mapclip-${uid}`;

  // Graticule lines
  const grat: string[] = [];
  for (let i = 1; i < 4; i++) {
    const gy = box.y + (box.h * i) / 4;
    const gx = box.x + (box.w * i) / 4;
    grat.push(
      `<line x1="${f(box.x)}" y1="${f(gy)}" x2="${f(box.x + box.w)}" y2="${f(gy)}" stroke="${pal.ruleLight}" stroke-width="0.65" stroke-dasharray="3 4"/>`,
      `<line x1="${f(gx)}" y1="${f(box.y)}" x2="${f(gx)}" y2="${f(box.y + box.h)}" stroke="${pal.ruleLight}" stroke-width="0.65" stroke-dasharray="3 4"/>`
    );
  }

  const wpMap = new Map<string, { x: number; y: number; wp: (typeof data.waypoints)[number] }>();
  data.waypoints.forEach((wp) => {
    const [x, y] = proj.project(wp.lon, wp.lat);
    wpMap.set(wp.id, { x, y, wp });
  });

  const routesSvg = data.routes
    .map((r, idx) => {
      const a = wpMap.get(r.from);
      const b = wpMap.get(r.to);
      if (!a || !b) return '';
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const lift = Math.min(72, dist * 0.24) * (idx % 2 === 0 ? 1 : -0.8);
      const mx = (a.x + b.x) / 2 - (dy / dist) * lift;
      const my = (a.y + b.y) / 2 + (dx / dist) * lift;
      return `<path d="M ${f(a.x)} ${f(a.y)} Q ${f(mx)} ${f(my)} ${f(b.x)} ${f(b.y)}" fill="none" stroke="${pal.accent}" stroke-width="${compact ? 2.4 : 1.9}" stroke-dasharray="${r.loop ? '5 3' : '7 4'}" marker-end="url(#arrow-accent-${uid})"/>`;
    })
    .join('');

  const pinsSvg = Array.from(wpMap.values())
    .map(({ x, y, wp }) => {
      return `
        <g>
          <circle cx="${f(x)}" cy="${f(y)}" r="${compact ? 7 : 5.5}" fill="${pal.paperCard}" stroke="${pal.accent}" stroke-width="2.2"/>
          <circle cx="${f(x)}" cy="${f(y)}" r="2" fill="${pal.ink}"/>
          ${!compact ? `<text x="${f(x + 9)}" y="${f(y + 3.5)}" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.sans}" font-size="10.5" font-weight="700">${escapeXml(truncate(wp.label, 16))}</text>` : ''}
        </g>
      `;
    })
    .join('');

  return `
    <g>
      <defs><clipPath id="${clipId}"><rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}"/></clipPath></defs>
      <rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" fill="${pal.paperAlt}" opacity="0.45"/>
      <g clip-path="url(#${clipId})">
        ${grat.join('')}
        ${continentPathsSvg(proj, { fill: pal.paperCard, stroke: pal.inkMuted, hatchId: `hatch-${uid}` })}
        ${routesSvg}
        ${pinsSvg}
      </g>
      ${sketchRectSvg(box.x, box.y, box.w, box.h, rng, { stroke: pal.rule, strokeWidth: 1.2 })}
    </g>
  `;
}

// ---------------------------------------------------------------------------
// 7. EDITORIAL VIGNETTE STATIC
// ---------------------------------------------------------------------------
function renderVignetteStatic(
  data: ReturnType<typeof normalizeEditorialVignette>,
  box: { x: number; y: number; w: number; h: number },
  pal: ReturnType<typeof getPalette>,
  rng: ReturnType<typeof createPrng>,
  uid: string,
  compact: boolean
): string {
  const sceneSvg = renderVignetteSceneSvg(data.scene, box, pal, rng, uid, false);
  const pins = compact
    ? ''
    : data.hotspots
        .map((h, i) => {
          const hx = box.x + ((h.x ?? 50) / 100) * box.w;
          const hy = box.y + ((h.y ?? 50) / 100) * box.h;
          return `
            <g>
              <circle cx="${f(hx)}" cy="${f(hy)}" r="12" fill="${pal.paperCard}" stroke="${pal.accent}" stroke-width="1.8"/>
              <text x="${f(hx)}" y="${f(hy + 4)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="11" font-weight="700">${i + 1}</text>
            </g>
          `;
        })
        .join('');

  return `<g>${sceneSvg}${pins}</g>`;
}

// ---------------------------------------------------------------------------
// 8. PENALTY WHEEL STATIC
// ---------------------------------------------------------------------------
function renderPenaltyWheelStatic(
  data: ReturnType<typeof normalizePenaltyWheel>,
  box: { x: number; y: number; w: number; h: number },
  pal: ReturnType<typeof getPalette>,
  rng: ReturnType<typeof createPrng>,
  compact: boolean
): string {
  const cx = box.x + box.w * 0.5;
  const r = Math.min(box.w * 0.4, box.h * (compact ? 0.56 : 0.52));
  const cy = box.y + box.h * (compact ? 0.72 : 0.66);

  const arcPoint = (deg: number, rad: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
  };

  const arcSegment = (startDeg: number, endDeg: number, rad: number): string => {
    const [x1, y1] = arcPoint(startDeg, rad);
    const [x2, y2] = arcPoint(endDeg, rad);
    return `M ${f(x1)} ${f(y1)} A ${f(rad)} ${f(rad)} 0 0 1 ${f(x2)} ${f(y2)}`;
  };

  const ticks: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const deg = 180 + i * 9;
    const major = i % 5 === 0;
    const [x1, y1] = arcPoint(deg, r * (major ? 0.78 : 0.85));
    const [x2, y2] = arcPoint(deg, r * 0.94);
    ticks.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${pal.ink}" stroke-width="${major ? 2 : 1}"/>`);
  }

  const needleDeg = 180 + (data.score / 100) * 180;
  const [nx, ny] = arcPoint(needleDeg, r * 0.76);

  return `
    <g>
      <!-- Outer vintage brass casing -->
      <path d="${arcSegment(180, 360, r)} L ${f(cx + r)} ${f(cy + 14)} L ${f(cx - r)} ${f(cy + 14)} Z" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="2"/>
      <!-- 3 colored deterrence arcs -->
      <path d="${arcSegment(180, 239, r * 0.88)}" fill="none" stroke="${pal.sage}" stroke-width="${compact ? 12 : 14}" opacity="0.65"/>
      <path d="${arcSegment(241, 299, r * 0.88)}" fill="none" stroke="${pal.gold}" stroke-width="${compact ? 12 : 14}" opacity="0.72"/>
      <path d="${arcSegment(301, 360, r * 0.88)}" fill="none" stroke="${pal.accent}" stroke-width="${compact ? 12 : 14}" opacity="0.82"/>
      ${ticks.join('')}

      ${
        !compact
          ? `
        <text x="${f(cx - r * 0.94)}" y="${f(cy + 30)}" text-anchor="start" fill="${pal.sage}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700">ACTUAL DETERRENT</text>
        <text x="${f(cx)}" y="${f(cy - r - 12)}" text-anchor="middle" fill="${pal.gold}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700">COST OF DOING BUSINESS</text>
        <text x="${f(cx + r * 0.94)}" y="${f(cy + 30)}" text-anchor="end" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700">ROUNDING ERROR</text>
      `
          : ''
      }

      <!-- Needle -->
      ${sketchLineSvg(cx, cy, nx, ny, rng, { stroke: pal.accent, strokeWidth: 3.5 })}
      ${sketchEllipseSvg(cx, cy, 11, 11, rng, { fill: pal.brass, stroke: pal.ink, strokeWidth: 1.8 })}

      <!-- Engraved brass score plaque -->
      <text x="${f(cx)}" y="${f(cy + (compact ? 42 : 52))}" text-anchor="middle" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="${compact ? 22 : 24}" font-weight="700">${data.score}/100</text>
      <text x="${f(cx)}" y="${f(cy + (compact ? 60 : 72))}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.sans}" font-size="${compact ? 11 : 12}" font-weight="700" letter-spacing="1.2">${escapeXml(data.verdict)}</text>
    </g>
  `;
}
