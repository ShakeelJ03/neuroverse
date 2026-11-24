/**
 * Label tables for the real-atlas anatomy source.
 *
 * Source data (downloaded from TemplateFlow, converted by scripts/build-atlas.ts):
 *  - FSL MNI152 6th-generation non-linear asymmetric T1 template, 1 mm (Grabner et al. 2006; Janke et al.)
 *  - Harvard–Oxford subcortical (HOSPA, 25% threshold) and lateralised cortical (HOCPAL) atlases
 *    (Desikan et al. 2006; Makris et al. 2006; Frazier et al. 2005; Goldstein et al. 2007)
 *  - Buckner et al. 2011 cerebellar 7-network parcellation, used here only as a cerebellum mask
 * Licence: FSL licence (free for non-commercial / educational use). See public/atlas/NOTICE.txt.
 */
import type { CortexParcel, FunctionalRegion } from '../anatomy/model';

/** Volume geometry: MNI152NLin6Asym 1 mm grid. voxel (i,j,k) ↔ MNI (i-91, j-126, k-72). */
export const DIM = [182, 218, 182] as const;
export const ORIGIN = [-91, -126, -72] as const;
export const NVOX = DIM[0] * DIM[1] * DIM[2];

/** Combined segmentation codes written by the build script. */
export const SEG = {
  air: 0,
  cortex: 1,
  wm: 2,
  latVent: 3,
  thalamus: 4,
  caudate: 5,
  putamen: 6,
  pallidum: 7,
  brainstem: 8,
  hippocampus: 9,
  amygdala: 10,
  accumbens: 11,
  cerebellum: 12,
  brainOther: 13, // inside the brain mask but unlabelled (mostly sulcal CSF / partial volume)
  cc: 14, // derived: midline white matter
  vent3: 15, // derived: dark midline CSF in the diencephalon
  vent4: 16, // derived: dark CSF between pons and cerebellum
  extraCsf: 20, // derived: dark voxels just outside the brain mask
  bone: 21,
  soft: 22,
  fat: 23,
} as const;

/** Harvard–Oxford cortical label names (48 per hemisphere). In HOCPAL the voxel value v
 *  maps to index (v-1): even = left, odd = right, region = floor((v-1)/2). */
export const HO_CORTICAL = [
  'Frontal pole', 'Insular cortex', 'Superior frontal gyrus', 'Middle frontal gyrus',
  'Inferior frontal gyrus, pars triangularis', 'Inferior frontal gyrus, pars opercularis', 'Precentral gyrus',
  'Temporal pole', 'Superior temporal gyrus, anterior', 'Superior temporal gyrus, posterior',
  'Middle temporal gyrus, anterior', 'Middle temporal gyrus, posterior', 'Middle temporal gyrus, temporo-occipital',
  'Inferior temporal gyrus, anterior', 'Inferior temporal gyrus, posterior', 'Inferior temporal gyrus, temporo-occipital',
  'Postcentral gyrus', 'Superior parietal lobule', 'Supramarginal gyrus, anterior', 'Supramarginal gyrus, posterior',
  'Angular gyrus', 'Lateral occipital cortex, superior', 'Lateral occipital cortex, inferior', 'Intracalcarine cortex',
  'Frontal medial cortex', 'Juxtapositional lobule (SMA)', 'Subcallosal cortex', 'Paracingulate gyrus',
  'Cingulate gyrus, anterior', 'Cingulate gyrus, posterior', 'Precuneus', 'Cuneus', 'Frontal orbital cortex',
  'Parahippocampal gyrus, anterior', 'Parahippocampal gyrus, posterior', 'Lingual gyrus',
  'Temporal fusiform cortex, anterior', 'Temporal fusiform cortex, posterior', 'Temporal occipital fusiform cortex',
  'Occipital fusiform gyrus', 'Frontal operculum', 'Central opercular cortex', 'Parietal operculum',
  'Planum polare', "Heschl's gyrus", 'Planum temporale', 'Supracalcarine cortex', 'Occipital pole',
];

