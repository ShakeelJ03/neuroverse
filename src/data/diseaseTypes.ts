import { emptyPathology, Pathology, Lesion } from '@/lib/anatomy/model';
import type { V3 } from '@/lib/anatomy/sdf';

export type DiseaseCategory =
  | 'Neurodegenerative'
  | 'Cerebrovascular'
  | 'Brain tumours'
  | 'Demyelinating & inflammatory'
  | 'Epilepsy & seizure disorders'
  | 'Traumatic brain injury'
  | 'Congenital & developmental';

export type EvidenceLevel = 'established' | 'supportive' | 'research';
export type Modality = 'MRI' | 'CT' | 'PET' | 'MRE' | 'Other';

export interface ImagingFinding {
  modality: Modality;
  finding: string;
  evidence: EvidenceLevel;
}

export interface Stage {
  t: number;
  label: string;
  note: string;
}

export interface ImagingLink {
  modality: 'mri' | 'ct' | 'pet' | 'mre';
  sequence?: string;
  axis?: 'axial' | 'coronal' | 'sagittal';
  /** point of interest (scene mm) used to position the slice crosshair */
  focus?: V3;
}

export interface Disease {
  id: string;
  name: string;
  aliases?: string[];
  category: DiseaseCategory;
  depth: 'comprehensive' | 'core';
  summary: string;
  overview: string;
  epidemiology: string;
  pathophysiology: string;
  /** structure ids from data/structures.ts */
  structures: string[];
  cellular: string;
  macroscopic: string;
  clinical: string[];
  progression: string;
  imaging: ImagingFinding[];
  differentials: string[];
  refs: string[];
  /** t ∈ [0,1]: 0 = reference/healthy, 1 = advanced. Always an illustrative model. */
  model: (t: number) => Pathology;
  stages: Stage[];
  /** how the progression stages are grounded */
  progressionBasis: 'imaging-timecourse' | 'pathological-staging' | 'longitudinal-cohort' | 'conceptual';
  progressionNote: string;
  imagingLinks: ImagingLink[];
  /** true when conventional structural imaging is typically normal */
  oftenNormalImaging?: boolean;
}

export const P = (partial: Partial<Pathology>): Pathology => ({ ...emptyPathology(), ...partial });
export const L = (l: Lesion): Lesion => l;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ramp = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));

export const STD_STAGES: Stage[] = [
  { t: 0, label: 'Reference', note: 'Healthy reference anatomy.' },
  { t: 0.33, label: 'Early', note: 'Early disease.' },
  { t: 0.66, label: 'Intermediate', note: 'Intermediate disease.' },
  { t: 1, label: 'Advanced', note: 'Advanced disease.' },
];
