import type { Pathology } from '../anatomy/model';
import type { V3 } from '../anatomy/sdf';
import { K, sampleTissue } from './tissue';
import { sampleTissueAtlas } from './tissueAtlas';
import type { AtlasVolumes } from '../atlas/load';

export type Axis = 'axial' | 'coronal' | 'sagittal';
export const FOV = 220; // mm
export const SLICE_N = 224;
export const CENTER: V3 = [0, 5, -14];

/** Scene coordinate for pixel (i, j) of a slice. Radiological convention: patient right on image left. */
export function pixelToScene(axis: Axis, pos: number, i: number, j: number, n = SLICE_N): V3 {
  const px = FOV / n;
  const u = FOV / 2 - (i + 0.5) * px;
  const v = FOV / 2 - (j + 0.5) * px;
  if (axis === 'axial') return [u, pos, CENTER[2] + v];
  if (axis === 'coronal') return [u, CENTER[1] + v, pos];
  return [pos, CENTER[1] + v, CENTER[2] + u];
}

/** Inverse: scene point → fractional pixel coords on the given slice plane. */
export function sceneToPixel(axis: Axis, p: V3, n = SLICE_N): [number, number] {
  const px = FOV / n;
  if (axis === 'axial') return [(FOV / 2 - p[0]) / px, (FOV / 2 - (p[2] - CENTER[2])) / px];
  if (axis === 'coronal') return [(FOV / 2 - p[0]) / px, (FOV / 2 - (p[1] - CENTER[1])) / px];
  return [(FOV / 2 - (p[2] - CENTER[2])) / px, (FOV / 2 - (p[1] - CENTER[1])) / px];
}

export const slicePosOf = (axis: Axis, p: V3) => (axis === 'axial' ? p[1] : axis === 'coronal' ? p[2] : p[0]);
export const sliceRange = (axis: Axis): [number, number] =>
  axis === 'axial' ? [-75, 85] : axis === 'coronal' ? [-105, 80] : [-75, 75];

export interface SliceData {
  n: number;
  props: Float32Array; // n*n*K
  labels: Uint8Array;
}

export function computeSlice(axis: Axis, pos: number, path: Pathology, n = SLICE_N, atlas?: AtlasVolumes): SliceData {
  const props = new Float32Array(n * n * K);
  const labels = new Uint8Array(n * n);
  const out = new Float32Array(K);
  const hasWarp = path.lesions.some((l) => (l.massEffect ?? 0) > 0);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const p = pixelToScene(axis, pos, i, j, n);
      const lab = atlas ? sampleTissueAtlas(p, path, out, hasWarp, atlas) : sampleTissue(p, path, out, hasWarp);
      props.set(out, (j * n + i) * K);
      labels[j * n + i] = lab;
    }
  return { n, props, labels };
}
