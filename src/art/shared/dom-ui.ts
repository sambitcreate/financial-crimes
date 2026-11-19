import type { EditorialPalette } from './palette';

export function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function createSvgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  return el;
}

/**
 * Sets CSS custom properties for the active editorial palette on the interactive stage.
 */
export function applyStagePalette(stage: HTMLElement, pal: EditorialPalette): void {
  stage.style.setProperty('--fc-art-paper', pal.paper);
  stage.style.setProperty('--fc-art-paper-alt', pal.paperAlt);
  stage.style.setProperty('--fc-art-paper-card', pal.paperCard);
  stage.style.setProperty('--fc-art-ink', pal.ink);
  stage.style.setProperty('--fc-art-ink-soft', pal.inkSoft);
  stage.style.setProperty('--fc-art-ink-muted', pal.inkMuted);
  stage.style.setProperty('--fc-art-rule', pal.rule);
  stage.style.setProperty('--fc-art-rule-light', pal.ruleLight);
  stage.style.setProperty('--fc-art-spot', pal.accent);
  stage.style.setProperty('--fc-art-spot-wash', pal.accentWash);
}

/**
 * Managed requestAnimationFrame loop that respects AbortSignal AND container pause state (`data-paused="true"`).
 */
export function startManagedRaf(
  container: HTMLElement,
  signal: AbortSignal,
  tick: (dtSec: number, elapsedSec: number) => boolean | void
): void {
  let rafId = 0;
  let lastTs = performance.now();
  let elapsed = 0;

  const loop = (now: number): void => {
    if (signal.aborted) return;
    if (container.dataset.paused === 'true') {
      lastTs = now;
      rafId = requestAnimationFrame(loop);
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
    lastTs = now;
    elapsed += dt;
    const keepGoing = tick(dt, elapsed);
    if (keepGoing !== false && !signal.aborted) {
      rafId = requestAnimationFrame(loop);
    }
  };

  signal.addEventListener('abort', () => {
    if (rafId) cancelAnimationFrame(rafId);
  });

  rafId = requestAnimationFrame(loop);
}
