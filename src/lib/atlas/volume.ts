// Volume sampling and the packed mesh format shared by the build script and the browser workers.
import { DIM, ORIGIN } from './labels';

const NX = DIM[0], NY = DIM[1], NZ = DIM[2];
const SXY = NX * NY;

/** Scene point (Right, Superior, Anterior) → continuous voxel coordinates. Scene (x,y,z) = MNI (x,z,y). */
export const sceneToVox = (x: number, y: number, z: number): [number, number, number] => [x - ORIGIN[0], z - ORIGIN[1], y - ORIGIN[2]];
export const voxToScene = (i: number, j: number, k: number): [number, number, number] => [i + ORIGIN[0], k + ORIGIN[2], j + ORIGIN[1]];
export const vidx = (i: number, j: number, k: number) => i + NX * j + SXY * k;

/** Nearest-neighbour lookup at a scene point (0 outside the grid). */
export function nearest(vol: ArrayLike<number>, x: number, y: number, z: number): number {
  const i = Math.round(x - ORIGIN[0]), j = Math.round(z - ORIGIN[1]), k = Math.round(y - ORIGIN[2]);
  if (i < 0 || j < 0 || k < 0 || i >= NX || j >= NY || k >= NZ) return 0;
  return vol[i + NX * j + SXY * k];
}

/** Trilinear interpolation at a scene point (0 outside the grid). */
export function trilinear(vol: ArrayLike<number>, x: number, y: number, z: number): number {
  const fi = x - ORIGIN[0], fj = z - ORIGIN[1], fk = y - ORIGIN[2];
  const i = Math.floor(fi), j = Math.floor(fj), k = Math.floor(fk);
  if (i < 0 || j < 0 || k < 0 || i >= NX - 1 || j >= NY - 1 || k >= NZ - 1) return 0;
  const a = fi - i, b = fj - j, c = fk - k;
  const o = i + NX * j + SXY * k;
  const v000 = vol[o], v100 = vol[o + 1], v010 = vol[o + NX], v110 = vol[o + NX + 1];
  const v001 = vol[o + SXY], v101 = vol[o + SXY + 1], v011 = vol[o + SXY + NX], v111 = vol[o + SXY + NX + 1];
  const x00 = v000 + (v100 - v000) * a, x10 = v010 + (v110 - v010) * a;
  const x01 = v001 + (v101 - v001) * a, x11 = v011 + (v111 - v011) * a;
  const y0 = x00 + (x10 - x00) * b, y1 = x01 + (x11 - x01) * b;
  return y0 + (y1 - y0) * c;
}

// ─── Packed mesh container ──────────────────────────────────────────────────────────
// [u32 headerLength][header JSON utf8][pad to 4][blobs...]; positions int16 (×POS_SCALE), normals int8 (×127),
// colours uint8, indices uint32.
export const POS_SCALE = 50;

export interface PackedMesh {
  id: string;
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  colors?: Float32Array;
}

interface Entry { id: string; nv: number; ni: number; color: boolean }

export function packMeshes(meshes: PackedMesh[]): Uint8Array {
  const entries: Entry[] = meshes.map((m) => ({ id: m.id, nv: m.positions.length / 3, ni: m.indices.length, color: !!m.colors }));
  const head = new TextEncoder().encode(JSON.stringify(entries));
  const headPad = (4 + head.length + 3) & ~3;
  let size = headPad;
  for (const e of entries) {
    size += e.nv * 6; size = (size + 3) & ~3;
    size += e.nv * 3; size = (size + 3) & ~3;
    if (e.color) { size += e.nv * 3; size = (size + 3) & ~3; }
    size += e.ni * 4;
  }
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, head.length, true);
  buf.set(head, 4);
  let o = headPad;
  meshes.forEach((m, n) => {
    const e = entries[n];
    const p = new Int16Array(buf.buffer, o, e.nv * 3);
    for (let i = 0; i < p.length; i++) p[i] = Math.round(m.positions[i] * POS_SCALE);
    o += e.nv * 6; o = (o + 3) & ~3;
    const nr = new Int8Array(buf.buffer, o, e.nv * 3);
    for (let i = 0; i < nr.length; i++) nr[i] = Math.round(Math.max(-1, Math.min(1, m.normals[i])) * 127);
    o += e.nv * 3; o = (o + 3) & ~3;
    if (m.colors) {
      const c = new Uint8Array(buf.buffer, o, e.nv * 3);
      for (let i = 0; i < c.length; i++) c[i] = Math.round(Math.max(0, Math.min(1, m.colors[i])) * 255);
      o += e.nv * 3; o = (o + 3) & ~3;
    }
    new Uint32Array(buf.buffer, o, e.ni).set(m.indices);
    o += e.ni * 4;
  });
  return buf;
}

export function unpackMeshes(buf: ArrayBuffer): PackedMesh[] {
  const dv = new DataView(buf);
  const hl = dv.getUint32(0, true);
  const entries: Entry[] = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let o = (4 + hl + 3) & ~3;
  return entries.map((e) => {
    const p = new Int16Array(buf, o, e.nv * 3);
    const positions = new Float32Array(e.nv * 3);
    for (let i = 0; i < p.length; i++) positions[i] = p[i] / POS_SCALE;
    o += e.nv * 6; o = (o + 3) & ~3;
    const nr = new Int8Array(buf, o, e.nv * 3);
    const normals = new Float32Array(e.nv * 3);
    for (let i = 0; i < nr.length; i++) normals[i] = nr[i] / 127;
    o += e.nv * 3; o = (o + 3) & ~3;
    let colors: Float32Array | undefined;
    if (e.color) {
      const c = new Uint8Array(buf, o, e.nv * 3);
      colors = new Float32Array(e.nv * 3);
      for (let i = 0; i < c.length; i++) colors[i] = c[i] / 255;
      o += e.nv * 3; o = (o + 3) & ~3;
    }
    const indices = new Uint32Array(buf.slice(o, o + e.ni * 4));
    o += e.ni * 4;
    return { id: e.id, positions, normals, indices, colors };
  });
}

export interface AtlasMeta {
  version: number;
  /** T1 template intensities (uint8 units) of the three tissue classes */
  csf: number;
  gm: number;
  wm: number;
  /** pial isosurface threshold used for the cortex mesh */
  pialThr: number;
}
