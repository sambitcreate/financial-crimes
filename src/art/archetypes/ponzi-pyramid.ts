import { applyStagePalette, createEl, startManagedRaf } from '../shared/dom-ui';
import { normalizePonziPyramid } from '../shared/normalize';
import { EDITORIAL_FONTS, getPalette, getViewBox } from '../shared/palette';
import { createPrng, hashString } from '../shared/prng';
import {
  buildEditorialDefs,
  buildPlateFrame,
  escapeXml,
  f,
  letterpressStampSvg,
  sketchRectSvg,
  truncate,
} from '../shared/rough-helpers';
import type { InteractiveArtSpec, MountOptions } from '../shared/types';

interface TierCard {
  idx: number;
  label: string;
  count: string;
  inflow: string;
  payout: string;
  note: string;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  angle: number;
  angVel: number;
  boxSvg: string;
}

export function mount(container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions): void {
  const data = normalizePonziPyramid(spec);
  const pal = getPalette(spec.accent, spec.theme);
  const { width, height } = getViewBox(opts.aspect ?? '16/9');
  const rng = createPrng(`${opts.seed}:ponzi-live`);
  const uid = hashString(`${opts.seed}:ponzi-live`).toString(36).slice(0, 7);

  container.innerHTML = '';
  const stage = createEl('div', 'fc-stage fc-stage-ponzi');
  applyStagePalette(stage, pal);

  const svgWrap = createEl('div', 'fc-stage-canvas');
  stage.appendChild(svgWrap);

  const toolbar = createEl('div', 'fc-inline-toolbar');
  const collapseBtn = createEl('button', 'fc-art-pill fc-art-pill--accent', 'Request Redemption');
  collapseBtn.type = 'button';
  const resetBtn = createEl('button', 'fc-art-pill', 'Reset');
  resetBtn.type = 'button';
  toolbar.append(collapseBtn, resetBtn);
  stage.appendChild(toolbar);

  const inspector = createEl('div', 'fc-inspector-card');
  stage.appendChild(inspector);

  const box = { x: 42, y: 112, w: width - 84, h: height - 172 };
  const floorY = box.y + box.h - 10;
  const count = data.tiers.length;
  const gap = 8;
  const tierH = (box.h - (count - 1) * gap - 22) / count;
  const cx = box.x + box.w * 0.5;
  const maxW = box.w * 0.88;
  const minW = box.w * 0.34;

  const cards: TierCard[] = data.tiers.map((t, i) => {
    const frac = count > 1 ? i / (count - 1) : 1;
    const w = minW + (maxW - minW) * frac;
    const homeX = cx;
    const homeY = box.y + i * (tierH + gap) + tierH / 2;
    const localRng = createPrng(`${opts.seed}:ponzi-card:${i}`);
    const isTop = i === 0;
    const isBase = i === count - 1;
    const boxSvg = sketchRectSvg(-w / 2, -tierH / 2, w, tierH, localRng, {
      fill: isTop ? pal.accentWash : isBase ? pal.paperAlt : pal.paperCard,
      stroke: isTop ? pal.accent : pal.ink,
      strokeWidth: isTop || isBase ? 1.85 : 1.4,
      hachure: isBase,
      hachureColor: pal.ink,
    });
    return {
      idx: i,
      label: t.label,
      count: t.count || '',
      inflow: t.inflow,
      payout: t.payout,
      note: t.note || 'Earlier tiers funded strictly from new investor inflows.',
      homeX,
      homeY,
      x: homeX,
      y: homeY,
      w,
      h: tierH,
      vx: 0,
      vy: 0,
      angle: 0,
      angVel: 0,
      boxSvg,
    };
  });

  let collapsed = false;
  let collapsing = false;
  let stampAlpha = 0;
  let selectedIdx = count - 1;

  const baseDefs = buildEditorialDefs(uid, pal);
  const baseFrame = buildPlateFrame(width, height, pal, {
    kicker: 'LIQUIDITY STRUCTURE · COLLAPSE SIMULATOR',
    title: data.title,
    subtitle: `${data.promisedReturn} · ${data.totalRaised}`,
    plateNo: 'FIG. V',
  });

  function updateInspector(): void {
    if (collapsed) {
      inspector.innerHTML = `<span class="fc-insp-kicker">${escapeXml(data.collapseStamp)}</span> <strong>Liquidity Failure:</strong> Base deposits withdrew faster than new inflows could cover promised payouts. Click <em>Reset</em> to rebuild.`;
      return;
    }
    const c = cards[selectedIdx] || cards[0];
    inspector.innerHTML = `<span class="fc-insp-kicker">TIER ${c.idx + 1}${c.count ? ` · ${escapeXml(c.count.toUpperCase())}` : ''}</span> <strong>${escapeXml(c.label)}</strong> <span class="fc-insp-meta">In: ${escapeXml(c.inflow)} · Out: ${escapeXml(c.payout)}</span> <span class="fc-insp-note">${escapeXml(c.note)}</span>`;
  }

  function render(): void {
    const cardsSvg = cards
      .map((c) => {
        const isSel = !collapsed && selectedIdx === c.idx;
        return `
          <g class="fc-ponzi-tier" data-tier-idx="${c.idx}" transform="translate(${f(c.x)},${f(c.y)}) rotate(${f(c.angle)})" style="cursor:pointer">
            ${isSel ? `<rect x="${f(-c.w / 2 - 4)}" y="${f(-c.h / 2 - 4)}" width="${f(c.w + 8)}" height="${f(c.h + 8)}" fill="none" stroke="${pal.accent}" stroke-width="1.5" stroke-dasharray="4 3"/>` : ''}
            ${c.boxSvg}
            <text x="0" y="-4" text-anchor="middle" fill="${c.idx === 0 ? pal.accent : pal.ink}" font-family="${EDITORIAL_FONTS.serif}" font-size="13.5" font-weight="700" pointer-events="none">${escapeXml(truncate(c.label, 30))}</text>
            <text x="0" y="14" text-anchor="middle" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.mono}" font-size="10.5" pointer-events="none">IN: ${escapeXml(c.inflow)} · OUT: ${escapeXml(c.payout)}</text>
          </g>
        `;
      })
      .join('');

    const stampSvg =
      stampAlpha > 0.04
        ? `<g opacity="${f(stampAlpha)}">${letterpressStampSvg(cx, box.y + box.h * 0.44, data.collapseStamp, pal.accent, -9, 18)}</g>`
        : '';

    svgWrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="fc-art-svg" preserveAspectRatio="xMidYMid meet">${baseDefs}${baseFrame}<g><line x1="${f(box.x)}" y1="${f(floorY)}" x2="${f(box.x + box.w)}" y2="${f(floorY)}" stroke="${pal.rule}" stroke-width="1.4"/><rect x="${f(box.x)}" y="${f(floorY + 1)}" width="${f(box.w)}" height="6" fill="url(#hatch-${uid})"/>${cardsSvg}${stampSvg}</g></svg>`;
  }

  function triggerCollapse(): void {
    collapsed = true;
    collapseBtn.disabled = true;
    if (opts.reducedMotion) {
      cards.forEach((c, i) => {
        c.x = cx + (i % 2 === 0 ? -1 : 1) * (35 + i * 24);
        c.y = floorY - c.h * 0.5 - (count - 1 - i) * 14;
        c.angle = (i % 2 === 0 ? -1 : 1) * (10 + i * 7);
      });
      stampAlpha = 1;
      updateInspector();
      render();
      return;
    }

    collapsing = true;
    stampAlpha = 0;
    cards.forEach((c, i) => {
      const dir = i % 2 === 0 ? -1 : 1;
      // Base pulls out first; upper tiers cascade and rotate
      c.vx = dir * rng.range(70, 175) * (0.6 + i * 0.22);
      c.vy = -rng.range(40, 130) + i * 18;
      c.angVel = dir * rng.range(45, 135);
    });
    updateInspector();
  }

  function resetPyramid(): void {
    collapsed = false;
    collapsing = false;
    stampAlpha = 0;
    collapseBtn.disabled = false;
    cards.forEach((c) => {
      c.x = c.homeX;
      c.y = c.homeY;
      c.vx = 0;
      c.vy = 0;
      c.angle = 0;
      c.angVel = 0;
    });
    updateInspector();
    render();
  }

  collapseBtn.addEventListener('click', triggerCollapse, { signal: opts.signal });
  resetBtn.addEventListener('click', resetPyramid, { signal: opts.signal });

  svgWrap.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest('.fc-ponzi-tier');
      if (!el) return;
      const idx = Number(el.getAttribute('data-tier-idx'));
      if (Number.isFinite(idx)) {
        selectedIdx = idx;
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
      if (!collapsing) return;
      let energy = 0;
      for (const c of cards) {
        c.vy += 880 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.angle += c.angVel * dt;

        // Horizontal walls
        const minX = box.x + c.w * 0.28;
        const maxX = box.x + box.w - c.w * 0.28;
        if (c.x < minX) {
          c.x = minX;
          c.vx = Math.abs(c.vx) * 0.45;
        } else if (c.x > maxX) {
          c.x = maxX;
          c.vx = -Math.abs(c.vx) * 0.45;
        }

        // Floor collision with damped bounce
        const maxY = floorY - c.h * 0.44;
        if (c.y > maxY) {
          c.y = maxY;
          c.vy = -c.vy * 0.36;
          c.vx *= 0.72;
          c.angVel *= 0.68;
          if (Math.abs(c.vy) < 22) c.vy = 0;
        }
        energy += Math.abs(c.vx) + Math.abs(c.vy) + Math.abs(c.angVel);
      }

      if (stampAlpha < 1) {
        stampAlpha = Math.min(1, stampAlpha + dt * 1.4);
      }

      render();
      if (energy < 18 && stampAlpha >= 1) {
        collapsing = false;
      }
    });
  }
}
