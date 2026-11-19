import { mulberry32, valueNoise } from './noise';

const TILE = 180;
let cached: HTMLCanvasElement | null | undefined;

/**
 * Procedural Belgian linen canvas weave tile, generated once per browser session.
 * Composited over the ground stroke layer via CSS `mix-blend-mode: multiply`.
 */
export function getWeaveTile(): HTMLCanvasElement | null {
  if (cached !== undefined) return cached;
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  const g = canvas.getContext('2d');
  if (!g) {
    cached = null;
    return null;
  }

  const img = g.createImageData(TILE, TILE);
  const rand = mulberry32(3);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const warp = Math.sin((x / TILE) * Math.PI * 2 * 30) * 0.5 + 0.5;
      const weft = Math.sin((y / TILE) * Math.PI * 2 * 30) * 0.5 + 0.5;
      const tooth = warp * weft * 18 + rand() * 15 + valueNoise(x / 9, y / 9) * 14;
      const v = Math.max(0, Math.min(255, Math.round(255 - tooth)));
      const i = (y * TILE + x) * 4;
      // Slightly warmer archival rag-linen tint
      img.data[i] = v;
      img.data[i + 1] = Math.max(0, v - 3);
      img.data[i + 2] = Math.max(0, v - 8);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  cached = canvas;
  return canvas;
}

/** Fill a canvas with the repeating linen weave (composited with mix-blend-multiply in CSS). */
export function paintWeave(g: CanvasRenderingContext2D, width: number, height: number): void {
  const tile = getWeaveTile();
  if (!tile) return;
  const pattern = g.createPattern(tile, 'repeat');
  if (!pattern) return;
  g.clearRect(0, 0, width, height);
  g.fillStyle = pattern;
  g.fillRect(0, 0, width, height);
}
