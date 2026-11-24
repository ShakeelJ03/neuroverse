/**
 * Converts the downloaded TemplateFlow NIfTI files (atlas-src/) into compact assets in public/atlas/:
 *   t1.u8.gz     T1 template, uint8 (WM ≈ 200)
 *   seg.u8.gz    combined segmentation (codes in src/lib/atlas/labels.ts SEG)
 *   ctx.u8.gz    Harvard–Oxford lateralised cortical labels (raw HOCPAL values 0..96)
 *   meshes.bin.gz pre-built healthy surface meshes (packed, see src/lib/atlas/volume.ts)
 *   meta.json    tissue-class intensities
 * Run: npx tsx scripts/build-atlas.ts
 */
import { gunzipSync, gzipSync } from 'zlib';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { DIM, NVOX, SEG, hoIsLeft, hoParcel } from '../src/lib/atlas/labels';
import { nearest, packMeshes, PackedMesh, trilinear, vidx, voxToScene } from '../src/lib/atlas/volume';
import { surfaceNets, vertexNormals } from '../src/lib/anatomy/mesher';
import { cortexParcel, CortexParcel, CORTEX_PARCELS, parcelMeshId } from '../src/lib/anatomy/model';
import type { V3 } from '../src/lib/anatomy/sdf';

const SRC = join(__dirname, '..', 'atlas-src');
const OUT = join(__dirname, '..', 'public', 'atlas');
const P = 'res-01_';
const [NX, NY, NZ] = DIM;
const SXY = NX * NY;

function readNii(name: string): Float32Array {
  const b = gunzipSync(readFileSync(join(SRC, P + name)));
  const dims = [b.readInt16LE(42), b.readInt16LE(44), b.readInt16LE(46)];
  if (dims[0] !== NX || dims[1] !== NY || dims[2] !== NZ) throw new Error(`${name}: unexpected dims ${dims}`);
  const srow = [280, 296, 312].map((o) => [0, 1, 2, 3].map((i) => b.readFloatLE(o + 4 * i)));
  const expect = [[1, 0, 0, -91], [0, 1, 0, -126], [0, 0, 1, -72]];
  if (srow.some((r, i) => r.some((v, j) => Math.abs(v - expect[i][j]) > 1e-3))) throw new Error(`${name}: unexpected affine`);
  const dt = b.readInt16LE(70);
  const off = Math.round(b.readFloatLE(108));
  const out = new Float32Array(NVOX);
  for (let i = 0; i < NVOX; i++) out[i] = dt === 2 ? b[off + i] : dt === 4 ? b.readInt16LE(off + 2 * i) : dt === 16 ? b.readFloatLE(off + 4 * i) : NaN;
  return out;
}

const t0 = Date.now();
const t1raw = readNii('T1w.nii.gz');
const mask = readNii('desc-brain_mask.nii.gz');
const hos = readNii('atlas-HOSPA_desc-th25_dseg.nii.gz');
const hoc = readNii('atlas-HOCPAL_desc-th0_dseg.nii.gz');
const buck = readNii('atlas-Buckner2011_seg-7n_dseg.nii.gz');
console.log('read', Date.now() - t0, 'ms');

// sanity: HOCPAL even indices must be left hemisphere (MNI x < 0)
{
  let ok = 0, bad = 0;
  for (let k = 0; k < NZ; k += 3) for (let j = 0; j < NY; j += 3) for (let i = 0; i < NX; i += 3) {
    const v = hoc[vidx(i, j, k)];
    if (!v || Math.abs(i - 91) < 6) continue;
    if (hoIsLeft(v) === i - 91 < 0) ok++; else bad++;
  }
  console.log('HOCPAL laterality check', ok, 'ok', bad, 'mismatch');
  if (bad > ok * 0.02) throw new Error('HOCPAL laterality mismatch');
}

