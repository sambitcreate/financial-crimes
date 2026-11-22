/**
 * One shared clock for every <fc-painting> on the page.
 *
 * - A single rAF drives all painters, and they share ONE per-frame time budget
 *   (`frameDeadline()`), so twenty thumbnails under reduced motion still cost ~12ms per
 *   frame in total instead of 10ms each.
 * - The loop idles: each tick returns how many seconds until it next needs a frame
 *   (0 = next frame, Infinity = sleep until woken). When nobody needs a frame the rAF stops;
 *   a timer covers periodic idle maintenance, and `wake()` restarts it on visibility,
 *   intersection, pointer, resize or image-load events.
 */

/** Return seconds until the next frame is needed (0 = next frame, Infinity = sleep). `void` = 0. */
export type Tick = (t: number, dt: number) => number | void;

/** Total main-thread slice per frame shared by all painters. */
export const FRAME_BUDGET_MS = 12;

const ticks = new Set<Tick>();
let raf = 0;
let timer: ReturnType<typeof setTimeout> | 0 = 0;
let last = 0;
let clock = 0;
let frameCount = 0;
let deadline = Infinity;
/** performance.now() when the loop went idle; null while running or tab-hidden. */
let sleptAt: number | null = null;
let visibilityBound = false;

const nowMs = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

/** Seconds elapsed on the shared painting clock. */
export function now(): number {
  return clock;
}

/** performance.now() timestamp by which this frame's painting work should stop. */
export function frameDeadline(): number {
  return deadline;
}

/** True once the shared per-frame budget is spent. */
export function budgetExhausted(): boolean {
  return nowMs() > deadline;
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = 0;
  }
}

function requestFrame(): void {
  if (raf || ticks.size === 0 || typeof requestAnimationFrame === 'undefined' || isHidden()) return;
  clearTimer();
  if (sleptAt !== null) {
    // Everything was idle while asleep, so let the clock catch up with real time: idle-batch
    // and interaction-grace timers are measured on this clock.
    clock += Math.max(0, nowMs() - sleptAt) / 1000;
    sleptAt = null;
  }
  last = nowMs();
  raf = requestAnimationFrame(frame);
}

function sleep(seconds: number): void {
  sleptAt = nowMs();
  clearTimer();
  if (Number.isFinite(seconds)) {
    timer = setTimeout(() => {
      timer = 0;
      requestFrame();
    }, Math.max(16, seconds * 1000));
  }
}

function frame(ms: number): void {
  raf = 0;
  if (ticks.size === 0) return;
  if (isHidden()) {
    last = ms;
    return;
  }
  const dt = Math.min(0.1, Math.max(0, (ms - last) / 1000));
  last = ms;
  clock += dt;
  deadline = nowMs() + FRAME_BUDGET_MS;

  // Rotate who goes first so a big hero cannot starve the thumbnails of the shared budget.
  const list = [...ticks];
  const offset = list.length > 0 ? frameCount++ % list.length : 0;
  let nextWake = Infinity;
  for (let i = 0; i < list.length; i++) {
    const tick = list[(i + offset) % list.length];
    if (!ticks.has(tick)) continue;
    const wantIn = tick(clock, dt);
    const seconds = typeof wantIn === 'number' && !Number.isNaN(wantIn) ? wantIn : 0;
    if (seconds < nextWake) nextWake = seconds;
  }
  deadline = Infinity;

  if (ticks.size === 0) return;
  if (nextWake <= 0) {
    raf = requestAnimationFrame(frame);
  } else {
    sleep(nextWake);
  }
}

/** Restart the loop after an event that may need painting (pointer, resize, visibility, load). */
export function wake(): void {
  if (isHidden()) return;
  requestFrame();
}

function bindVisibility(): void {
  if (visibilityBound || typeof document === 'undefined') return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestFrame();
    } else {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      clearTimer();
      // A hidden tab freezes the clock (no catch-up), unlike an idle sleep.
      sleptAt = null;
    }
  });
}

/** Run `tick` on the shared loop. Returns an unsubscribe callback. */
export function addTick(tick: Tick): () => void {
  bindVisibility();
  ticks.add(tick);
  requestFrame();
  return () => {
    ticks.delete(tick);
    if (ticks.size === 0) {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      clearTimer();
      sleptAt = null;
    }
  };
}

/** Test hook: reset module state between unit tests. */
export function __resetLoopForTests(): void {
  ticks.clear();
  if (raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
  raf = 0;
  clearTimer();
  last = 0;
  clock = 0;
  frameCount = 0;
  deadline = Infinity;
  sleptAt = null;
}
