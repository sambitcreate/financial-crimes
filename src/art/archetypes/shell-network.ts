import { applyStagePalette, createEl, startManagedRaf } from '../shared/dom-ui';
import { normalizeShellNetwork } from '../shared/normalize';
import { EDITORIAL_FONTS, getPalette, getViewBox } from '../shared/palette';
import { createPrng, hashString } from '../shared/prng';
import { buildEditorialDefs, buildPlateFrame, escapeXml, f, sketchRectSvg, truncate } from '../shared/rough-helpers';
import type { InteractiveArtSpec, MountOptions } from '../shared/types';

interface SimNode {
  id: string;
  label: string;
  role: string;
  amount: string;
  jurisdiction: string;
  kind: string;
  note: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function mount(container: HTMLElement, spec: InteractiveArtSpec, opts: MountOptions): void {
  const data = normalizeShellNetwork(spec);
  const pal = getPalette(spec.accent, spec.theme);
  const { width, height } = getViewBox(opts.aspect ?? '16/9');
  const rng = createPrng(`${opts.seed}:shell-network`);
  const uid = hashString(`${opts.seed}:sn-live`).toString(36).slice(0, 7);

  container.innerHTML = '';
  const stage = createEl('div', 'fc-stage fc-stage-shell');
  applyStagePalette(stage, pal);

  const box = { x: 40, y: 112, w: width - 80, h: height - 166 };
  const rawNodes = data.nodes.slice(0, 8);
  const cols = Math.min(3, Math.max(2, Math.ceil(rawNodes.length / 2)));
  const rows = Math.ceil(rawNodes.length / cols);
  const nodeW = Math.min(182, (box.w - 32) / cols - 20);
  const nodeH = Math.min(72, (box.h - 24) / rows - 22);

  const nodes: SimNode[] = rawNodes.map((n, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const colCount = row === rows - 1 ? rawNodes.length - row * cols : cols;
    const cellW = box.w / Math.max(1, colCount);
    const cellH = box.h / Math.max(1, rows);
    const cx = typeof n.x === 'number' ? box.x + (n.x / 100) * box.w : box.x + cellW * (col + 0.5) + rng.jitter(8);
    const cy = typeof n.y === 'number' ? box.y + (n.y / 100) * box.h : box.y + cellH * (row + 0.5) + rng.jitter(8);
    return {
      id: n.id,
      label: n.label,
      role: n.role || n.kind || 'Entity',
      amount: n.amount || '',
      jurisdiction: n.jurisdiction || '',
      kind: n.kind || 'shell',
      note: n.note || 'Referenced in primary public docket filings.',
      x: cx,
      y: cy,
      w: nodeW,
      h: nodeH,
    };
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const edges = data.edges.filter((e) => nodeMap.has(e.from) && nodeMap.has(e.to));

  let activeId: string | null = nodes[0]?.id ?? null;
  let draggingId: string | null = null;
  let dashOffset = 0;

  // Build SVG wrapper
  const svgWrap = createEl('div', 'fc-stage-canvas');
  stage.appendChild(svgWrap);

  // Filing inspector card at bottom-left
  const inspector = createEl('div', 'fc-inspector-card');
  stage.appendChild(inspector);

  // Hint bar
  const toolbar = createEl('div', 'fc-inline-toolbar');
  const resetBtn = createEl('button', 'fc-art-pill', 'Reset Layout');
  resetBtn.type = 'button';
  const showAllBtn = createEl('button', 'fc-art-pill', 'Show All Trails');
  showAllBtn.type = 'button';
  toolbar.append(showAllBtn, resetBtn);
  stage.appendChild(toolbar);

  const initialPos = nodes.map((n) => ({ x: n.x, y: n.y }));

  function getConnectedSet(id: string | null): Set<string> {
    const out = new Set<string>();
    if (!id) return out;
    out.add(id);
    // BFS upstream and downstream
    const qUp = [id];
    while (qUp.length) {
      const cur = qUp.shift()!;
      for (const e of edges) {
        if (e.to === cur && !out.has(e.from)) {
          out.add(e.from);
          qUp.push(e.from);
        }
      }
    }
    const qDown = [id];
    while (qDown.length) {
      const cur = qDown.shift()!;
      for (const e of edges) {
        if (e.from === cur && !out.has(e.to)) {
          out.add(e.to);
          qDown.push(e.to);
        }
      }
    }
    return out;
  }

  function updateInspector(): void {
    const node = activeId ? nodeMap.get(activeId) : null;
    if (!node) {
      inspector.innerHTML = `<span class="fc-insp-kicker">ENTITY NETWORK</span> <strong>${nodes.length} Entities · ${edges.length} Traced Flows</strong> — Drag any box or click to trace upstream &amp; downstream filings.`;
      return;
    }
    const inbound = edges.filter((e) => e.to === node.id);
    const outbound = edges.filter((e) => e.from === node.id);
    const flowMeta = [
      node.jurisdiction ? node.jurisdiction : null,
      node.amount ? node.amount : null,
      `${inbound.length} in / ${outbound.length} out`,
    ]
      .filter(Boolean)
      .join(' · ');
    inspector.innerHTML = `
      <span class="fc-insp-kicker">${escapeXml(node.role.toUpperCase())}</span>
      <strong>${escapeXml(node.label)}</strong>
      <span class="fc-insp-meta">${escapeXml(flowMeta)}</span>
      <span class="fc-insp-note">${escapeXml(node.note)}</span>
    `;
  }

  const baseDefs = buildEditorialDefs(uid, pal);
  const baseFrame = buildPlateFrame(width, height, pal, {
    kicker: 'FORENSIC ENTITY GRAPH · INTERACTIVE',
    title: data.title,
    subtitle: data.subtitle,
    plateNo: 'FIG. I',
  });

  // Pre-compute deterministic rough box inner SVG per node using fixed local rng
  const nodeBoxSvg = new Map<string, string>();
  nodes.forEach((n, i) => {
    const localRng = createPrng(`${opts.seed}:node:${n.id}`);
    const isAccent = i === 0 || n.kind === 'asset';
    nodeBoxSvg.set(
      n.id,
      sketchRectSvg(-n.w / 2, -n.h / 2, n.w, n.h, localRng, {
        fill: isAccent ? pal.paperCard : pal.paper,
        stroke: isAccent ? pal.accent : pal.ink,
        strokeWidth: isAccent ? 1.85 : 1.35,
        hachure: n.kind === 'shell' || i === 1,
        hachureColor: isAccent ? pal.accent : pal.ink,
        doubleBorder: isAccent,
      })
    );
  });

  function render(): void {
    const connected = getConnectedSet(activeId);

    const edgesMarkup = edges
      .map((e, idx) => {
        const a = nodeMap.get(e.from)!;
        const b = nodeMap.get(e.to)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const curve = Math.min(34, dist * 0.16) * (idx % 2 === 0 ? 1 : -1);
        const mx = (a.x + b.x) / 2 - (dy / dist) * curve;
        const my = (a.y + b.y) / 2 + (dx / dist) * curve;
        const highlighted = !activeId || (connected.has(e.from) && connected.has(e.to));
        const isDirect = activeId === e.from || activeId === e.to;
        const stroke = isDirect ? pal.accent : pal.ink;
        const opacity = highlighted ? (isDirect ? 1 : 0.78) : 0.18;

        return `
          <g opacity="${f(opacity)}">
            <path class="fc-flow-arc" d="M ${f(a.x)} ${f(a.y)} Q ${f(mx)} ${f(my)} ${f(b.x)} ${f(b.y)}" fill="none" stroke="${stroke}" stroke-width="${isDirect ? 2.4 : 1.6}" stroke-dasharray="8 5" stroke-dashoffset="${f(-dashOffset)}" marker-end="url(#${isDirect ? 'arrow-accent' : 'arrow'}-${uid})"/>
            ${
              e.amount || e.label
                ? `<rect x="${f(mx - 42)}" y="${f(my - 10)}" width="84" height="18" fill="${pal.paper}" stroke="${isDirect ? pal.accent : pal.ruleLight}" stroke-width="0.8"/>
                   <text x="${f(mx)}" y="${f(my + 2.5)}" text-anchor="middle" fill="${isDirect ? pal.accent : pal.ink}" font-family="${EDITORIAL_FONTS.mono}" font-size="9.5" font-weight="700">${escapeXml(truncate(e.amount || e.label || '', 13))}</text>`
                : ''
            }
          </g>
        `;
      })
      .join('');

    const nodesMarkup = nodes
      .map((n) => {
        const isSelected = activeId === n.id;
        const inTrail = !activeId || connected.has(n.id);
        const opacity = inTrail ? 1 : 0.34;
        return `
          <g class="fc-shell-node" data-node-id="${escapeXml(n.id)}" transform="translate(${f(n.x)},${f(n.y)})" opacity="${f(opacity)}" style="cursor:grab">
            ${isSelected ? `<rect x="${f(-n.w / 2 - 4)}" y="${f(-n.h / 2 - 4)}" width="${f(n.w + 8)}" height="${f(n.h + 8)}" fill="none" stroke="${pal.accent}" stroke-width="1.6" stroke-dasharray="4 3"/>` : ''}
            ${nodeBoxSvg.get(n.id)}
            <text x="0" y="-12" text-anchor="middle" fill="${pal.ink}" font-family="${EDITORIAL_FONTS.serif}" font-size="12.5" font-weight="700" pointer-events="none">${escapeXml(truncate(n.label, 22))}</text>
            <text x="0" y="5" text-anchor="middle" fill="${pal.inkMuted}" font-family="${EDITORIAL_FONTS.sans}" font-size="9" letter-spacing="0.4" pointer-events="none">${escapeXml(truncate((n.jurisdiction || n.role).toUpperCase(), 22))}</text>
            ${n.amount ? `<text x="0" y="22" text-anchor="middle" fill="${pal.accent}" font-family="${EDITORIAL_FONTS.mono}" font-size="11" font-weight="700" pointer-events="none">${escapeXml(truncate(n.amount, 16))}</text>` : ''}
          </g>
        `;
      })
      .join('');

    svgWrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" class="fc-art-svg" preserveAspectRatio="xMidYMid meet">${baseDefs}${baseFrame}<g class="fc-edges-layer">${edgesMarkup}</g><g class="fc-nodes-layer">${nodesMarkup}</g></svg>`;
  }

  function clientToSvg(evt: PointerEvent): { x: number; y: number } {
    const svg = svgWrap.querySelector('svg');
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((evt.clientX - rect.left) / Math.max(1, rect.width)) * width,
      y: ((evt.clientY - rect.top) / Math.max(1, rect.height)) * height,
    };
  }

  svgWrap.addEventListener(
    'pointerdown',
    (e) => {
      const target = (e.target as Element | null)?.closest('.fc-shell-node') as SVGElement | null;
      if (!target) return;
      const id = target.getAttribute('data-node-id');
      if (!id) return;
      activeId = id;
      draggingId = id;
      svgWrap.setPointerCapture(e.pointerId);
      updateInspector();
      render();
    },
    { signal: opts.signal }
  );

  svgWrap.addEventListener(
    'pointermove',
    (e) => {
      if (!draggingId) return;
      const node = nodeMap.get(draggingId);
      if (!node) return;
      const pt = clientToSvg(e);
      node.x = Math.max(box.x + node.w / 2, Math.min(box.x + box.w - node.w / 2, pt.x));
      node.y = Math.max(box.y + node.h / 2, Math.min(box.y + box.h - node.h / 2, pt.y));
      render();
    },
    { signal: opts.signal }
  );

  const endDrag = (): void => {
    draggingId = null;
  };
  svgWrap.addEventListener('pointerup', endDrag, { signal: opts.signal });
  svgWrap.addEventListener('pointercancel', endDrag, { signal: opts.signal });

  showAllBtn.addEventListener(
    'click',
    () => {
      activeId = null;
      updateInspector();
      render();
    },
    { signal: opts.signal }
  );

  resetBtn.addEventListener(
    'click',
    () => {
      nodes.forEach((n, i) => {
        n.x = initialPos[i].x;
        n.y = initialPos[i].y;
      });
      activeId = nodes[0]?.id ?? null;
      updateInspector();
      render();
    },
    { signal: opts.signal }
  );

  updateInspector();
  render();
  container.appendChild(stage);

  if (!opts.reducedMotion) {
    startManagedRaf(container, opts.signal, (dt) => {
      dashOffset = (dashOffset + dt * 22) % 26;
      const arcs = svgWrap.querySelectorAll('.fc-flow-arc');
      for (let i = 0; i < arcs.length; i++) {
        arcs[i].setAttribute('stroke-dashoffset', f(-dashOffset));
      }
    });
  }
}
