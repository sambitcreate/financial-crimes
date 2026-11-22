import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetLoopForTests,
  addTick,
  budgetExhausted,
  FRAME_BUDGET_MS,
  frameDeadline,
  wake,
} from '../src/painting/loop';
import { paintingButtonLabel } from '../src/painting/a11y';
import { DARK_GROUND_THRESHOLD, isDarkGround, sampleLocalLuminance } from '../src/painting/pixel-field';

type FrameCb = (ms: number) => void;

describe('shared painting loop (F5)', () => {
  let queue: Map<number, FrameCb>;
  let nextId: number;
  let perfNow: number;

  /** Fire every pending rAF callback once, advancing the fake clock by one 60 Hz frame. */
  function flushFrame(): number {
    perfNow += 16;
    const pending = [...queue.entries()];
    queue.clear();
    for (const [, cb] of pending) cb(perfNow);
    return pending.length;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    queue = new Map();
    nextId = 1;
    perfNow = 1000;
    vi.stubGlobal('performance', { now: () => perfNow });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameCb) => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
    __resetLoopForTests();
  });

  afterEach(() => {
    __resetLoopForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stops requesting frames when every painter is idle, and wake() restarts it', () => {
    const tick = vi.fn(() => Infinity);
    addTick(tick);
    expect(flushFrame()).toBe(1);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(queue.size).toBe(0); // idle: no rAF scheduled
    vi.advanceTimersByTime(60_000);
    expect(queue.size).toBe(0); // Infinity = no maintenance timer either

    wake();
    expect(queue.size).toBe(1);
    flushFrame();
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('keeps animating while a painter asks for the next frame', () => {
    let frames = 0;
    addTick(() => (++frames < 3 ? 0 : Infinity));
    flushFrame();
    flushFrame();
    flushFrame();
    expect(frames).toBe(3);
    expect(queue.size).toBe(0);
  });

  it('uses a timer for periodic maintenance instead of spinning rAF', () => {
    const tick = vi.fn(() => 2);
    addTick(tick);
    flushFrame();
    expect(queue.size).toBe(0);
    vi.advanceTimersByTime(1_999);
    expect(queue.size).toBe(0);
    vi.advanceTimersByTime(1);
    expect(queue.size).toBe(1);
    flushFrame();
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('shares one frame budget across all painters', () => {
    const deadlines: number[] = [];
    const exhausted: boolean[] = [];
    const hog = () => {
      deadlines.push(frameDeadline());
      perfNow += FRAME_BUDGET_MS + 1; // burns the whole slice
      exhausted.push(budgetExhausted());
      return Infinity;
    };
    const polite = () => {
      deadlines.push(frameDeadline());
      exhausted.push(budgetExhausted());
      return Infinity;
    };
    addTick(hog);
    addTick(polite);
    flushFrame();
    expect(deadlines[0]).toBe(deadlines[1]);
    expect(deadlines[0]).toBeLessThan(Infinity);
    // Whoever runs after the hog in this frame sees the budget already spent.
    expect(exhausted).toEqual([true, true]);
    expect(frameDeadline()).toBe(Infinity); // outside a frame there is no deadline
  });

  it('unsubscribing the last painter cancels pending work', () => {
    const off = addTick(() => 0);
    expect(queue.size).toBe(1);
    off();
    expect(queue.size).toBe(0);
  });
});

describe('painting accessibility (F7)', () => {
  it('never produces a doubled period in the accessible name', () => {
    expect(paintingButtonLabel('Oil portrait of a regulator.')).toBe('Oil portrait of a regulator');
    expect(paintingButtonLabel('Portrait ..  ')).toBe('Portrait');
    expect(paintingButtonLabel('   ')).toBe('Editorial oil painting');
  });
});

describe('adaptive contrast guards (F6)', () => {
  const crop = { canvasU0: 0, canvasU1: 1, srcU0: 0, srcU1: 1, srcV0: 0, srcV1: 1 } as never;
  const mood = { shadow: [0, 0, 10] } as never;

  it('returns a neutral 0.5 for missing, zero-size or truncated pixel fields (no NaN)', () => {
    expect(sampleLocalLuminance(null, crop, mood, false, 0.5, 0.5)).toBe(0.5);
    const empty = { width: 0, height: 0, data: new Uint8ClampedArray(0) } as never;
    expect(sampleLocalLuminance(empty, crop, mood, false, 0.5, 0.5)).toBe(0.5);
    const truncated = { width: 4, height: 4, data: new Uint8ClampedArray(8) } as never;
    expect(sampleLocalLuminance(truncated, crop, mood, false, 0.5, 0.5)).toBe(0.5);
  });

  it('switches to screen ink strictly below the 0.48 threshold', () => {
    expect(DARK_GROUND_THRESHOLD).toBe(0.48);
    expect(isDarkGround(0.479)).toBe(true);
    expect(isDarkGround(0.48)).toBe(false);
    expect(isDarkGround(0.9)).toBe(false);
  });
});
