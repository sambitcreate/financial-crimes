import type { PaintMode, PaintRefConfig, PointerKind } from './types';
import { clamp } from './color';
import { hashString, mulberry32 } from './noise';
import { paintWeave } from './weave';
import { addTick, now } from './loop';
import { Painter, painterOptionsForMode } from './engine';
import { createPortraitScene } from './portrait-scene';

function parseAspect(aspectAttr: string | null | undefined): number {
  if (!aspectAttr) return 16 / 10;
  const parts = aspectAttr.split('/').map((n) => Number(n.trim()));
  if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && parts[1] > 0) {
    return parts[0] / parts[1];
  }
  const numeric = Number(aspectAttr);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 16 / 10;
}

function parseMode(modeAttr: string | null | undefined): PaintMode {
  if (modeAttr === 'hero' || modeAttr === 'thumb') return modeAttr;
  return 'inline';
}

export class FcPaintingElement extends HTMLElement {
  private painter: Painter | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private stopTick: (() => void) | null = null;
  private cleanupListeners: (() => void)[] = [];
  private mounted = false;

  connectedCallback(): void {
    if (this.mounted) return;
    this.mounted = true;

    const stage = this.querySelector<HTMLElement>('.fc-painting-stage');
    const groundCanvas = this.querySelector<HTMLCanvasElement>('canvas[data-layer="ground"]');
    const weaveCanvas = this.querySelector<HTMLCanvasElement>('canvas[data-layer="weave"]');
    const liveCanvas = this.querySelector<HTMLCanvasElement>('canvas[data-layer="live"]');

    if (!stage || !groundCanvas || !weaveCanvas || !liveCanvas) return;

    const ground = groundCanvas.getContext('2d');
    const weave = weaveCanvas.getContext('2d');
    const live = liveCanvas.getContext('2d');
    if (!ground || !weave || !live) return;

    const config = this.readConfig();
    const mode = parseMode(this.dataset.mode ?? config.mode);
    const aspect = config.aspect ?? parseAspect(this.dataset.aspect);
    const seed = config.seed ?? hashString(this.dataset.id || config.slug || config.refImage || 'fc');
    const reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = createPortraitScene(
      { ...config, mode, aspect, seed },
      { random: mulberry32(seed ^ 0x9e3779b9) },
    );

    const painter = new Painter(
      scene,
      ground,
      mode === 'thumb' ? null : live,
      painterOptionsForMode(mode, reducedMotion, mulberry32(seed)),
    );
    this.painter = painter;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = stage.clientWidth;
      const cssH = stage.clientHeight;
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (w <= 0 || h <= 0) return;
      if (painter.width === w && painter.height === h) return;

      groundCanvas.width = w;
      groundCanvas.height = h;
      weaveCanvas.width = w;
      weaveCanvas.height = h;
      liveCanvas.width = w;
      liveCanvas.height = h;

      paintWeave(weave, w, h);
      painter.resize(w, h);
    };

    resize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(resize);
      this.resizeObserver.observe(stage);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          painter.visible = entry.isIntersecting;
        },
        { rootMargin: '120px 0px' },
      );
      this.intersectionObserver.observe(this);
    } else {
      painter.visible = true;
    }

    // Shared single-rAF clock for all paintings on the page
    this.stopTick = addTick((t, dt) => {
      painter.step(t, dt);
    });

    const handlePointer = (kind: PointerKind) => (e: PointerEvent) => {
      // Never intercept clicks on thumbnails inside article links
      if (mode === 'thumb' && kind === 'down') return;
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const u = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const v = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      painter.pointer(kind, u, v, now());
    };

    const onDown = handlePointer('down');
    const onMove = handlePointer('move');
    const onLeave = handlePointer('leave');

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerleave', onLeave);
    this.cleanupListeners.push(() => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
    });

    // Optional whisper-quiet Repaint button (hero / inline only)
    const repaintBtn = this.querySelector<HTMLButtonElement>('button[data-fc-repaint]');
    if (repaintBtn) {
      const onRepaint = (e: MouseEvent) => {
        e.stopPropagation();
        painter.repaint();
        repaintBtn.classList.remove('is-spinning');
        void repaintBtn.offsetWidth;
        repaintBtn.classList.add('is-spinning');
      };
      repaintBtn.addEventListener('click', onRepaint);
      this.cleanupListeners.push(() => {
        repaintBtn.removeEventListener('click', onRepaint);
      });
    }
  }

  disconnectedCallback(): void {
    this.mounted = false;
    this.stopTick?.();
    this.stopTick = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    for (const cleanup of this.cleanupListeners) cleanup();
    this.cleanupListeners = [];
    this.painter?.dispose();
    this.painter = null;
  }

  /** Programmatic repaint hook if needed by page scripts. */
  repaint(): void {
    this.painter?.repaint();
  }

  private readConfig(): PaintRefConfig {
    const script = this.querySelector<HTMLScriptElement>('script.fc-painting-config');
    if (!script?.textContent) return {};
    try {
      return JSON.parse(script.textContent) as PaintRefConfig;
    } catch {
      return {};
    }
  }
}

export function registerFcPainting(): void {
  if (typeof customElements !== 'undefined' && !customElements.get('fc-painting')) {
    customElements.define('fc-painting', FcPaintingElement);
  }
}

registerFcPainting();
