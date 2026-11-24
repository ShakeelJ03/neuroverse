export interface TourStep {
  title: string;
  body: string;
  href: string;
  cta: string;
}
export interface Tour {
  id: string;
  title: string;
  summary: string;
  steps: TourStep[];
}

export const TOURS: Tour[] = [
  {
    id: 'hippocampus', title: 'Explore the hippocampus', summary: 'From 3D anatomy to memory circuits, Alzheimer’s disease and multimodal imaging.',
    steps: [
      { title: 'Find the hippocampus', body: 'Open the explorer in X-ray mode. The hippocampus curves along the floor of the temporal horn, medial to it and posterior to the amygdala.', href: '/?s=hippocampus', cta: 'Locate in 3D' },
      { title: 'Understand its anatomy', body: 'Read the location and description: head, body and tail; dentate gyrus, CA1–CA4 and subiculum. Use Isolate and rotate to see its curvature.', href: '/atlas?s=hippocampus', cta: 'Open atlas entry' },
      { title: 'Explore its connections', body: 'Input arrives from entorhinal cortex via the perforant path; output leaves via the fornix to the mammillary bodies — part of the Papez circuit. Toggle the fornix and cingulum.', href: '/connections', cta: 'Open connections' },
      { title: 'Learn its function', body: 'Declarative memory encoding and consolidation, and spatial navigation (place cells). Bilateral loss causes anterograde amnesia (patient H.M.).', href: '/atlas?s=hippocampus', cta: 'Review functions' },
      { title: 'Investigate Alzheimer’s disease', body: 'Select the disease and step through the stages: watch entorhinal/hippocampal changes appear first, then cortical atrophy and ventricular enlargement.', href: '/diseases/alzheimers', cta: 'Open disease page' },
      { title: 'Examine hippocampal atrophy on MRI', body: 'Use coronal T1 at the hippocampal body. Compare Healthy vs case and note the widened choroid fissure and temporal horn (MTA score concept).', href: '/imaging?disease=alzheimers&modality=mri&seq=T1&axis=coronal&structure=hippocampus', cta: 'Open MRI' },
      { title: 'Compare PET and MRE research', body: 'Switch to PET (FDG, amyloid, tau) and then MRE. Note which findings are established clinical biomarkers and which are research findings.', href: '/imaging?disease=alzheimers&modality=pet&seq=TAU&structure=hippocampus', cta: 'Open PET' },
    ],
  },
  {
    id: 'stroke', title: 'Acute stroke imaging', summary: 'Why CT comes first, what DWI and ADC show, and how signal evolves over time.',
    steps: [
      { title: 'MCA territory anatomy', body: 'Identify the frontal, temporal and parietal lobes and the insula — the territory of the middle cerebral artery.', href: '/?s=insular-cortex', cta: 'Explore insula' },
      { title: 'Non-contrast CT', body: 'Use stroke and brain windows. Hyperacute infarcts are subtle; CT mainly excludes haemorrhage.', href: '/imaging?disease=ischaemic-stroke&modality=ct', cta: 'Open CT' },
      { title: 'DWI and ADC', body: 'Compare DWI with the ADC map: true restriction is bright on DWI and dark on ADC.', href: '/imaging?disease=ischaemic-stroke&modality=mri&seq=DWI', cta: 'Open DWI' },
      { title: 'Time course', body: 'Use the stage slider to move from hyperacute to chronic and watch FLAIR become positive, ADC pseudonormalise and encephalomalacia form.', href: '/progression?disease=ischaemic-stroke', cta: 'Open progression' },
    ],
  },
  {
    id: 'mri-physics', title: 'MRI physics hands-on', summary: 'Build T1, T2 and FLAIR contrast yourself by changing TR, TE and TI.',
    steps: [
      { title: 'Open the sequence lab', body: 'Select “Sequence lab” and set TR 500, TE 10 — a T1-weighted spin echo.', href: '/imaging?modality=mri&seq=CUSTOM', cta: 'Open sequence lab' },
      { title: 'Make it T2-weighted', body: 'Increase TR to 4000 and TE to 100. CSF turns bright; grey matter becomes brighter than white matter.', href: '/imaging?modality=mri&seq=CUSTOM', cta: 'Try it' },
      { title: 'Null the CSF', body: 'Press “Set TI to null CSF” with TR 9000: you have built a FLAIR sequence.', href: '/imaging?modality=mri&seq=CUSTOM', cta: 'Try it' },
    ],
  },
];
