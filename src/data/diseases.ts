import type { Disease, DiseaseCategory } from './diseaseTypes';
import { NEURODEGENERATIVE } from './diseases/neurodegenerative';
import { VASCULAR } from './diseases/vascular';
import { TUMOURS } from './diseases/tumours';
import { INFLAMMATORY } from './diseases/inflammatory';
import { EPILEPSY, TRAUMA, CONGENITAL } from './diseases/other';

export type { Disease } from './diseaseTypes';

export const DISEASES: Disease[] = [...NEURODEGENERATIVE, ...VASCULAR, ...TUMOURS, ...INFLAMMATORY, ...EPILEPSY, ...TRAUMA, ...CONGENITAL];
export const DISEASE_BY_ID: Record<string, Disease> = Object.fromEntries(DISEASES.map((d) => [d.id, d]));
export const CATEGORIES: DiseaseCategory[] = [
  'Neurodegenerative', 'Cerebrovascular', 'Brain tumours', 'Demyelinating & inflammatory', 'Epilepsy & seizure disorders',
  'Traumatic brain injury', 'Congenital & developmental',
];