// ── T1 normalisation (WM mean → 200) ──
const meanOf = (pred: (i: number) => boolean) => {
  let s = 0, n = 0;
  for (let i = 0; i < NVOX; i++) if (pred(i)) { s += t1raw[i]; n++; }
  return s / n;
};
const wmRaw = meanOf((i) => hos[i] === 1 || hos[i] === 12);
const t1 = new Uint8Array(NVOX);
for (let i = 0; i < NVOX; i++) t1[i] = Math.max(0, Math.min(255, Math.round((t1raw[i] * 200) / wmRaw)));
const meanU8 = (pred: (i: number) => boolean) => {
  let s = 0, n = 0;
  for (let i = 0; i < NVOX; i++) if (pred(i)) { s += t1[i]; n++; }
  return s / n;
};
const csfMean = meanU8((i) => hos[i] === 3 || hos[i] === 14);
const gmMean = meanU8((i) => hos[i] === 2 || hos[i] === 13);
const wmMean = 200;
const darkThr = (csfMean + gmMean) / 2;
console.log({ csfMean: csfMean.toFixed(1), gmMean: gmMean.toFixed(1), darkThr: darkThr.toFixed(1) });

// ── segmentation ──
const HOS_MAP: Record<number, number> = {
  1: SEG.wm, 12: SEG.wm, 2: SEG.cortex, 13: SEG.cortex, 3: SEG.latVent, 14: SEG.latVent, 4: SEG.thalamus, 15: SEG.thalamus,
  5: SEG.caudate, 16: SEG.caudate, 6: SEG.putamen, 17: SEG.putamen, 7: SEG.pallidum, 18: SEG.pallidum, 8: SEG.brainstem,
  9: SEG.hippocampus, 19: SEG.hippocampus, 10: SEG.amygdala, 20: SEG.amygdala, 11: SEG.accumbens, 21: SEG.accumbens,
};
const seg = new Uint8Array(NVOX);
for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
  const v = vidx(i, j, k);
  const mx = i - 91, my = j - 126, mz = k - 72;
  const inMask = mask[v] > 0;
  const h = hos[v];
  let c: number = SEG.air;
  if (buck[v] > 0 && h !== 8) c = SEG.cerebellum;
  else if (h > 0 && (inMask || (h !== 1 && h !== 12 && h !== 2 && h !== 13))) c = HOS_MAP[h];
  else if (inMask) c = my < -40 && mz < -8 ? SEG.cerebellum : SEG.brainOther;
  if (inMask || c !== SEG.air) {
    const dark = t1[v] < darkThr;
    if (c === SEG.wm && Math.abs(mx) <= 4 && mz > -2) c = SEG.cc;
    else if (dark && Math.abs(mx) <= 4 && my > -32 && my < 6 && mz > -14 && mz < 16 && c !== SEG.latVent) c = SEG.vent3;
    else if (dark && Math.abs(mx) <= 9 && my > -62 && my < -32 && mz > -52 && mz < -16 && (c === SEG.brainOther || c === SEG.cerebellum || c === SEG.brainstem)) c = SEG.vent4;
  }
  seg[v] = c;
}

