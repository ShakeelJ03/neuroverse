/**
 * NEUROVERSE parametric anatomical model (v1).
 *
 * PROVENANCE: this is a *conceptual educational representation*. Each structure is a
 * hand-built signed-distance field positioned from approximate MNI152 coordinates of
 * structure centroids/extents reported in standard atlases (Harvard-Oxford, AAL,
 * FreeSurfer aseg) and neuroanatomy texts. It is NOT segmented from a scan and must
 * not be used for measurement. Gyral patterns are procedural (noise-based) except the
 * central sulcus and lateral (Sylvian) fissure, which are explicitly modelled so that
 * lobe and gyrus boundaries sit on the correct landmarks.
 *
 * Because the 3D meshes AND every simulated imaging slice are generated from these
 * same fields, all modalities are perfectly co-registered with the 3D model.
 */
import { noiseA, noiseB, noiseC } from './noise';
import {
  V3, sdEllipsoid, sdSuperEllipsoid, sdTube, smin, smax, TubeNode, mirrorNodes, clamp, smoothstep,
} from './sdf';

// ─── Pathology description shared by 3D, imaging and progression ─────────────────────

export type LesionKind =
  | 'ms' | 'infarct' | 'gbm' | 'lowgrade' | 'meningioma' | 'metastasis' | 'ich' | 'sdh' | 'edh' | 'sah'
  | 'contusion' | 'abscess' | 'inflammation' | 'fcd' | 'avm' | 'schwannoma' | 'adenoma' | 'medulloblastoma'
  | 'dai' | 'venous' | 'wmh' | 'aneurysm' | 'meningitis';

export interface Lesion {
  id: string;
  kind: LesionKind;
  center: V3;
  radii: V3;
  /** generic evolution / severity parameter, meaning depends on kind (see imaging/tissue.ts) */
  stage?: number;
  /** vasogenic oedema margin, mm */
  edema?: number;
  /** enhancing rim thickness, mm (0 = solid enhancement when enhance>0) */
  rim?: number;
  /** contrast enhancement 0..1 */
  enhance?: number;
  /** radial mass effect, mm */
  massEffect?: number;
  /** irregularity of margin 0..1 */
  irregular?: number;
  /** extra-axial collections: hemisphere side (+1 right, -1 left) */
  side?: number;
}

export type AtrophyRegion =
  | 'global' | 'mtl' | 'temporal' | 'anteriorTemporal' | 'frontal' | 'parietal' | 'occipital' | 'insula'
  | 'motor' | 'precuneus' | 'cingulate';

export interface Pathology {
  corticalAtrophy: Partial<Record<AtrophyRegion, number>>; // 0..1 each
  hippocampalAtrophy: number; // 0..1
  ventricleScale: number; // 1 normal
  caudateAtrophy: number; // 0..1
  putamenAtrophy: number;
  midbrainAtrophy: number;
  ponsAtrophy: number;
  cerebellarAtrophy: number;
  ccThinning: number; // corpus callosum thinning 0..1
  ccAgenesis?: boolean;
  tonsillarDescent?: number; // Chiari, mm
  posteriorFossaCyst?: number; // Dandy-Walker, 0..1
  microcephaly?: number; // 0..1 scaling of cerebrum
  gyralSimplification?: number; // 0..1 (lissencephaly / simplified gyral pattern)
  leftHippoAtrophy?: number; // unilateral (left) hippocampal sclerosis 0..1
  leftHippoSignal?: number; // T2/FLAIR signal increase of left hippocampus 0..1
  lesions: Lesion[];
  /** functional / molecular layers used by PET & MRE simulators (no geometry) */
  fdg: Partial<Record<FunctionalRegion, number>>; // relative change, e.g. -0.3
  amyloid: number; // 0..1 cortical amyloid burden
  tauBraak: number; // 0..6
  datLoss: number; // striatal dopamine transporter loss 0..1 (posterior putamen first)
  nigralLoss: number; // 0..1
  stiffness: Partial<Record<StiffnessRegion, number>>; // fractional change, e.g. -0.08
  sviHyper?: number; // generic T2 signal increase in caudate/putamen (CJD etc.) 0..1
  cortexDiffusion?: number; // cortical ribboning (CJD) 0..1
}

export type FunctionalRegion =
  | 'frontal' | 'parietal' | 'temporal' | 'mtl' | 'occipital' | 'precuneus' | 'pcc' | 'acc' | 'sensorimotor'
  | 'insula' | 'anteriorTemporal' | 'caudate' | 'putamen' | 'thalamus' | 'cerebellum' | 'visual' | 'lateralTemporal';

