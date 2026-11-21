export const DURATION = 56;

export const ISLAND = { x: 168, z: -78, radius: 62 };
export const RING = { x: 36, z: -18, radius: 210, width: 26 };
export const PLANE_STOP = { x: -7.4, y: 0.02, z: -22 };

export const PHASES = [
  { id: "approach", label: "Approach", line: "Over the reef", t: 0 },
  { id: "reef", label: "Reef", line: "Lagoon in sight", t: 9 },
  { id: "flare", label: "Flare", line: "Power back", t: 18 },
  { id: "splash", label: "Splash", line: "On the water", t: 24 },
  { id: "taxi", label: "Taxi", line: "To the pontoon", t: 30 },
  { id: "ashore", label: "Ashore", line: "Four ashore", t: 47 },
] as const;

export type PhaseId = (typeof PHASES)[number]["id"];

export function phaseAt(t: number) {
  let phase: (typeof PHASES)[number] = PHASES[0];
  for (const next of PHASES) {
    if (t >= next.t) phase = next;
  }
  return phase;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function hash(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

type Wave = { x: number; z: number; k: number; amp: number; speed: number };

function wave(dx: number, dz: number, len: number, amp: number, speed: number): Wave {
  const l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l, k: (Math.PI * 2) / len, amp, speed };
}

export const WAVES: readonly Wave[] = [
  wave(0.15, 0.99, 84, 0.1, 0.82),
  wave(0.98, 0.2, 26, 0.16, 1.1),
  wave(0.25, 0.97, 14, 0.09, 1.45),
  wave(-0.55, 0.83, 7.5, 0.04, 1.85),
  wave(0.72, -0.69, 3.8, 0.018, 2.15),
];

/** 0 inside the pass, 1 where the motu ring is solid. */
export function reefSolid(angle: number): number {
  const pass = 1.32;
  const d = Math.abs(Math.atan2(Math.sin(angle - pass), Math.cos(angle - pass)));
  return smoothstep(0.4, 0.95, d);
}

function bump(x: number, z: number, cx: number, cz: number, radius: number, amp: number): number {
  const d = Math.hypot(x - cx, z - cz) / radius;
  if (d >= 1) return 0;
  const e = 1 - d;
  return e * e * amp;
}

export function landHeight(x: number, z: number): number {
  const ix = (x - ISLAND.x) * 0.78;
  const iz = (z - ISLAND.z) * 1.08;
  const d = Math.hypot(ix, iz);
  let h = 0;
  if (d < ISLAND.radius + 10) {
    const e = Math.max(0, 1 - d / (ISLAND.radius + 6));
    const apron = Math.pow(e, 0.65) * 8;
    const plug = Math.hypot((ix - 2) * 0.62, (iz + 4) * 0.48);
    const peakAng = Math.atan2(iz + 4, ix - 2);
    const ridges = 0.86 + 0.14 * Math.sin(peakAng * 3.0 + 0.4);
    const body = Math.exp(-(plug * plug) / 1600) * 54 * ridges;
    const crest = Math.exp(-(plug * plug) / 260) * 22;
    const shoulder = Math.exp(-((ix + 22) ** 2) / 700 - ((iz + 6) ** 2) / 900) * 16;
    const skirt = e * e * (3 - 2 * e);
    h += (apron + body + crest + shoulder) * skirt;
  }
  const dx = x - RING.x;
  const dz = z - RING.z;
  const r = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const solid = reefSolid(ang);
  const ring = Math.max(0, 1 - Math.abs(r - RING.radius) / RING.width);
  const lumps = 0.55 + 0.45 * Math.sin(ang * 9 + 0.7);
  h += ring * ring * solid * Math.max(0, lumps) * 3.15;
  h += bump(x, z, 28, 24, 16, 2.4);
  h += bump(x, z, -96, 78, 20, 2.8);
  h += bump(x, z, 124, 86, 14, 2.1);
  h += bump(x, z, -40, -120, 18, 2.2);
  return h;
}

export function lagoonFactor(x: number, z: number): number {
  const r = Math.hypot(x - RING.x, z - RING.z);
  return 1 - smoothstep(RING.radius - 28, RING.radius + 40, r);
}

export function waterHeight(x: number, z: number, time: number): number {
  const ampScale = 1 - 0.72 * lagoonFactor(x, z);
  let h = 0;
  for (const w of WAVES) {
    const phase = (w.x * x + w.z * z) * w.k - time * w.speed * w.k;
    h += Math.sin(phase) * w.amp * ampScale;
  }
  return h;
}

function distToLand(x: number, z: number): number {
  const ix = (x - ISLAND.x) * 0.86;
  const iz = (z - ISLAND.z) * 1.05;
  let best = Math.hypot(ix, iz) - (ISLAND.radius - 4);
  const dx = x - RING.x;
  const dz = z - RING.z;
  const r = Math.hypot(dx, dz);
  const solid = reefSolid(Math.atan2(dz, dx));
  if (solid > 0.2) best = Math.min(best, Math.abs(r - RING.radius) - RING.width * 0.72 * solid);
  best = Math.min(best, Math.hypot(x - 28, z - 24) - 12);
  best = Math.min(best, Math.hypot(x + 96, z - 78) - 15);
  best = Math.min(best, Math.hypot(x - 124, z - 86) - 10);
  best = Math.min(best, Math.hypot(x + 40, z + 120) - 13);
  return best;
}

const MASK_SIZE = 384;
const MASK_EXTENT = 1400;

export function buildMaskTexture(): Uint8Array {
  const data = new Uint8Array(MASK_SIZE * MASK_SIZE * 4);
  for (let iy = 0; iy < MASK_SIZE; iy++) {
    for (let ix = 0; ix < MASK_SIZE; ix++) {
      const u = (ix + 0.5) / MASK_SIZE;
      const v = (iy + 0.5) / MASK_SIZE;
      const x = (u - 0.5) * MASK_EXTENT;
      const z = (v - 0.5) * MASK_EXTENT;
      const lagoon = lagoonFactor(x, z);
      const dist = distToLand(x, z);
      const shore = Math.exp(-Math.max(dist, 0) * 0.1);
      const dx = x - RING.x;
      const dz = z - RING.z;
      const radius = Math.hypot(dx, dz);
      const reefBand = Math.exp(-((radius - RING.radius) ** 2) / 90);
      const reef = reefBand * reefSolid(Math.atan2(dz, dx)) * (1 - smoothstep(0, 18, Math.max(dist, 0)));
      const o = (iy * MASK_SIZE + ix) * 4;
      data[o] = Math.round(lagoon * 255);
      data[o + 1] = Math.round(Math.min(1, shore) * 255);
      data[o + 2] = Math.round(Math.min(1, reef) * 255);
      data[o + 3] = 255;
    }
  }
  return data;
}

export const MASK_SIZE_PX = MASK_SIZE;
export const MASK_SPAN = MASK_EXTENT;

export function landNormal(x: number, z: number): [number, number, number] {
  const e = 1.4;
  const dhx = (landHeight(x + e, z) - landHeight(x - e, z)) / (2 * e);
  const dhz = (landHeight(x, z + e) - landHeight(x, z - e)) / (2 * e);
  const nx = -dhx;
  const ny = 1;
  const nz = -dhz;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
