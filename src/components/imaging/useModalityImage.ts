'use client';
import { useMemo } from 'react';
import type { SliceData } from '@/lib/imaging/slice';
import { Img, MriSeq, PetTracer, renderCT, renderMRI, renderPET, renderStiffness, SeqParams, waveField } from '@/lib/imaging/modalities';

export type Spec =
  | { modality: 'mri'; seq: MriSeq; custom?: SeqParams }
  | { modality: 'ct' }
  | { modality: 'pet'; tracer: PetTracer; fwhm: number }
  | { modality: 'mre'; display: 'elastogram' | 'wave'; freq: number };

export function useModalityImage(slice: SliceData | null, spec: Spec): { base: Img | null; overlay: Img | null } {
  const key = JSON.stringify(spec);
  return useMemo(() => {
    if (!slice) return { base: null, overlay: null };
    switch (spec.modality) {
      case 'mri':
        return { base: renderMRI(slice, spec.seq, spec.custom), overlay: null };
      case 'ct':
        return { base: renderCT(slice), overlay: null };
      case 'pet':
        return { base: null, overlay: renderPET(slice, spec.tracer, spec.fwhm) };
      case 'mre':
        return { base: renderMRI(slice, 'T1'), overlay: renderStiffness(slice) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slice, key]);
}

export function useWave(slice: SliceData | null, freq: number, enabled: boolean) {
  return useMemo(() => (slice && enabled ? waveField(slice, freq) : null), [slice, freq, enabled]);
}
