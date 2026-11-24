'use client';
import { Provenance } from '@/components/ui';
import { useSettings } from '@/store/settings';

/** Provenance chip + caption that follow the selected anatomy source. */
export function AnatomyProvenance({ caption = 'short', className }: { caption?: 'none' | 'short' | 'long'; className?: string }) {
  const atlas = useSettings((s) => s.anatomySource) === 'atlas';
  const text =
    caption === 'long'
      ? atlas
        ? 'Geometry comes from the MNI152 population-average template with Harvard–Oxford labels (a few small structures stay parametric; each structure says which). Switch to the parametric model in the sidebar.'
        : 'Geometry is a parametric educational reconstruction (not segmented from a scan). Switch to the MNI atlas in the sidebar for template-derived anatomy.'
      : atlas
        ? 'MNI152 template · Harvard–Oxford atlas'
        : 'Parametric model in MNI-aligned mm space';
  return (
    <span className={className}>
      <Provenance kind={atlas ? 'atlas' : 'conceptual'} />
      {caption !== 'none' && <span className={caption === 'long' ? 'mt-1 block' : 'ml-2 hidden text-[11px] text-ink-400 xl:inline'}>{text}</span>}
    </span>
  );
}
