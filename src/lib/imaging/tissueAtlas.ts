/**
 * Atlas-driven digital phantom. Tissue classes and partial volume come from the MNI152 T1
 * template intensity; structure identity from Harvard–Oxford labels. Physical properties per
 * tissue are the same literature-based tables as the parametric phantom (imaging/tissue.ts).
 * Disease shape changes are approximated: atrophy converts boundary voxels to CSF, enlarged
 * ventricles are tested by shrinking the query point toward the ventricle centre.
 */
import {
  Pathology, functionalRegion, lesionCoreSdf, pinealSdf, pituitarySdf, regionAtrophy, substantiaNigraSdf, warp,
} from '../anatomy/model';
import { lesionCompartment, lesionSdf } from '../anatomy/lesions';
import { sdEllipsoid, smoothstep, V3 } from '../anatomy/sdf';
import { DIM, SEG, hoFunctional, hoRegion } from '../atlas/labels';
import { nearest, trilinear, voxToScene } from '../atlas/volume';
import type { AtlasVolumes } from '../atlas/load';
import {
  AMY, AMY_W, BRAAK_REGIONS, CHI, DOPA, FDG, FLUIDMASK, H, K, Props, REGION_LABEL, STIFF, T1, T2, T2S, TAU, ADC,
  T_AIR, T_BONE, T_CAUD, T_CBGM, T_CBWM, T_CHOROID, T_CSF, T_DEEP, T_DIPLOE, T_FAT, T_GM, T_HIPPO, T_MUSCLE, T_PALL,
  T_PINEAL, T_PITU, T_PUT, T_SN, T_STEM, T_THAL, T_VITREOUS, T_WM, blend, cover, edemaProps, lesionProps,
} from './tissue';

const tmp = new Float32Array(K);
const tmp2 = new Float32Array(K);

