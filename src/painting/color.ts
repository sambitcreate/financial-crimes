import type { HSL } from './types';

export const clamp = (x: number, lo: number, hi: number): number =>
  x < lo ? lo : x > hi ? hi : x;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Linear HSL interpolation (matches sambitbiswas.com color utility). */
export function mixHsl(a: HSL, b: HSL, t: number): HSL {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Shortest-arc hue interpolation for natural oil glazing & vignettes. */
export function mixHslShortest(a: HSL, b: HSL, t: number): HSL {
  const dh = ((((b[0] - a[0]) % 360) + 540) % 360) - 180;
  return [
    (a[0] + dh * t + 360) % 360,
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

/** CSS colour string for canvas. Hue wraps; saturation/lightness clamp to 0..100. */
export function hslCss(h: number, s: number, l: number, alpha = 1): string {
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue.toFixed(1)} ${clamp(s, 0, 100).toFixed(1)}% ${clamp(l, 0, 100).toFixed(1)}% / ${clamp(alpha, 0, 1).toFixed(3)})`;
}

export function rgbToHsl(r: number, g: number, b: number): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s * 100, l * 100];
}

export function hslToRgb([h, s, l]: HSL): [number, number, number] {
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + (((h % 360) + 360) % 360) / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function luminance(c: HSL): number {
  const [r, g, b] = hslToRgb(c).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two colours (1..21). */
export function contrastRatio(a: HSL, b: HSL): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
