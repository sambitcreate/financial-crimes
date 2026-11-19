/**
 * Deterministic string hash (FNV-1a 32-bit) + mulberry32 PRNG.
 * Seeded from article.id so build-time SSR SVG and client interactive canvas match identically.
 */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface PRNG {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, max: number) => number;
  jitter: (amount: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
}

export function mulberry32(seedNum: number): () => number {
  let a = seedNum >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createPrng(seed: string | number): PRNG {
  const num = typeof seed === 'number' ? seed : hashString(seed || 'financial-crimes');
  const raw = mulberry32(num);
  return {
    next: raw,
    range(min: number, max: number): number {
      return min + raw() * (max - min);
    },
    int(min: number, max: number): number {
      return Math.floor(min + raw() * (max - min + 1));
    },
    jitter(amount: number): number {
      return (raw() - 0.5) * 2 * amount;
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(raw() * items.length) % items.length];
    },
    chance(probability: number): boolean {
      return raw() < probability;
    },
  };
}