/** NEUROVERSE surface parcel for each HO cortical region (index into HO_CORTICAL). */
const PARCEL_OF: CortexParcel[] = [
  'frontal', 'insula', 'frontal', 'frontal', 'broca', 'broca', 'precentral',
  'temporal', 'temporal', 'wernicke', 'temporal', 'temporal', 'temporal', 'temporal', 'temporal', 'temporal',
  'postcentral', 'parietal', 'parietal', 'parietal', 'parietal', 'occipital', 'occipital', 'visual',
  'frontal', 'frontal', 'cingulate', 'cingulate', 'cingulate', 'cingulate', 'parietal', 'occipital', 'frontal',
  'temporal', 'temporal', 'occipital', 'temporal', 'temporal', 'temporal', 'occipital',
  'frontal', 'postcentral', 'parietal', 'temporal', 'auditory', 'wernicke', 'visual', 'visual',
];

const FUNC_OF: FunctionalRegion[] = [
  'frontal', 'insula', 'frontal', 'frontal', 'frontal', 'frontal', 'sensorimotor',
  'anteriorTemporal', 'lateralTemporal', 'lateralTemporal', 'anteriorTemporal', 'lateralTemporal', 'lateralTemporal',
  'anteriorTemporal', 'lateralTemporal', 'lateralTemporal', 'sensorimotor', 'parietal', 'parietal', 'parietal',
  'parietal', 'occipital', 'occipital', 'visual', 'frontal', 'sensorimotor', 'acc', 'acc', 'acc', 'pcc', 'precuneus',
  'occipital', 'frontal', 'mtl', 'mtl', 'occipital', 'anteriorTemporal', 'lateralTemporal', 'lateralTemporal',
  'occipital', 'frontal', 'sensorimotor', 'parietal', 'lateralTemporal', 'lateralTemporal', 'lateralTemporal', 'visual',
  'visual',
];

/** HOCPAL voxel value → region index (0..47) or -1. */
export const hoRegion = (v: number) => (v > 0 ? (v - 1) >> 1 : -1);
export const hoIsLeft = (v: number) => v > 0 && (v - 1) % 2 === 0;
export function hoParcel(v: number, isLeft: boolean): CortexParcel | null {
  const r = hoRegion(v);
  if (r < 0) return null;
  const p = PARCEL_OF[r];
  // Broca's and Wernicke's areas are defined in the language-dominant (left) hemisphere
  if (!isLeft && p === 'broca') return 'frontal';
  if (!isLeft && p === 'wernicke') return r === 45 ? 'auditory' : 'temporal';
  return p;
}
export const hoFunctional = (v: number): FunctionalRegion | null => {
  const r = hoRegion(v);
  return r < 0 ? null : FUNC_OF[r];
};
export const hoName = (v: number) => {
  const r = hoRegion(v);
  return r < 0 ? null : `${hoIsLeft(v) ? 'Left' : 'Right'} ${HO_CORTICAL[r].toLowerCase()}`;
};

/** Where each 3D mesh comes from when the atlas source is active. */
export type MeshSource = 'atlas' | 'derived' | 'model';
export const ATLAS_MESH_SOURCE: Record<string, MeshSource> = {
  thalamus: 'atlas', caudate: 'atlas', putamen: 'atlas', 'globus-pallidus': 'atlas', hippocampus: 'atlas',
  amygdala: 'atlas', 'nucleus-accumbens': 'atlas', 'lateral-ventricles': 'atlas', cerebellum: 'atlas',
  'cerebral-white-matter': 'atlas',
  midbrain: 'derived', pons: 'derived', medulla: 'derived', 'corpus-callosum': 'derived', 'third-ventricle': 'derived',
  'fourth-ventricle': 'derived', entorhinal: 'derived',
  hypothalamus: 'model', 'internal-capsule': 'model', fornix: 'model', 'substantia-nigra': 'model',
  'pineal-gland': 'model', 'pituitary-gland': 'model',
};
export const meshSource = (id: string): MeshSource => (id.startsWith('cortex-') ? 'atlas' : ATLAS_MESH_SOURCE[id] ?? 'model');

export const MESH_SOURCE_TEXT: Record<MeshSource, string> = {
  atlas: 'Harvard–Oxford / MNI152 atlas label (population average)',
  derived: 'Derived from atlas labels and template intensity by a NEUROVERSE rule (approximate)',
  model: 'Not in the atlas — parametric model shape positioned in MNI space',
};

/** Parametric meshes still generated at runtime in atlas mode. */
export const MODEL_ONLY_MESHES = Object.entries(ATLAS_MESH_SOURCE).filter(([, s]) => s === 'model').map(([id]) => id);
