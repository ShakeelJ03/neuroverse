'use client';
import { useCallback, useMemo } from 'react';
import { SliceCanvas } from './SliceCanvas';
import { Spec, useModalityImage, useWave } from './useModalityImage';
import { useSlice } from '@/lib/imaging/useSlice';
import { Axis, slicePosOf } from '@/lib/imaging/slice';
import type { Pathology } from '@/lib/anatomy/model';
import type { V3 } from '@/lib/anatomy/sdf';
import { lut, Cmap } from '@/lib/imaging/colormaps';
import { MRI_SEQS, PET_TRACERS } from '@/lib/imaging/modalities';
import { useSettings } from '@/store/settings';
import { effectiveSource } from '@/lib/atlas/source';

export interface PaneOpts {
  wl: Record<string, [number, number]>;
  setWL: (key: string, w: number, l: number) => void;
  petBase: 'none' | 'mri' | 'ct';
  petOpacity: number;
  petCmap: Cmap;
  mreOpacity: number;
  tool: 'cross' | 'wl' | 'pan';
}

export const specKey = (s: Spec) => (s.modality === 'mri' ? `mri:${s.seq}` : s.modality === 'pet' ? `pet:${s.tracer}` : s.modality);
export const specLabel = (s: Spec) =>
  s.modality === 'mri' ? (s.seq === 'CUSTOM' ? 'MRI · custom sequence' : `MRI · ${MRI_SEQS[s.seq].name}`) : s.modality === 'ct' ? 'CT · non-contrast' : s.modality === 'pet' ? `PET · ${PET_TRACERS[s.tracer].name}` : `MRE · ${s.display === 'wave' ? 'shear-wave field' : 'elastogram |G*|'}`;

export function ModalityPane({ axis, cross, pathology, spec, opts, onCross, onScroll, label }: {
  axis: Axis; cross: V3; pathology: Pathology; spec: Spec; opts: PaneOpts; onCross: (p: V3) => void; onScroll: (axis: Axis, d: number) => void; label?: string;
}) {
  const pos = Math.round(slicePosOf(axis, cross));
  const { slice, loading } = useSlice(axis, pos, pathology);
  const main = useModalityImage(slice, spec);
  const bgSpec: Spec = spec.modality === 'pet' && opts.petBase === 'ct' ? { modality: 'ct' } : { modality: 'mri', seq: 'T1' };
  const bg = useModalityImage(spec.modality === 'pet' && opts.petBase !== 'none' ? slice : null, bgSpec);
  const wave = useWave(slice, spec.modality === 'mre' ? spec.freq : 60, spec.modality === 'mre' && spec.display === 'wave');

  const key = specKey(spec);
  const defaultWL = (img: { window: number; level: number } | null): [number, number] => (img ? [img.window, img.level] : [1, 0.5]);
  const primary = spec.modality === 'pet' ? main.overlay : spec.modality === 'mre' ? main.overlay : main.base;
  const [w, l] = opts.wl[key] ?? defaultWL(primary);

  let baseImg = main.base;
  let baseW = w, baseL = l;
  let overlay = null as null | { img: NonNullable<typeof main.overlay>; cmap: Cmap; opacity: number; window: number; level: number; threshold: number };
  let cmap: Cmap = 'gray';
  if (spec.modality === 'pet') {
    if (opts.petBase === 'none') {
      baseImg = main.overlay;
      cmap = opts.petCmap;
    } else {
      baseImg = bg.base;
      const bwl = opts.wl[opts.petBase === 'ct' ? 'ct' : 'mri:T1'];
      [baseW, baseL] = bwl ?? defaultWL(bg.base);
      if (main.overlay) overlay = { img: main.overlay, cmap: opts.petCmap, opacity: opts.petOpacity, window: w, level: l, threshold: 0.08 };
    }
  } else if (spec.modality === 'mre') {
    const bwl = opts.wl['mri:T1'];
    [baseW, baseL] = bwl ?? defaultWL(main.base);
    if (spec.display === 'elastogram' && main.overlay) overlay = { img: main.overlay, cmap: 'inferno', opacity: opts.mreOpacity, window: w, level: l, threshold: 0.03 };
  }

  const animate = useMemo(() => {
    if (!wave || spec.modality !== 'mre' || spec.display !== 'wave') return undefined;
    const L = lut('wave');
    const op = opts.mreOpacity;
    return (id: ImageData, t: number) => {
      const n = id.width;
      const wt = 2 * Math.PI * 0.75 * t; // slowed for display
      for (let i = 0; i < n * n; i++) {
        const a = wave.amp[i];
        if (a <= 0) continue;
        const u = a * Math.cos(wave.phase[i] - wt);
        const k = Math.round((u * 0.5 + 0.5) * 255) * 3;
        const o = i * 4;
        id.data[o] += (L[k] - id.data[o]) * op;
        id.data[o + 1] += (L[k + 1] - id.data[o + 1]) * op;
        id.data[o + 2] += (L[k + 2] - id.data[o + 2]) * op;
      }
      return true;
    };
  }, [wave, spec, opts.mreOpacity]);

  const onWL = useCallback((nw: number, nl: number) => opts.setWL(key, nw, nl), [key, opts]);
  const axisLabel = axis === 'axial' ? `Axial · S/I ${pos > 0 ? '+' : ''}${pos} mm` : axis === 'coronal' ? `Coronal · A/P ${pos > 0 ? '+' : ''}${pos} mm` : `Sagittal · R/L ${pos > 0 ? '+' : ''}${pos} mm`;

  return (
    <SliceCanvas
      axis={axis}
      img={baseImg}
      window={spec.modality === 'pet' && opts.petBase === 'none' ? w : spec.modality === 'mri' || spec.modality === 'ct' ? w : baseW}
      level={spec.modality === 'pet' && opts.petBase === 'none' ? l : spec.modality === 'mri' || spec.modality === 'ct' ? l : baseL}
      cmap={cmap}
      overlay={overlay}
      cross={cross}
      onCross={onCross}
      onScroll={(d) => onScroll(axis, d)}
      onWL={onWL}
      tool={opts.tool}
      loading={loading}
      animate={animate}
      title={
        <>
          <div className="text-primary-accent">{label ?? specLabel(spec)}</div>
          <div>{axisLabel}</div>
        </>
      }
      corner={<div className="text-amber-accent/90">SYNTHETIC — not patient data · <PhantomSource pathology={pathology} /></div>}
    />
  );
}

function PhantomSource({ pathology }: { pathology: Pathology }) {
  const pref = useSettings((s) => s.anatomySource);
  return <span className="text-ink-400">{effectiveSource(pref, pathology).source === 'atlas' ? 'MNI152 phantom' : 'model phantom'}</span>;
}
