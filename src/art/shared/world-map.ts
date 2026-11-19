import { f } from './rough-helpers';
import type { MapWaypoint } from './types';

/**
 * Simplified, lightweight embedded world landmass polygons ([lon, lat] pairs).
 * 100% offline — zero external TopoJSON/CDN fetches!
 * Clean editorial broadsheet cartography fidelity.
 */
export const CONTINENT_POLYGONS: Array<{ name: string; points: Array<[number, number]> }> = [
  {
    name: 'North America',
    points: [
      [-165, 65], [-145, 70], [-125, 69], [-95, 69], [-80, 62], [-64, 59],
      [-55, 51], [-66, 44], [-71, 41], [-76, 35], [-81, 25], [-83, 30],
      [-90, 29], [-97, 26], [-96, 19], [-87, 21], [-83, 10], [-78, 8],
      [-85, 11], [-93, 15], [-105, 20], [-112, 29], [-117, 32], [-124, 41],
      [-125, 49], [-136, 58], [-152, 60], [-162, 55],
    ],
  },
  {
    name: 'Greenland',
    points: [
      [-50, 60], [-42, 65], [-20, 74], [-28, 82], [-55, 81], [-68, 76], [-56, 68],
    ],
  },
  {
    name: 'South America',
    points: [
      [-78, 9], [-72, 12], [-61, 10], [-50, 2], [-35, -6], [-39, -15],
      [-42, -23], [-53, -33], [-64, -42], [-68, -54], [-74, -52], [-73, -38],
      [-71, -18], [-81, -5], [-79, 2],
    ],
  },
  {
    name: 'UK & Ireland',
    points: [
      [-6, 50], [1.5, 51], [1.5, 53], [-1.5, 55.5], [-3, 58.5], [-6, 57], [-5.5, 53],
    ],
  },
  {
    name: 'Continental Europe',
    points: [
      [-9.5, 37], [-9, 43], [-2, 43.5], [-4.5, 48.3], [2, 51], [6, 53.5],
      [9, 55], [10, 58], [5, 61], [12, 66], [24, 70], [31, 69],
      [28, 60], [21, 55], [14, 54], [20, 54.5], [27, 59], [40, 65],
      [58, 68], [60, 55], [47, 46], [39, 45], [30, 46], [27, 41],
      [23, 37], [19, 40], [16, 40], [12.5, 42], [14, 45.5], [9, 44.5],
      [4, 43.3], [0, 39], [-5.5, 36],
    ],
  },
  {
    name: 'Africa',
    points: [
      [-17, 15], [-13, 28], [-6, 35.8], [10, 37], [15, 32], [25, 32],
      [33, 31], [43, 12], [51, 11], [42, -2], [40, -15], [34, -26],
      [20, -35], [15, -26], [12, -12], [9, 4], [2, 6], [-8, 5], [-15, 11],
    ],
  },
  {
    name: 'Middle East & Asia',
    points: [
      [27, 41], [40, 42], [48, 46], [60, 55], [68, 70], [105, 74],
      [140, 71], [170, 66], [162, 56], [142, 54], [135, 43], [129, 35],
      [121, 38], [122, 30], [116, 22], [109, 20], [109, 12], [103, 1.3],
      [99, 7], [97, 16], [90, 22], [85, 20], [80, 13], [77, 8],
      [73, 19], [68, 23], [60, 25], [56, 26], [51, 24], [59, 22],
      [52, 16], [44, 13], [36, 28], [35, 36],
    ],
  },
  {
    name: 'Japan',
    points: [
      [130, 31], [136, 34], [141, 38], [145, 44], [140, 42], [136, 37], [131, 33],
    ],
  },
  {
    name: 'Maritime SE Asia',
    points: [
      [96, 5], [105, -6], [114, -8], [118, -3], [117, 5], [110, 1], [104, -1],
    ],
  },
  {
    name: 'Australia',
    points: [
      [114, -22], [129, -14], [136, -12], [142, -11], [153, -26], [150, -37],
      [138, -35], [129, -32], [115, -34], [113, -25],
    ],
  },
];