interface AtlasCentres { hippo: [V3, V3]; caud: [V3, V3]; put: [V3, V3]; vent: [V3, V3]; stemZ: number }
const centreCache = new WeakMap<AtlasVolumes, AtlasCentres>();
function atlasCentres(V: AtlasVolumes): AtlasCentres {
  const c = centreCache.get(V);
  if (c) return c;
  const acc = new Map<number, number[]>();
  const [NX, NY] = DIM;
  for (let v = 0; v < V.seg.length; v++) {
    const s = V.seg[v];
    if (s !== SEG.hippocampus && s !== SEG.caudate && s !== SEG.putamen && s !== SEG.latVent && s !== SEG.brainstem) continue;
    const p = voxToScene(v % NX, ((v / NX) | 0) % NY, (v / (NX * NY)) | 0);
    const key = s * 2 + (p[0] < 0 ? 0 : 1);
    const a = acc.get(key) ?? [0, 0, 0, 0];
    a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++;
    acc.set(key, a);
  }
  const get = (s: number, side: number): V3 => { const a = acc.get(s * 2 + side) ?? [0, 0, 0, 1]; return [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; };
  const pair = (s: number): [V3, V3] => [get(s, 0), get(s, 1)];
  const out: AtlasCentres = {
    hippo: pair(SEG.hippocampus), caud: pair(SEG.caudate), put: pair(SEG.putamen), vent: pair(SEG.latVent),
    stemZ: (get(SEG.brainstem, 0)[2] + get(SEG.brainstem, 1)[2]) / 2,
  };
  centreCache.set(V, out);
  return out;
}

/** Does structure `code`, shrunk about c by factors f, still contain w? */
const shrunkContains = (V: AtlasVolumes, code: number, w: V3, c: V3, f: V3) =>
  nearest(V.seg, c[0] + (w[0] - c[0]) / f[0], c[1] + (w[1] - c[1]) / f[1], c[2] + (w[2] - c[2]) / f[2]) === code;

const isHead = (c: number) => c === SEG.air || c === SEG.bone || c === SEG.soft || c === SEG.fat;

export function sampleTissueAtlas(p: V3, path: Pathology, out: Props, hasWarp: boolean, V: AtlasVolumes): number {
  const [x, y, z] = p;
  const M = V.meta;
  const codeP = nearest(V.seg, x, y, z);
  const tP = trilinear(V.t1, x, y, z);
  let label = 0;

  // ── head (fixed: not displaced by mass effect) ──
  if (isHead(codeP)) {
    if (codeP === SEG.air) { out.set(T_AIR); return 0; }
    for (const s of [-1, 1]) {
      const eye = sdEllipsoid(x, y, z, [s * 32, -36, 60], [12, 12, 12]);
      if (eye < 0.5 && tP < M.gm) { out.set(T_FAT); blend(out, T_VITREOUS, cover(eye)); return REGION_LABEL.eye; }
    }
    if (codeP === SEG.bone) {
      out.set(T_BONE);
      blend(out, T_DIPLOE, smoothstep(30, 70, tP));
      return REGION_LABEL.bone;
    }
    out.set(T_MUSCLE);
    blend(out, T_FAT, smoothstep(M.gm, M.wm + 15, tP));
    return REGION_LABEL.scalp;
  }

  // ── intracranial: composition sampled through the mass-effect warp ──
  const w = hasWarp ? warp(p, path) : p;
  const [wx, wy, wz] = w;
  let code = hasWarp ? nearest(V.seg, wx, wy, wz) : codeP;
  if (isHead(code)) code = SEG.extraCsf;
  let t = hasWarp ? trilinear(V.t1, wx, wy, wz) : tP;
  const C = atlasCentres(V);
  const side = wx < 0 ? 0 : 1;

  // atrophy rules: shape change approximated by converting voxels to CSF
  const vs = path.ventricleScale;
  if (vs > 1 && code !== SEG.latVent && Math.abs(wx) < 45) {
    if (shrunkContains(V, SEG.latVent, w, C.vent[side], [vs, vs, Math.sqrt(vs)])) code = SEG.latVent;
    else if (code !== SEG.vent3 && Math.abs(wx) < 10 && nearest(V.seg, wx / (vs * vs), wy, wz) === SEG.vent3) code = SEG.vent3;
  }
  const hipA = path.hippocampalAtrophy + (wx < 0 ? path.leftHippoAtrophy ?? 0 : 0);
  if (code === SEG.hippocampus && hipA > 0) {
    const f = Math.max(0.5, 1 - 0.42 * hipA);
    if (!shrunkContains(V, SEG.hippocampus, w, C.hippo[side], [f, f, 1 - (1 - f) * 0.5])) code = SEG.latVent;
  }
  if (code === SEG.caudate && path.caudateAtrophy > 0) {
    const a = path.caudateAtrophy;
    if (!shrunkContains(V, SEG.caudate, w, C.caud[side], [1 - 0.5 * a, 1 - 0.2 * a, 1 - 0.1 * a])) code = SEG.latVent;
  }
  if (code === SEG.putamen && path.putamenAtrophy > 0) {
    const f = 1 - 0.35 * path.putamenAtrophy;
    if (!shrunkContains(V, SEG.putamen, w, C.put[side], [f, f, f])) code = SEG.wm;
  }
  if (code === SEG.brainstem) {
    const a = wy > -16 ? path.midbrainAtrophy : path.ponsAtrophy;
    if (a > 0) {
      const f = 1 - 0.3 * a;
      if (!shrunkContains(V, SEG.brainstem, w, [0, wy, C.stemZ], [f, 1, f])) code = SEG.extraCsf;
    }
  }

  // partial-volume fractions from template intensity (CSF ↔ GM ↔ WM)
  if (code === SEG.cortex || code === SEG.brainOther) t -= regionAtrophy(wx, wy, wz, path) * 0.6 * (M.gm - M.csf);
  if (code === SEG.cerebellum) t -= path.cerebellarAtrophy * 0.5 * (M.gm - M.csf);
  const fC = t <= M.csf ? 1 : t >= M.gm ? 0 : (M.gm - t) / (M.gm - M.csf);
  const fW = t <= M.gm ? 0 : Math.min(1, (t - M.gm) / (M.wm - M.gm));
  let wmFrac = 0;

  out.set(T_CSF);
  label = REGION_LABEL.csf;
  switch (code) {
    case SEG.cortex:
    case SEG.brainOther:
    case SEG.wm:
    case SEG.cc: {
      const hv = nearest(V.ctx, wx, wy, wz);
      const ent = hoRegion(hv) === 33;
      const fr = hoFunctional(hv) ?? functionalRegion(wx, wy, wz);
      tmp.set(T_GM);
      tmp[FDG] *= 1 + (path.fdg[fr] ?? 0);
      if (path.amyloid > 0) tmp[AMY] = T_GM[AMY] + 1.25 * path.amyloid * (AMY_W[fr] ?? 0.8);
      if (path.tauBraak > 0) {
        const reg = BRAAK_REGIONS.find((b) => b[0] === fr);
        const st = ent ? 0.6 : reg ? reg[1] : 6;
        tmp[TAU] = T_GM[TAU] + (ent ? 2.1 : 1.9) * smoothstep(st - 1.2, st + 0.6, path.tauBraak);
      }
      if (path.cortexDiffusion) tmp[ADC] *= 1 - 0.38 * path.cortexDiffusion;
      if (path.stiffness.cortex) tmp[STIFF] *= 1 + path.stiffness.cortex;
      blend(out, tmp, 1 - fC);
      tmp.set(T_WM);
      if (code === SEG.cc) { tmp[T2] = 64; tmp[STIFF] = 3.1; }
      if (path.stiffness.whiteMatter) tmp[STIFF] *= 1 + path.stiffness.whiteMatter;
      blend(out, tmp, fW);
      wmFrac = fW;
      if (fC < 0.5) label = code === SEG.cc ? REGION_LABEL.cc : fW > 0.5 ? REGION_LABEL.wm : ent ? REGION_LABEL.entorhinal : REGION_LABEL.cortex;
      break;
    }
    case SEG.latVent:
    case SEG.vent3:
    case SEG.vent4:
      blend(out, T_WM, Math.min(1 - fC, 0.9));
      label = fC > 0.5 ? REGION_LABEL.ventricle : REGION_LABEL.wm;
      if (code === SEG.latVent && fC > 0.5 && sdEllipsoid(Math.abs(wx), wy, wz, [24, 9, -35], [3.2, 3, 4.5]) < 0) {
        blend(out, T_CHOROID, 1);
        label = REGION_LABEL.choroid;
      }
      break;
    case SEG.extraCsf:
      break;
    case SEG.cerebellum:
      tmp.set(T_CBGM);
      tmp[FDG] *= 1 + (path.fdg.cerebellum ?? 0);
      if (path.stiffness.cerebellum) tmp[STIFF] *= 1 + path.stiffness.cerebellum;
      blend(out, tmp, 1 - fC);
      blend(out, T_CBWM, fW);
      if (fC < 0.5) label = REGION_LABEL.cerebellum;
      break;
    case SEG.brainstem: {
      blend(out, T_STEM, 1 - fC * 0.8);
      label = REGION_LABEL.brainstem;
      const sn = substantiaNigraSdf(wx, wy, wz, path);
      if (sn < H) {
        tmp.set(T_SN);
        if (path.nigralLoss) { tmp[T2S] *= 1 - 0.35 * path.nigralLoss; tmp[CHI] += 0.1 * path.nigralLoss; }
        blend(out, tmp, cover(sn));
        if (sn < 0) label = REGION_LABEL.sn;
      }
      break;
    }
    default: {
      // deep grey nuclei
      tmp.set(T_DEEP);
      switch (code) {
        case SEG.putamen: {
          tmp.set(T_PUT);
          const post = smoothstep(14, -12, wz);
          tmp[DOPA] = 3.1 * (1 - path.datLoss * (0.55 + 0.45 * post));
          tmp[FDG] *= 1 + (path.fdg.putamen ?? 0);
          if (path.sviHyper) { tmp[ADC] *= 1 - 0.35 * path.sviHyper; tmp[T2] *= 1 + 0.25 * path.sviHyper; }
          if (path.stiffness.deepGM) tmp[STIFF] *= 1 + path.stiffness.deepGM;
          label = REGION_LABEL.putamen;
          break;
        }
        case SEG.caudate:
          tmp.set(T_CAUD);
          tmp[DOPA] = 2.8 * (1 - 0.45 * path.datLoss);
          tmp[FDG] *= 1 + (path.fdg.caudate ?? 0);
          if (path.sviHyper) { tmp[ADC] *= 1 - 0.35 * path.sviHyper; tmp[T2] *= 1 + 0.25 * path.sviHyper; }
          label = REGION_LABEL.caudate;
          break;
        case SEG.pallidum: tmp.set(T_PALL); label = REGION_LABEL.pallidum; break;
        case SEG.accumbens: tmp[DOPA] = 2.4; label = REGION_LABEL.accumbens; break;
        case SEG.thalamus:
          tmp.set(T_THAL);
          tmp[FDG] *= 1 + (path.fdg.thalamus ?? 0);
          if (path.stiffness.thalamus) tmp[STIFF] *= 1 + path.stiffness.thalamus;
          label = REGION_LABEL.thalamus;
          break;
        case SEG.hippocampus:
          tmp.set(T_HIPPO);
          tmp[FDG] *= 1 + (path.fdg.mtl ?? 0);
          if (path.tauBraak) tmp[TAU] = 1 + 1.9 * smoothstep(0.8, 2.6, path.tauBraak);
          if (path.amyloid) tmp[AMY] = T_GM[AMY] + 0.5 * path.amyloid;
          if (path.stiffness.hippocampus) tmp[STIFF] *= 1 + path.stiffness.hippocampus;
          if (wx < 0 && path.leftHippoSignal) { tmp[T2] *= 1 + 0.55 * path.leftHippoSignal; tmp[T1] *= 1 + 0.15 * path.leftHippoSignal; tmp[FDG] *= 1 - 0.3 * path.leftHippoSignal; }
          label = REGION_LABEL.hippocampus;
          break;
        case SEG.amygdala:
          tmp.set(T_HIPPO);
          tmp[FDG] *= 1 + (path.fdg.mtl ?? 0) * 0.7;
          if (path.tauBraak) tmp[TAU] = 1 + 1.6 * smoothstep(1.5, 3.2, path.tauBraak);
          label = REGION_LABEL.amygdala;
          break;
      }
      blend(out, tmp, 1 - fC);
      // let the template's own contrast (e.g. internal-capsule fibres crossing the striatum) show through
      blend(out, T_WM, 0.5 * fW);
      wmFrac = 0.4;
      if (fC >= 0.5) label = REGION_LABEL.csf;
    }
  }
  // small midline structures absent from the atlas (parametric, positioned in MNI space)
  const pin = pinealSdf(wx, wy, wz);
  if (pin < H) { blend(out, T_PINEAL, cover(pin)); if (pin < 0) label = REGION_LABEL.pineal; }
  const pit = pituitarySdf(wx, wy, wz);
  if (pit < H) { blend(out, T_PITU, cover(pit)); if (pit < 0) label = REGION_LABEL.pituitary; }

  if (path.stiffness.global && out[FLUIDMASK] < 0.5) out[STIFF] *= 1 + path.stiffness.global;

  // ── lesions ──
  const inBrain = code !== SEG.extraCsf;
  for (const l of path.lesions) {
    const comp = lesionCompartment(l);
    if (comp === 'extra') {
      const d = lesionSdf(l, p, path);
      if (d < H) { lesionProps(l, out, tmp, d, p); blend(out, tmp, cover(d)); if (d < 0) label = REGION_LABEL.lesion; }
      continue;
    }
    const core = lesionCoreSdf(l, x, y, z);
    if (l.edema && comp === 'intra' && wmFrac > 0) {
      const de = Math.max(core - l.edema, -core);
      if (de < H) {
        edemaProps(out, tmp2);
        blend(out, tmp2, cover(de) * Math.min(1, wmFrac * 1.6));
        if (de < 0 && wmFrac > 0.35) label = REGION_LABEL.edema;
      }
    }
    if (core < H && (comp === 'csf' || inBrain)) {
      lesionProps(l, out, tmp, core, p);
      blend(out, tmp, cover(core));
      if (core < 0 && (comp !== 'csf' || out[FLUIDMASK] < 0.9)) label = REGION_LABEL.lesion;
    }
  }
  return label;
}