export type StiffnessRegion = 'global' | 'cortex' | 'whiteMatter' | 'hippocampus' | 'thalamus' | 'cerebellum' | 'deepGM';

export const emptyPathology = (): Pathology => ({
  corticalAtrophy: {},
  hippocampalAtrophy: 0,
  ventricleScale: 1,
  caudateAtrophy: 0,
  putamenAtrophy: 0,
  midbrainAtrophy: 0,
  ponsAtrophy: 0,
  cerebellarAtrophy: 0,
  ccThinning: 0,
  lesions: [],
  fdg: {},
  amyloid: 0,
  tauBraak: 0,
  datLoss: 0,
  nigralLoss: 0,
  stiffness: {},
});

// ─── Mass-effect warp (shared) ──────────────────────────────────────────────────────

/** Returns the source point to sample anatomy from, after displacement by space-occupying lesions. */
export function warp(p: V3, path: Pathology): V3 {
  let x = p[0], y = p[1], z = p[2];
  for (const l of path.lesions) {
    const m = l.massEffect ?? 0;
    if (m <= 0) continue;
    const dx = x - l.center[0], dy = y - l.center[1], dz = z - l.center[2];
    const s = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
    const R = Math.max(l.radii[0], l.radii[1], l.radii[2]);
    const fall = clamp(s / R, 0, 1) * Math.exp(-Math.max(0, s - R) / 28);
    const u = m * fall;
    // inverse map approximation: sample closer to the lesion centre
    x -= (dx / s) * u;
    y -= (dy / s) * u;
    z -= (dz / s) * u;
  }
  return [x, y, z];
}

// ─── Landmark curves ────────────────────────────────────────────────────────────────

/** Lateral (Sylvian) fissure height as a function of anterior–posterior position. */
export const sylvianY = (z: number) => -10 + (10 - z) * 0.6;
/** Central sulcus AP position as a function of height. */
export const centralZ = (y: number) => -24 + (66 - y) * 0.38;

// ─── Infratentorial structures ──────────────────────────────────────────────────────

const BRAINSTEM: TubeNode[] = [
  { p: [0, -1, -20], r: 11 },
  { p: [0, -14, -24], r: 11.5 },
  { p: [0, -28, -22], r: 13.5 },
  { p: [0, -40, -30], r: 9.5 },
  { p: [0, -52, -36], r: 8 },
  { p: [0, -70, -40], r: 7 },
];

export function brainstemSdf(x: number, y: number, z: number, path: Pathology): number {
  let d = sdTube(x, y, z, BRAINSTEM, [1.25, 1, 1]);
  // midbrain atrophy (PSP "hummingbird"), pontine atrophy (MSA-C)
  if (path.midbrainAtrophy > 0) d += path.midbrainAtrophy * 3.2 * smoothstep(-22, -12, y) * smoothstep(4, -6, y);
  if (path.ponsAtrophy > 0) d += path.ponsAtrophy * 3.5 * smoothstep(-44, -34, y) * smoothstep(-14, -22, y);
  return d;
}

export function cerebellumSdf(x: number, y: number, z: number, path: Pathology): number {
  const ax = Math.abs(x);
  const ty = y + (path.tonsillarDescent ? 0 : 0);
  let hemi = sdEllipsoid(ax, ty, z, [24, -36, -62], [26, 21, 27]);
  const vermis = sdEllipsoid(ax, ty, z, [0, -32, -60], [9, 20, 22]);
  let d = smin(hemi, vermis, 6);
  if (path.posteriorFossaCyst) {
    // Dandy–Walker: vermian hypoplasia
    d = smax(d, -(sdEllipsoid(ax, ty, z, [0, -36, -62], [8 + 6 * path.posteriorFossaCyst, 18, 22])), 3);
  }
  // tonsils (Chiari: descend through foramen magnum)
  const t = path.tonsillarDescent ?? 0;
  const tonsil = sdEllipsoid(ax, y, z, [7, -54 - t, -50 + t * 0.2], [5, 7 + t * 0.5, 6]);
  d = smin(d, tonsil, 4);
  // keep clear of the brainstem / fourth ventricle
  d = smax(d, -(sdEllipsoid(x, y, z, [0, -32, -42], [7, 8, 5]) - 1), 2);
  d = smax(d, -(brainstemSdf(x, y, z, path) - 1.2), 2);
  if (path.cerebellarAtrophy) d += path.cerebellarAtrophy * 2.5;
  // folia: concentric laminae around the fastigium + jitter
  if (d < 6) {
    const cx = x, cy = y + 30, cz = z + 46;
    const r = Math.sqrt(cx * cx + cy * cy + cz * cz);
    const j = noiseB.noise(x * 0.06, y * 0.06, z * 0.06) * 1.6;
    const lam = 0.5 + 0.5 * Math.sin(r * 1.3 + j * 2);
    d += Math.pow(lam, 6) * (1.6 + 1.2 * (path.cerebellarAtrophy ?? 0));
    // primary fissure: one deeper lamina
    const pf = Math.abs(r - 31) - 0.9;
    if (pf < 0) d += 3 * (1 + pf / 0.9);
  }
  return d;
}

