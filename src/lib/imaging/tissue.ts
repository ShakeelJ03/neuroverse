/**
 * Digital phantom: maps every point of the parametric anatomy to physical tissue properties.
 *
 * Property sources (approximate, adult brain):
 *  - T1/T2 of WM and cortical GM at 3 T: Stanisz et al., MRM 2005 (WM 1084/69 ms, GM 1820/99 ms).
 *    Deep-grey, CSF, fat and blood-product values are representative literature ranges.
 *  - ADC (×10⁻³ mm²/s): WM ≈0.7, GM ≈0.8–0.9, CSF ≈3.0.
 *  - CT (HU): CSF 0–15, WM 20–30, GM 35–45, acute blood 50–80, bone >700.
 *  - FDG relative uptake: GM ≈3–4× WM. Tracer maps for amyloid/tau/DOPA/FET are schematic.
 *  - |G*| shear stiffness (kPa) at ~50–60 Hz: illustrative values inside the 1–4 kPa range
 *    reported by brain MRE studies (Hiscox et al. 2016 review); WM > GM, cerebellum softest.
 * These are educational simulation parameters, not measurements.
 */
import {
  Pathology, skullEnvelope, brainstemSdf, caudateSdf, cerebellumSdf, corpusCallosumSdf, cortexEval, fornixSdf,
  fourthVentricleSdf, functionalRegion, gmThickness, hippocampusSdf, amygdalaSdf, entorhinalSdf, hypothalamusSdf,
  internalCapsuleSdf, lateralVentriclesSdf, pallidumSdf, putamenSdf, accumbensSdf, thalamusSdf, thirdVentricleSdf,
  substantiaNigraSdf, pinealSdf, pituitarySdf, warp, FunctionalRegion, Lesion,
} from '../anatomy/model';
import { edemaSdf, lesionCompartment, lesionSdf } from '../anatomy/lesions';
import { sdEllipsoid, smoothstep, V3 } from '../anatomy/sdf';

// property vector layout
export const K = 16;
export const PD = 0, T1 = 1, T2 = 2, T2S = 3, ADC = 4, HU = 5, FDG = 6, AMY = 7, TAU = 8, DOPA = 9, FET = 10, GD = 11, STIFF = 12, DAMP = 13, CHI = 14, FLUIDMASK = 15;

export type Props = Float32Array;
const mk = (o: Partial<Record<number, number>>, base?: Props) => {
  const a = base ? new Float32Array(base) : new Float32Array(K);
  for (const [k, v] of Object.entries(o)) a[+k] = v as number;
  return a;
};

