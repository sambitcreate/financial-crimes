import { applyStagePalette, createEl, startManagedRaf } from '../shared/dom-ui';
import { normalizePumpDumpTicker } from '../shared/normalize';
import { EDITORIAL_FONTS, getPalette, getViewBox } from '../shared/palette';
import { createPrng, hashString } from '../shared/prng';
import { buildEditorialDefs, buildPlateFrame, escapeXml, f, sketchLineSvg, truncate } from '../shared/rough-helpers';
import type { InteractiveArtSpec, MountOptions } from '../shared/types';

export function mount(container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions): void {
  const data = normalizePumpDumpTicker(spec);
  const pal = getPalette(spec.accent, spec.theme);
  const { width, height } = getViewBox(opts.aspect ?? '16/9');
  const uid = hashString(`${opts.seed}:ticker-live`).toString(36).slice(0, 7);

  container.innerHTML = '';
  const stage = createEl('div', 'fc-stage fc-stage-ticker');
  applyStagePalette(stage, pal);

  const svgWrap = createEl('div', 'fc-stage-canvas');
  stage.appendChild(svgWrap);

  const toolbar = createEl('div', 'fc-inline-toolbar');
  const replayBtn = createEl('button', 'fc-art-pill fc-art-pill--accent', '▶ Replay');
  replayBtn.type = 'button';

  const eventBtns = data.events.slice(0, 4).map((ev) => {
    const b = createEl('button', 'fc-art-pill', truncate(ev.label, 18));
    b.type = 'button';
    b.addEventListener(
      'click',
      () => {
        replaying = false;
        revealProgress = 1;
        scrubIdx = ev.index;
        updateInspector();
        render();
      },
      { signal: opts.signal }
    );
    return b;
  });

  toolbar.append(replayBtn, ...eventBtns);
  stage.appendChild(toolbar);

  const inspector = createEl('div', 'fc-inspector-card');
  stage.appendChild(inspector);

  const box = { x: 40, y: 112, w: width - 80, h: height - 172 };
  const padL = 56;
  const padR = 26;
  const padT = 22;
  const padB = 38;
  const cw = box.w - padL - padR;
  const ch = box.h - padT - padB;
  const ox = box.x + padL;
  const oy = box.y + padT;

  const vals = data.points.map((p) => p.value);
  const minV = Math.min(...vals) * 0.94;
  const maxV = Math.max(...vals) * 1.06;
  const span = Math.max(0.001, maxV - minV);

  const coords = data.points.map((p, i) => ({
    x: ox + (i / Math.max(1, data.points.length - 1)) * cw,
    y: oy + (1 - (p.value - minV) / span) * ch,
    ...p,
  }));

  let scrubIdx = data.peakIndex;
  let revealProgress = 1;
  let replaying = false;

  const baseDefs = buildEditorialDefs(uid, pal);
  const baseFrame = buildPlateFrame(width, height, pal, {
    kicker: `MARKET FORENSICS // ${data.ticker}`,
    title: data.title,
    subtitle: `${data.drawdownLabel} · Scrub across chart or click pins`,
    plateNo: 'FIG. IV',
  });

  const gridRng = createPrng(`${opts.seed}:ticker-grid`);
  const gridLines: string[] = [];
  for (let i = 0; i <= 4; i++) {
    const gy = oy + (i / 4) * ch;
    const gv = maxV - (i / 4) * span;
    gridLines.push(
      `<line x1="${f(ox)}" y1="${f(gy)}" x2="${f(ox + cw)}" y2="${f(gy)}" stroke="${pal.ruleLight}" stroke-width="0.8"/>`,
      `<text x="${f(ox - 8)}" y="${f(gy + 3.5)}" text-anchor="end" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5">${escapeXml(data.currency + Math.round(gv).toLocaleString())}</text>`
    );
  }
  const axisLine = sketchLineSvg(ox, oy + ch, ox + cw, oy + ch, gridRng, { stroke: pal.rule, strokeWidth: 1.4 });
  const xLabels = [0, Math.floor((coords.length - 1) / 3), Math.floor(((coords.length - 1) * 2) / 3), coords.length - 1]
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .map(
      (i) =>
        `<text x="${f(coords[i].x)}" y="${f(oy + ch + 18)}" text-anchor="${i === 0 ? 'start' : i === coords.length - 1 ? 'end' : 'middle'}" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5">${escapeXml(coords[i].label)}</text>`
    )
    .join('');

  function updateInspector(): void {
    const pt = coords[scrubIdx] || coords[0];
    const startVal = coords[0]?.value || 1;
    const deltaPct = ((pt.value - startVal) / Math.max(0.0001, startVal)) * 100;
    const sign = deltaPct >= 0 ? '+' : '';
    const ev = data.events.find((e) => e.index === scrubIdx);
    inspector.innerHTML = `
      <span class="fc-insp-kicker">${escapeXml(pt.label)}</span>
      <strong>${escapeXml(data.currency + pt.value.toLocaleString() + data.unit)}</strong>
      <span class="fc-insp-meta">(${sign}${deltaPct.toFixed(1)}% vs. open)</span>
      <span class="fc-insp-note">${escapeXml(ev ? `${ev.label}${ev.detail ? ` — ${ev.detail}` : ''}` : 'Drag pointer across timeline to inspect price & enforcement dates.')}</span>
    `;
  }

  function render(): void {
    const visibleCount = Math.max(2, Math.round(revealProgress * coords.length));
    const visCoords = coords.slice(0, visibleCount);
    const lineD = visCoords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${f(p.x)} ${f(p.y)}`).join(' ');

    // Drawdown crosshatch shading between peakIndex and visible end (up to troughIndex)
    const dropEnd = Math.min(visibleCount - 1, data.troughIndex);
    let dropPoly = '';
    if (dropEnd > data.peakIndex) {
      const slice = coords.slice(data.peakIndex, dropEnd + 1);
      dropPoly = `${slice.map((p) => `${f(p.x)},${f(p.y)}`).join(' ')} ${f(slice[slice.length - 1].x)},${f(oy + ch)} ${f(slice[0].x)},${f(oy + ch)}`;
    }

    // Event callout stems
    const pinsSvg = data.events
      .filter((ev) => ev.index < visibleCount)
      .map((ev, idx) => {
        const pt = coords[ev.index];
        const stemUp = pt.y > oy + ch * 0.36;
        const ly = stemUp ? Math.max(oy + 14, pt.y - 40 - (idx % 2) * 16) : Math.min(oy + ch - 18, pt.y + 34);
        const alignRight = pt.x > ox + cw * 0.72;
        const active = scrubIdx === ev.index;
        return `
          <g>
            <line x1="${f(pt.x)}" y1="${f(pt.y)}" x2="${f(pt.x)}" y2="${f(ly)}" stroke="${pal.accent}" stroke-width="${active ? 1.8 : 1.1}" stroke-dasharray="3 2"/>
            <circle cx="${f(pt.x)}" cy="${f(pt.y)}" r="${active ? 6 : 4.5}" fill="${pal.accent}" stroke="${pal.paper}" stroke-width="1.6"/>
            <text x="${f(pt.x + (alignRight ? -7 : 7))}" y="${f(ly + 3)}" text-anchor="${alignRight ? 'end' : 'start'}" fill="${active ? pal.accent : pal.ink}" font-family="${EDITORIAL_FONTS.sans}" font-size="10.5" font-weight="700">${escapeXml(truncate(ev.label, 22))}</text>
          </g>
        `;
      })
      .join('');

    // Active hairline scrubber
    const activePt = coords[Math.min(scrubIdx, visibleCount - 1)];
    const scrubberSvg = `
      <g pointer-events="none">
        <line x1="${f(activePt.x)}" y1="${f(oy)}" x2="${f(activePt.x)}" y2="${f(oy + ch)}" stroke="${pal.ink}" stroke-width="1.1" stroke-dasharray="2 2"/>
        <circle cx="${f(activePt.x)}" cy="${f(activePt.y)}" r="6.5" fill="${pal.paperCard}" stroke="${pal.ink}" stroke-width="2.2"/>
        <circle cx="${f(activePt.x)}" cy="${f(activePt.y)}" r="2.5" fill="${pal.accent}"/>
      </g>
    `;

    svgWrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="fc-art-svg" style="cursor:crosshair" preserveAspectRatio="xMidYMid meet">${baseDefs}${baseFrame}<g>${gridLines.join('')}${dropPoly ? `<polygon points="${dropPoly}" fill="url(#hatch-accent-${uid})" opacity="0.88"/>` : ''}${axisLine}<path d="${lineD}" fill="none" stroke="${pal.ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${pinsSvg}${scrubberSvg}${xLabels}</g></svg>`;
  }

  function scrubFromPointer(e: PointerEvent): void {
    const svg = svgWrap.querySelector('svg');
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * width;
    const norm = Math.max(0, Math.min(1, (sx - ox) / Math.max(1, cw)));
    const nextIdx = Math.round(norm * (coords.length - 1));
    if (nextIdx !== scrubIdx) {
      replaying = false;
      revealProgress = 1;
      scrubIdx = nextIdx;
      updateInspector();
      render();
    }
  }

  svgWrap.addEventListener('pointermove', scrubFromPointer, { signal: opts.signal });
  svgWrap.addEventListener('pointerdown', scrubFromPointer, { signal: opts.signal });

  replayBtn.addEventListener(
    'click',
    () => {
      if (opts.reducedMotion) {
        revealProgress = 1;
        scrubIdx = data.troughIndex;
        updateInspector();
        render();
        return;
      }
      revealProgress = 0.08;
      replaying = true;
      scrubIdx = 0;
    },
    { signal: opts.signal }
  );

  updateInspector();
  render();
  container.appendChild(stage);

  if (!opts.reducedMotion) {
    startManagedRaf(container, opts.signal, (dt) => {
      if (!replaying) return;
      revealProgress = Math.min(1, revealProgress + dt * 0.42);
      scrubIdx = Math.min(coords.length - 1, Math.floor(revealProgress * (coords.length - 1)));
      updateInspector();
      render();
      if (revealProgress >= 1) {
        replaying = false;
      }
    });
  }
}