// ─── Cerebral hemispheres ───────────────────────────────────────────────────────────

export function regionAtrophy(x: number, y: number, z: number, path: Pathology): number {
  const a = path.corticalAtrophy;
  let v = a.global ?? 0;
  const ax = Math.abs(x);
  const ys = sylvianY(z);
  if (a.frontal) v += a.frontal * smoothstep(centralZ(y) - 4, centralZ(y) + 14, z);
  if (a.parietal) v += a.parietal * smoothstep(centralZ(y) + 2, centralZ(y) - 12, z) * smoothstep(-80, -62, z) * smoothstep(ys - 6, ys + 6, y);
  if (a.temporal) v += a.temporal * smoothstep(ys + 4, ys - 6, y) * smoothstep(-74, -60, z);
  if (a.anteriorTemporal) v += a.anteriorTemporal * smoothstep(ys + 4, ys - 6, y) * smoothstep(-20, 0, z);
  if (a.mtl) v += a.mtl * smoothstep(36, 26, ax) * smoothstep(-4, -12, y) * smoothstep(-50, -35, z) * smoothstep(20, 8, z);
  if (a.occipital) v += a.occipital * smoothstep(-58, -72, z);
  if (a.insula) v += a.insula * smoothstep(46, 38, ax) * smoothstep(14, 6, Math.abs(y - ys));
  if (a.motor) v += a.motor * smoothstep(14, 4, Math.abs(z - centralZ(y) - 5));
  if (a.precuneus) v += a.precuneus * smoothstep(14, 6, ax) * smoothstep(centralZ(y) - 10, centralZ(y) - 24, z) * smoothstep(-62, -54, z) * smoothstep(0, 12, y);
  if (a.cingulate) v += a.cingulate * smoothstep(10, 4, ax) * smoothstep(-4, 6, y);
  return clamp(v, 0, 1.2);
}

/** Smooth hemispheric hull without sulci. */
export function cerebrumBase(x: number, y: number, z: number, path: Pathology): number {
  const ax = Math.abs(x);
  const mc = path.microcephaly ?? 0;
  const k = 1 - 0.22 * mc;
  const sx = ax / k, sy = (y - 10) / k + 10, sz = (z + 10) / k - 10;
  const taper = 1 - 0.1 * clamp((sz - 10) / 60, 0, 1);
  const main = sdSuperEllipsoid(sx, sy, sz, [33, 28, -16], [36 * taper, 48, 86], 2.6);
  const temporal = sdEllipsoid(sx, sy, sz, [47, -17, -20], [21, 18, 45]);
  let d = smin(main, temporal, 14) * k;
  // medial plane (interhemispheric fissure)
  d = smax(d, 1.2 - ax, 2);
  // tentorium: stay clear of cerebellum and brainstem
  d = smax(d, -(cerebellumSdf(x, y, z, path) - 3), 3);
  d = smax(d, -(sdTube(x, y, z, BRAINSTEM, [1.25, 1, 1]) - 2), 3);
  // medial hilum (where the corpus callosum / diencephalon join the hemisphere)
  d = smax(d, -sdEllipsoid(x, y, z, [0, 6, -8], [6.5, 21, 35]), 2);
  return d;
}

export interface CortexEval {
  d: number; // final pial SDF
  base: number; // hull without sulci (for sulcal depth shading)
  atrophy: number;
}

