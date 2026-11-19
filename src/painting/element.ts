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
    const motionQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reducedMotion = motionQuery?.matches ?? false;

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

    if (motionQuery) {
      const onMotion = () => {
        painter.reducedMotion = motionQuery.matches;
      };
      motionQuery.addEventListener('change', onMotion);
      this.cleanupListeners.push(() => motionQuery.removeEventListener('change', onMotion));
    }

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = stage.clientWidth;
      const cssH = stage.clientHeight;
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (w <= 0 || h <= 0) return;
      if (painter.width === w && painter.height === h && painter.dpr === dpr) return;
      painter.dpr = dpr;

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

    // ResizeObserver misses DPR-only changes (window dragged to another display)
    let dprQuery: MediaQueryList | null = null;
    const onDprChange = () => {
      resize();
      watchDpr();
    };
    const watchDpr = () => {
      dprQuery?.removeEventListener('change', onDprChange);
      if (typeof window.matchMedia !== 'function') return;
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprQuery.addEventListener('change', onDprChange);
    };
    watchDpr();
    this.cleanupListeners.push(() => dprQuery?.removeEventListener('change', onDprChange));

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

    const send = (kind: PointerKind, e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const u = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const v = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      painter.pointer(kind, u, v, now());
    };

    // Mouse toys fire on press. Touch/pen toys fire on lift, and only for a tap: a scroll or
    // pinch that starts on the painting must not stamp it.
    let tap: { id: number; x: number; y: number } | null = null;
    const TAP_SLOP_PX = 10;
    const onDown = (e: PointerEvent) => {
      // Never intercept clicks on thumbnails inside article links
      if (mode === 'thumb' || !e.isPrimary || e.button !== 0) return;
      if (e.pointerType === 'mouse') send('down', e);
      else tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!tap || tap.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
      tap = null;
      if (moved <= TAP_SLOP_PX) send('down', e);
    };
    const onCancel = () => {
      tap = null;
    };
    const onMove = (e: PointerEvent) => send('move', e);
    const onLeave = (e: PointerEvent) => send('leave', e);

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onCancel);
    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerleave', onLeave);
    this.cleanupListeners.push(() => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onCancel);
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
