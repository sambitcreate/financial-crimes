import { applyStagePalette, createEl, startManagedRaf } from '../shared/dom-ui';
import { normalizePenaltyWheel } from '../shared/normalize';
import { EDITORIAL_FONTS, getPalette, getViewBox } from '../shared/palette';
import { createPrng, hashString } from '../shared/prng';
import { buildEditorialDefs, buildPlateFrame, escapeXml, f, sketchEllipseSvg } from '../shared/rough-helpers';
import type { InteractiveArtSpec, MountOptions } from '../shared/types';

export function mount(container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions): void {
  const data = normalizePenaltyWheel(spec);
  const pal = getPalette(spec.accent, spec.theme);
  const { width, height } = getViewBox(opts.aspect ?? '16/9');
  const uid = hashString(`${opts.seed}:wheel-live`).toString(36).slice(0, 7);

  container.innerHTML = '';
  const stage = createEl('div', 'fc-stage fc-stage-wheel');
  applyStagePalette(stage, pal);

  const svgWrap = createEl('div', 'fc-stage-canvas');
  stage.appendChild(svgWrap);

  let activeCompIdx = 0;
  const activeTargetScore = (): number => {
    const c = data.comparisons[activeCompIdx];
    return typeof c?.score === 'number' ? c.score : data.score;
  };

  let curScore = opts.reducedMotion ? activeTargetScore() : 6;
  let velocity = 0;

  const toolbar = createEl('div', 'fc-inline-toolbar');
  const compBtns = data.comparisons.map((c, idx) => {
    const b = createEl('button', `fc-art-pill${idx === activeCompIdx ? ' is-active' : ''}`, c.label);
    b.type = 'button';
    b.addEventListener(
      'click',
      () => {
        activeCompIdx = idx;
        compBtns.forEach((btn, i) => btn.classList.toggle('is-active', i === activeCompIdx));
        if (opts.reducedMotion) {
          curScore = activeTargetScore();
          render();
        } else {
          velocity += curScore < activeTargetScore() ? 65 : -65;
        }
        updateInspector();
      },
      { signal: opts.signal }
    );
    return b;
  });

  const resweepBtn = createEl('button', 'fc-art-pill fc-art-pill--accent', '↻ Sweep Gauge');
  resweepBtn.type = 'button';
  resweepBtn.addEventListener(
    'click',
    () => {
      if (opts.reducedMotion) return;
      curScore = 4;
      velocity = 90;
    },
    { signal: opts.signal }
  );

  toolbar.append(resweepBtn, ...compBtns);
  stage.appendChild(toolbar);

  const inspector = createEl('div', 'fc-inspector-card');
  stage.appendChild(inspector);

  const box = { x: 40, y: 112, w: width - 80, h: height - 172 };
  const cx = box.x + box.w * 0.5;
  const r = Math.min(box.w * 0.39, box.h * 0.54);
  const cy = box.y + box.h * 0.65;

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
    const [x1, y1] = arcPoint(deg, r * (major ? 0.76 : 0.84));
    const [x2, y2] = arcPoint(deg, r * 0.94);
    ticks.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${pal.ink}" stroke-width="${major ? 2.1 : 1}"/>`);
    if (major) {
      const [tx, ty] = arcPoint(deg, r * 0.65);
      ticks.push(
        `<text x="${f(tx)}" y="${f(ty + 3.5)}" text-anchor="middle" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5">${i * 5}</text>`
      );
    }
  }

  const baseDefs = buildEditorialDefs(uid, pal);
  const baseFrame = buildPlateFrame(width, height, pal, {
    kicker: 'DETERRENCE PRESSURE GAUGE · INTERACTIVE',
    title: data.title,
    subtitle: data.subtitle,
    plateNo: 'FIG. VIII',
  });
  const rivetRng = createPrng(`${opts.seed}:rivet`);
  const rivetSvg = sketchEllipseSvg(cx, cy, 12, 12, rivetRng, { fill: pal.brass, stroke: pal.ink, strokeWidth: 2 });

  function verdictFor(sc: number): string {
    if (sc >= 67) return 'ROUNDING ERROR';
    if (sc >= 34) return 'COST OF DOING BUSINESS';
    return 'ACTUAL DETERRENT';
  }

  function updateInspector(): void {
    const c = data.comparisons[activeCompIdx];
    if (!c) return;
    inspector.innerHTML = `
      <span class="fc-insp-kicker">${escapeXml(c.label.toUpperCase())}</span>
      <strong>${escapeXml(c.value)}</strong>
      <span class="fc-insp-meta">Penalty ${escapeXml(data.fineDisplay)} vs. ${escapeXml(data.lootDisplay)}</span>
      <span class="fc-insp-note">${escapeXml(c.detail)}</span>
    `;
  }

  function render(): void {
    const clamped = Math.max(0, Math.min(100, curScore));
    const deg = 180 + (clamped / 100) * 180;
    const [nx, ny] = arcPoint(deg, r * 0.78);
    const [bx, by] = arcPoint(deg + 180, r * 0.14);
    const activeComp = data.comparisons[activeCompIdx];
    const displayedVerdict = activeCompIdx === 0 && data.verdict ? data.verdict : verdictFor(clamped);

    svgWrap.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="fc-art-svg" preserveAspectRatio="xMidYMid meet">
        ${baseDefs}
        ${baseFrame}
        <g>
          <path d="${arcSegment(180, 360, r)} L ${f(cx + r)} ${f(cy + 14)} L ${f(cx - r)} ${f(cy + 14)} Z" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="2.1"/>
          <path d="${arcSegment(180, 360, r * 0.96)}" fill="none" stroke="${pal.brass}" stroke-width="1.2" opacity="0.6"/>
          <path d="${arcSegment(180, 239, r * 0.88)}" fill="none" stroke="${pal.sage}" stroke-width="14" opacity="0.65"/>
          <path d="${arcSegment(241, 299, r * 0.88)}" fill="none" stroke="${pal.gold}" stroke-width="14" opacity="0.72"/>
          <path d="${arcSegment(301, 360, r * 0.88)}" fill="none" stroke="${pal.accent}" stroke-width="14" opacity="0.86"/>
          ${ticks.join('')}

          <text x="${f(cx - r * 0.94)}" y="${f(cy + 30)}" text-anchor="start" fill="${pal.sage}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700">ACTUAL DETERRENT</text>
          <text x="${f(cx)}" y="${f(cy - r - 10)}" text-anchor="middle" fill="${pal.gold}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700">COST OF DOING BUSINESS</text>
          <text x="${f(cx + r * 0.94)}" y="${f(cy + 30)}" text-anchor="end" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700">ROUNDING ERROR</text>

          <!-- Brass & Crimson Indicator Needle -->
          <line x1="${f(bx)}" y1="${f(by)}" x2="${f(nx)}" y2="${f(ny)}" stroke="${pal.accent}" stroke-width="3.6" stroke-linecap="round"/>
          ${rivetSvg}
          <circle cx="${f(cx)}" cy="${f(cy)}" r="3.2" fill="${pal.paperCard}"/>

          <!-- Engraved Plaque -->
          <rect x="${f(cx - 118)}" y="${f(cy + 38)}" width="236" height="50" fill="${pal.paperAlt}" stroke="${pal.rule}" stroke-width="1.2"/>
          <text x="${f(cx)}" y="${f(cy + 61)}" text-anchor="middle" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="21" font-weight="700">${Math.round(clamped)}/100 · ${escapeXml(activeComp?.value || data.fineDisplay)}</text>
          <text x="${f(cx)}" y="${f(cy + 79)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.sans}" font-size="11" font-weight="700" letter-spacing="1.2">${escapeXml(displayedVerdict)}</text>
        </g>
      </svg>
    `;
  }

  updateInspector();
  render();
  container.appendChild(stage);

  if (!opts.reducedMotion) {
    startManagedRaf(container, opts.signal, (dt) => {
      const target = activeTargetScore();
      const force = (target - curScore) * 34;
      velocity = (velocity + force * dt) * Math.pow(0.05, dt);
      curScore += velocity * dt;
      if (Math.abs(target - curScore) > 0.08 || Math.abs(velocity) > 0.15) {
        render();
      }
    });
  }
}
