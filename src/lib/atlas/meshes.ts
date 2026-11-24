// Applies a pathology state to the pre-built healthy atlas meshes (vertex-level deformation).
import { vertexNormals } from '../anatomy/mesher';
import { Pathology, regionAtrophy, warp } from '../anatomy/model';
import type { MeshData } from '../anatomy/build';
import type { PackedMesh } from './volume';

/** Pathology features the atlas source cannot represent (malformations change the whole brain shape). */
export function atlasUnsupported(p: Pathology): string | null {
  if (p.ccAgenesis) return 'callosal agenesis';
  if ((p.microcephaly ?? 0) > 0) return 'microcephaly';
  if ((p.gyralSimplification ?? 0) > 0) return 'a simplified gyral pattern';
  if ((p.tonsillarDescent ?? 0) > 0) return 'tonsillar descent';
  if ((p.posteriorFossaCyst ?? 0) > 0) return 'a posterior-fossa malformation';
  return null;
}

type Scale = (x: number) => [number, number, number]; // per-vertex scale factors, may depend on side

function centroids(P: Float32Array): { L: number[]; R: number[]; all: number[] } {
  const L = [0, 0, 0, 0], R = [0, 0, 0, 0], A = [0, 0, 0, 0];
  for (let i = 0; i < P.length; i += 3) {
    const t = P[i] < 0 ? L : R;
    for (let a = 0; a < 3; a++) { t[a] += P[i + a]; A[a] += P[i + a]; }
    t[3]++; A[3]++;
  }
  const f = (t: number[]) => (t[3] ? [t[0] / t[3], t[1] / t[3], t[2] / t[3]] : [0, 0, 0]);
  return { L: f(L), R: f(R), all: f(A) };
}

function scaleAbout(P: Float32Array, s: Scale, perSide: boolean) {
  const c = centroids(P);
  for (let i = 0; i < P.length; i += 3) {
    const o = perSide ? (P[i] < 0 ? c.L : c.R) : c.all;
    const f = s(P[i]);
    for (let a = 0; a < 3; a++) P[i + a] = o[a] + (P[i + a] - o[a]) * f[a];
  }
}

/** Approximate inverse of the mass-effect warp (which maps output → source) by fixed-point iteration. */
function forwardWarp(P: Float32Array, path: Pathology) {
  for (let i = 0; i < P.length; i += 3) {
    const s0 = P[i], s1 = P[i + 1], s2 = P[i + 2];
    let o0 = s0, o1 = s1, o2 = s2;
    for (let it = 0; it < 6; it++) {
      const w = warp([o0, o1, o2], path);
      o0 += s0 - w[0]; o1 += s1 - w[1]; o2 += s2 - w[2];
    }
    P[i] = o0; P[i + 1] = o1; P[i + 2] = o2;
  }
}

const uni = (f: number): Scale => () => [f, f, f];

export function deformAtlasMeshes(src: PackedMesh[], path: Pathology, want: (id: string) => boolean): MeshData[] {
  const hasWarp = path.lesions.some((l) => (l.massEffect ?? 0) > 0);
  const out: MeshData[] = [];
  const hip = path.hippocampalAtrophy, leftHip = path.leftHippoAtrophy ?? 0;
  const vs = path.ventricleScale;
  for (const m of src) {
    if (!want(m.id)) continue;
    const P = new Float32Array(m.positions);
    const C = m.colors ? new Float32Array(m.colors) : undefined;
    let changed = hasWarp;
    if (m.id.startsWith('cortex-')) {
      const N = m.normals;
      for (let i = 0; i < P.length; i += 3) {
        const a = regionAtrophy(P[i], P[i + 1], P[i + 2], path);
        if (a <= 0) continue;
        changed = true;
        const d = 2.4 * Math.min(a, 1);
        P[i] -= N[i] * d; P[i + 1] -= N[i + 1] * d; P[i + 2] -= N[i + 2] * d;
        if (C) for (let c = 0; c < 3; c++) C[i + c] *= 1 - 0.12 * Math.min(a, 1);
      }
    } else {
      let s: Scale | null = null, perSide = true;
      switch (m.id) {
        case 'hippocampus':
          if (hip || leftHip) s = (x) => { const f = Math.max(0.5, 1 - 0.42 * (hip + (x < 0 ? leftHip : 0))); return [f, f, 1 - (1 - f) * 0.5]; };
          break;
        case 'amygdala':
        case 'entorhinal':
          if (hip) s = uni(1 - 0.28 * hip);
          break;
        case 'caudate':
          if (path.caudateAtrophy) s = () => [1 - 0.5 * path.caudateAtrophy, 1 - 0.2 * path.caudateAtrophy, 1 - 0.1 * path.caudateAtrophy];
          break;
        case 'putamen':
          if (path.putamenAtrophy) s = uni(1 - 0.35 * path.putamenAtrophy);
          break;
        case 'lateral-ventricles':
          if (vs !== 1) s = () => [vs, vs, Math.sqrt(vs)];
          break;
        case 'third-ventricle':
          if (vs !== 1) { s = () => [vs * vs, Math.sqrt(vs), Math.sqrt(vs)]; perSide = false; }
          break;
        case 'fourth-ventricle':
          if (vs !== 1) { s = uni(Math.sqrt(vs)); perSide = false; }
          break;
        case 'midbrain':
          if (path.midbrainAtrophy) { s = () => [1 - 0.3 * path.midbrainAtrophy, 1, 1 - 0.3 * path.midbrainAtrophy]; perSide = false; }
          break;
        case 'pons':
        case 'medulla':
          if (path.ponsAtrophy) { s = () => [1 - 0.28 * path.ponsAtrophy, 1, 1 - 0.28 * path.ponsAtrophy]; perSide = false; }
          break;
        case 'cerebellum':
          if (path.cerebellarAtrophy) s = uni(1 - 0.18 * path.cerebellarAtrophy);
          break;
        case 'corpus-callosum':
          if (path.ccThinning) { s = () => [1, 1 - 0.5 * path.ccThinning, 1]; perSide = false; }
          break;
        case 'cerebral-white-matter': {
          const g = path.corticalAtrophy.global ?? 0;
          if (g) s = uni(1 - 0.04 * g);
          break;
        }
      }
      if (s) { scaleAbout(P, s, perSide); changed = true; }
    }
    if (hasWarp) forwardWarp(P, path);
    const normals = changed ? vertexNormals(P, m.indices) : new Float32Array(m.normals);
    out.push({ id: m.id, positions: P, normals, indices: new Uint32Array(m.indices), colors: C });
  }
  return out;
}
