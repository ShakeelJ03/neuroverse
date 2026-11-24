// Signed-distance primitives (negative inside). Units: millimetres.
// Coordinate frame used across NEUROVERSE ("scene frame"):
//   x = patient Right (+) / Left (-)
//   y = Superior (+) / Inferior (-)
//   z = Anterior (+) / Posterior (-)
// Origin ≈ anterior commissure, so scene (x, y, z) == MNI (x, z, y).

export type V3 = [number, number, number];

export const mni = (x: number, y: number, z: number): V3 => [x, z, y];

export function sdEllipsoid(px: number, py: number, pz: number, c: V3, r: V3): number {
  // Inigo Quilez's bounded approximation
  const x = (px - c[0]) / r[0];
  const y = (py - c[1]) / r[1];
  const z = (pz - c[2]) / r[2];
  const k0 = Math.sqrt(x * x + y * y + z * z);
  const x2 = x / r[0], y2 = y / r[1], z2 = z / r[2];
  const k1 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
  if (k1 < 1e-9) return -Math.min(r[0], r[1], r[2]);
  return (k0 * (k0 - 1)) / k1;
}

export function sdSuperEllipsoid(px: number, py: number, pz: number, c: V3, r: V3, n: number): number {
  const x = Math.abs((px - c[0]) / r[0]);
  const y = Math.abs((py - c[1]) / r[1]);
  const z = Math.abs((pz - c[2]) / r[2]);
  const f = Math.pow(Math.pow(x, n) + Math.pow(y, n) + Math.pow(z, n), 1 / n);
  return (f - 1) * Math.min(r[0], r[1], r[2]);
}

export const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - (h * h * k) / 4;
};
export const smax = (a: number, b: number, k: number) => -smin(-a, -b, k);

export interface TubeNode {
  p: V3;
  r: number;
}

/** Tube along a polyline with linearly interpolated radius. `scale` squashes the
 *  cross-section per axis (values <1 flatten the tube along that axis). */
export function sdTube(px: number, py: number, pz: number, nodes: TubeNode[], scale: V3 = [1, 1, 1]): number {
  let best = Infinity;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i].p, b = nodes[i + 1].p;
    const ax = px - a[0], ay = py - a[1], az = pz - a[2];
    const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
    const bb = bx * bx + by * by + bz * bz;
    let t = bb > 0 ? (ax * bx + ay * by + az * bz) / bb : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = (ax - bx * t) / scale[0];
    const dy = (ay - by * t) / scale[1];
    const dz = (az - bz * t) / scale[2];
    const r = nodes[i].r + (nodes[i + 1].r - nodes[i].r) * t;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
    if (d < best) best = d;
  }
  return best * Math.min(scale[0], scale[1], scale[2]);
}

/** Mirror a right-hemisphere node list to the left (x → -x). */
export const mirrorNodes = (nodes: TubeNode[], s: number): TubeNode[] =>
  nodes.map((n) => ({ p: [n.p[0] * s, n.p[1], n.p[2]], r: n.r }));

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