export function cortexEval(x: number, y: number, z: number, path: Pathology): CortexEval {
  const base = cerebrumBase(x, y, z, path);
  const atrophy = regionAtrophy(x, y, z, path);
  if (base > 14 || base < -22) return { d: base, base, atrophy };
  const ax = Math.abs(x);
  let d = base;

  // Sylvian fissure (with deep insular cistern so the insula is a real hidden surface)
  const ys = sylvianY(z);
  const w = ax > 46 ? 1.6 + atrophy * 1.6 : 1.6 + (46 - ax) * 0.95 + atrophy * 1.6;
  const groove = Math.max(Math.abs(y - ys) - Math.min(w, 9), 38 - ax, z - 22, -45 - z);
  d = Math.max(d, -groove);

  // Central sulcus (explicit landmark)
  const zc = centralZ(y);
  const cs = Math.max(Math.abs(z - zc) - (1.3 + atrophy), ys + 3 - y, -base - 15);
  d = Math.max(d, -cs);

  const g = 1 - 0.85 * (path.gyralSimplification ?? 0);
  const sw = 1.1 + atrophy * 1.1; // sulcal half-width
  // low-frequency wobble so landmark sulci are not ruler-straight
  const wob = noiseB.noise(x * 0.05, y * 0.05, z * 0.05) * 3.2;
  const carve = (line: number, depth: number, inRegion: boolean) => {
    if (!inRegion || g < 0.2) return;
    const c = Math.max(Math.abs(line + wob) - sw, -base - depth * g);
    d = Math.max(d, -c);
  };
  const s = x >= 0 ? 1 : -1;
  // Primary / secondary sulci as explicit landmarks (approximate MNI course)
  carve(z - (zc + 12), 11, y > ys + 8 && z < 40); // precentral sulcus
  carve(z - (zc - 12), 10, y > ys + 4 && z > -72); // postcentral sulcus
  carve(ax - 22 - 0.06 * (z - 10), 11, z > zc + 14 && y > 28 && ax > 12); // superior frontal sulcus
  carve(y - (20 + 0.12 * (z - 20)), 11, z > zc + 14 && ax > 38 && z < 62); // inferior frontal sulcus
  const yt = ys - 11;
  carve(y - yt, 11, z < 24 && z > -66 && ax > 40 && y < ys); // superior temporal sulcus
  carve(y - (yt - 13), 9, z < 18 && z > -70 && ax > 44 && y < ys); // inferior temporal sulcus
  carve(ax - (31 - 0.12 * (z + 40)), 12, z < zc - 14 && z > -78 && y > 22); // intraparietal sulcus
  carve(z - (-66 + 0.25 * (y - 20)), 13, ax < 12 && y > -4); // parieto-occipital sulcus (medial)
  carve(y - (6 + 0.15 * (z + 80)), 12, ax < 13 && z < -58); // calcarine sulcus (medial)
  {
    const e = Math.sqrt(((y - 8) / 20) ** 2 + ((z + 5) / 36) ** 2);
    carve((e - 1.62) * 22, 10, ax < 10 && y > -2 && z > -48); // cingulate sulcus (medial)
  }
  void s;

  // Tertiary folding: domain-warped ridged simplex noise, anisotropic (gyri run mostly A–P)
  const wx = noiseB.noise(x * 0.018, y * 0.018, z * 0.018) * 9;
  const wy = noiseC.noise(x * 0.018 + 5, y * 0.018, z * 0.018) * 9;
  const q = 0.04;
  const n1 = noiseA.noise((x + wx) * q, (y + wy) * q * 1.15, (z + wx * 0.5) * q * 0.62);
  const sharp = 14 - 6 * atrophy;
  const s1 = Math.pow(1 - Math.abs(n1), sharp);
  const n2 = noiseC.noise(x * 0.085, y * 0.085, z * 0.085);
  const s2 = Math.pow(1 - Math.abs(n2), 12);
  d += ((10 + 4 * atrophy) * s1 + 1.1 * s2) * g + atrophy * 1.6;
  return { d, base, atrophy };
}

export const cortexSdf = (x: number, y: number, z: number, path: Pathology) => cortexEval(x, y, z, path).d;

/** Nominal cortical grey-matter thickness, mm (thins with atrophy). */
export const gmThickness = (atrophy: number) => 2.7 * (1 - 0.28 * clamp(atrophy, 0, 1));

// ─── Cortical parcellation (surface labelling) ─────────────────────────────────────

export type CortexParcel =
  | 'frontal' | 'precentral' | 'broca' | 'parietal' | 'postcentral' | 'temporal' | 'auditory' | 'wernicke'
  | 'occipital' | 'visual' | 'insula' | 'cingulate' | 'hilum';

