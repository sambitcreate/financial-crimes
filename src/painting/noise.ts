export type Rand = () => number;

/** Small, fast seeded PRNG (mulberry32). Returns floats in [0, 1). */
export function mulberry32(seed: number): Rand {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string, unsigned 32-bit. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

const PERM = (() => {
  const rand = mulberry32(7);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const out = new Uint8Array(512);
  for (let i = 0; i < 512; i++) out[i] = p[i & 255];
  return out;
})();

/** Smooth value noise in [0, 1]. */
export function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const X = xi & 255;
  const Y = yi & 255;
  const a = PERM[PERM[X] + Y];
  const b = PERM[PERM[X + 1] + Y];
  const c = PERM[PERM[X] + Y + 1];
  const d = PERM[PERM[X + 1] + Y + 1];
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) / 255;
}

/** Three octaves of value noise, in [0, 1]. */
export function fbm(x: number, y: number): number {
  return (
    valueNoise(x, y) * 0.55 +
    valueNoise(x * 2.03, y * 2.03) * 0.3 +
    valueNoise(x * 4.1, y * 4.1) * 0.15
  );
}
