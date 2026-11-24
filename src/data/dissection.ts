// Exploded-view lesson: the brain is taken apart layer by layer, one idea per stage.
// Offsets are in anatomical millimetres: x = right, y = superior, z = anterior.

type V = [number, number, number];

export const LOBES = {
  frontal: ['cortex-frontal', 'cortex-precentral', 'cortex-broca'],
  parietal: ['cortex-parietal', 'cortex-postcentral'],
  temporal: ['cortex-temporal', 'cortex-auditory', 'cortex-wernicke'],
  occipital: ['cortex-occipital', 'cortex-visual'],
};
export const CORTEX = [...LOBES.frontal, ...LOBES.parietal, ...LOBES.temporal, ...LOBES.occipital, 'cortex-insula', 'cortex-cingulate', 'cortex-hilum'];
export const BASAL_GANGLIA = ['caudate', 'putamen', 'globus-pallidus', 'nucleus-accumbens'];
export const DIENCEPHALON = ['thalamus', 'hypothalamus'];
export const LIMBIC = ['hippocampus', 'amygdala', 'entorhinal', 'fornix'];
export const VENTRICLES = ['lateral-ventricles', 'third-ventricle', 'fourth-ventricle'];
export const BRAINSTEM = ['midbrain', 'pons', 'medulla', 'substantia-nigra'];
export const DEEP_WM = ['corpus-callosum', 'internal-capsule'];
export const GLANDS = ['pineal-gland', 'pituitary-gland'];

/** Displacement per piece (before the spread multiplier). Side = -1 left, +1 right, 0 midline piece. */
type Layout = (id: string, side: -1 | 0 | 1) => V;

const lobeOffset = (id: string, side: number): V => {
  if (LOBES.frontal.includes(id)) return [side * 6, 4, 30];
  if (LOBES.parietal.includes(id)) return [side * 6, 24, -12];
  if (LOBES.temporal.includes(id)) return [side * 26, -18, 6];
  if (LOBES.occipital.includes(id)) return [side * 4, 2, -32];
  if (id === 'cortex-insula') return [side * 10, 0, 0];
  return [0, 0, 0];
};
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const hemi = (side: number, d: number): V => [side * d, 0, 0];

const deepSpread = (id: string, side: number): V => {
  if (id === 'caudate') return [side * 14, 18, 10];
  if (id === 'putamen') return [side * 30, 0, 6];
  if (id === 'globus-pallidus') return [side * 20, -10, 2];
  if (id === 'nucleus-accumbens') return [side * 10, -16, 22];
  if (id === 'thalamus') return [side * 8, 4, -10];
  if (id === 'hypothalamus') return [0, -14, 8];
  return [0, 0, 0];
};
const limbicSpread = (id: string, side: number): V => {
  if (id === 'hippocampus') return [side * 22, -8, -6];
  if (id === 'amygdala') return [side * 22, -8, 16];
  if (id === 'entorhinal') return [side * 34, -16, 6];
  if (id === 'fornix') return [0, 14, 0];
  if (id === 'cortex-cingulate') return [side * 10, 22, 0];
  return [0, 0, 0];
};
const ventSpread = (id: string): V => {
  if (id === 'lateral-ventricles') return [0, 26, 0];
  if (id === 'third-ventricle') return [0, 10, 6];
  if (id === 'fourth-ventricle') return [0, -14, -26];
  return [0, 0, 0];
};
const hindSpread = (id: string): V => {
  if (BRAINSTEM.includes(id)) return [0, -34, 14];
  if (id === 'cerebellum') return [0, -30, -44];
  return [0, 0, 0];
};

export interface DissectStage {
  id: string;
  title: string;
  /** one or two short paragraphs */
  text: string;
  /** structure ids (data/structures) offered as clickable chips */
  chips: string[];
  /** meshes drawn in their teaching colour; the rest dims */
  spotlight: string[];
  /** fade these meshes strongly (e.g. cortex when looking inside) */
  fade?: string[];
  layout: Layout;
}

const none: Layout = () => [0, 0, 0];

