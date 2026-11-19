import { applyStagePalette, createEl } from '../shared/dom-ui';
import { normalizeEditorialVignette } from '../shared/normalize';
import { EDITORIAL_FONTS, getPalette, getViewBox } from '../shared/palette';
import { createPrng, hashString } from '../shared/prng';
import { buildEditorialDefs, buildPlateFrame, escapeXml, f } from '../shared/rough-helpers';
import { renderVignetteSceneSvg } from '../shared/scenes';
import type { InteractiveArtSpec, MountOptions } from '../shared/types';

export function mount(container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions): void {
  const data = normalizeEditorialVignette(spec);
  const pal = getPalette(spec.accent, spec.theme);
  const { width, height } = getViewBox(opts.aspect ?? '16/9');
  const uid = hashString(`${opts.seed}:vig-live`).toString(36).slice(0, 7);

  container.innerHTML = '';
  const stage = createEl('div', 'fc-stage fc-stage-vignette');
  applyStagePalette(stage, pal);

  const svgWrap = createEl('div', 'fc-stage-canvas');
  stage.appendChild(svgWrap);

  const box = { x: 40, y: 112, w: width - 80, h: height - 172 };
  let activeIdx = 0;
  let xrayMode = false;

  const toolbar = createEl('div', 'fc-inline-toolbar');

  if (data.scene === 'server_vault') {
    const xrayBtn = createEl('button', 'fc-art-pill fc-art-pill--accent', data.xrayLabel || 'Toggle X-Ray View');
    xrayBtn.type = 'button';
    xrayBtn.addEventListener(
      'click',
      () => {
        xrayMode = !xrayMode;
        xrayBtn.classList.toggle('is-active', xrayMode);
        xrayBtn.textContent = xrayMode ? 'Close X-Ray View' : data.xrayLabel || 'Toggle X-Ray View';
        render();
      },
      { signal: opts.signal }
    );
    toolbar.appendChild(xrayBtn);
  }

  const pinBtns = data.hotspots.map((h, i) => {
    const b = createEl('button', `fc-art-pill${i === activeIdx ? ' is-active' : ''}`, `①②③④⑤`[i] + ` ${h.title.slice(0, 16)}`);
    b.type = 'button';
    b.addEventListener(
      'click',
      () => {
        activeIdx = i;
        syncBtns();
        updateInspector();
        render();
      },
      { signal: opts.signal }
    );
    return b;
  });

  function syncBtns(): void {
    pinBtns.forEach((b, i) => b.classList.toggle('is-active', i === activeIdx));
  }

  toolbar.append(...pinBtns);
  stage.appendChild(toolbar);

  const inspector = createEl('div', 'fc-inspector-card');
  stage.appendChild(inspector);

  const baseDefs = buildEditorialDefs(uid, pal);
  const baseFrame = buildPlateFrame(width, height, pal, {
    kicker: 'ISOMETRIC DOCKET PLATE · INTERACTIVE',
    title: data.title,
    subtitle: data.subtitle,
    plateNo: 'FIG. VII',
  });

  function updateInspector(): void {
    const h = data.hotspots[activeIdx] || data.hotspots[0];
    if (!h) return;
    inspector.innerHTML = `
      <span class="fc-insp-kicker">EXHIBIT PIN #${activeIdx + 1}</span>
      <strong>${escapeXml(h.title)}</strong>
      ${h.figure ? `<span class="fc-insp-meta">${escapeXml(h.figure)}</span>` : ''}
      <span class="fc-insp-note">${escapeXml(h.note)}</span>
    `;
  }

  function render(): void {
    const sceneRng = createPrng(`${opts.seed}:scene:${xrayMode ? 'x' : 'n'}`);
    const sceneSvg = renderVignetteSceneSvg(data.scene, box, pal, sceneRng, uid, xrayMode);

    const pinsSvg = data.hotspots
      .map((h, i) => {
        const hx = box.x + ((h.x ?? 50) / 100) * box.w;
        const hy = box.y + ((h.y ?? 50) / 100) * box.h;
        const isSel = i === activeIdx;
        return `
          <g class="fc-vignette-pin" data-pin-idx="${i}" style="cursor:pointer">
            ${!opts.reducedMotion ? `<circle class="fc-pulse-ring" cx="${f(hx)}" cy="${f(hy)}" r="${isSel ? 18 : 15}" fill="none" stroke="${pal.accent}" stroke-width="1.2" opacity="${isSel ? 0.85 : 0.45}"/>` : ''}
            <circle cx="${f(hx)}" cy="${f(hy)}" r="12.5" fill="${isSel ? pal.accent : pal.paperCard}" stroke="${isSel ? pal.ink : pal.accent}" stroke-width="2"/>
            <text x="${f(hx)}" y="${f(hy + 4)}" text-anchor="middle" fill="${isSel ? pal.paper : pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="11.5" font-weight="700" pointer-events="none">${i + 1}</text>
          </g>
        `;
      })
      .join('');

    svgWrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="fc-art-svg" preserveAspectRatio="xMidYMid meet">${baseDefs}${baseFrame}${sceneSvg}${pinsSvg}</svg>`;
  }

  svgWrap.addEventListener(
    'click',
    (e) => {
      const pin = (e.target as Element | null)?.closest('.fc-vignette-pin');
      if (!pin) return;
      const idx = Number(pin.getAttribute('data-pin-idx'));
      if (Number.isFinite(idx)) {
        activeIdx = idx;
        syncBtns();
        updateInspector();
        render();
      }
    },
    { signal: opts.signal }
  );

  svgWrap.addEventListener(
    'pointerover',
    (e) => {
      const pin = (e.target as Element | null)?.closest('.fc-vignette-pin');
      if (!pin) return;
      const idx = Number(pin.getAttribute('data-pin-idx'));
      if (Number.isFinite(idx) && idx !== activeIdx) {
        activeIdx = idx;
        syncBtns();
        updateInspector();
        render();
      }
    },
    { signal: opts.signal }
  );

  updateInspector();
  render();
  container.appendChild(stage);
}
