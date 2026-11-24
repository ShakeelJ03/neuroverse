/**
 * Signal models that turn the tissue-property phantom into modality images.
 * MRI: closed-form steady-state signal equations (spin echo, inversion recovery, diffusion).
 * CT: Hounsfield units + quantum noise. PET: tracer distribution blurred by the scanner PSF + noise.
 * MRE: shear stiffness map and simulated harmonic shear-wave propagation.
 */
import { ADC, AMY, CHI, DOPA, FDG, FET, FLUIDMASK, GD, HU, K, PD, STIFF, T1, T2, T2S, TAU, DAMP } from './tissue';
import type { SliceData } from './slice';
import { FOV } from './slice';

export type MriSeq = 'T1' | 'T2' | 'FLAIR' | 'DWI' | 'ADC' | 'SWI' | 'T1C' | 'CUSTOM';
export type PetTracer = 'FDG' | 'AMY' | 'TAU' | 'DOPA' | 'FET';
export type ModalityKey = 'mri' | 'ct' | 'pet' | 'mre';

export interface SeqParams {
  tr: number;
  te: number;
  ti: number; // 0 = no inversion
  b: number;
}

export const MRI_SEQS: Record<Exclude<MriSeq, 'CUSTOM'>, { name: string; params: SeqParams; desc: string; emphasises: string }> = {
  T1: { name: 'T1-weighted (3D IR-prepared, MPRAGE-like)', params: { tr: 2300, te: 3, ti: 1100, b: 0 }, emphasises: 'T1 (longitudinal) relaxation', desc: 'An inversion pulse followed by a delay (TI) lets tissues recover according to T1: short-T1 tissue (fat, white matter, methaemoglobin, gadolinium) is bright and long-T1 tissue (CSF, oedema) dark. The standard sequence for anatomy and volumetry (e.g., hippocampal atrophy).' },
  T2: { name: 'T2-weighted (fast spin echo)', params: { tr: 4000, te: 100, ti: 0, b: 0 }, emphasises: 'T2 (transverse) relaxation', desc: 'Long TR removes T1 differences; long TE lets short-T2 tissue decay. Free water (CSF, oedema, most lesions) stays bright; white matter is darker than grey matter.' },
  FLAIR: { name: 'FLAIR (T2 with CSF suppression)', params: { tr: 9000, te: 120, ti: 2500, b: 0 }, emphasises: 'T2 with free-water nulling', desc: 'An inversion pulse with TI chosen at the CSF null point suppresses free fluid, so periventricular and juxtacortical lesions stand out against dark CSF.' },
  DWI: { name: 'Diffusion-weighted (b = 1000 s/mm²)', params: { tr: 6000, te: 80, ti: 0, b: 1000 }, emphasises: 'Water mobility (with residual T2)', desc: 'Motion-probing gradients attenuate signal where water moves freely (S = S₀·e^(−b·ADC)). Restricted diffusion — cytotoxic oedema, abscess pus, highly cellular tumour — stays bright. Bright DWI must be checked against ADC to exclude “T2 shine-through”.' },
  ADC: { name: 'Apparent diffusion coefficient map', params: { tr: 6000, te: 80, ti: 0, b: 1000 }, emphasises: 'Quantitative diffusivity (×10⁻³ mm²/s)', desc: 'Calculated from DWI at two or more b-values; removes T2 effects. True restriction is dark on ADC.' },
  SWI: { name: 'Susceptibility-weighted', params: { tr: 30, te: 20, ti: 0, b: 0 }, emphasises: 'T2* and magnetic susceptibility', desc: 'Gradient-echo magnitude multiplied by a phase mask: paramagnetic deoxyhaemoglobin, haemosiderin, iron and calcium (diamagnetic, opposite phase) become dark and “bloom”. Very sensitive to microbleeds and veins.' },
  T1C: { name: 'T1 post-gadolinium', params: { tr: 2300, te: 3, ti: 1100, b: 0 }, emphasises: 'T1 shortening by gadolinium where the blood–brain barrier is disrupted', desc: 'Gadolinium shortens T1 (1/T1 = 1/T1₀ + r₁·[Gd]). Structures without a blood–brain barrier (pituitary, choroid plexus, dura, veins) enhance normally; parenchymal enhancement implies BBB breakdown (tumour, active MS plaque, subacute infarct, infection).' },
};

export const PET_TRACERS: Record<PetTracer, { name: string; desc: string; idx: number }> = {
  FDG: { name: '¹⁸F-FDG (glucose metabolism)', idx: FDG, desc: 'FDG is phosphorylated by hexokinase and trapped intracellularly, mapping regional glucose utilisation — dominated by synaptic activity, so grey matter is ~3–4× white matter.' },
  AMY: { name: 'Amyloid PET (e.g. ¹⁸F-florbetapir)', idx: AMY, desc: 'Binds fibrillar Aβ plaques. Normal scans show non-specific white-matter retention with low cortex (clear grey–white contrast); positive scans show cortical uptake with loss of that contrast.' },
  TAU: { name: 'Tau PET (e.g. ¹⁸F-flortaucipir)', idx: TAU, desc: 'Binds paired-helical-filament tau. Uptake spreads from medial temporal cortex in a Braak-like pattern. Note known off-target binding in choroid plexus and basal ganglia.' },
  DOPA: { name: '¹⁸F-DOPA (presynaptic dopamine)', idx: DOPA, desc: 'Taken up and decarboxylated in dopaminergic terminals: high striatal signal. Parkinsonian loss begins in the posterior putamen. (DaT-SPECT is the more common clinical analogue.)' },
  FET: { name: '¹⁸F-FET (amino-acid transport)', idx: FET, desc: 'Amino-acid tracers have low normal-brain background, outlining glioma extent beyond contrast enhancement and helping distinguish recurrence from treatment effects.' },
};

