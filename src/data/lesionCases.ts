// "Where's the lesion?" case studies: from symptoms to one location, then to the scan.
// Coordinates are scene millimetres (x = right, y = superior, z = anterior), i.e. MNI (x, z, y).
// Cases are illustrative teaching vignettes, not real patients.
import type { Lesion, LesionKind, Pathology } from '@/lib/anatomy/model';
import { emptyPathology } from '@/lib/anatomy/model';
import type { MriSeq } from '@/lib/imaging/modalities';

type V = [number, number, number];

export interface ReasoningStep {
  /** the clinical clue */
  clue: string;
  /** what it tells you about location */
  means: string;
  /** structures (data/structures ids) to light up while reading this step */
  structures: string[];
}

export interface LesionCase {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  /** one-line vignette */
  presentation: string;
  /** examination findings, as a list */
  findings: string[];
  /** where one lesion explains everything */
  answer: string;
  /** main structures involved (highlighted on reveal) */
  structures: string[];
  steps: ReasoningStep[];
  /** the take-home rule */
  pearl: string;
  lesion: { kind: LesionKind; center: V; radii: V; stage?: number; edema?: number };
  /** what the scan panel shows */
  scan: { seq: MriSeq; axis: 'axial' | 'coronal' | 'sagittal'; why: string };
  /** disease page for more detail */
  disease?: string;
  /** 3D view that shows the lesion best */
  view: 'left' | 'right' | 'superior' | 'posterior' | 'inferior' | 'medial' | 'oblique';
  /** reference ids from data/references */
  refs: string[];
}