export function cortexParcel(x: number, y: number, z: number): CortexParcel {
  const ax = Math.abs(x);
  const left = x < 0;
  const ys = sylvianY(z);
  const zc = centralZ(y);
  // medial surface: hilum and cingulate gyrus around the callosal arch
  if (ax < 8) {
    const e = Math.sqrt(((y - 8) / 20) ** 2 + ((z + 5) / 36) ** 2);
    if (e < 1.02 && y > -18) return 'hilum';
    if (e < 1.55 && y > -4 && z > -46) return 'cingulate';
  }
  if (ax < 42 && ax > 28 && Math.abs(y - ys) < 12 && z > -40 && z < 22) return 'insula';
  const occBoundary = -68 + 0.12 * (y - 20);
  if (z < occBoundary) {
    if (ax < 17 && Math.abs(y - (6 + 0.15 * (z + 80))) < 13) return 'visual';
    return 'occipital';
  }
  const yt = z > -40 ? ys : -5 + (ys - -5) * clamp((z + 70) / 30, 0, 1);
  const temporal = (y < yt && z < 28) || (ax < 32 && y < -6 && z > -66);
  if (temporal) {
    if (y > yt - 7 && z > -30 && z < -6 && ax > 34 && ax < 54) return 'auditory';
    if (left && y > yt - 16 && z < -24 && z > -56 && ax > 44) return 'wernicke';
    return 'temporal';
  }
  if (z > zc) {
    const dz = z - zc;
    if (dz < 11) return 'precentral';
    if (left && ax > 40 && y > ys - 1 && y < ys + 20 && dz > 13 && dz < 38 && z < 42) return 'broca';
    return 'frontal';
  }
  if (zc - z < 11) return 'postcentral';
  return 'parietal';
}

/** Functional region used by PET/MRE (finer than parcels: precuneus, PCC, ACC, MTL...). */
export function functionalRegion(x: number, y: number, z: number): FunctionalRegion {
  const p = cortexParcel(x, y, z);
  const ax = Math.abs(x);
  switch (p) {
    case 'cingulate':
      return z < -12 ? 'pcc' : 'acc';
    case 'parietal':
      return ax < 14 ? 'precuneus' : 'parietal';
    case 'precentral':
    case 'postcentral':
      return 'sensorimotor';
    case 'temporal':
    case 'wernicke':
    case 'auditory':
      if (ax < 33 && y < -4) return 'mtl';
      if (z > 0) return 'anteriorTemporal';
      return 'lateralTemporal';
    case 'visual':
      return 'visual';
    case 'occipital':
      return 'occipital';
    case 'insula':
      return 'insula';
    default:
      return 'frontal';
  }
}

// ─── Deep / midline structures ──────────────────────────────────────────────────────

const LAT_VENT_R: TubeNode[] = [
  { p: [9, 6, 26], r: 3.2 },
  { p: [10.5, 12, 14], r: 4.2 },
  { p: [13, 15, -4], r: 3.6 },
  { p: [17, 14, -22], r: 4.2 },
  { p: [24, 10, -34], r: 5.5 },
  { p: [20, 6, -52], r: 2.6 },
  { p: [17, 5, -60], r: 1.2 },
];
const TEMP_HORN_R: TubeNode[] = [
  { p: [24, 10, -34], r: 5 },
  { p: [33, 0, -32], r: 3.4 },
  { p: [35.5, -6, -20], r: 2.6 },
  { p: [33, -11, -6], r: 2.0 },
  { p: [31, -13, 0], r: 1.2 },
];
const CAUDATE_R: TubeNode[] = [
  { p: [14.5, 8, 20], r: 6 },
  { p: [16, 12, 8], r: 5.2 },
  { p: [18, 16.5, -6], r: 3.3 },
  { p: [21.5, 16, -20], r: 2.4 },
  { p: [27, 13, -32], r: 1.8 },
  { p: [34, 2, -30], r: 1.4 },
  { p: [36, -5, -18], r: 1.0 },
];
const HIPPO_R: TubeNode[] = [
  { p: [20, 8, -36], r: 2.2 },
  { p: [25, 0, -33], r: 3.2 },
  { p: [28.5, -9, -25], r: 4.2 },
  { p: [28, -13.5, -15], r: 5 },
  { p: [26, -15, -7], r: 5.2 },
];
const FORNIX_R: TubeNode[] = [
  { p: [21, 9, -37], r: 1.5 },
  { p: [12, 17, -30], r: 1.8 },
  { p: [3, 17.5, -14], r: 1.8 },
  { p: [2.5, 13, 0], r: 1.6 },
  { p: [3, 3, 4], r: 1.4 },
  { p: [3, -8, 0], r: 1.3 },
];
const CC: TubeNode[] = [
  { p: [0, -4, 18], r: 2 },
  { p: [0, 4, 28], r: 4.5 },
  { p: [0, 15, 26], r: 4 },
  { p: [0, 22, 12], r: 3 },
  { p: [0, 24.5, -6], r: 2.8 },
  { p: [0, 22, -24], r: 3.4 },
  { p: [0, 14, -36], r: 5.5 },
  { p: [0, 8, -35], r: 3 },
];
const IC_R: TubeNode[] = [
  { p: [19, 6, 20], r: 1.5 },
  { p: [17.5, 5, 2], r: 1.7 },
  { p: [18.5, 5, -16], r: 1.6 },
  { p: [21, 6, -24], r: 1.2 },
];
const AQUEDUCT: TubeNode[] = [
  { p: [0, -3, -26], r: 1.1 },
  { p: [0, -16, -32], r: 1.0 },
  { p: [0, -27, -38], r: 1.2 },
];