// head: flood "outside" from the volume border through background-dark voxels
const bg = 22;
const outside = new Uint8Array(NVOX);
{
  const q = new Int32Array(NVOX);
  let qh = 0, qt = 0;
  const push = (v: number) => { if (!outside[v] && t1[v] < bg && seg[v] === SEG.air) { outside[v] = 1; q[qt++] = v; } };
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++)
    if (i === 0 || j === 0 || k === 0 || i === NX - 1 || j === NY - 1 || k === NZ - 1) push(vidx(i, j, k));
  while (qh < qt) {
    const v = q[qh++];
    const i = v % NX, j = ((v / NX) | 0) % NY, k = (v / SXY) | 0;
    if (i > 0) push(v - 1); if (i < NX - 1) push(v + 1);
    if (j > 0) push(v - NX); if (j < NY - 1) push(v + NX);
    if (k > 0) push(v - SXY); if (k < NZ - 1) push(v + SXY);
  }
}
// distance (in voxels, 6-connected) from the brain mask, up to 20
const dist = new Uint8Array(NVOX).fill(255);
{
  const q = new Int32Array(NVOX);
  let qh = 0, qt = 0;
  for (let v = 0; v < NVOX; v++) if (seg[v] !== SEG.air) { dist[v] = 0; q[qt++] = v; }
  while (qh < qt) {
    const v = q[qh++];
    const d = dist[v] + 1;
    if (d > 20) continue;
    const i = v % NX, j = ((v / NX) | 0) % NY, k = (v / SXY) | 0;
    const nb = [i > 0 ? v - 1 : -1, i < NX - 1 ? v + 1 : -1, j > 0 ? v - NX : -1, j < NY - 1 ? v + NX : -1, k > 0 ? v - SXY : -1, k < NZ - 1 ? v + SXY : -1];
    for (const n of nb) if (n >= 0 && dist[n] > d) { dist[n] = d; q[qt++] = n; }
  }
}
const fatThr = (gmMean + wmMean) / 2 + 10;
for (let v = 0; v < NVOX; v++) {
  if (seg[v] !== SEG.air || outside[v]) continue;
  const t = t1[v];
  if (t < darkThr) seg[v] = dist[v] <= 3 ? SEG.extraCsf : SEG.bone;
  else if (t > fatThr) seg[v] = SEG.fat;
  else seg[v] = SEG.soft;
}
const hist = new Map<number, number>();
for (let v = 0; v < NVOX; v++) hist.set(seg[v], (hist.get(seg[v]) ?? 0) + 1);
console.log('seg codes', [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([c, n]) => `${c}:${n}`).join(' '));

// ── meshes ──
const isCode = (set: number[]) => { const s = new Set(set); return (c: number) => s.has(c); };
function bboxOf(pred: (c: number) => boolean, pad = 3): { bmin: V3; bmax: V3 } {
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (!pred(seg[vidx(i, j, k)])) continue;
    const s = voxToScene(i, j, k);
    for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], s[a]); hi[a] = Math.max(hi[a], s[a]); }
  }
  return { bmin: lo.map((v) => v - pad) as V3, bmax: hi.map((v) => v + pad) as V3 };
}
function maskMesh(id: string, pred: (c: number, v: number) => boolean, step: number, smooth: number): PackedMesh | null {
  const f = new Float32Array(NVOX);
  let any = false;
  for (let v = 0; v < NVOX; v++) if (pred(seg[v], v)) { f[v] = 1; any = true; }
  if (!any) return null;
  // light 3-tap blur so binary masks give smooth isosurfaces
  const g = blur3(f);
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (!f[vidx(i, j, k)]) continue;
    const s = voxToScene(i, j, k);
    for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], s[a]); hi[a] = Math.max(hi[a], s[a]); }
  }
  const raw = surfaceNets((x, y, z) => 0.5 - trilinear(g, x, y, z), lo.map((v) => v - 3) as V3, hi.map((v) => v + 3) as V3, step, smooth);
  if (!raw.indices.length) return null;
  console.log(id.padEnd(24), (raw.indices.length / 3).toString().padStart(7), 'tris');
  return { id, ...raw };
}
function blur3(f: Float32Array): Float32Array {
  let a = f;
  for (const s of [1, NX, SXY]) {
    const b = new Float32Array(NVOX);
    for (let v = 0; v < NVOX; v++) b[v] = 0.25 * (a[v - s] ?? 0) + 0.5 * a[v] + 0.25 * (a[v + s] ?? 0);
    a = b;
  }
  return a;
}
function boxBlur(f: Float32Array, r: number, passes: number): Float32Array {
  let a = new Float32Array(f);
  const tmp = new Float32Array(NVOX);
  const axes: [number, number][] = [[1, NX], [NX, NY], [SXY, NZ]];
  for (let p = 0; p < passes; p++)
    for (const [s, n] of axes) {
      for (let v = 0; v < NVOX; v++) {
        const pos = s === 1 ? v % NX : s === NX ? ((v / NX) | 0) % NY : (v / SXY) | 0;
        let sum = 0, cnt = 0;
        for (let d = -r; d <= r; d++) { const q = pos + d; if (q >= 0 && q < n) { sum += a[v + d * s]; cnt++; } }
        tmp[v] = sum / cnt;
      }
      a.set(tmp);
    }
  return a;
}

const meshes: PackedMesh[] = [];

