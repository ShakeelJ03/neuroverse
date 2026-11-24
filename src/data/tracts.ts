// Schematic white-matter bundles (scene mm: x Right, y Superior, z Anterior), traced through
// approximate MNI trajectories described in DTI tractography atlases (Catani & Thiebaut de Schotten 2008).
// These are hand-placed educational streamlines, not tractography output.
import type { V3 } from '@/lib/anatomy/sdf';

export type TractClass = 'association' | 'commissural' | 'projection' | 'limbic';
export interface Tract {
  id: string;
  name: string;
  cls: TractClass;
  /** one or more centreline curves (right hemisphere; mirrored if bilateral) */
  paths: V3[][];
  bilateral: boolean;
  spread: number; // jitter radius mm
  count: number; // streamlines per path
  connects: string[]; // structure ids
  function: string;
  clinical: string;
  structureId?: string;
}

const fan = (from: V3[], to: V3): V3[][] => from.map((f) => [f, [(f[0] + to[0]) / 2 + 2, (f[1] + to[1]) / 2, (f[2] + to[2]) / 2], to]);

export const TRACTS: Tract[] = [
  {
    id: 'cst', name: 'Corticospinal tract', cls: 'projection', bilateral: true, spread: 2.5, count: 10, structureId: 'corticospinal-tract',
    paths: [
      [[22, 64, -22], [22, 34, -14], [19, 8, -12], [11, -10, -20], [7, -30, -22], [4, -50, -32], [2, -70, -40]],
      [[42, 52, -14], [28, 32, -13], [19, 8, -12], [11, -10, -20], [7, -30, -22], [4, -50, -32], [2, -70, -40]],
      [[56, 30, -6], [32, 24, -10], [19, 8, -12], [11, -10, -20], [7, -30, -22], [4, -50, -32], [2, -70, -40]],
    ],
    connects: ['precentral-gyrus', 'internal-capsule', 'midbrain', 'pons', 'medulla'],
    function: 'Voluntary motor output from primary motor and premotor cortex to brainstem and spinal motor neurons.',
    clinical: 'Lesions anywhere along the tract cause contralateral upper-motor-neuron weakness; tractography helps plan tumour resection near the tract.',
  },
  {
    id: 'af', name: 'Arcuate fasciculus', cls: 'association', bilateral: true, spread: 2.5, count: 12, structureId: 'arcuate-fasciculus',
    paths: [[[50, 18, 24], [44, 30, 2], [40, 32, -26], [46, 20, -44], [54, 2, -44], [56, -12, -28]]],
    connects: ['brocas-area', 'wernickes-area', 'precentral-gyrus'],
    function: 'Dorsal language stream linking posterior temporal cortex to inferior frontal / precentral cortex — sound-to-articulation mapping and repetition.',
    clinical: 'Damage is classically associated with conduction aphasia; usually larger in the left hemisphere.',
  },
  {
    id: 'slf', name: 'Superior longitudinal fasciculus (SLF II)', cls: 'association', bilateral: true, spread: 3, count: 10,
    paths: [[[34, 44, 36], [34, 46, 6], [32, 46, -24], [30, 40, -52]]],
    connects: ['frontal-lobe', 'parietal-lobe'],
    function: 'Fronto-parietal attention and working-memory networks; right-hemisphere SLF supports spatial attention.',
    clinical: 'Right SLF damage is associated with hemispatial neglect.',
  },
  {
    id: 'cingulum', name: 'Cingulum bundle', cls: 'limbic', bilateral: true, spread: 1.8, count: 10, structureId: 'cingulum',
    paths: [[[7, 12, 42], [8, 28, 20], [9, 32, -4], [9, 28, -26], [10, 16, -44], [18, 0, -42], [23, -12, -24], [25, -18, -10]]],
    connects: ['cingulate-cortex', 'hippocampus', 'entorhinal-cortex', 'frontal-lobe'],
    function: 'Links cingulate, medial prefrontal, retrosplenial and parahippocampal cortices — limbic and default-mode connectivity.',
    clinical: 'Reduced FA in the parahippocampal cingulum is reported early in Alzheimer’s disease and MCI (research).',
  },
  {
    id: 'uf', name: 'Uncinate fasciculus', cls: 'association', bilateral: true, spread: 2, count: 10,
    paths: [[[16, -10, 50], [24, -8, 28], [31, -6, 14], [35, -14, 6], [40, -24, 18]]],
    connects: ['frontal-lobe', 'temporal-lobe', 'amygdala'],
    function: 'Hook-shaped bundle from orbitofrontal cortex to the anterior temporal lobe and amygdala; semantic and socio-emotional processing.',
    clinical: 'Implicated in semantic-variant PPA and behavioural FTD; at risk in anterior temporal surgery.',
  },
  {
    id: 'ifof', name: 'Inferior fronto-occipital fasciculus', cls: 'association', bilateral: true, spread: 2.5, count: 10,
    paths: [[[24, 4, -82], [30, -2, -50], [32, -2, -10], [30, 4, 12], [26, 10, 48]]],
    connects: ['occipital-lobe', 'frontal-lobe', 'temporal-lobe'],
    function: 'Long ventral association pathway through the extreme/external capsule; semantic language and visual processing.',
    clinical: 'Intra-operative stimulation of the IFOF can elicit semantic paraphasias.',
  },
  {
    id: 'ilf', name: 'Inferior longitudinal fasciculus', cls: 'association', bilateral: true, spread: 2.5, count: 10,
    paths: [[[28, -4, -82], [36, -10, -56], [40, -16, -26], [42, -22, 12]]],
    connects: ['occipital-lobe', 'temporal-lobe'],
    function: 'Ventral visual stream from occipital to anterior temporal cortex — object/face recognition and visual memory.',
    clinical: 'Disruption is associated with visual agnosia and prosopagnosia.',
  },
  {
    id: 'or', name: 'Optic radiation', cls: 'projection', bilateral: true, spread: 1.8, count: 12, structureId: 'optic-radiation',
    paths: [[[22, -4, -24], [32, -7, -12], [35, 0, -30], [30, 6, -52], [18, 6, -74], [10, 6, -84]]],
    connects: ['thalamus', 'visual-cortex'],
    function: 'Carries contralateral visual hemifield information from the lateral geniculate nucleus to V1; inferior fibres loop forward (Meyer’s loop).',
    clinical: 'Meyer’s loop injury causes a contralateral superior quadrantanopia.',
  },
  {
    id: 'fornix', name: 'Fornix', cls: 'limbic', bilateral: true, spread: 0.9, count: 8, structureId: 'fornix',
    paths: [[[22, 6, -36], [12, 17, -30], [3, 17.5, -14], [2.5, 13, 0], [3, 3, 4], [3, -8, 0]]],
    connects: ['hippocampus', 'hypothalamus'],
    function: 'Main hippocampal output to mammillary bodies and septal nuclei (Papez circuit).',
    clinical: 'Forniceal damage can cause amnesia.',
  },
  {
    id: 'cc', name: 'Corpus callosum', cls: 'commissural', bilateral: false, spread: 2, count: 4, structureId: 'corpus-callosum',
    paths: [
      // forceps minor (genu)
      [[-30, 10, 52], [-12, 8, 34], [0, 5, 28], [12, 8, 34], [30, 10, 52]],
      [[-38, 26, 34], [-14, 16, 26], [0, 15, 26], [14, 16, 26], [38, 26, 34]],
      // body
      ...[12, -6, -22].flatMap((z) => [
        [[-40, 54, z], [-16, 34, z], [0, 24.5 - Math.abs(z) * 0.05, z], [16, 34, z], [40, 54, z]] as V3[],
        [[-50, 36, z + 4], [-20, 28, z], [0, 23, z], [20, 28, z], [50, 36, z + 4]] as V3[],
      ]),
      // forceps major (splenium)
      [[-24, 8, -84], [-14, 12, -52], [0, 14, -36], [14, 12, -52], [24, 8, -84]],
      [[-36, 26, -66], [-16, 18, -44], [0, 15, -38], [16, 18, -44], [36, 26, -66]],
    ],
    connects: ['frontal-lobe', 'parietal-lobe', 'occipital-lobe', 'temporal-lobe'],
    function: 'Largest commissure, integrating homologous cortices of both hemispheres.',
    clinical: 'Callosal lesions: MS (callososeptal), DAI (splenium); callosotomy produces disconnection syndromes.',
  },
];

