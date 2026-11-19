export type Tick = (t: number, dt: number) => void;

const ticks = new Set<Tick>();
let raf = 0;
let last = 0;
let clock = 0;
let visibilityBound = false;

/** Seconds elapsed on the shared painting clock. */
export function now(): number {
  return clock;
}

function frame(ms: number): void {
  raf = 0;
  if (ticks.size === 0) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    last = ms;
    return;
  }
  const dt = Math.min(0.1, Math.max(0, (ms - last) / 1000));
  last = ms;
  clock += dt;
  for (const tick of [...ticks]) {
    tick(clock, dt);
  }
  if (ticks.size > 0) {
    raf = requestAnimationFrame(frame);
  }
}

function scheduleIfNeeded(): void {
  if (!raf && ticks.size > 0 && typeof requestAnimationFrame !== 'undefined') {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === 'undefined') return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      scheduleIfNeeded();
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
}

/** Run `tick` every animation frame on one shared rAF. Returns an unsubscribe callback. */
export function addTick(tick: Tick): () => void {
  bindVisibility();
  ticks.add(tick);
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    scheduleIfNeeded();
  }
  return () => {
    ticks.delete(tick);
    if (ticks.size === 0 && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
