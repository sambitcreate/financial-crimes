import { applyStagePalette, createEl, startManagedRaf } from '../shared/dom-ui';
import { normalizeFlightMap } from '../shared/normalize';
import { EDITORIAL_FONTS, getPalette, getViewBox } from '../shared/palette';
import { createPrng, hashString } from '../shared/prng';
import { buildEditorialDefs, buildPlateFrame, escapeXml, f, sketchRectSvg, truncate } from '../shared/rough-helpers';
import type { InteractiveArtSpec, MountOptions } from '../shared/types';
import { continentPathsSvg, createMapProjection } from '../shared/world-map';

export function mount(container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions): void {
  const data = normalizeFlightMap(spec);
  const pal = getPalette(spec.accent, spec.theme);
  const { width, height } = getViewBox(opts.aspect ?? '16/9');
  const rng = createPrng(`${opts.seed}:map-live`);
  const uid = hashString(`${opts.seed}:map-live`).toString(36).slice(0, 7);

  container.innerHTML = '';
  const stage = createEl('div', 'fc-stage fc-stage-map');
  applyStagePalette(stage, pal);

  const svgWrap = createEl('div', 'fc-stage-canvas');
  stage.appendChild(svgWrap);

  const box = { x: 40, y: 112, w: width - 80, h: height - 172 };
  const proj = createMapProjection(data.waypoints, data.region, box);
  const clipId = `mapclip-live-${uid}`;

  const wpCoords = data.waypoints.map((wp) => {
    const [x, y] = proj.project(wp.lon, wp.lat);
    return { wp, x, y };
  });
  const wpMap = new Map(wpCoords.map((item) => [item.wp.id, item]));

  const routeCurves = data.routes
    .map((r, idx) => {
      const a = wpMap.get(r.from);
      const b = wpMap.get(r.to);
      if (!a || !b) return null;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const lift = Math.min(72, dist * 0.25) * (idx % 2 === 0 ? 1 : -0.82);
      const mx = (a.x + b.x) / 2 - (dy / dist) * lift;
      const my = (a.y + b.y) / 2 + (dx / dist) * lift;
      return { r, a, b, mx, my };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  let activeWpId: string = data.waypoints[0]?.id ?? '';
  let beaconT = 0;

  // Toolbar with quick-jump jurisdiction pills + Trace Next
  const toolbar = createEl('div', 'fc-inline-toolbar');
  const traceBtn = createEl('button', 'fc-art-pill fc-art-pill--accent', 'Trace Next Stop →');
  traceBtn.type = 'button';

  const wpBtns = data.waypoints.slice(0, 5).map((wp) => {
    const b = createEl('button', `fc-art-pill${wp.id === activeWpId ? ' is-active' : ''}`, truncate(wp.label, 14));
    b.type = 'button';
    b.addEventListener(
      'click',
      () => {
        activeWpId = wp.id;
        syncPills();
        updateInspector();
        render();
      },
      { signal: opts.signal }
    );
    return { id: wp.id, el: b };
  });

  function syncPills(): void {
    wpBtns.forEach((p) => p.el.classList.toggle('is-active', p.id === activeWpId));
  }

  traceBtn.addEventListener(
    'click',
    () => {
      const idx = data.waypoints.findIndex((w) => w.id === activeWpId);
      const next = data.waypoints[(idx + 1) % data.waypoints.length];
      if (next) {
        activeWpId = next.id;
        syncPills();
        updateInspector();
        render();
      }
    },
    { signal: opts.signal }
  );

  toolbar.append(traceBtn, ...wpBtns.map((p) => p.el));
  stage.appendChild(toolbar);

  const inspector = createEl('div', 'fc-inspector-card');
  stage.appendChild(inspector);

  const baseDefs = buildEditorialDefs(uid, pal);
  const baseFrame = buildPlateFrame(width, height, pal, {
    kicker: 'CROSS-BORDER WIRE & ASSET TRACE · INTERACTIVE',
    title: data.title,
    subtitle: data.subtitle,
    plateNo: 'FIG. VI',
  });

  const grat: string[] = [];
  for (let i = 1; i < 4; i++) {
    const gy = box.y + (box.h * i) / 4;
    const gx = box.x + (box.w * i) / 4;
    grat.push(
      `<line x1="${f(box.x)}" y1="${f(gy)}" x2="${f(box.x + box.w)}" y2="${f(gy)}" stroke="${pal.ruleLight}" stroke-width="0.65" stroke-dasharray="3 4"/>`,
      `<line x1="${f(gx)}" y1="${f(box.y)}" x2="${f(gx)}" y2="${f(box.y + box.h)}" stroke="${pal.ruleLight}" stroke-width="0.65" stroke-dasharray="3 4"/>`
    );
  }
  const continents = continentPathsSvg(proj, { fill: pal.paperCard, stroke: pal.inkMuted, hatchId: `hatch-${uid}` });
  const mapBorder = sketchRectSvg(box.x, box.y, box.w, box.h, rng, { stroke: pal.rule, strokeWidth: 1.2 });

  function evalQuad(ax: number, ay: number, mx: number, my: number, bx: number, by: number, t: number): [number, number] {
    const u = 1 - t;
    return [u * u * ax + 2 * u * t * mx + t * t * bx, u * u * ay + 2 * u * t * my + t * t * by];
  }

  function updateInspector(): void {
    const found = wpMap.get(activeWpId);
    if (!found) return;
    const { wp } = found;
    const linked = data.routes.filter((r) => r.from === wp.id || r.to === wp.id);
    inspector.innerHTML = `
      <span class="fc-insp-kicker">${escapeXml((wp.role || 'JURISDICTION').toUpperCase())}</span>
      <strong>${escapeXml(wp.label)}</strong>
      ${wp.amount ? `<span class="fc-insp-meta">${escapeXml(wp.amount)}</span>` : ''}
      <span class="fc-insp-note">${escapeXml(wp.status || 'Active regulatory docket')}${linked.length ? ` · ${linked.length} traced wire/flight leg${linked.length > 1 ? 's' : ''}` : ''}</span>
    `;
  }

  function render(): void {
    const routesMarkup = routeCurves
      .map((c, idx) => {
        const isActive = c.r.from === activeWpId || c.r.to === activeWpId;
        const t = (beaconT + idx * 0.27) % 1;
        const [bx, by] = evalQuad(c.a.x, c.a.y, c.mx, c.my, c.b.x, c.b.y, t);
        return `
          <g opacity="${isActive ? 1 : 0.45}">
            <path d="M ${f(c.a.x)} ${f(c.a.y)} Q ${f(c.mx)} ${f(c.my)} ${f(c.b.x)} ${f(c.b.y)}" fill="none" stroke="${isActive ? pal.accent : pal.ink}" stroke-width="${isActive ? 2.3 : 1.5}" stroke-dasharray="${c.r.loop ? '5 3' : '7 4'}" marker-end="url(#${isActive ? 'arrow-accent' : 'arrow'}-${uid})"/>
            <circle class="fc-map-beacon" data-route-idx="${idx}" cx="${f(bx)}" cy="${f(by)}" r="${isActive ? 4 : 2.8}" fill="${pal.accent}" stroke="${pal.paper}" stroke-width="1.2"/>
            ${
              isActive && (c.r.amount || c.r.label)
                ? `<rect x="${f(c.mx - 36)}" y="${f(c.my - 9)}" width="72" height="17" fill="${pal.paper}" stroke="${pal.accent}" stroke-width="0.8"/>
                   <text x="${f(c.mx)}" y="${f(c.my + 3)}" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="9" font-weight="700">${escapeXml(truncate(c.r.amount || c.r.label || '', 12))}</text>`
                : ''
            }
          </g>
        `;
      })
      .join('');

    const pinsMarkup = wpCoords
      .map(({ wp, x, y }) => {
        const isSel = wp.id === activeWpId;
        return `
          <g class="fc-map-pin" data-wp-id="${escapeXml(wp.id)}" style="cursor:pointer">
            ${isSel ? `<circle cx="${f(x)}" cy="${f(y)}" r="13" fill="${pal.accentWash}" stroke="${pal.accent}" stroke-width="1.3" stroke-dasharray="3 2"/>` : ''}
            <circle cx="${f(x)}" cy="${f(y)}" r="${isSel ? 6.5 : 5}" fill="${isSel ? pal.accent : pal.paperCard}" stroke="${pal.ink}" stroke-width="1.8"/>
            <text x="${f(x + 10)}" y="${f(y + 3.5)}" fill="${isSel ? pal.accent : pal.ink}" font-family="${EDITORIAL_FONTS.sans}" font-size="${isSel ? 11.5 : 10.5}" font-weight="700">${escapeXml(truncate(wp.label, 18))}</text>
          </g>
        `;
      })
      .join('');

    svgWrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="fc-art-svg" preserveAspectRatio="xMidYMid meet">${baseDefs}${baseFrame}<defs><clipPath id="${clipId}"><rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}"/></clipPath></defs><rect x="${f(box.x)}" y="${f(box.y)}" width="${f(box.w)}" height="${f(box.h)}" fill="${pal.paperAlt}" opacity="0.45"/><g clip-path="url(#${clipId})">${grat.join('')}${continents}${routesMarkup}${pinsMarkup}</g>${mapBorder}</svg>`;
  }

  svgWrap.addEventListener(
    'click',
    (e) => {
      const pin = (e.target as Element | null)?.closest('.fc-map-pin');
      if (!pin) return;
      const id = pin.getAttribute('data-wp-id');
      if (id) {
        activeWpId = id;
        syncPills();
        updateInspector();
        render();
      }
    },
    { signal: opts.signal }
  );

  updateInspector();
  render();
  container.appendChild(stage);

  if (!opts.reducedMotion) {
    startManagedRaf(container, opts.signal, (dt) => {
      beaconT = (beaconT + dt * 0.28) % 1;
      const beacons = svgWrap.querySelectorAll('.fc-map-beacon');
      beacons.forEach((el) => {
        const idx = Number(el.getAttribute('data-route-idx'));
        const c = routeCurves[idx];
        if (!c) return;
        const t = (beaconT + idx * 0.27) % 1;
        const [bx, by] = evalQuad(c.a.x, c.a.y, c.mx, c.my, c.b.x, c.b.y, t);
        el.setAttribute('cx', f(bx));
        el.setAttribute('cy', f(by));
      });
    });
  }
}