const bilateral = (nodes: TubeNode[], x: number, y: number, z: number, scale: V3 = [1, 1, 1]) =>
  sdTube(Math.abs(x), y, z, nodes, scale);

export function lateralVentriclesSdf(x: number, y: number, z: number, path: Pathology): number {
  const v = path.ventricleScale;
  const sx = Math.min(1, 0.62 + 0.3 * (v - 1));
  const scaled = (n: TubeNode[]) => n.map((q) => ({ p: q.p, r: q.r * Math.pow(v, 0.95) }));
  const a = bilateral(scaled(LAT_VENT_R), x, y, z, [sx, 1, 1]);
  const b = bilateral(scaled(TEMP_HORN_R), x, y, z, [sx + 0.15, 1, 1]);
  let d = smin(a, b, 2);
  if (path.ccAgenesis) {
    // colpocephaly + parallel, widely separated ventricles
    d = Math.min(d, bilateral(LAT_VENT_R.map((q) => ({ p: [q.p[0] + 5, q.p[1], q.p[2]] as V3, r: q.r * (q.p[2] < -30 ? 1.8 : 1) })), x, y, z, [0.7, 1, 1]));
  }
  return d;
}
export const thirdVentricleSdf = (x: number, y: number, z: number, path: Pathology) =>
  sdEllipsoid(x, y, z, [0, 2, -10], [2.2 * Math.pow(path.ventricleScale, 1.4), 9, 14]);
export const fourthVentricleSdf = (x: number, y: number, z: number, path: Pathology) => {
  const cyst = path.posteriorFossaCyst ?? 0;
  const base = sdEllipsoid(x, y, z, [0, -32, -42], [6 * (1 + 0.3 * (path.ventricleScale - 1)), 6.5, 3.5]);
  const aq = sdTube(x, y, z, AQUEDUCT);
  let d = smin(base, aq, 1.5);
  if (cyst > 0) d = Math.min(d, sdEllipsoid(x, y, z, [0, -36, -62], [10 + 12 * cyst, 14 + 6 * cyst, 14 + 10 * cyst]));
  return d;
};

export const caudateSdf = (x: number, y: number, z: number, path: Pathology) =>
  bilateral(CAUDATE_R.map((n, i) => ({ p: n.p, r: n.r * (1 - path.caudateAtrophy * (i < 2 ? 0.55 : 0.35)) })), x, y, z);
export const putamenSdf = (x: number, y: number, z: number, path: Pathology) =>
  sdEllipsoid(Math.abs(x), y, z, [26, 1, 3], [5.5 * (1 - 0.3 * path.putamenAtrophy), 10, 16 * (1 - 0.15 * path.putamenAtrophy)]);
export const pallidumSdf = (x: number, y: number, z: number) => sdEllipsoid(Math.abs(x), y, z, [20, -1, -2], [3, 6.5, 9]);
export const accumbensSdf = (x: number, y: number, z: number) => sdEllipsoid(Math.abs(x), y, z, [10, -7, 13], [5, 4, 5]);
export const thalamusSdf = (x: number, y: number, z: number) =>
  smax(sdEllipsoid(Math.abs(x), y, z, [10, 6, -16], [6.5, 8.5, 15]), 2.4 - Math.abs(x), 1);
export const hypothalamusSdf = (x: number, y: number, z: number, path: Pathology) =>
  smax(sdEllipsoid(x, y, z, [0, -9, -2], [7, 5, 8]), -thirdVentricleSdf(x, y, z, path), 1);
