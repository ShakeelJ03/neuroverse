import type { Pathology } from '../anatomy/model';
import { atlasUnsupported } from './meshes';

/** 'atlas' = MNI152 template + Harvard–Oxford labels; 'model' = NEUROVERSE parametric model. */
export type AnatomySource = 'atlas' | 'model';

/** The source actually used for a pathology state (malformations always use the parametric model). */
export function effectiveSource(pref: AnatomySource, p: Pathology): { source: AnatomySource; fallback: string | null } {
  if (pref === 'model') return { source: 'model', fallback: null };
  const why = atlasUnsupported(p);
  return why ? { source: 'model', fallback: why } : { source: 'atlas', fallback: null };
}
