import type { PaintMode, PaintRefConfig, PointerKind } from './types';
import { clamp } from './color';
import { hashString, mulberry32 } from './noise';
import { paintWeave } from './weave';
import { addTick, now, wake } from './loop';
import { PAINTING_HINT, paintingButtonLabel } from './a11y';
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
    let liveCanvas = this.querySelector<HTMLCanvasElement>('canvas[data-layer="live"]');
    const repaintBtn = this.querySelector<HTMLButtonElement>('button[data-fc-repaint]');

    const config = this.readConfig();
    const mode = parseMode(this.dataset.mode ?? config.mode);

    // Thumbnails never draw on the live layer: drop it so it never gets a backing store.
    if (mode === 'thumb' && liveCanvas) {
      liveCanvas.remove();
      liveCanvas = null;
    }

    const ground = groundCanvas?.getContext('2d') ?? null;
    const weave = weaveCanvas?.getContext('2d') ?? null;
    const live = liveCanvas?.getContext('2d') ?? null;
    if (!stage || !groundCanvas || !weaveCanvas || !ground || !weave || (mode !== 'thumb' && !live)) {
      // No canvas (blocked, unsupported, or out of memory): a Repaint control would do nothing.
      repaintBtn?.remove();
      this.dataset.state = 'unavailable';
      return;
    }

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
        wake();
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
      if (liveCanvas) {
        liveCanvas.width = w;
        liveCanvas.height = h;
      }

      paintWeave(weave, w, h);
      painter.resize(w, h);
      wake();
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
          if (entry.isIntersecting) wake();
        },
        { rootMargin: '120px 0px' },
      );
      this.intersectionObserver.observe(this);
    } else {
      painter.visible = true;
    }

    // Shared single-rAF clock for all paintings on the page; step() says when it next needs a frame
    this.stopTick = addTick((t, dt) => painter.step(t, dt));

    const interactive = mode !== 'thumb';
    const isPortrait = config.isPortrait ?? true;
    const focusU = clamp(config.focalPoint?.u ?? 0.5, 0.15, 0.85);
    const focusV = clamp(config.focalPoint?.v ?? (isPortrait ? 0.34 : 0.45), 0.15, 0.82);

    // Keyboard & screen-reader accessibility (interactive hero/inline paintings only; thumbs stay non-focusable)
    let announceExhibit = () => {};
    if (interactive) {
      // Server markup is a static role="img"; once it responds to Enter/Space it is a button.
      stage.setAttribute('role', 'button');
      stage.setAttribute('tabindex', '0');
      stage.removeAttribute('aria-roledescription');
      const baseLabel = (
        stage.dataset.baseAriaLabel ??
        stage.getAttribute('aria-label') ??
        'Editorial oil painting'
      ).trim();
      stage.dataset.baseAriaLabel = baseLabel;
      stage.setAttribute('aria-label', paintingButtonLabel(baseLabel));

      let hintEl = this.querySelector<HTMLElement>('.fc-painting-sr-hint');
      if (!hintEl) {
        hintEl = document.createElement('span');
        hintEl.className = 'fc-painting-sr-hint';
        hintEl.id = `fc-painting-hint-${seed.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
        hintEl.textContent = PAINTING_HINT;
        hintEl.hidden = true;
        this.appendChild(hintEl);
      }
      stage.setAttribute('aria-describedby', hintEl.id);

      let statusRegion = this.querySelector<HTMLElement>('.fc-painting-sr-status');
      if (!statusRegion) {
        statusRegion = document.createElement('span');
        statusRegion.className = 'fc-painting-sr-status';
        statusRegion.setAttribute('role', 'status');
        statusRegion.setAttribute('aria-live', 'polite');
        statusRegion.setAttribute('aria-atomic', 'true');
        this.appendChild(statusRegion);
      }

      const toyText = (config.toyText || 'CASE SETTLED').trim();
      const toySubtext = (
        config.toySubtext || (config.toyKind === 'redaction' ? 'Hover bar to reveal' : '')
      ).trim();
      const announcement = `${toyText}${toySubtext ? ` — ${toySubtext}` : ''}`;

      let announceRaf: number | null = null;
      announceExhibit = () => {
        if (!statusRegion) return;
        if (announceRaf !== null) {
          cancelAnimationFrame(announceRaf);
          announceRaf = null;
        }
        statusRegion.textContent = '';
        announceRaf = requestAnimationFrame(() => {
          announceRaf = null;
          if (statusRegion) statusRegion.textContent = announcement;
        });
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.target !== stage || e.repeat) return;
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
        e.preventDefault();
        const t = now();
        painter.pointer('down', focusU, focusV, t);
        painter.pointer('up', focusU, focusV, t);
        wake();
        announceExhibit();
      };
      const onBlur = () => {
        painter.pointer('leave', focusU, focusV, now());
      };

      stage.addEventListener('keydown', onKeyDown);
      stage.addEventListener('blur', onBlur);
      this.cleanupListeners.push(() => {
        stage.removeEventListener('keydown', onKeyDown);
        stage.removeEventListener('blur', onBlur);
        if (announceRaf !== null) {
          cancelAnimationFrame(announceRaf);
          announceRaf = null;
        }
      });
    } else {
      stage.removeAttribute('tabindex');
    }

    const send = (kind: PointerKind, e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const u = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      const v = clamp((e.clientY - rect.top) / rect.height, 0, 1);
      painter.pointer(kind, u, v, now());
      if (kind !== 'leave') wake();
    };

    // Mouse toys fire on press. Touch/pen toys fire on lift, and only for a tap: a scroll or
    // pinch that starts on the painting must not stamp it.
    let tap: { id: number; x: number; y: number } | null = null;
    const TAP_SLOP_PX = 10;
    const onDown = (e: PointerEvent) => {
      // Never intercept clicks on thumbnails inside article links
      if (!interactive || !e.isPrimary || e.button !== 0) return;
      if (e.pointerType === 'mouse') {
        send('down', e);
        announceExhibit();
      } else {
        tap = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!tap || tap.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y);
      tap = null;
      if (moved <= TAP_SLOP_PX) {
        send('down', e);
        announceExhibit();
      }
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
    if (repaintBtn && !interactive) {
      repaintBtn.remove();
    } else if (repaintBtn) {
      const onRepaint = (e: MouseEvent) => {
        e.stopPropagation();
        painter.repaint();
        wake();
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