export const hippocampusSdf = (x: number, y: number, z: number, path: Pathology) => {
  const a = Math.min(1, path.hippocampalAtrophy + (x < 0 ? path.leftHippoAtrophy ?? 0 : 0));
  return bilateral(HIPPO_R.map((n) => ({ p: n.p, r: n.r * (1 - 0.42 * a) })), x, y, z, [1, 0.8, 1]);
};
export const amygdalaSdf = (x: number, y: number, z: number, path: Pathology) => {
  const a = 1 - 0.3 * path.hippocampalAtrophy;
  return sdEllipsoid(Math.abs(x), y, z, [22, -17, 2], [7 * a, 6.5 * a, 7.5 * a]);
};
export const entorhinalSdf = (x: number, y: number, z: number, path: Pathology) => {
  const a = 1 - 0.35 * path.hippocampalAtrophy;
  return sdEllipsoid(Math.abs(x), y, z, [25, -24, -4], [3.5 * a, 3.2 * a, 9]);
};
export const fornixSdf = (x: number, y: number, z: number) => bilateral(FORNIX_R, x, y, z);
export const corpusCallosumSdf = (x: number, y: number, z: number, path: Pathology) => {
  if (path.ccAgenesis) return 50;
  return sdTube(x, y, z, CC.map((n) => ({ p: n.p, r: n.r * (1 - 0.45 * path.ccThinning) })), [4.2, 1, 1]);
};
export const internalCapsuleSdf = (x: number, y: number, z: number) => bilateral(IC_R, x, y, z, [1, 4.5, 1]);
export const substantiaNigraSdf = (x: number, y: number, z: number, path: Pathology) =>
  sdEllipsoid(Math.abs(x), y, z, [9, -9.5, -18], [2.4 * (1 - 0.4 * path.nigralLoss), 2.4, 6]);
export const pinealSdf = (x: number, y: number, z: number) => sdEllipsoid(x, y, z, [0, 3, -30], [3, 2.8, 4]);
export const pituitarySdf = (x: number, y: number, z: number) =>
  smin(sdEllipsoid(x, y, z, [0, -30, 4], [6, 4, 5]), sdTube(x, y, z, [{ p: [0, -14, 0], r: 1.2 }, { p: [0, -27, 3], r: 1.1 }]), 1.5);
export const midbrainSdf = (x: number, y: number, z: number, path: Pathology) => Math.max(brainstemSdf(x, y, z, path), -16 - y);
export const ponsSdf = (x: number, y: number, z: number, path: Pathology) =>
  Math.max(brainstemSdf(x, y, z, path), y + 16, -39 - y);
export const medullaSdf = (x: number, y: number, z: number, path: Pathology) => Math.max(brainstemSdf(x, y, z, path), y + 39);
export const whiteMatterSdf = (x: number, y: number, z: number, path: Pathology) => {
  const e = cortexEval(x, y, z, path);
  return e.d + gmThickness(e.atrophy);
};

// ─── Lesion geometry ────────────────────────────────────────────────────────────────

export function lesionCoreSdf(l: Lesion, x: number, y: number, z: number): number {
  let d = sdEllipsoid(x, y, z, l.center, l.radii);
  const irr = l.irregular ?? 0;
  if (irr > 0 && d < 8) d += irr * 2.6 * noiseA.noise(x * 0.16 + l.center[0], y * 0.16, z * 0.16 + l.center[2]);
  return d;
}

/** Brain-envelope distance (smooth outer surface of brain: cerebrum ∪ cerebellum ∪ brainstem). */
export function brainEnvelope(x: number, y: number, z: number, path: Pathology): number {
  const c = cerebrumBase(x, y, z, path);
  const cb = cerebellumSdf(x, y, z, path);
  const bs = brainstemSdf(x, y, z, path);
  return smin(smin(Math.min(c, sdEllipsoid(x, y, z, [0, 6, -8], [8, 21, 35])), cb, 6), bs, 6);
}

/** Smooth skull-interior envelope (no interhemispheric fissure), used for CSF/skull/scalp layers. */
export function skullEnvelope(x: number, y: number, z: number, path: Pathology): number {
  const ax = Math.abs(x);
  const mc = path.microcephaly ?? 0;
  const k = 1 - 0.22 * mc;
  const sx = x / k, sax = ax / k, sy = (y - 10) / k + 10, sz = (z + 10) / k - 10;
  const taper = 1 - 0.1 * clamp((sz - 10) / 60, 0, 1);
  const zn = clamp((sz + 16) / 86, -1, 1);
  const main = sdSuperEllipsoid(sx, sy, sz, [0, 28, -16], [69 * taper * (1 - 0.3 * zn * zn), 48, 86], 2.4);
  const temporal = sdEllipsoid(sax, sy, sz, [47, -17, -20], [21, 18, 45]);
  const d = smin(main, temporal, 14) * k;
  const cb = sdEllipsoid(ax, y, z, [24, -36, -62], [28, 23, 29]);
  const bs = sdTube(x, y, z, BRAINSTEM, [1.25, 1, 1]);
  return smin(smin(d, cb, 12), bs, 8);
}

