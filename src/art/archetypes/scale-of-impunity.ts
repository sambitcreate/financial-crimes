import { applyStagePalette, createEl, startManagedRaf } from '../shared/dom-ui';
import { normalizeScaleOfImpunity } from '../shared/normalize';
import { EDITORIAL_FONTS, getPalette, getViewBox } from '../shared/palette';
import { createPrng, hashString } from '../shared/prng';
import {
  buildEditorialDefs,
  buildPlateFrame,
  escapeXml,
  f,
  letterpressStampSvg,
  sketchEllipseSvg,
  sketchRectSvg,
  truncate,
} from '../shared/rough-helpers';
import type { InteractiveArtSpec, MountOptions } from '../shared/types';

type CompareMode = 'loot-fine' | 'street' | 'pct';

export function mount(container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions): void {
  const data = normalizeScaleOfImpunity(spec);
  const pal = getPalette(spec.accent, spec.theme);
  const { width, height } = getViewBox(opts.aspect ?? '16/9');
  const uid = hashString(`${opts.seed}:scale-live`).toString(36).slice(0, 7);

  container.innerHTML = '';
  const stage = createEl('div', 'fc-stage fc-stage-scale');
  applyStagePalette(stage, pal);

  const svgWrap = createEl('div', 'fc-stage-canvas');
  stage.appendChild(svgWrap);

  const toolbar = createEl('div', 'fc-inline-toolbar');
  const dropBtn = createEl('button', 'fc-art-pill fc-art-pill--accent', '↓ Drop Penalty');
  dropBtn.type = 'button';

  const modes: Array<{ id: CompareMode; label: string }> = [
    { id: 'loot-fine', label: 'Loot vs. Fine' },
    { id: 'street', label: 'Vs. Street Crime' },
    { id: 'pct', label: '% of Loot' },
  ];
  let activeMode: CompareMode = 'loot-fine';
  const modeBtns = modes.map((m) => {
    const b = createEl('button', `fc-art-pill${m.id === activeMode ? ' is-active' : ''}`, m.label);
    b.type = 'button';
    b.addEventListener(
      'click',
      () => {
        activeMode = m.id;
        modeBtns.forEach((btn, idx) => btn.classList.toggle('is-active', modes[idx].id === activeMode));
        triggerDrop();
      },
      { signal: opts.signal }
    );
    return b;
  });

  toolbar.append(dropBtn, ...modeBtns);
  stage.appendChild(toolbar);

  const inspector = createEl('div', 'fc-inspector-card');
  stage.appendChild(inspector);

  // Spring physics state for balance beam angle (radians) + falling penalty weight
  const ratio = Math.min(1, Math.max(0.008, data.ratioPct / 100));
  const targetAngle = (): number => {
    if (activeMode === 'street') return 0.24; // Street crime sentence weighs far heavier on right!
    return -(0.16 + (1 - Math.sqrt(ratio)) * 0.16);
  };

  let angle = opts.reducedMotion ? targetAngle() : 0.04;
  let angVel = 0;
  let weightDropY = 0; // 0 = seated on pan, negative = falling from above
  let weightVelY = 0;
  let stampScale = opts.reducedMotion ? 1 : 0;

  function triggerDrop(): void {
    if (opts.reducedMotion) {
      angle = targetAngle();
      weightDropY = 0;
      stampScale = 1;
      updateInspector();
      render();
      return;
    }
    angle = activeMode === 'street' ? -0.18 : 0.12;
    angVel = 0;
    weightDropY = -110;
    weightVelY = 0;
    stampScale = 0;
    updateInspector();
  }

  dropBtn.addEventListener('click', triggerDrop, { signal: opts.signal });

  function updateInspector(): void {
    if (activeMode === 'street') {
      inspector.innerHTML = `<span class="fc-insp-kicker">DISPARITY CHECK</span> <strong>${escapeXml(data.streetLabel)} (${escapeXml(data.streetAmountDisplay)}):</strong> ${escapeXml(data.streetSentenceDisplay)} · <strong>This Case:</strong> ${escapeXml(data.execSentenceDisplay)}`;
    } else if (activeMode === 'pct') {
      inspector.innerHTML = `<span class="fc-insp-kicker">PENALTY RATIO</span> <strong>${escapeXml(data.ratioDisplay)}</strong> — ${escapeXml(data.fineDisplay)} assessed on ${escapeXml(data.lootDisplay)} alleged volume (${escapeXml(data.stampText)}).`;
    } else {
      inspector.innerHTML = `<span class="fc-insp-kicker">APOTHECARY BALANCE</span> <strong>${escapeXml(data.lootLabel)}:</strong> ${escapeXml(data.lootDisplay)} vs. <strong>${escapeXml(data.fineLabel)}:</strong> ${escapeXml(data.fineDisplay)} — Click <em>Drop Penalty</em> to test counterweight.`;
    }
  }

  const baseDefs = buildEditorialDefs(uid, pal);
  const baseFrame = buildPlateFrame(width, height, pal, {
    kicker: 'BALANCE OF PENALTIES · PHYSICS SCALE',
    title: data.title,
    subtitle: data.subtitle,
    plateNo: 'FIG. II',
  });

  const box = { x: 40, y: 112, w: width - 80, h: height - 168 };
  const cx = box.x + box.w * 0.5;
  const baseY = box.y + box.h * 0.84;
  const pillarTopY = box.y + box.h * 0.22;
  const beamHalf = Math.min(box.w * 0.34, 208);
  const chainLen = box.h * 0.24;
  const panW = 136;

  // Static plinth & pillar rendered once deterministically
  const baseRng = createPrng(`${opts.seed}:scale-plinth`);
  const plinthSvg = `
    ${sketchRectSvg(cx - 74, baseY - 14, 148, 16, baseRng, { fill: pal.inkSoft, stroke: pal.ink })}
    ${sketchRectSvg(cx - 48, baseY - 28, 96, 14, baseRng, { fill: pal.paperAlt, stroke: pal.ink, hachure: true })}
    ${sketchRectSvg(cx - 8, pillarTopY, 16, baseY - 28 - pillarTopY, baseRng, { fill: pal.paperCard, stroke: pal.ink, hachure: true, hachureColor: pal.brass })}
    ${sketchEllipseSvg(cx, pillarTopY, 13, 13, baseRng, { fill: pal.brassLight, stroke: pal.ink, strokeWidth: 1.6 })}
  `;

  function renderRoundingGridSvg(): string {
    // 100-square percentage grid showing exact ratio share in crimson ink!
    const cols = 20;
    const rows = 5;
    const cell = Math.min(24, (box.w - 110) / cols);
    const gw = cols * cell;
    const gh = rows * cell;
    const gx = cx - gw / 2;
    const gy = box.y + box.h * 0.22;
    const litCells = Math.max(1, Math.round(Math.min(100, data.ratioPct)));

    const rects: string[] = [];
    for (let i = 0; i < 100; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const isFine = i < litCells;
      rects.push(
        `<rect x="${f(gx + c * cell + 1.5)}" y="${f(gy + r * cell + 1.5)}" width="${f(cell - 3)}" height="${f(cell - 3)}" fill="${isFine ? pal.accent : pal.paperCard}" stroke="${isFine ? pal.accent : pal.inkMuted}" stroke-width="${isFine ? 1.2 : 0.7}"/>`
      );
    }

    return `
      <g>
        <text x="${f(cx)}" y="${f(gy - 14)}" text-anchor="middle" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="11.5" font-weight="700">EACH SQUARE = 1% OF ALLEGED VOLUME (${escapeXml(data.lootDisplay)})</text>
        ${rects.join('')}
        <text x="${f(cx)}" y="${f(gy + gh + 28)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.serif}" font-size="22" font-weight="700">${escapeXml(data.fineDisplay)} = ${escapeXml(data.ratioDisplay)}</text>
        ${letterpressStampSvg(cx, gy + gh + 68, data.stampText, pal.accent, -4, 13)}
      </g>
    `;
  }

  function render(): void {
    let artwork = '';

    if (activeMode === 'pct') {
      artwork = renderRoundingGridSvg();
    } else {
      const lx = cx - Math.cos(angle) * beamHalf;
      const ly = pillarTopY + 18 - Math.sin(angle) * beamHalf;
      const rx = cx + Math.cos(angle) * beamHalf;
      const ry = pillarTopY + 18 + Math.sin(angle) * beamHalf;

      const leftVal = activeMode === 'street' ? data.execSentenceDisplay : data.lootDisplay;
      const leftTitle = activeMode === 'street' ? 'EXECUTIVE OUTCOME' : data.lootLabel.toUpperCase();
      const rightVal = activeMode === 'street' ? data.streetSentenceDisplay : data.fineDisplay;
      const rightTitle = activeMode === 'street' ? `${data.streetLabel.toUpperCase()} (${data.streetAmountDisplay})` : data.fineLabel.toUpperCase();

      const leftBlockH = activeMode === 'street' ? 20 : 54;
      const rightBlockH = activeMode === 'street' ? 56 : 18;
      const stampText = activeMode === 'street' ? 'DOUBLE STANDARD' : data.ratioDisplay;

      const beamRng = createPrng(`${opts.seed}:beam`);

      artwork = `
        <g>
          ${plinthSvg}
          <!-- Beam -->
          <line x1="${f(lx)}" y1="${f(ly)}" x2="${f(rx)}" y2="${f(ry)}" stroke="${pal.ink}" stroke-width="4.5" stroke-linecap="round"/>
          <circle cx="${f(lx)}" cy="${f(ly)}" r="5" fill="${pal.brass}" stroke="${pal.ink}" stroke-width="1.4"/>
          <circle cx="${f(rx)}" cy="${f(ry)}" r="5" fill="${pal.brass}" stroke="${pal.ink}" stroke-width="1.4"/>

          <!-- Left Pan -->
          <line x1="${f(lx)}" y1="${f(ly)}" x2="${f(lx - panW * 0.4)}" y2="${f(ly + chainLen)}" stroke="${pal.ink}" stroke-width="1.2"/>
          <line x1="${f(lx)}" y1="${f(ly)}" x2="${f(lx + panW * 0.4)}" y2="${f(ly + chainLen)}" stroke="${pal.ink}" stroke-width="1.2"/>
          ${sketchRectSvg(lx - panW * 0.34, ly + chainLen - leftBlockH - 2, panW * 0.68, leftBlockH, beamRng, {
            fill: pal.paperCard,
            stroke: pal.ink,
            strokeWidth: 1.6,
            hachure: true,
            crossHatch: activeMode !== 'street',
          })}
          <path d="M ${f(lx - panW * 0.48)} ${f(ly + chainLen)} Q ${f(lx)} ${f(ly + chainLen + 24)} ${f(lx + panW * 0.48)} ${f(ly + chainLen)} Z" fill="${pal.brassLight}" stroke="${pal.ink}" stroke-width="1.6"/>
          <text x="${f(lx)}" y="${f(ly + chainLen - leftBlockH - 10)}" text-anchor="middle" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="13.5" font-weight="700">${escapeXml(truncate(leftVal, 18))}</text>
          <text x="${f(lx)}" y="${f(ly + chainLen + 38)}" text-anchor="middle" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.sans}" font-size="10" font-weight="700">${escapeXml(truncate(leftTitle, 24))}</text>

          <!-- Right Pan (dropping weight!) -->
          <line x1="${f(rx)}" y1="${f(ry)}" x2="${f(rx - panW * 0.4)}" y2="${f(ry + chainLen)}" stroke="${pal.ink}" stroke-width="1.2"/>
          <line x1="${f(rx)}" y1="${f(ry)}" x2="${f(rx + panW * 0.4)}" y2="${f(ry + chainLen)}" stroke="${pal.ink}" stroke-width="1.2"/>
          <g transform="translate(0,${f(weightDropY)})">
            ${sketchRectSvg(rx - (activeMode === 'street' ? 42 : 24), ry + chainLen - rightBlockH - 2, activeMode === 'street' ? 84 : 48, rightBlockH, beamRng, {
              fill: pal.accentWash,
              stroke: pal.accent,
              strokeWidth: 1.7,
              hachure: true,
              hachureColor: pal.accent,
            })}
            <text x="${f(rx)}" y="${f(ry + chainLen - rightBlockH - 10)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="13.5" font-weight="700">${escapeXml(truncate(rightVal, 18))}</text>
          </g>
          <path d="M ${f(rx - panW * 0.48)} ${f(ry + chainLen)} Q ${f(rx)} ${f(ry + chainLen + 24)} ${f(rx + panW * 0.48)} ${f(ry + chainLen)} Z" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="1.6"/>
          <text x="${f(rx)}" y="${f(ry + chainLen + 38)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.sans}" font-size="10" font-weight="700">${escapeXml(truncate(rightTitle, 26))}</text>

          ${
            stampScale > 0.05
              ? `<g transform="translate(${f(cx + box.w * 0.12)},${f(baseY - 56)}) scale(${f(stampScale)}) translate(${f(-(cx + box.w * 0.12))},${f(-(baseY - 56))})">${letterpressStampSvg(cx + box.w * 0.12, baseY - 56, stampText, pal.accent, -6, 13)}</g>`
              : ''
          }
        </g>
      `;
    }

    svgWrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="fc-art-svg" preserveAspectRatio="xMidYMid meet">${baseDefs}${baseFrame}${artwork}</svg>`;
  }

  updateInspector();
  render();
  container.appendChild(stage);

  if (!opts.reducedMotion) {
    triggerDrop();
    startManagedRaf(container, opts.signal, (dt) => {
      let dirty = false;
      if (weightDropY < 0) {
        weightVelY += 720 * dt;
        weightDropY = Math.min(0, weightDropY + weightVelY * dt);
        if (weightDropY === 0) {
          // Impact impulse on beam!
          angVel += activeMode === 'street' ? 2.4 : 0.85;
        }
        dirty = true;
      }

      const tgt = targetAngle();
      const force = (tgt - angle) * 28;
      angVel = (angVel + force * dt) * Math.pow(0.08, dt);
      angle += angVel * dt;

      if (Math.abs(tgt - angle) > 0.001 || Math.abs(angVel) > 0.002) {
        dirty = true;
      }

      if (weightDropY === 0 && stampScale < 1) {
        stampScale = Math.min(1, stampScale + dt * 4.5);
        dirty = true;
      }

      if (dirty) render();
    });
  }
}
