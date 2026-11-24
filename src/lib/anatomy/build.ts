// Builds all renderable meshes for a given pathology state (runs inside a Web Worker).
import { surfaceNets } from './mesher';
import {
  CORTEX_BOUNDS, CORTEX_PARCELS, CortexParcel, DEEP_MESHES, Pathology, cortexEval, cortexParcel, parcelMeshId, warp,
  whiteMatterSdf,
} from './model';
import { edemaSdf, lesionBounds, lesionSdf } from './lesions';
import { noiseC } from './noise';
import { smoothstep, V3 } from './sdf';

export interface MeshData {
  id: string;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  colors?: Float32Array;
}

export type Quality = 'high' | 'low';

export const wrapped = (fn: (x: number, y: number, z: number, p: Pathology) => number, path: Pathology) => {
  const hasWarp = path.lesions.some((l) => (l.massEffect ?? 0) > 0);
  if (!hasWarp) return (x: number, y: number, z: number) => fn(x, y, z, path);
  return (x: number, y: number, z: number) => {
    const w = warp([x, y, z], path);
    return fn(w[0], w[1], w[2], path);
  };
};

export function buildCortex(path: Pathology, quality: Quality): MeshData[] {
  const step = quality === 'high' ? 1.35 : 2.2;
  const f = wrapped((x, y, z, p) => cortexEval(x, y, z, p).d, path);
  const raw = surfaceNets(f, CORTEX_BOUNDS.bmin, CORTEX_BOUNDS.bmax, step, 3);
  const nV = raw.positions.length / 3;

  // per-vertex sulcal-depth colouring (realistic fresh-tissue palette)
  const colors = new Float32Array(nV * 3);
  const crown = [0.86, 0.69, 0.63];
  const deep = [0.46, 0.3, 0.3];
  for (let v = 0; v < nV; v++) {
    const x = raw.positions[v * 3], y = raw.positions[v * 3 + 1], z = raw.positions[v * 3 + 2];
    const w = warp([x, y, z], path);
    const e = cortexEval(w[0], w[1], w[2], path);
    const t = smoothstep(0.5, 9, -e.base);
    const mott = 0.04 * noiseC.noise(x * 0.3, y * 0.3, z * 0.3);
    for (let c = 0; c < 3; c++) colors[v * 3 + c] = crown[c] + (deep[c] - crown[c]) * t + mott;
  }

  // split into parcels by triangle centroid
  const buckets = new Map<CortexParcel, number[]>();
  CORTEX_PARCELS.forEach((p) => buckets.set(p, []));
  const I = raw.indices, P = raw.positions;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const cx = (P[a] + P[b] + P[c]) / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3;
    const w = warp([cx, cy, cz], path);
    buckets.get(cortexParcel(w[0], w[1], w[2]))!.push(I[t], I[t + 1], I[t + 2]);
  }
  const out: MeshData[] = [];
  for (const [parcel, tris] of buckets) {
    if (!tris.length) continue;
    out.push(subMesh(parcelMeshId(parcel), raw.positions, raw.normals, colors, tris));
  }
  return out;
}

function subMesh(id: string, P: Float32Array, N: Float32Array, C: Float32Array, tris: number[]): MeshData {
  const remap = new Map<number, number>();
  const pos: number[] = [], nrm: number[] = [], col: number[] = [];
  const idx = new Uint32Array(tris.length);
  for (let i = 0; i < tris.length; i++) {
    const v = tris[i];
    let m = remap.get(v);
    if (m === undefined) {
      m = remap.size;
      remap.set(v, m);
      pos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      nrm.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
      col.push(C[v * 3], C[v * 3 + 1], C[v * 3 + 2]);
    }
    idx[i] = m;
  }
  return { id, positions: new Float32Array(pos), normals: new Float32Array(nrm), colors: new Float32Array(col), indices: idx };
}

export function buildDeep(path: Pathology, quality: Quality): MeshData[] {
  const out: MeshData[] = [];
  for (const def of DEEP_MESHES) {
    const step = quality === 'high' ? def.step : def.step * 1.6;
    const raw = surfaceNets(wrapped(def.sdf, path), def.bmin, def.bmax, step, 2);
    if (raw.indices.length) out.push({ id: def.id, ...raw });
  }
  // cerebral white matter (white surface), coarse
  const wmRaw = surfaceNets(wrapped(whiteMatterSdf, path), CORTEX_BOUNDS.bmin, CORTEX_BOUNDS.bmax, quality === 'high' ? 2.3 : 3, 2);
  out.push({ id: 'cerebral-white-matter', ...wmRaw });
  return out;
}

export function buildLesions(path: Pathology, quality: Quality): MeshData[] {
  const out: MeshData[] = [];
  for (const l of path.lesions) {
    const b = lesionBounds(l);
    const size = Math.max(b.bmax[0] - b.bmin[0], b.bmax[1] - b.bmin[1], b.bmax[2] - b.bmin[2]);
    const step = Math.max(0.6, size / (quality === 'high' ? 70 : 40));
    const core = surfaceNets((x, y, z) => lesionSdf(l, [x, y, z] as V3, path), b.bmin, b.bmax, step, 1);
    if (core.indices.length) out.push({ id: `lesion:${l.id}`, ...core });
    if ((l.edema ?? 0) > 0) {
      const ed = surfaceNets((x, y, z) => edemaSdf(l, [x, y, z] as V3, path), b.bmin, b.bmax, step * 1.2, 2);
      if (ed.indices.length) out.push({ id: `edema:${l.id}`, ...ed });
    }
  }
  return out;
}

export type Part = 'cortex' | 'rest' | 'all';
export function buildAll(path: Pathology, quality: Quality, part: Part = 'all'): MeshData[] {
  if (part === 'cortex') return buildCortex(path, quality);
  if (part === 'rest') return [...buildDeep(path, quality), ...buildLesions(path, quality)];
  return [...buildCortex(path, quality), ...buildDeep(path, quality), ...buildLesions(path, quality)];
}