// ─── Mesh catalogue ─────────────────────────────────────────────────────────────────

export interface MeshDef {
  id: string;
  /** SDF in *warped* coordinates is handled by the mesher */
  sdf: (x: number, y: number, z: number, path: Pathology) => number;
  bmin: V3;
  bmax: V3;
  step: number;
  smooth?: number;
}

export const DEEP_MESHES: MeshDef[] = [
  { id: 'thalamus', sdf: thalamusSdf, bmin: [-19, -5, -34], bmax: [19, 17, 1], step: 0.8 },
  { id: 'hypothalamus', sdf: hypothalamusSdf, bmin: [-9, -16, -12], bmax: [9, -2, 8], step: 0.6 },
  { id: 'hippocampus', sdf: hippocampusSdf, bmin: [-36, -22, -42], bmax: [36, 13, 0], step: 0.7 },
  { id: 'amygdala', sdf: amygdalaSdf, bmin: [-31, -26, -8], bmax: [31, -8, 12], step: 0.7 },
  { id: 'entorhinal', sdf: entorhinalSdf, bmin: [-31, -30, -15], bmax: [31, -18, 7], step: 0.6 },
  { id: 'caudate', sdf: caudateSdf, bmin: [-39, -9, -36], bmax: [39, 22, 28], step: 0.7 },
  { id: 'putamen', sdf: putamenSdf, bmin: [-33, -11, -15], bmax: [33, 13, 21], step: 0.7 },
  { id: 'globus-pallidus', sdf: pallidumSdf, bmin: [-25, -9, -13], bmax: [25, 7, 9], step: 0.6 },
  { id: 'nucleus-accumbens', sdf: accumbensSdf, bmin: [-17, -13, 6], bmax: [17, -1, 20], step: 0.6 },
  { id: 'internal-capsule', sdf: internalCapsuleSdf, bmin: [-25, -6, -28], bmax: [25, 17, 24], step: 0.7 },
  { id: 'corpus-callosum', sdf: corpusCallosumSdf, bmin: [-30, -9, -44], bmax: [30, 30, 35], step: 0.8 },
  { id: 'fornix', sdf: fornixSdf, bmin: [-25, -12, -41], bmax: [25, 21, 8], step: 0.6 },
  { id: 'lateral-ventricles', sdf: lateralVentriclesSdf, bmin: [-50, -25, -72], bmax: [50, 32, 38], step: 0.8 },
  { id: 'third-ventricle', sdf: thirdVentricleSdf, bmin: [-8, -9, -26], bmax: [8, 13, 6], step: 0.5 },
  { id: 'fourth-ventricle', sdf: fourthVentricleSdf, bmin: [-26, -55, -82], bmax: [26, 0, -20], step: 0.7 },
  { id: 'substantia-nigra', sdf: substantiaNigraSdf, bmin: [-14, -14, -26], bmax: [14, -5, -10], step: 0.5 },
  { id: 'pineal-gland', sdf: pinealSdf, bmin: [-5, -1, -36], bmax: [5, 7, -24], step: 0.5 },
  { id: 'pituitary-gland', sdf: pituitarySdf, bmin: [-8, -36, -3], bmax: [8, -11, 11], step: 0.5 },
  { id: 'midbrain', sdf: midbrainSdf, bmin: [-17, -18, -36], bmax: [17, 12, -8], step: 0.9 },
  { id: 'pons', sdf: ponsSdf, bmin: [-19, -41, -40], bmax: [19, -14, -6], step: 0.9 },
  { id: 'medulla', sdf: medullaSdf, bmin: [-14, -80, -50], bmax: [14, -37, -18], step: 0.9 },
  { id: 'cerebellum', sdf: cerebellumSdf, bmin: [-53, -72, -94], bmax: [53, -11, -28], step: 1.0 },
];

export const CORTEX_BOUNDS: { bmin: V3; bmax: V3 } = { bmin: [-72, -42, -106], bmax: [72, 80, 74] };

export const CORTEX_PARCELS: CortexParcel[] = [
  'frontal', 'precentral', 'broca', 'parietal', 'postcentral', 'temporal', 'auditory', 'wernicke', 'occipital', 'visual',
  'insula', 'cingulate', 'hilum',
];

/** mesh id used for each parcel */
export const parcelMeshId = (p: CortexParcel) => `cortex-${p}`;