//                    PD   T1    T2   T2*  ADC  HU   FDG  AMY  TAU  DOPA FET  GD  STIFF DAMP CHI FLUID
export const T_AIR = mk({ [PD]: 0, [T1]: 1000, [T2]: 1, [T2S]: 1, [ADC]: 0, [HU]: -1000, [STIFF]: 0, [FLUIDMASK]: 0 });
export const T_CSF = mk({ [PD]: 1, [T1]: 4300, [T2]: 2000, [T2S]: 1200, [ADC]: 3.0, [HU]: 7, [FDG]: 0.05, [AMY]: 0.1, [TAU]: 0.1, [DOPA]: 0.1, [FET]: 0.2, [STIFF]: 0.05, [DAMP]: 0.9, [FLUIDMASK]: 1 });
export const T_GM = mk({ [PD]: 0.8, [T1]: 1820, [T2]: 99, [T2S]: 62, [ADC]: 0.85, [HU]: 38, [FDG]: 3.2, [AMY]: 0.85, [TAU]: 1.0, [DOPA]: 0.8, [FET]: 1.05, [STIFF]: 2.6, [DAMP]: 0.32 });
export const T_WM = mk({ [PD]: 0.69, [T1]: 1084, [T2]: 69, [T2S]: 50, [ADC]: 0.7, [HU]: 28, [FDG]: 1.0, [AMY]: 1.75, [TAU]: 0.85, [DOPA]: 0.7, [FET]: 0.9, [STIFF]: 3.0, [DAMP]: 0.28 });
export const T_DEEP = mk({ [PD]: 0.78, [T1]: 1650, [T2]: 84, [T2S]: 48, [ADC]: 0.8, [HU]: 36, [FDG]: 2.8, [AMY]: 0.95, [TAU]: 1.25, [DOPA]: 0.9, [FET]: 1.05, [STIFF]: 2.9, [DAMP]: 0.3 });
export const T_PUT = mk({ [T2]: 76, [T2S]: 34, [CHI]: 0.06 }, T_DEEP);
export const T_PALL = mk({ [T1]: 1250, [T2]: 62, [T2S]: 22, [HU]: 33, [FDG]: 2.4, [CHI]: 0.15 }, T_DEEP);
export const T_CAUD = mk({ [T2S]: 42, [CHI]: 0.04 }, T_DEEP);
export const T_THAL = mk({ [T1]: 1350, [T2]: 80, [T2S]: 52, [FDG]: 2.9, [STIFF]: 3.2 }, T_DEEP);
export const T_HIPPO = mk({ [T1]: 1700, [T2]: 104, [T2S]: 64, [ADC]: 0.9, [HU]: 36, [FDG]: 2.4, [STIFF]: 2.4, [TAU]: 1.0 }, T_GM);
export const T_SN = mk({ [T1]: 1200, [T2]: 58, [T2S]: 20, [CHI]: 0.18, [HU]: 34, [FDG]: 2 }, T_DEEP);
export const T_CBGM = mk({ [T1]: 1650, [T2]: 96, [FDG]: 2.6, [STIFF]: 2.0, [AMY]: 0.7 }, T_GM);
export const T_CBWM = mk({ [STIFF]: 2.2, [FDG]: 1.0 }, T_WM);
export const T_STEM = mk({ [PD]: 0.71, [T1]: 1150, [T2]: 76, [T2S]: 50, [ADC]: 0.75, [HU]: 31, [FDG]: 1.6, [STIFF]: 2.5, [AMY]: 1.5 }, T_WM);
export const T_PITU = mk({ [T1]: 1300, [T2]: 90, [GD]: 0.9, [HU]: 40, [FDG]: 1.5 }, T_GM);
export const T_PINEAL = mk({ [T1]: 1400, [T2]: 90, [GD]: 0.7, [HU]: 120, [T2S]: 15 }, T_GM);
export const T_CHOROID = mk({ [PD]: 0.85, [T1]: 1500, [T2]: 120, [T2S]: 30, [ADC]: 1.2, [HU]: 80, [GD]: 0.9, [TAU]: 2.2, [FDG]: 0.6, [STIFF]: 0.5 }, T_GM);
export const T_FAT = mk({ [PD]: 0.9, [T1]: 380, [T2]: 130, [T2S]: 60, [ADC]: 0.02, [HU]: -95, [FDG]: 0.4, [STIFF]: 0, [FLUIDMASK]: 0 });
export const T_MUSCLE = mk({ [PD]: 0.7, [T1]: 1400, [T2]: 45, [T2S]: 28, [ADC]: 1.4, [HU]: 50, [FDG]: 0.8, [STIFF]: 0 });
export const T_BONE = mk({ [PD]: 0.04, [T1]: 400, [T2]: 2, [T2S]: 0.8, [ADC]: 0.1, [HU]: 1250, [FDG]: 0.2, [STIFF]: 0 });
export const T_DIPLOE = mk({ [PD]: 0.45, [T1]: 400, [T2]: 90, [T2S]: 8, [ADC]: 0.1, [HU]: 450, [FDG]: 0.3, [STIFF]: 0 });
export const T_VITREOUS = mk({ [PD]: 1, [T1]: 4000, [T2]: 1500, [T2S]: 800, [ADC]: 2.9, [HU]: 10, [FDG]: 0.1, [FLUIDMASK]: 1 });
export const T_LENS = mk({ [PD]: 0.6, [T1]: 1000, [T2]: 30, [T2S]: 20, [ADC]: 0.2, [HU]: 120 });