export interface Img {
  n: number;
  data: Float32Array;
  unit: string;
  window: number;
  level: number;
  min: number;
  max: number;
}

const hash = (i: number, j: number, s: number) => {
  let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const gauss = (i: number, j: number, s: number) => {
  const u = Math.max(1e-7, hash(i, j, s)), v = hash(i, j, s + 7);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export function mriSignal(pr: Float32Array, o: number, seq: MriSeq, sp: SeqParams): number {
  const pd = pr[o + PD];
  let t1 = pr[o + T1];
  const t2 = Math.max(0.5, pr[o + T2]);
  const t2s = Math.max(0.3, pr[o + T2S]);
  if (seq === 'T1C') {
    const c = pr[o + GD] * 0.6; // mM
    t1 = 1 / (1 / t1 + 0.004 * c);
  }
  if (seq === 'ADC') return pr[o + ADC];
  const { tr, te, ti, b } = sp;
  let s: number;
  if (seq === 'SWI') {
    s = pd * (1 - Math.exp(-tr / t1) * 0) * Math.exp(-te / t2s);
    const chi = pr[o + CHI];
    const mask = chi > 0 ? Math.pow(Math.max(0, 1 - chi * 1.4), 4) : Math.pow(Math.max(0, 1 + chi * 0.8), 2);
    return s * mask;
  }
  if (ti > 0) {
    s = pd * Math.abs(1 - 2 * Math.exp(-ti / t1) + Math.exp(-tr / t1)) * Math.exp(-te / t2);
  } else {
    s = pd * (1 - Math.exp(-tr / t1)) * Math.exp(-te / t2);
  }
  if (b > 0) s *= Math.exp(-b * pr[o + ADC] * 1e-3);
  return s;
}

/** FLAIR TI that nulls CSF for the given TR (TI = T1·ln(2/(1+e^(−TR/T1)))). */
export const nullTI = (tr: number, t1 = 4300) => t1 * Math.log(2 / (1 + Math.exp(-tr / t1)));

export function renderMRI(sl: SliceData, seq: MriSeq, custom?: SeqParams, noise = 1): Img {
  const n = sl.n;
  const data = new Float32Array(n * n);
  const sp = seq === 'CUSTOM' ? custom! : { ...MRI_SEQS[seq].params };
  if (seq === 'FLAIR') sp.ti = nullTI(sp.tr);
  let max = 0;
  for (let i = 0; i < n * n; i++) {
    const v = mriSignal(sl.props, i * K, seq, sp);
    data[i] = v;
    if (v > max) max = v;
  }
  if (seq === 'ADC') {
    const sigma = 0.04 * noise;
    for (let i = 0; i < n * n; i++) data[i] = Math.max(0, data[i] + sigma * gauss(i % n, (i / n) | 0, 3) * (sl.props[i * K + PD] > 0.05 ? 1 : 0.2));
    return { n, data, unit: '×10⁻³ mm²/s', window: 3.2, level: 1.6, min: 0, max: 3.5 };
  }
  // robust normalisation to brain signal (use 99.5th percentile)
  // normalise to brain parenchyma (labels 4–13: cortex, WM, cerebellum, deep nuclei) so fat may saturate
  const brainVals: number[] = [];
  for (let i = 0; i < n * n; i++) if (sl.labels[i] >= 4 && sl.labels[i] <= 13) brainVals.push(data[i]);
  brainVals.sort((a, b) => a - b);
  const ref = (brainVals.length > 50 ? brainVals[Math.floor(brainVals.length * 0.985)] * 1.25 : max) || 1;
  const sigma = 0.012 * noise;
  for (let i = 0; i < n * n; i++) {
    const x = data[i] / ref;
    const a = x + sigma * gauss(i % n, (i / n) | 0, 1);
    const b = sigma * gauss(i % n, (i / n) | 0, 2);
    data[i] = Math.sqrt(a * a + b * b); // Rician magnitude noise
  }
  return { n, data, unit: 'a.u.', window: 1.05, level: 0.5, min: 0, max: 1.3 };
}

export const CT_WINDOWS = {
  brain: { label: 'Brain', w: 80, l: 40 },
  stroke: { label: 'Stroke', w: 40, l: 40 },
  subdural: { label: 'Subdural', w: 200, l: 80 },
  bone: { label: 'Bone', w: 2800, l: 600 },
  soft: { label: 'Soft tissue', w: 400, l: 40 },
};

export function renderCT(sl: SliceData, noise = 1): Img {
  const n = sl.n;
  const data = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) data[i] = sl.props[i * K + HU] + 3.5 * noise * gauss(i % n, (i / n) | 0, 11);
  return { n, data, unit: 'HU', window: 80, level: 40, min: -1000, max: 2000 };
}

function blur(src: Float32Array, n: number, sigmaPx: number): Float32Array {
  const r = Math.ceil(sigmaPx * 2.5);
  const kern = new Float32Array(2 * r + 1);
  let s = 0;
  for (let k = -r; k <= r; k++) s += kern[k + r] = Math.exp(-(k * k) / (2 * sigmaPx * sigmaPx));
  for (let k = 0; k < kern.length; k++) kern[k] /= s;
  const tmp = new Float32Array(n * n), out = new Float32Array(n * n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let a = 0;
      for (let k = -r; k <= r; k++) a += src[j * n + Math.min(n - 1, Math.max(0, i + k))] * kern[k + r];
      tmp[j * n + i] = a;
    }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      let a = 0;
      for (let k = -r; k <= r; k++) a += tmp[Math.min(n - 1, Math.max(0, j + k)) * n + i] * kern[k + r];
      out[j * n + i] = a;
    }
  return out;
}