export const STAGES: DissectStage[] = [
  {
    id: 'whole',
    title: 'The whole brain',
    text: 'About 1.3–1.4 kg in an adult, it fills the skull above the tentorium (cerebrum) and below it (cerebellum and brainstem). Everything you see on the outside is cerebral cortex: a 2–4 mm sheet of grey matter folded into gyri and sulci so it fits about 1,800 cm² into the skull.',
    chips: ['frontal-lobe', 'cerebellum', 'brainstem'],
    spotlight: [],
    layout: none,
  },
  {
    id: 'hemispheres',
    title: 'Two hemispheres',
    text: 'A deep cleft, the longitudinal fissure, splits the cerebrum into left and right hemispheres. They are mirror images in layout but not in function: language is usually lateralised to the left. Their main bridge is the corpus callosum, left in the middle here, with about 200 million axons.',
    chips: ['corpus-callosum'],
    spotlight: ['corpus-callosum'],
    layout: (id, side) => (CORTEX.includes(id) ? hemi(side, 34) : [0, 0, 0]),
  },
  {
    id: 'lobes',
    title: 'Four lobes (and a hidden fifth)',
    text: 'Each hemisphere is divided by landmarks: the central sulcus separates frontal from parietal lobe, the lateral (Sylvian) fissure separates the temporal lobe below, and the parieto-occipital sulcus marks the occipital lobe at the back. Pulling the temporal and frontal lobes apart reveals the insula, folded deep inside the lateral fissure.',
    chips: ['frontal-lobe', 'parietal-lobe', 'temporal-lobe', 'occipital-lobe', 'insular-cortex'],
    spotlight: [...CORTEX.filter((c) => c !== 'cortex-hilum')],
    layout: (id, side) => (CORTEX.includes(id) ? add(hemi(side, 30), lobeOffset(id, side)) : [0, 0, 0]),
  },
  {
    id: 'deep',
    title: 'Deep grey nuclei',
    text: 'Under the cortex and white matter sit islands of grey matter. The basal ganglia (caudate, putamen, globus pallidus, accumbens) select and scale movements and habits through loops with the cortex. The thalamus, in the middle, is the relay that almost all sensory information passes through on its way to cortex.',
    chips: ['caudate-nucleus', 'putamen', 'globus-pallidus', 'nucleus-accumbens', 'thalamus', 'hypothalamus'],
    spotlight: [...BASAL_GANGLIA, ...DIENCEPHALON],
    fade: CORTEX,
    layout: (id, side) => (CORTEX.includes(id) ? hemi(side, 60) : deepSpread(id, side)),
  },
  {
    id: 'limbic',
    title: 'The limbic system',
    text: 'Curving around the inner edge of each hemisphere is the limbic system, which handles memory and emotion. The hippocampus forms new episodic memories; the amygdala, just in front of it, tags events with emotional weight; the entorhinal cortex is the gateway between them and the neocortex. The fornix carries hippocampal output forward, arching over the thalamus.',
    chips: ['hippocampus', 'amygdala', 'entorhinal-cortex', 'fornix', 'cingulate-cortex'],
    spotlight: [...LIMBIC, 'cortex-cingulate'],
    fade: CORTEX.filter((c) => c !== 'cortex-cingulate'),
    layout: (id, side) => (CORTEX.includes(id) && id !== 'cortex-cingulate' ? hemi(side, 60) : limbicSpread(id, side)),
  },
  {
    id: 'ventricles',
    title: 'The ventricles',
    text: 'Inside the brain is a connected set of fluid-filled cavities. Choroid plexus in the lateral ventricles makes about 500 mL of cerebrospinal fluid a day. It flows through the third ventricle, down the cerebral aqueduct to the fourth ventricle, and out around the brain and spinal cord. A blockage anywhere along that path causes hydrocephalus.',
    chips: ['lateral-ventricles', 'third-ventricle', 'fourth-ventricle'],
    spotlight: VENTRICLES,
    fade: [...CORTEX, ...BASAL_GANGLIA],
    layout: (id, side) => (CORTEX.includes(id) ? hemi(side, 60) : ventSpread(id)),
  },
  {
    id: 'hindbrain',
    title: 'Brainstem and cerebellum',
    text: 'The brainstem (midbrain, pons, medulla) connects the brain to the spinal cord. It carries every long tract, holds most cranial-nerve nuclei, and keeps breathing and heart rate going. Behind it, the cerebellum compares intended with actual movement and corrects it, so damage causes unsteady, poorly aimed movement rather than weakness.',
    chips: ['midbrain', 'pons', 'medulla', 'cerebellum', 'substantia-nigra'],
    spotlight: [...BRAINSTEM, 'cerebellum'],
    fade: CORTEX,
    layout: (id, side) => (CORTEX.includes(id) ? hemi(side, 40) : hindSpread(id)),
  },
  {
    id: 'all',
    title: 'Everything apart',
    text: 'Here every system is pulled away from the others at once, colour-coded by structure. Rotate around it and click any piece to read about it. Use the Spread slider to push the pieces back together and watch where each one sits.',
    chips: [],
    spotlight: [],
    layout: (id, side) => {
      if (CORTEX.includes(id)) return add(hemi(side, 38), lobeOffset(id, side));
      if (BASAL_GANGLIA.includes(id) || DIENCEPHALON.includes(id)) return add(deepSpread(id, side), [0, 6, 0]);
      if (LIMBIC.includes(id)) return add(limbicSpread(id, side), [0, -6, 0]);
      if (VENTRICLES.includes(id)) return add(ventSpread(id), [0, 14, 0]);
      if (BRAINSTEM.includes(id) || id === 'cerebellum') return hindSpread(id);
      if (id === 'corpus-callosum') return [0, 30, 0];
      if (id === 'pineal-gland') return [0, 8, -20];
      if (id === 'pituitary-gland') return [0, -22, 20];
      if (id === 'internal-capsule') return [side * 8, 0, 0];
      return [0, 0, 0];
    },
  },
];