export const REGION_LABEL: Record<string, number> = {
  air: 0, scalp: 1, bone: 2, csf: 3, cortex: 4, wm: 5, cerebellum: 6, brainstem: 7, thalamus: 8, caudate: 9, putamen: 10,
  pallidum: 11, hippocampus: 12, amygdala: 13, ventricle: 14, cc: 15, ic: 16, lesion: 17, edema: 18, sn: 19, hypothalamus: 20,
  pituitary: 21, eye: 22, entorhinal: 23, accumbens: 24, fornix: 25, pineal: 26, choroid: 27,
};
export const LABEL_NAME: Record<number, string> = {
  0: 'Air', 1: 'Scalp / soft tissue', 2: 'Skull', 3: 'CSF (subarachnoid)', 4: 'Cortical grey matter', 5: 'Cerebral white matter',
  6: 'Cerebellum', 7: 'Brainstem', 8: 'Thalamus', 9: 'Caudate nucleus', 10: 'Putamen', 11: 'Globus pallidus', 12: 'Hippocampus',
  13: 'Amygdala', 14: 'Ventricle (CSF)', 15: 'Corpus callosum', 16: 'Internal capsule', 17: 'Lesion', 18: 'Oedema', 19: 'Substantia nigra',
  20: 'Hypothalamus', 21: 'Pituitary gland', 22: 'Globe', 23: 'Entorhinal cortex', 24: 'Nucleus accumbens', 25: 'Fornix', 26: 'Pineal gland', 27: 'Choroid plexus',
};

export const H = 0.55; // partial-volume half-width, mm
export const cover = (d: number) => 1 - smoothstep(-H, H, d);

export function blend(out: Props, layer: Props, a: number) {
  if (a <= 0) return;
  if (a >= 1) {
    out.set(layer);
    return;
  }
  for (let k = 0; k < K; k++) out[k] += (layer[k] - out[k]) * a;
}

const tmp = new Float32Array(K);
const tmp2 = new Float32Array(K);

/** Blood-product MRI/CT properties by age (stage 0..1 → hyperacute..chronic). */
export function bloodProps(stage: number, out: Props, base: Props, days: number) {
  out.set(base);
  out[PD] = 0.85;
  out[ADC] = 0.65;
  out[FDG] = 0.3;
  out[STIFF] = 1.8;
  out[FLUIDMASK] = 0;
  // CT attenuation falls ~1.5 HU/day after the first days
  out[HU] = Math.max(12, 68 - 1.6 * Math.max(0, days - 1));
  if (stage < 0.1) { out[T1] = 1650; out[T2] = 190; out[T2S] = 25; }
  else if (stage < 0.33) { out[T1] = 1550; out[T2] = 38; out[T2S] = 8; out[CHI] = 0.4; }
  else if (stage < 0.58) { out[T1] = 520; out[T2] = 40; out[T2S] = 9; out[CHI] = 0.4; }
  else if (stage < 0.86) { out[T1] = 520; out[T2] = 320; out[T2S] = 40; out[CHI] = 0.2; }
  else { out[PD] = 0.95; out[T1] = 3600; out[T2] = 1500; out[T2S] = 300; out[ADC] = 2.5; out[HU] = 10; out[FLUIDMASK] = 1; out[STIFF] = 0.5; }
}

const stageDays = (l: Lesion) => {
  const s = l.stage ?? 0;
  if (l.kind === 'sdh') return s * 40;
  // piecewise: 0→0 d, .2→2 d, .45→5 d, .7→14 d, 1→90 d
  if (s < 0.2) return (s / 0.2) * 2;
  if (s < 0.45) return 2 + ((s - 0.2) / 0.25) * 3;
  if (s < 0.7) return 5 + ((s - 0.45) / 0.25) * 9;
  return 14 + ((s - 0.7) / 0.3) * 76;
};