export interface MapProjection {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  project: (lon: number, lat: number) => [number, number];
}

export function createMapProjection(
  waypoints: MapWaypoint[],
  region: 'world' | 'europe' | 'americas' | 'asia' | 'transatlantic',
  box: { x: number; y: number; w: number; h: number }
): MapProjection {
  let minLon = -135;
  let maxLon = 155;
  let minLat = -45;
  let maxLat = 68;

  if (region === 'europe') {
    minLon = -14;
    maxLon = 34;
    minLat = 34;
    maxLat = 62;
  } else if (region === 'americas') {
    minLon = -126;
    maxLon = -52;
    minLat = 4;
    maxLat = 54;
  } else if (region === 'asia') {
    minLon = 48;
    maxLon = 146;
    minLat = -6;
    maxLat = 48;
  } else if (region === 'transatlantic') {
    minLon = -98;
    maxLon = 28;
    minLat = 16;
    maxLat = 60;
  } else if (waypoints.length >= 2) {
    // Auto-frame smartly if all waypoints live in a compact cluster
    const lons = waypoints.map((w) => w.lon);
    const lats = waypoints.map((w) => w.lat);
    const lonSpan = Math.max(...lons) - Math.min(...lons);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    if (lonSpan < 45 && latSpan < 30) {
      const padLon = Math.max(12, lonSpan * 0.45);
      const padLat = Math.max(8, latSpan * 0.5);
      minLon = Math.max(-170, Math.min(...lons) - padLon);
      maxLon = Math.min(175, Math.max(...lons) + padLon);
      minLat = Math.max(-55, Math.min(...lats) - padLat);
      maxLat = Math.min(72, Math.max(...lats) + padLat);
    }
  }

  // Match aspect ratio cleanly without stretching continents
  const mapAspect = box.w / Math.max(1, box.h);
  const lonRange = maxLon - minLon;
  const latRange = maxLat - minLat;
  const cosMid = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const effectiveLonRange = lonRange * Math.max(0.55, cosMid);
  const dataAspect = effectiveLonRange / Math.max(1, latRange);

  if (dataAspect > mapAspect) {
    const targetLatRange = effectiveLonRange / mapAspect;
    const extra = (targetLatRange - latRange) / 2;
    minLat = Math.max(-60, minLat - extra);
    maxLat = Math.min(76, maxLat + extra);
  } else {
    const targetLonRange = (latRange * mapAspect) / Math.max(0.55, cosMid);
    const extra = (targetLonRange - lonRange) / 2;
    minLon = Math.max(-175, minLon - extra);
    maxLon = Math.min(178, maxLon + extra);
  }

  const project = (lon: number, lat: number): [number, number] => {
    const nx = (lon - minLon) / Math.max(0.001, maxLon - minLon);
    const ny = 1 - (lat - minLat) / Math.max(0.001, maxLat - minLat);
    return [box.x + nx * box.w, box.y + ny * box.h];
  };

  return { minLon, maxLon, minLat, maxLat, project };
}

export function continentPathsSvg(
  proj: MapProjection,
  opts: { fill: string; stroke: string; hatchId?: string }
): string {
  return CONTINENT_POLYGONS.map((poly) => {
    const pts = poly.points
      .map(([lon, lat]) => {
        const [x, y] = proj.project(lon, lat);
        return `${f(x)},${f(y)}`;
      })
      .join(' ');
    return `
      <polygon points="${pts}" fill="${opts.fill}" stroke="${opts.stroke}" stroke-width="1" stroke-linejoin="round"/>
      ${opts.hatchId ? `<polygon points="${pts}" fill="url(#${opts.hatchId})" stroke="none" opacity="0.55"/>` : ''}
    `;
  }).join('');
}