export const LESION_CASES: LesionCase[] = [
  {
    id: 'broca',
    title: 'Weak right hand, halting speech',
    level: 1,
    presentation: 'A 68-year-old woman suddenly cannot find her words. Her right face droops and her right hand is weak.',
    findings: ['Non-fluent, effortful speech; understands what is said to her', 'Right lower face weakness', 'Right arm weaker than right leg', 'Sensation and vision normal'],
    answer: 'Left inferior frontal lobe and adjacent motor cortex (superior division of the left middle cerebral artery)',
    structures: ['brocas-area', 'precentral-gyrus'],
    steps: [
      { clue: 'Weakness of the right side', means: 'Motor pathways cross, so the lesion is in the left hemisphere (above the medulla).', structures: ['precentral-gyrus'] },
      { clue: 'Face and arm worse than leg', means: 'On the motor strip the face and hand sit on the lateral convexity; the leg is on the medial surface. A lateral lesion spares the leg.', structures: ['precentral-gyrus'] },
      { clue: 'Non-fluent speech with good comprehension', means: 'Classic expressive (Broca’s) aphasia: left inferior frontal gyrus, just in front of the face area of the motor strip.', structures: ['brocas-area'] },
      { clue: 'Sudden onset', means: 'Points to a vascular cause. Both areas share the superior division of the left middle cerebral artery.', structures: [] },
    ],
    pearl: 'Aphasia + face/arm weakness = left lateral frontal cortex. Leg-predominant weakness would point medially (anterior cerebral artery).',
    lesion: { kind: 'infarct', center: [-44, 20, 16], radii: [11, 15, 17], stage: 0.2 },
    scan: { seq: 'DWI', axis: 'axial', why: 'Diffusion-weighted MRI shows an acute infarct as bright within minutes to hours.' },
    disease: 'ischaemic-stroke',
    view: 'left',
    refs: ['mohr1978', 'bamford1991', 'powers2019'],
  },
  {
    id: 'pca',
    title: 'Missing the right half of the world',
    level: 1,
    presentation: 'A 72-year-old man keeps bumping into things on his right. He is otherwise well.',
    findings: ['Right homonymous hemianopia (right half of vision lost in both eyes)', 'Central (macular) vision spared', 'No weakness, normal speech'],
    answer: 'Left occipital lobe, primary visual cortex along the calcarine fissure (left posterior cerebral artery)',
    structures: ['visual-cortex', 'occipital-lobe'],
    steps: [
      { clue: 'Same half of the field lost in both eyes', means: 'The problem is behind the optic chiasm, where each side of the brain sees the opposite half of space.', structures: [] },
      { clue: 'Right field lost', means: 'So the left visual pathway or cortex is affected.', structures: ['visual-cortex'] },
      { clue: 'Macula spared, nothing else wrong', means: 'Typical of an occipital cortex lesion: the occipital pole often keeps a second blood supply from the middle cerebral artery.', structures: ['visual-cortex', 'occipital-lobe'] },
    ],
    pearl: 'An isolated homonymous hemianopia with macular sparing is an occipital lobe lesion until proven otherwise.',
    lesion: { kind: 'infarct', center: [-12, 6, -84], radii: [10, 13, 14], stage: 0.25 },
    scan: { seq: 'DWI', axis: 'axial', why: 'Diffusion restriction along the left calcarine cortex.' },
    disease: 'ischaemic-stroke',
    view: 'medial',
    refs: ['zhang2006', 'bamford1991'],
  },
  {
    id: 'lacune',
    title: 'Pure weakness, nothing else',
    level: 1,
    presentation: 'A 60-year-old man with long-standing high blood pressure wakes with a weak left side.',
    findings: ['Left face, arm and leg equally weak', 'No sensory loss, no visual loss', 'Speech, language and attention normal'],
    answer: 'Right internal capsule, posterior limb (a small lacunar infarct)',
    structures: ['internal-capsule'],
    steps: [
      { clue: 'Left-sided weakness', means: 'Right hemisphere or upper brainstem.', structures: [] },
      { clue: 'Face, arm and leg equally weak', means: 'The motor fibres for the whole body are only packed this tightly deep in the brain: in the internal capsule or brainstem. A cortical lesion would rarely hit all three equally.', structures: ['internal-capsule'] },
      { clue: 'No cortical signs (language, neglect, vision)', means: 'The cortex is spared, so the lesion is small and deep.', structures: ['internal-capsule'] },
      { clue: 'Hypertension', means: 'Damages the small penetrating arteries that supply deep structures, causing lacunes.', structures: [] },
    ],
    pearl: 'Equal face–arm–leg weakness without cortical signs = a small deep lesion (internal capsule or pons).',
    lesion: { kind: 'infarct', center: [24, 8, -12], radii: [4, 7, 6], stage: 0.2 },
    scan: { seq: 'DWI', axis: 'axial', why: 'A small bright dot in the posterior limb of the right internal capsule.' },
    disease: 'svd',
    view: 'oblique',
    refs: ['fisher1982', 'bamford1991', 'wardlaw2013'],
  },
  {
    id: 'wernicke',
    title: 'Talks easily but makes no sense',
    level: 2,
    presentation: 'A 75-year-old man speaks fluently but in jumbled words and does not follow instructions. His family think he is confused.',
    findings: ['Fluent speech full of wrong or made-up words', 'Poor comprehension and repetition', 'Unaware of the problem', 'Possible loss of the right upper quarter of vision', 'No weakness'],
    answer: 'Left posterior superior temporal gyrus (Wernicke’s area; inferior division of the left middle cerebral artery)',
    structures: ['wernickes-area', 'temporal-lobe'],
    steps: [
      { clue: 'Language problem', means: 'In most people language lives in the left hemisphere.', structures: [] },
      { clue: 'Fluent but meaningless, poor comprehension', means: 'Receptive (Wernicke’s) aphasia: posterior superior temporal gyrus, beside the auditory cortex.', structures: ['wernickes-area'] },
      { clue: 'No weakness', means: 'The motor strip in the frontal lobe is spared, so the lesion is behind and below it.', structures: ['temporal-lobe'] },
      { clue: 'Right upper quadrant field loss', means: 'Meyer’s loop of the optic radiation runs through the temporal lobe and carries the upper field.', structures: ['temporal-lobe'] },
    ],
    pearl: 'Fluent aphasia without weakness is often mistaken for confusion; think left posterior temporal lobe.',
    lesion: { kind: 'infarct', center: [-55, 10, -42], radii: [10, 13, 16], stage: 0.25 },
    scan: { seq: 'DWI', axis: 'axial', why: 'Acute infarct in the left posterior temporal lobe.' },
    disease: 'ischaemic-stroke',
    view: 'left',
    refs: ['hickok2007', 'bamford1991'],
  },
  {
    id: 'neglect',
    title: 'Ignores everything on the left',
    level: 2,
    presentation: 'A 70-year-old woman eats only from the right half of her plate and denies that anything is wrong.',
    findings: ['Ignores people and objects on her left (hemineglect)', 'Denies her deficit (anosognosia)', 'Reduced sensation on the left', 'Mild left arm weakness'],
    answer: 'Right inferior parietal lobule',
    structures: ['parietal-lobe', 'postcentral-gyrus'],
    steps: [
      { clue: 'Neglect of the left side', means: 'Spatial attention is dominated by the right hemisphere, especially the right parietal lobe. Left parietal lesions rarely cause lasting neglect.', structures: ['parietal-lobe'] },
      { clue: 'Left-sided sensory loss', means: 'Points to the right postcentral gyrus or the fibres just beneath it.', structures: ['postcentral-gyrus'] },
      { clue: 'Denial of illness', means: 'Anosognosia goes with large right parietal lesions.', structures: ['parietal-lobe'] },
    ],
    pearl: 'Neglect is a right-hemisphere sign; language is preserved because the left hemisphere is intact.',
    lesion: { kind: 'infarct', center: [42, 36, -50], radii: [13, 15, 17], stage: 0.25 },
    scan: { seq: 'DWI', axis: 'axial', why: 'Acute infarct in the right parietal lobe.' },
    disease: 'ischaemic-stroke',
    view: 'right',
    refs: ['vallar1986', 'bamford1991'],
  },
  {
    id: 'cerebellar',
    title: 'Clumsy right hand, swaying walk',
    level: 2,
    presentation: 'A 55-year-old man has vertigo and keeps missing the cup with his right hand. He walks as if drunk.',
    findings: ['Right finger–nose and heel–shin tests overshoot', 'Wide-based, unsteady gait', 'Nystagmus', 'Normal strength and sensation'],
    answer: 'Right cerebellar hemisphere',
    structures: ['cerebellum'],
    steps: [
      { clue: 'Poorly aimed movement with normal strength', means: 'Coordination, not power, is affected: the cerebellum or its connections.', structures: ['cerebellum'] },
      { clue: 'Right-sided limb ataxia', means: 'Unlike the cerebrum, each cerebellar hemisphere controls the same side of the body (its pathways cross twice).', structures: ['cerebellum'] },
      { clue: 'Vertigo and nystagmus', means: 'The cerebellum and vestibular nuclei work closely together in the posterior fossa.', structures: ['cerebellum', 'pons'] },
    ],
    pearl: 'Cerebellar signs are on the same side as the lesion. Swelling in the posterior fossa can compress the brainstem, so this is urgent.',
    lesion: { kind: 'infarct', center: [26, -30, -60], radii: [12, 11, 13], stage: 0.25 },
    scan: { seq: 'DWI', axis: 'axial', why: 'Acute infarct in the right cerebellar hemisphere.' },
    disease: 'ischaemic-stroke',
    view: 'posterior',
    refs: ['edlow2008'],
  },
  {
    id: 'wallenberg',
    title: 'Crossed numbness and hoarse voice',
    level: 3,
    presentation: 'A 48-year-old man develops vertigo, vomiting and a hoarse voice after a neck massage.',
    findings: ['Loss of pain and temperature on the left face and right body', 'Hoarseness and difficulty swallowing', 'Left ptosis and small pupil (Horner syndrome)', 'Left limb ataxia', 'Strength normal'],
    answer: 'Left lateral medulla (lateral medullary or Wallenberg syndrome; vertebral or posterior inferior cerebellar artery)',
    structures: ['medulla'],
    steps: [
      { clue: 'Face on one side, body on the other', means: '“Crossed” signs mean the brainstem: the face pathway has not crossed yet while the body pathway already has.', structures: ['medulla', 'pons'] },
      { clue: 'Hoarseness and swallowing trouble', means: 'Nucleus ambiguus (cranial nerves IX and X) sits in the medulla.', structures: ['medulla'] },
      { clue: 'Left Horner syndrome', means: 'Descending sympathetic fibres run in the lateral brainstem.', structures: ['medulla'] },
      { clue: 'Strength normal', means: 'The corticospinal tract lies medially, so a lateral lesion spares it.', structures: ['medulla'] },
      { clue: 'After neck manipulation', means: 'Suggests a vertebral artery dissection.', structures: [] },
    ],
    pearl: 'Crossed sensory signs + bulbar signs + Horner + no weakness = lateral medulla.',
    lesion: { kind: 'infarct', center: [-6, -48, -42], radii: [4, 7, 5], stage: 0.25 },
    scan: { seq: 'DWI', axis: 'axial', why: 'A small infarct in the left lateral medulla; these are easy to miss early.' },
    disease: 'ischaemic-stroke',
    view: 'inferior',
    refs: ['kim2003'],
  },
  {
    id: 'hsv',
    title: 'Fever, confusion and odd smells',
    level: 3,
    presentation: 'A 35-year-old woman has two days of fever and headache, then becomes confused and has a seizure. She reports strange smells.',
    findings: ['Fever and reduced consciousness', 'Cannot form new memories', 'Olfactory hallucinations before a seizure', 'Mild word-finding difficulty'],
    answer: 'Left medial temporal lobe (hippocampus and amygdala), often spreading to the insula; herpes simplex encephalitis, frequently on both sides but asymmetric',
    structures: ['hippocampus', 'amygdala', 'temporal-lobe', 'insular-cortex'],
    steps: [
      { clue: 'Cannot form new memories', means: 'The hippocampus in the medial temporal lobe is needed to lay down new episodic memories. A dense amnesia like this usually means both hippocampi are affected; one side alone gives milder, material-specific loss (verbal for the left).', structures: ['hippocampus'] },
      { clue: 'Strange smells before a seizure', means: 'Olfactory auras come from the medial temporal lobe (amygdala and uncus), close to the primary olfactory cortex.', structures: ['amygdala'] },
      { clue: 'Fever and a subacute course', means: 'Infection rather than a stroke. Herpes simplex virus has a striking preference for the medial temporal lobes and insula.', structures: ['temporal-lobe', 'insular-cortex'] },
    ],
    pearl: 'Fever + confusion + temporal lobe features = start aciclovir for herpes encephalitis immediately, before the scan and lumbar puncture results.',
    lesion: { kind: 'inflammation', center: [-30, -22, -8], radii: [12, 13, 20], stage: 0.3 },
    scan: { seq: 'FLAIR', axis: 'coronal', why: 'FLAIR shows swelling and bright signal in the left medial temporal lobe.' },
    disease: 'viral-encephalitis',
    view: 'left',
    refs: ['tunkel2008'],
  },
];

export function casePathology(c: LesionCase): Pathology {
  const l: Lesion = { id: `case-${c.id}`, kind: c.lesion.kind, center: c.lesion.center, radii: c.lesion.radii, stage: c.lesion.stage, edema: c.lesion.edema };
  return { ...emptyPathology(), lesions: [l] };
}