/** Applies a lesion's tissue change to the current property vector. `dIn` = signed distance inside lesion (≤0). */
export function lesionProps(l: Lesion, cur: Props, out: Props, dIn: number, p: V3) {
  out.set(cur);
  const s = l.stage ?? 0;
  const depth = -dIn; // mm inside the lesion boundary
  switch (l.kind) {
    case 'ms':
    case 'wmh': {
      const sev = l.kind === 'ms' ? 1 : 0.75;
      out[T2] = cur[T2] * (1 + 1.1 * sev);
      out[T1] = cur[T1] * (1 + (l.kind === 'ms' && s > 0.8 ? 0.9 : 0.3) * sev);
      out[ADC] = cur[ADC] * (1 + 0.35 * sev);
      out[HU] = cur[HU] - 6 * sev;
      out[STIFF] = cur[STIFF] * 0.8;
      out[AMY] = cur[AMY] * 0.7;
      if (l.enhance) out[GD] = l.rim ? (depth < (l.rim ?? 1) ? 0.7 : 0.1) : 0.6;
      break;
    }
    case 'infarct': {
      // time course: hyperacute (s≈0) … chronic (s=1)
      const parenchyma = cur[FLUIDMASK] < 0.5;
      if (!parenchyma) break;
      if (s < 0.08) { out[ADC] = cur[ADC] * 0.5; out[T2] = cur[T2] * 1.05; out[HU] = cur[HU] - 2.5 + (cur[HU] > 33 ? -5 : 0); }
      else if (s < 0.4) { out[ADC] = cur[ADC] * 0.5; out[T2] = cur[T2] * 1.75; out[T1] = cur[T1] * 1.25; out[HU] = 19; }
      else if (s < 0.75) { const f = (s - 0.4) / 0.35; out[ADC] = cur[ADC] * (0.75 + 0.45 * f); out[T2] = cur[T2] * 1.9; out[T1] = cur[T1] * 1.3; out[HU] = 22 - 4 * f; out[GD] = 0.35 * (1 - f) + 0.15; }
      else { const core = depth > 2; if (core) { out.set(T_CSF); out[STIFF] = 0.2; } else { out[T2] = cur[T2] * 2.4; out[T1] = cur[T1] * 1.6; out[ADC] = cur[ADC] * 1.6; out[HU] = 14; } }
      out[FDG] = cur[FDG] * 0.25;
      out[STIFF] = Math.min(out[STIFF], cur[STIFF] * 0.85);
      break;
    }
    case 'gbm':
    case 'metastasis': {
      const rim = l.rim ?? 3;
      if (depth > rim) { // necrotic core
        out[PD] = 0.92; out[T1] = 2600; out[T2] = 600; out[T2S] = 200; out[ADC] = 2.1; out[HU] = 18; out[FDG] = 0.25; out[FET] = 0.5; out[GD] = 0; out[STIFF] = 1.2; out[FLUIDMASK] = 0.6;
      } else {
        out[PD] = 0.85; out[T1] = 1500; out[T2] = 125; out[T2S] = 30; out[ADC] = 0.75; out[HU] = 36; out[FDG] = 4.2; out[FET] = 2.8; out[GD] = 1.0 * (l.enhance ?? 1); out[STIFF] = 1.9; out[CHI] = 0.15; out[FLUIDMASK] = 0;
      }
      break;
    }
    case 'lowgrade': {
      const n = Math.sin(p[0] * 0.9) * Math.sin(p[1] * 1.1) * Math.sin(p[2] * 0.8);
      out[PD] = 0.9; out[T1] = 2100; out[T2] = depth > 3 && s < 0.5 ? 420 : 210; out[T2S] = 90; out[ADC] = 1.35; out[HU] = 26; out[FDG] = 1.2; out[FET] = 1.5; out[GD] = 0; out[STIFF] = 2.0; out[FLUIDMASK] = 0;
      if (s > 0.5) { out[T2] = 180; if (n > 0.55) { out[HU] = 260; out[T2S] = 6; out[CHI] = -0.4; } }
      if (depth > 3 && s < 0.5) out[T1] = 3200; // T2–FLAIR mismatch core
      break;
    }
    case 'meningioma':
      out[PD] = 0.82; out[T1] = 1650; out[T2] = 95; out[T2S] = 50; out[ADC] = 0.85; out[HU] = 52; out[FDG] = 1.6; out[FET] = 1.6; out[GD] = 1.0; out[STIFF] = 4.2; out[FLUIDMASK] = 0; out[AMY] = 0.6; out[TAU] = 0.5;
      break;
    case 'medulloblastoma':
      out[PD] = 0.85; out[T1] = 1650; out[T2] = 92; out[ADC] = 0.55; out[HU] = 46; out[FDG] = 3.2; out[FET] = 2.2; out[GD] = 0.6; out[STIFF] = 1.8; out[FLUIDMASK] = 0;
      break;
    case 'adenoma':
      out[PD] = 0.82; out[T1] = 1350; out[T2] = 100; out[ADC] = 0.8; out[HU] = 40; out[FDG] = 1.6; out[GD] = 0.55; out[FLUIDMASK] = 0;
      break;
    case 'schwannoma':
      out[PD] = 0.85; out[T1] = 1500; out[T2] = 130; out[ADC] = 1.1; out[HU] = 40; out[FDG] = 1.4; out[GD] = 0.9; out[STIFF] = 2.4; out[FLUIDMASK] = 0;
      break;
    case 'ich':
    case 'sdh':
    case 'edh':
    case 'contusion':
    case 'venous': {
      const days = stageDays(l);
      bloodProps(l.kind === 'contusion' && s === 0 ? 0.05 : s, out, cur, days);
      if (l.kind === 'edh') bloodProps(0.15, out, cur, 1);
      if (l.kind === 'contusion' || l.kind === 'venous') {
        // patchy haemorrhage within oedematous tissue
        const n = Math.sin(p[0] * 0.7 + 1) * Math.sin(p[1] * 0.8) * Math.sin(p[2] * 0.75 + 2);
        if (n < 0.15 && s < 0.85) { out.set(cur); out[T2] = cur[T2] * 1.8; out[T1] = cur[T1] * 1.3; out[ADC] = cur[ADC] * 1.3; out[HU] = cur[HU] - 10; }
      }
      if (s >= 0.86 && depth < 1.6) { out[T2] = 30; out[T2S] = 4; out[CHI] = 0.6; out[HU] = 30; out[FLUIDMASK] = 0; } // haemosiderin rim
      // chronic subdural: hypodense fluid
      if (l.kind === 'sdh' && s > 0.8) { out[PD] = 0.95; out[T1] = 2800; out[T2] = 900; out[T2S] = 250; out[ADC] = 2.6; out[FLUIDMASK] = 1; }
      break;
    }
    case 'sah':
      if (cur[FLUIDMASK] > 0.5) {
        const days = stageDays(l);
        out[HU] = Math.max(12, 62 - 6 * days); out[T1] = 1700; out[T2] = 420; out[T2S] = 25; out[CHI] = 0.3; out[ADC] = 1.6; out[FLUIDMASK] = 0.4;
      }
      break;
    case 'meningitis':
      if (cur[FLUIDMASK] > 0.5) { out[T1] = 3000; out[GD] = 0.45 * (l.enhance ?? 1); out[HU] = 12; }
      break;
    case 'inflammation': {
      out[T2] = cur[T2] * 1.75; out[T1] = cur[T1] * 1.25; out[ADC] = cur[ADC] * (s > 0.6 ? 0.75 : 1.3); out[HU] = cur[HU] - 7; out[GD] = 0.15; out[FDG] = cur[FDG] * (s > 0.6 ? 0.7 : 1.15); out[STIFF] = cur[STIFF] * 0.85;
      break;
    }
    case 'fcd':
      out[T2] = cur[T2] * 1.35; out[T1] = cur[T1] * 1.25; out[FDG] = cur[FDG] * 0.7;
      break;
    case 'avm':
    case 'aneurysm': {
      const n = Math.sin(p[0] * 1.3) * Math.sin(p[1] * 1.2) * Math.sin(p[2] * 1.4);
      if (l.kind === 'aneurysm' || n > -0.1) { out[PD] = 0.02; out[T2S] = 3; out[HU] = 48; out[GD] = 1.2; out[ADC] = 2; out[FDG] = 0.6; out[CHI] = 0.1; out[FLUIDMASK] = 0; out[STIFF] = 1.5; }
      break;
    }
    case 'dai':
      out[T2S] = 3; out[CHI] = 0.8; out[HU] = cur[HU] + 18; out[T2] = cur[T2] * 1.2;
      break;
  }
}