// cortex: pial isosurface of the template T1 inside the cerebrum
{
  const cerebrum = isCode([SEG.cortex, SEG.wm, SEG.latVent, SEG.thalamus, SEG.caudate, SEG.putamen, SEG.pallidum, SEG.hippocampus, SEG.amygdala, SEG.accumbens, SEG.brainOther, SEG.cc, SEG.vent3]);
  const filled = isCode([SEG.wm, SEG.latVent, SEG.thalamus, SEG.caudate, SEG.putamen, SEG.pallidum, SEG.hippocampus, SEG.amygdala, SEG.accumbens, SEG.cc, SEG.vent3]);
  const V = new Float32Array(NVOX);
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const v = vidx(i, j, k);
    const c = seg[v];
    if (i === 91 || !cerebrum(c)) continue; // medial cut at MNI x = 0
    V[v] = filled(c) ? wmMean : t1[v];
  }
  const Vs = blur3(V);
  const pialThr = darkThr;
  const inside = new Float32Array(NVOX);
  for (let v = 0; v < NVOX; v++) inside[v] = Vs[v] > pialThr ? 1 : 0;
  const depthVol = boxBlur(inside, 3, 3);
  const bb = bboxOf(cerebrum, 3);
  const raw = surfaceNets((x, y, z) => pialThr - trilinear(Vs, x, y, z), bb.bmin, bb.bmax, 1.0, 2);
  const nV = raw.positions.length / 3;
  console.log('cortex', raw.indices.length / 3, 'tris', nV, 'verts');
  // sulcal-depth colouring from local brain occupancy
  const dv = new Float32Array(nV);
  for (let n = 0; n < nV; n++) dv[n] = trilinear(depthVol, raw.positions[n * 3], raw.positions[n * 3 + 1], raw.positions[n * 3 + 2]);
  const sorted = Array.from(dv).sort((a, b) => a - b);
  const lo = sorted[Math.floor(nV * 0.15)], hi = sorted[Math.floor(nV * 0.9)];
  const crown = [0.86, 0.69, 0.63], deep = [0.46, 0.3, 0.3];
  const colors = new Float32Array(nV * 3);
  for (let n = 0; n < nV; n++) {
    const t = Math.min(1, Math.max(0, (dv[n] - lo) / (hi - lo)));
    const s = t * t * (3 - 2 * t);
    for (let c = 0; c < 3; c++) colors[n * 3 + c] = crown[c] + (deep[c] - crown[c]) * s;
  }
  // parcels by triangle: HO label sampled slightly beneath the surface
  const buckets = new Map<CortexParcel, number[]>();
  CORTEX_PARCELS.forEach((p) => buckets.set(p, []));
  const I = raw.indices, Ps = raw.positions, N = raw.normals;
  let fallback = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const cx = (Ps[a] + Ps[b] + Ps[c]) / 3, cy = (Ps[a + 1] + Ps[b + 1] + Ps[c + 1]) / 3, cz = (Ps[a + 2] + Ps[b + 2] + Ps[c + 2]) / 3;
    const nx = N[a] + N[b] + N[c], ny = N[a + 1] + N[b + 1] + N[c + 1], nz = N[a + 2] + N[b + 2] + N[c + 2];
    const nl = Math.hypot(nx, ny, nz) || 1;
    let parcel: CortexParcel | null = null;
    const medial = Math.abs(cx) < 2.2;
    if (medial) {
      const sc = seg[vidx(Math.round(cx + 91), Math.round(cz + 126), Math.round(cy + 72))];
      const sc2 = nearest(seg, cx + (cx < 0 ? -2 : 2), cy, cz);
      if (sc !== SEG.cortex && sc2 !== SEG.cortex) parcel = 'hilum';
    }
    for (const d of [1.5, 0.5, 3, 4.5]) {
      if (parcel) break;
      const v = nearest(hoc, cx - (nx / nl) * d, cy - (ny / nl) * d, cz - (nz / nl) * d);
      if (v) parcel = hoParcel(v, cx < 0);
    }
    if (!parcel) { parcel = cortexParcel(cx, cy, cz); fallback++; }
    buckets.get(parcel)!.push(I[t], I[t + 1], I[t + 2]);
  }
  console.log('cortex parcel fallback triangles', fallback);
  for (const [parcel, tris] of buckets) {
    if (!tris.length) continue;
    const remap = new Map<number, number>();
    const pos: number[] = [], nrm: number[] = [], col: number[] = [];
    const idx = new Uint32Array(tris.length);
    tris.forEach((v, i) => {
      let m = remap.get(v);
      if (m === undefined) {
        m = remap.size; remap.set(v, m);
        pos.push(Ps[v * 3], Ps[v * 3 + 1], Ps[v * 3 + 2]); nrm.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); col.push(colors[v * 3], colors[v * 3 + 1], colors[v * 3 + 2]);
      }
      idx[i] = m;
    });
    meshes.push({ id: parcelMeshId(parcel), positions: new Float32Array(pos), normals: new Float32Array(nrm), colors: new Float32Array(col), indices: idx });
    console.log(parcelMeshId(parcel).padEnd(24), (tris.length / 3).toString().padStart(7), 'tris');
  }
  writeMeta({ version: 1, csf: csfMean, gm: gmMean, wm: wmMean, pialThr });
}

