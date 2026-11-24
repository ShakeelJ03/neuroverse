// Lesion geometry shared by the 3D model and the imaging simulator.
import { Lesion, Pathology, brainEnvelope, cortexSdf, lesionCoreSdf, warp, whiteMatterSdf } from './model';
import type { V3 } from './sdf';

export type LesionCompartment = 'intra' | 'extra' | 'csf';

export const lesionCompartment = (l: Lesion): LesionCompartment =>
  l.kind === 'sdh' || l.kind === 'edh' || l.kind === 'meningioma'
    ? 'extra'
    : l.kind === 'sah' || l.kind === 'meningitis'
      ? 'csf'
      : 'intra';

/** Thickness profile of an extra-axial collection at point p (mm). */
function extraThickness(l: Lesion, x: number, y: number, z: number): number {
  const dx = x - l.center[0], dy = y - l.center[1], dz = z - l.center[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const T = l.radii[0];
  const S = l.radii[1];
  if (l.kind === 'edh') return T * Math.sqrt(Math.max(0, 1 - (dist / S) ** 2)); // biconvex lens
  if (l.kind === 'meningioma') return T * Math.sqrt(Math.max(0, 1 - (dist / S) ** 2)) * 1.0;
  return T * Math.exp(-(dist * dist) / (2 * S * S)); // crescent
}

/** SDF of the lesion "core" (the space-occupying or signal-altering compartment). */
export function lesionSdf(l: Lesion, p: V3, path: Pathology): number {
  const [x, y, z] = p;
  const comp = lesionCompartment(l);
  if (comp === 'extra') {
    const w = warp(p, path);
    const env = brainEnvelope(w[0], w[1], w[2], path);
    const t = extraThickness(l, x, y, z);
    if (t < 0.3) return 5;
    // restrict to the side of the collection
    const side = l.side ?? Math.sign(l.center[0] || 1);
    const sideCut = side * x < -1 ? 5 : 0;
    return Math.max(-env, env - t, sideCut ? 1 : -1);
  }
  if (comp === 'csf') {
    const w = warp(p, path);
    const core = lesionCoreSdf(l, x, y, z);
    const ctx = cortexSdf(w[0], w[1], w[2], path);
    const env = brainEnvelope(w[0], w[1], w[2], path);
    return Math.max(core, -ctx, env - 2.8);
  }
  return lesionCoreSdf(l, x, y, z);
}

/** Vasogenic oedema compartment (white-matter-following), excluding the core. */
export function edemaSdf(l: Lesion, p: V3, path: Pathology): number {
  const e = l.edema ?? 0;
  if (e <= 0) return 10;
  const core = lesionCoreSdf(l, p[0], p[1], p[2]);
  const w = warp(p, path);
  const wm = whiteMatterSdf(w[0], w[1], w[2], path);
  return Math.max(core - e, wm + 0.5, -core);
}

export function lesionBounds(l: Lesion): { bmin: V3; bmax: V3 } {
  const comp = lesionCompartment(l);
  const pad = (comp === 'extra' ? l.radii[1] * 1.3 : Math.max(...l.radii)) + (l.edema ?? 0) + 4;
  return {
    bmin: [l.center[0] - pad, l.center[1] - pad, l.center[2] - pad],
    bmax: [l.center[0] + pad, l.center[1] + pad, l.center[2] + pad],
  };
}