export function edemaProps(cur: Props, out: Props) {
  out.set(cur);
  out[T2] = cur[T2] * 2.1;
  out[T1] = cur[T1] * 1.45;
  out[ADC] = cur[ADC] * 1.7;
  out[HU] = cur[HU] - 10;
  out[FDG] = cur[FDG] * 0.8;
  out[FET] = cur[FET] * 1.15;
  out[AMY] = cur[AMY] * 0.8;
  out[STIFF] = cur[STIFF] * 0.85;
  out[PD] = Math.min(0.9, cur[PD] * 1.12);
}

export const BRAAK_REGIONS: [FunctionalRegion, number][] = [
  ['mtl', 1], ['lateralTemporal', 3], ['anteriorTemporal', 3], ['insula', 3], ['pcc', 4], ['precuneus', 4], ['parietal', 4],
  ['frontal', 5], ['acc', 5], ['occipital', 5], ['sensorimotor', 6], ['visual', 6],
];
export const AMY_W: Partial<Record<FunctionalRegion, number>> = { precuneus: 1.15, pcc: 1.15, frontal: 1.1, acc: 1.05, lateralTemporal: 1.0, parietal: 1.0, insula: 0.9, mtl: 0.55, occipital: 0.75, sensorimotor: 0.6, visual: 0.55 };