/** PET: true tracer map ⊗ PSF (FWHM mm) + count noise. Units: illustrative SUV-like. */
export function renderPET(sl: SliceData, tracer: PetTracer, fwhm = 5, noise = 1): Img {
  const n = sl.n;
  const idx = PET_TRACERS[tracer].idx;
  const raw = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) raw[i] = sl.props[i * K + idx];
  const px = FOV / n;
  const sig = fwhm / 2.355 / px;
  const b = blur(raw, n, sig);
  for (let i = 0; i < n * n; i++) b[i] = Math.max(0, b[i] + 0.06 * noise * Math.sqrt(Math.max(b[i], 0.01)) * gauss(i % n, (i / n) | 0, 21));
  const max = tracer === 'FDG' ? 4 : tracer === 'DOPA' ? 3.4 : tracer === 'FET' ? 3 : 2.6;
  return { n, data: b, unit: 'SUV-like (illustrative)', window: max, level: max / 2, min: 0, max };
}

export function renderStiffness(sl: SliceData): Img {
  const n = sl.n;
  const raw = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) raw[i] = sl.props[i * K + FLUIDMASK] > 0.5 ? 0 : sl.props[i * K + STIFF];
  // inversion algorithms have limited resolution: emulate with a mild blur
  const b = blur(raw, n, 1.6);
  return { n, data: b, unit: 'kPa |G*| (illustrative)', window: 4, level: 2, min: 0, max: 4.5 };
}

/**
 * Harmonic shear-wave simulation. Waves enter from the skull and travel inward; the local
 * wavelength λ = c/f with c = √(G/ρ). Phase is accumulated along rays toward the slice centre,
 * so softer tissue produces visibly shorter wavelengths. Returns phase & amplitude fields;
 * displacement at time t is A·cos(φ − ωt).
 */
export function waveField(sl: SliceData, freqHz = 60): { phase: Float32Array; amp: Float32Array } {
  const n = sl.n;
  const px = FOV / n; // mm
  const phase = new Float32Array(n * n);
  const amp = new Float32Array(n * n);
  const stiff = new Float32Array(n * n);
  const damp = new Float32Array(n * n);
  const brain = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const pr = sl.props;
    const g = pr[i * K + STIFF];
    const isBrain = g > 0.3 || pr[i * K + FLUIDMASK] > 0.5;
    brain[i] = isBrain ? 1 : 0;
    stiff[i] = Math.max(0.35, g); // CSF treated as very soft coupling medium
    damp[i] = pr[i * K + DAMP] || 0.3;
  }
  // centroid of brain region
  let cx = 0, cy = 0, cnt = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (brain[j * n + i]) { cx += i; cy += j; cnt++; }
  cx /= cnt || 1; cy /= cnt || 1;
  const rho = 1000;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const o = j * n + i;
      if (!brain[o]) continue;
      // march outward from pixel to brain boundary, accumulating k·ds
      let x = i, y = j;
      const dx = i - cx, dy = j - cy;
      const L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      let ph = 0, att = 0;
      for (let s = 0; s < n; s++) {
        const xi = Math.round(x), yi = Math.round(y);
        if (xi < 0 || yi < 0 || xi >= n || yi >= n) break;
        const q = yi * n + xi;
        if (!brain[q]) break;
        const c = Math.sqrt((stiff[q] * 1000) / rho); // m/s
        const k = (2 * Math.PI * freqHz) / (c * 1000); // rad/mm
        ph += k * px;
        att += damp[q] * k * px * 0.35;
        x += ux;
        y += uy;
      }
      phase[o] = ph;
      amp[o] = Math.exp(-att) * (0.55 + 0.45 * Math.cos(Math.atan2(dy, dx) * 2 + 0.6));
    }
  return { phase, amp };
}

export const wavelengthMm = (gKpa: number, f = 60) => (Math.sqrt((gKpa * 1000) / 1000) / f) * 1000;