void fan;
export const TRACT_BY_ID = Object.fromEntries(TRACTS.map((t) => [t.id, t]));

// ── Network graph: structural connections & resting-state networks ──
export interface NetNode { id: string; name: string; x: number; y: number; structure?: string; fn: string }
export const NET_NODES: NetNode[] = [
  { id: 'pfc', name: 'Prefrontal', x: 90, y: 90, structure: 'frontal-lobe', fn: 'Executive control, planning' },
  { id: 'broca', name: 'Broca', x: 70, y: 170, structure: 'brocas-area', fn: 'Speech production' },
  { id: 'm1', name: 'Motor', x: 210, y: 50, structure: 'precentral-gyrus', fn: 'Voluntary movement' },
  { id: 's1', name: 'Somatosens.', x: 280, y: 60, structure: 'postcentral-gyrus', fn: 'Touch, proprioception' },
  { id: 'par', name: 'Parietal', x: 350, y: 100, structure: 'parietal-lobe', fn: 'Spatial attention' },
  { id: 'pcc', name: 'PCC / precuneus', x: 300, y: 150, structure: 'cingulate-cortex', fn: 'Default-mode hub' },
  { id: 'wer', name: 'Wernicke', x: 330, y: 210, structure: 'wernickes-area', fn: 'Speech comprehension' },
  { id: 'v1', name: 'Visual', x: 430, y: 170, structure: 'visual-cortex', fn: 'Vision' },
  { id: 'atl', name: 'Ant. temporal', x: 150, y: 250, structure: 'temporal-lobe', fn: 'Semantic memory' },
  { id: 'hip', name: 'Hippocampus', x: 250, y: 260, structure: 'hippocampus', fn: 'Episodic memory' },
  { id: 'amy', name: 'Amygdala', x: 190, y: 290, structure: 'amygdala', fn: 'Emotion' },
  { id: 'ins', name: 'Insula', x: 140, y: 200, structure: 'insular-cortex', fn: 'Interoception, salience' },
  { id: 'acc', name: 'ACC', x: 160, y: 130, structure: 'cingulate-cortex', fn: 'Conflict monitoring, salience' },
  { id: 'th', name: 'Thalamus', x: 250, y: 190, structure: 'thalamus', fn: 'Relay & gating' },
  { id: 'bg', name: 'Basal ganglia', x: 200, y: 200, structure: 'basal-ganglia', fn: 'Action selection' },
  { id: 'cb', name: 'Cerebellum', x: 400, y: 290, structure: 'cerebellum', fn: 'Coordination' },
  { id: 'bs', name: 'Brainstem', x: 300, y: 320, structure: 'brainstem', fn: 'Vital functions, relay' },
];
export const NET_EDGES: { a: string; b: string; tract?: string }[] = [
  { a: 'broca', b: 'wer', tract: 'af' }, { a: 'pfc', b: 'par', tract: 'slf' }, { a: 'm1', b: 'bs', tract: 'cst' }, { a: 'm1', b: 's1' },
  { a: 'acc', b: 'pcc', tract: 'cingulum' }, { a: 'pcc', b: 'hip', tract: 'cingulum' }, { a: 'pfc', b: 'atl', tract: 'uf' }, { a: 'amy', b: 'pfc', tract: 'uf' },
  { a: 'v1', b: 'atl', tract: 'ilf' }, { a: 'v1', b: 'pfc', tract: 'ifof' }, { a: 'th', b: 'v1', tract: 'or' }, { a: 'hip', b: 'th', tract: 'fornix' },
  { a: 'pfc', b: 'bg' }, { a: 'bg', b: 'th' }, { a: 'th', b: 'm1' }, { a: 'cb', b: 'th' }, { a: 'bs', b: 'cb' }, { a: 's1', b: 'th' }, { a: 'ins', b: 'acc' },
  { a: 'ins', b: 'amy' }, { a: 'hip', b: 'amy' }, { a: 'par', b: 'pcc' },
];
export const NETWORKS: { id: string; name: string; color: string; nodes: string[]; desc: string }[] = [
  { id: 'dmn', name: 'Default mode', color: '#9b7bff', nodes: ['pcc', 'pfc', 'hip', 'par'], desc: 'Active at rest and during self-referential thought and memory; posterior hubs are affected early in Alzheimer’s disease.' },
  { id: 'sal', name: 'Salience', color: '#f2b45a', nodes: ['ins', 'acc', 'amy'], desc: 'Anterior insula and dorsal ACC; detects behaviourally relevant events and switches between networks. Degenerates early in bvFTD.' },
  { id: 'fpn', name: 'Fronto-parietal control', color: '#4fd1e8', nodes: ['pfc', 'par'], desc: 'Goal-directed attention and working memory.' },
  { id: 'smn', name: 'Somatomotor', color: '#4cc99a', nodes: ['m1', 's1', 'th', 'bg', 'cb'], desc: 'Primary motor and somatosensory cortex — the network first identified with resting-state fMRI (Biswal 1995).' },
  { id: 'vis', name: 'Visual', color: '#5b8cff', nodes: ['v1'], desc: 'Occipital visual cortex.' },
  { id: 'lang', name: 'Language', color: '#f0717d', nodes: ['broca', 'wer', 'atl'], desc: 'Left-lateralised fronto-temporal language network.' },
];