/** Sample the phantom at scene point p. Writes K properties into `out`; returns region label. */
export function sampleTissue(p: V3, path: Pathology, out: Props, hasWarp: boolean): number {
  const [x, y, z] = p;
  const ax = Math.abs(x);
  const w = hasWarp ? warp(p, path) : p;
  const [wx, wy, wz] = w;
  let label = 0;

  // ---- head layers from the (fixed) skull: envelope of the unwarped anatomy ----
  const env0 = skullEnvelope(x, y, z, path) + 1.6;
  out.set(T_AIR);
  // face/skull-base soft tissue
  const face = sdEllipsoid(x, y, z, [0, -50, 30], [62, 38, 64]);
  const head = Math.min(env0 - 16.5, face);
  if (head > 2 && env0 > 18) return 0;
  // eyes
  for (const s of [-1, 1]) {
    const eye = sdEllipsoid(x, y, z, [s * 32, -36, 60], [12, 12, 12]);
    if (eye < 6) {
      const fat = eye;
      if (fat < 6 && env0 > 2) blend(out, T_FAT, cover(fat - 6));
      blend(out, T_VITREOUS, cover(eye));
      const lens = sdEllipsoid(x, y, z, [s * 32, -36, 70.5], [4.5, 4.5, 2]);
      blend(out, T_LENS, cover(lens));
      if (eye < 0) label = REGION_LABEL.eye;
    }
  }
  if (env0 > 2.5 && label === 0) {
    // scalp / skull
    blend(out, T_FAT, cover(Math.max(head, 0)));
    if (env0 < 16.5) {
      const e = env0;
      if (e < 15.2) blend(out, T_MUSCLE, cover(e - 15.2) * (1 - cover(e - 11.5)));
      if (e < 11.5) blend(out, T_FAT, 1);
      if (e < 10) blend(out, T_BONE, cover(e - 10));
      if (e < 8.6) blend(out, T_DIPLOE, cover(e - 8.6));
      if (e < 5.0) blend(out, T_BONE, cover(e - 5.0));
      label = e < 10 ? REGION_LABEL.bone : REGION_LABEL.scalp;
    } else label = REGION_LABEL.scalp;
    if (env0 > 3.6) return label;
  }
  if (env0 <= 3.6) {
    // subarachnoid CSF fills everything inside the inner table not occupied by brain
    blend(out, T_CSF, cover(env0 - 3.6));
    label = REGION_LABEL.csf;
  }

  // ---- extra-axial and CSF-space lesions (evaluated in fixed space) ----
  for (const l of path.lesions) {
    const comp = lesionCompartment(l);
    if (comp !== 'extra') continue;
    const d = lesionSdf(l, p, path);
    if (d < H) {
      lesionProps(l, out, tmp, d, p);
      blend(out, tmp, cover(d));
      if (d < 0) label = REGION_LABEL.lesion;
    }
  }

  // ---- cerebrum ----
  const ce = cortexEval(wx, wy, wz, path);
  if (ce.d < H) {
    const gmT = gmThickness(ce.atrophy);
    const fr = functionalRegion(wx, wy, wz);
    tmp.set(T_GM);
    // functional/molecular modulation of cortex
    const f = path.fdg[fr] ?? 0;
    tmp[FDG] *= 1 + f;
    if (path.amyloid > 0) tmp[AMY] = T_GM[AMY] + 1.25 * path.amyloid * (AMY_W[fr] ?? 0.8);
    if (path.tauBraak > 0) {
      const reg = BRAAK_REGIONS.find((b) => b[0] === fr);
      const st = reg ? reg[1] : 6;
      const a = smoothstep(st - 1.2, st + 0.6, path.tauBraak);
      tmp[TAU] = T_GM[TAU] + 1.9 * a;
    }
    if (path.cortexDiffusion) tmp[ADC] *= 1 - 0.38 * path.cortexDiffusion;
    if (path.stiffness.cortex) tmp[STIFF] *= 1 + path.stiffness.cortex;
    blend(out, tmp, cover(ce.d));
    tmp.set(T_WM);
    if (path.stiffness.whiteMatter) tmp[STIFF] *= 1 + path.stiffness.whiteMatter;
    blend(out, tmp, cover(ce.d + gmT));
    if (ce.d < 0) label = ce.d < -gmT ? REGION_LABEL.wm : REGION_LABEL.cortex;
  }

  // ---- cerebellum & brainstem ----
  if (wy < -8 && wz < -18) {
    const cb = cerebellumSdf(wx, wy, wz, path);
    if (cb < H) {
      tmp.set(T_CBGM);
      tmp[FDG] *= 1 + (path.fdg.cerebellum ?? 0);
      if (path.stiffness.cerebellum) tmp[STIFF] *= 1 + path.stiffness.cerebellum;
      blend(out, tmp, cover(cb));
      blend(out, T_CBWM, cover(cb + 2.2) * smoothstep(8, 14, Math.abs(wx) + 4));
      if (cb < 0) label = REGION_LABEL.cerebellum;
    }
  }
  if (wy < 6 && wz < -6 && ax < 22) {
    const bs = brainstemSdf(wx, wy, wz, path);
    if (bs < H) {
      blend(out, T_STEM, cover(bs));
      if (bs < 0) label = REGION_LABEL.brainstem;
    }
    const sn = substantiaNigraSdf(wx, wy, wz, path);
    if (sn < H) {
      tmp.set(T_SN);
      // nigrosome loss reduces the dorsolateral hyperintensity ("swallow tail")
      if (path.nigralLoss) { tmp[T2S] *= 1 - 0.35 * path.nigralLoss; tmp[CHI] += 0.1 * path.nigralLoss; }
      blend(out, tmp, cover(sn));
      if (sn < 0) label = REGION_LABEL.sn;
    }
  }

  // ---- deep grey nuclei (bbox-pruned) ----
  const inDeep = ax < 40 && wy > -32 && wy < 30 && wz > -45 && wz < 32;
  if (inDeep) {
    const deep: [number, Props, number, () => void][] = [];
    void deep;
    const put = putamenSdf(wx, wy, wz, path);
    if (put < H) {
      tmp.set(T_PUT);
      const post = smoothstep(14, -12, wz); // posterior putamen first
      if (path.datLoss) tmp[DOPA] = 3.1 * (1 - path.datLoss * (0.55 + 0.45 * post));
      else tmp[DOPA] = 3.1;
      tmp[FDG] *= 1 + (path.fdg.putamen ?? 0);
      if (path.sviHyper) { tmp[ADC] *= 1 - 0.35 * path.sviHyper; tmp[T2] *= 1 + 0.25 * path.sviHyper; }
      if (path.stiffness.deepGM) tmp[STIFF] *= 1 + path.stiffness.deepGM;
      blend(out, tmp, cover(put));
      if (put < 0) label = REGION_LABEL.putamen;
    }
    const gp = pallidumSdf(wx, wy, wz);
    if (gp < H) { blend(out, T_PALL, cover(gp)); if (gp < 0) label = REGION_LABEL.pallidum; }
    const cd = caudateSdf(wx, wy, wz, path);
    if (cd < H) {
      tmp.set(T_CAUD);
      tmp[DOPA] = 2.8 * (1 - 0.45 * path.datLoss);
      tmp[FDG] *= 1 + (path.fdg.caudate ?? 0);
      if (path.sviHyper) { tmp[ADC] *= 1 - 0.35 * path.sviHyper; tmp[T2] *= 1 + 0.25 * path.sviHyper; }
      blend(out, tmp, cover(cd));
      if (cd < 0) label = REGION_LABEL.caudate;
    }
    const acc = accumbensSdf(wx, wy, wz);
    if (acc < H) { tmp.set(T_DEEP); tmp[DOPA] = 2.4; blend(out, tmp, cover(acc)); if (acc < 0) label = REGION_LABEL.accumbens; }
    const th = thalamusSdf(wx, wy, wz);
    if (th < H) {
      tmp.set(T_THAL);
      tmp[FDG] *= 1 + (path.fdg.thalamus ?? 0);
      if (path.stiffness.thalamus) tmp[STIFF] *= 1 + path.stiffness.thalamus;
      blend(out, tmp, cover(th));
      if (th < 0) label = REGION_LABEL.thalamus;
    }
    const hy = hypothalamusSdf(wx, wy, wz, path);
    if (hy < H) { blend(out, T_DEEP, cover(hy)); if (hy < 0) label = REGION_LABEL.hypothalamus; }
    const hc = hippocampusSdf(wx, wy, wz, path);
    if (hc < H) {
      tmp.set(T_HIPPO);
      tmp[FDG] *= 1 + (path.fdg.mtl ?? 0);
      if (path.tauBraak) tmp[TAU] = 1 + 1.9 * smoothstep(0.8, 2.6, path.tauBraak);
      if (path.amyloid) tmp[AMY] = T_GM[AMY] + 0.5 * path.amyloid;
      if (path.stiffness.hippocampus) tmp[STIFF] *= 1 + path.stiffness.hippocampus;
      if (wx < 0 && path.leftHippoSignal) { tmp[T2] *= 1 + 0.55 * path.leftHippoSignal; tmp[T1] *= 1 + 0.15 * path.leftHippoSignal; tmp[FDG] *= 1 - 0.3 * path.leftHippoSignal; }
      blend(out, tmp, cover(hc));
      if (hc < 0) label = REGION_LABEL.hippocampus;
    }
    const am = amygdalaSdf(wx, wy, wz, path);
    if (am < H) {
      tmp.set(T_HIPPO);
      tmp[FDG] *= 1 + (path.fdg.mtl ?? 0) * 0.7;
      if (path.tauBraak) tmp[TAU] = 1 + 1.6 * smoothstep(1.5, 3.2, path.tauBraak);
      blend(out, tmp, cover(am));
      if (am < 0) label = REGION_LABEL.amygdala;
    }
    const en = entorhinalSdf(wx, wy, wz, path);
    if (en < H) {
      tmp.set(T_GM);
      if (path.tauBraak) tmp[TAU] = 1 + 2.1 * smoothstep(0.2, 1.6, path.tauBraak);
      tmp[FDG] *= 1 + (path.fdg.mtl ?? 0);
      blend(out, tmp, cover(en));
      if (en < 0) label = REGION_LABEL.entorhinal;
    }
    // white-matter bundles
    const ic = internalCapsuleSdf(wx, wy, wz);
    if (ic < H) { blend(out, T_WM, cover(ic)); if (ic < 0) label = REGION_LABEL.ic; }
    const cc = corpusCallosumSdf(wx, wy, wz, path);
    if (cc < H) { tmp.set(T_WM); tmp[T2] = 64; tmp[STIFF] = 3.1; blend(out, tmp, cover(cc)); if (cc < 0) label = REGION_LABEL.cc; }
    const fx = fornixSdf(wx, wy, wz);
    if (fx < H) { blend(out, T_WM, cover(fx)); if (fx < 0) label = REGION_LABEL.fornix; }
    // ventricular CSF + choroid plexus
    const lv = lateralVentriclesSdf(wx, wy, wz, path);
    const v3 = thirdVentricleSdf(wx, wy, wz, path);
    const v = Math.min(lv, v3);
    if (v < H) {
      blend(out, T_CSF, cover(v));
      if (v < 0) label = REGION_LABEL.ventricle;
      const cp = sdEllipsoid(ax, wy, wz, [24, 9, -35], [3.2, 3, 4.5]);
      if (cp < H) { blend(out, T_CHOROID, cover(cp)); if (cp < 0) label = REGION_LABEL.choroid; }
    }
    const pin = pinealSdf(wx, wy, wz);
    if (pin < H) { blend(out, T_PINEAL, cover(pin)); if (pin < 0) label = REGION_LABEL.pineal; }
    const pit = pituitarySdf(wx, wy, wz);
    if (pit < H) { blend(out, T_PITU, cover(pit)); if (pit < 0) label = REGION_LABEL.pituitary; }
  }
  if (wy < 2 && wz < -15 && ax < 32) {
    const v4 = fourthVentricleSdf(wx, wy, wz, path);
    if (v4 < H) { blend(out, T_CSF, cover(v4)); if (v4 < 0) label = REGION_LABEL.ventricle; }
  }

  // ---- global stiffness modifier ----
  if (path.stiffness.global && out[FLUIDMASK] < 0.5) out[STIFF] *= 1 + path.stiffness.global;

  // ---- intra-axial lesions and oedema ----
  for (const l of path.lesions) {
    const comp = lesionCompartment(l);
    if (comp === 'extra') continue;
    if (l.edema) {
      const de = edemaSdf(l, p, path);
      if (de < H) {
        edemaProps(out, tmp2);
        blend(out, tmp2, cover(de));
        if (de < 0) label = REGION_LABEL.edema;
      }
    }
    const d = lesionSdf(l, p, path);
    if (d < H) {
      // intra-axial lesions only alter tissue inside the brain
      const inBrain = env0 < 3.6;
      if (!inBrain) continue;
      lesionProps(l, out, tmp, d, p);
      blend(out, tmp, cover(d));
      if (d < 0) label = REGION_LABEL.lesion;
    }
  }
  return label;
}