const add = (m: PackedMesh | null) => m && meshes.push(m);
const S = SEG;
add(maskMesh('thalamus', (c) => c === S.thalamus, 1.0, 3));
add(maskMesh('caudate', (c) => c === S.caudate, 1.0, 3));
add(maskMesh('putamen', (c) => c === S.putamen, 1.0, 3));
add(maskMesh('globus-pallidus', (c) => c === S.pallidum, 0.9, 3));
add(maskMesh('hippocampus', (c) => c === S.hippocampus, 0.9, 3));
add(maskMesh('amygdala', (c) => c === S.amygdala, 0.9, 3));
add(maskMesh('nucleus-accumbens', (c) => c === S.accumbens, 0.9, 3));
add(maskMesh('lateral-ventricles', (c) => c === S.latVent, 1.0, 3));
add(maskMesh('third-ventricle', (c) => c === S.vent3, 0.9, 3));
add(maskMesh('fourth-ventricle', (c) => c === S.vent4, 0.9, 3));
add(maskMesh('corpus-callosum', (c) => c === S.cc, 1.0, 3));
add(maskMesh('cerebellum', (c) => c === S.cerebellum, 1.15, 2));
const kOf = (v: number) => (v / SXY) | 0; // voxel k → MNI z = k - 72 (scene y)
add(maskMesh('midbrain', (c, v) => c === S.brainstem && kOf(v) - 72 > -16, 1.0, 3));
add(maskMesh('pons', (c, v) => c === S.brainstem && kOf(v) - 72 <= -16 && kOf(v) - 72 > -39, 1.0, 3));
add(maskMesh('medulla', (c, v) => c === S.brainstem && kOf(v) - 72 <= -39, 1.0, 3));
add(maskMesh('entorhinal', (c, v) => c === S.cortex && (hoc[v] - 1) >> 1 === 33, 1.0, 3));
add(maskMesh('cerebral-white-matter', (c) => c === S.wm || c === S.cc || c === S.latVent || c === S.thalamus || c === S.caudate || c === S.putamen || c === S.pallidum || c === S.accumbens || c === S.vent3, 2.0, 2));

for (const m of meshes) if (!m.id.startsWith("cortex-")) m.normals = vertexNormals(m.positions, m.indices);

// ── write ──
function writeMeta(meta: object) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
}
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const ctx8 = new Uint8Array(NVOX);
for (let v = 0; v < NVOX; v++) ctx8[v] = hoc[v];
const write = (name: string, data: Uint8Array) => {
  const gz = gzipSync(data, { level: 9 });
  writeFileSync(join(OUT, name), gz);
  console.log(name.padEnd(16), (gz.length / 1e6).toFixed(2), 'MB');
};
write('t1.u8.gz', t1);
write('seg.u8.gz', seg);
write('ctx.u8.gz', ctx8);
write('meshes.bin.gz', packMeshes(meshes));
console.log('done in', ((Date.now() - t0) / 1000).toFixed(1), 's');
