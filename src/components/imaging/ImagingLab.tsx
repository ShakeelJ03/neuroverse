'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { Crosshair, Move, SunMedium, ArrowUpRight } from 'lucide-react';
import { ModalityPane, PaneOpts, specLabel } from './ModalityPane';
import { Spec } from './useModalityImage';
import { CtPhysics, MriPhysics, MrePhysics, PetPhysics } from './Physics';
import { NiftiViewer } from './NiftiViewer';
import { RegionStiffness } from './RegionStiffness';
import { Readout } from './Readout';
import { Linked3D } from './Linked3D';
import { Badge, Button, Panel, Provenance, Segmented, Slider } from '@/components/ui';
import { CATEGORIES, DISEASES, DISEASE_BY_ID } from '@/data/diseases';
import { STRUCTURE_BY_ID } from '@/data/structures';
import { emptyPathology } from '@/lib/anatomy/model';
import type { V3 } from '@/lib/anatomy/sdf';
import { Axis, sliceRange } from '@/lib/imaging/slice';
import { CT_WINDOWS, MRI_SEQS, MriSeq, PET_TRACERS, PetTracer, SeqParams, nullTI } from '@/lib/imaging/modalities';
import { cssGradient, Cmap } from '@/lib/imaging/colormaps';

type Mod = 'mri' | 'ct' | 'pet' | 'mre' | 'nifti';
type Layout = 'ortho' | 'single' | 'compare' | 'multi';

const STRUCT_FOCUS: Record<string, V3> = {
  hippocampus: [-28, -13, -18], thalamus: [-10, 6, -16], 'caudate-nucleus': [-15, 9, 14], putamen: [-26, 1, 3], 'substantia-nigra': [-9, -9.5, -18],
  amygdala: [-22, -17, 2], cerebellum: [-24, -36, -62], 'corpus-callosum': [0, 22, -6], 'lateral-ventricles': [-13, 15, -4], 'insular-cortex': [-38, 2, 2],
  'entorhinal-cortex': [-25, -24, -4], pons: [0, -28, -24], midbrain: [0, -10, -24], 'pituitary-gland': [0, -30, 4],
};

export function ImagingLab() {
  const params = useSearchParams();
  const [diseaseId, setDiseaseId] = useState<string>(params.get('disease') ?? 'healthy');
  const disease = DISEASE_BY_ID[diseaseId];
  const [t, setT] = useState<number>(() => (disease ? (disease.stages.length > 1 ? disease.stages[Math.min(2, disease.stages.length - 1)].t : disease.stages[0].t) : 0));
  const [mod, setMod] = useState<Mod>(() => {
    const m = params.get('modality');
    return m && ['mri', 'ct', 'pet', 'mre', 'nifti'].includes(m) ? (m as Mod) : 'mri';
  });
  const [seq, setSeq] = useState<MriSeq>(() => {
    const q = params.get('seq');
    return q === 'CUSTOM' || (q && q in MRI_SEQS) ? (q as MriSeq) : 'T1';
  });
  const [tracer, setTracer] = useState<PetTracer>((params.get('seq') as PetTracer) && PET_TRACERS[params.get('seq') as PetTracer] ? (params.get('seq') as PetTracer) : 'FDG');
  const [custom, setCustom] = useState<SeqParams>({ tr: 2000, te: 80, ti: 0, b: 0 });
  const [layout, setLayout] = useState<Layout>('ortho');
  const [singleAxis, setSingleAxis] = useState<Axis>((params.get('axis') as Axis) ?? 'axial');
  const [cross, setCross] = useState<V3>(() => {
    const s = params.get('structure');
    if (s && STRUCT_FOCUS[s]) return STRUCT_FOCUS[s];
    const link = disease?.imagingLinks[0];
    return link?.focus ?? [-20, 8, -14];
  });
  const [wl, setWlState] = useState<Record<string, [number, number]>>({});
  const [petBase, setPetBase] = useState<'none' | 'mri' | 'ct'>('mri');
  const [petOpacity, setPetOpacity] = useState(0.7);
  const [petCmap, setPetCmap] = useState<Cmap>('hot');
  const [fwhm, setFwhm] = useState(5);
  const [mreDisplay, setMreDisplay] = useState<'elastogram' | 'wave'>('wave');
  const [mreOpacity, setMreOpacity] = useState(0.75);
  const [freq, setFreq] = useState(60);
  const [tool, setTool] = useState<'cross' | 'wl' | 'pan'>('cross');
  const [multiSpecs, setMultiSpecs] = useState<Spec[]>([]);

  // apply a disease's preferred imaging link when the disease changes
  useEffect(() => {
    const d = DISEASE_BY_ID[diseaseId];
    if (!d) return;
    const link = d.imagingLinks[0];
    if (link?.focus) setCross(link.focus);
    const st = d.stages.length > 1 ? d.stages[Math.min(2, d.stages.length - 1)].t : d.stages[0].t;
    setT(st);
    setMultiSpecs(defaultMulti(diseaseId));
  }, [diseaseId]);
  useEffect(() => {
    setMultiSpecs(defaultMulti(diseaseId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pathology = useMemo(() => (disease ? disease.model(t) : emptyPathology()), [disease, t]);
  const healthy = useMemo(() => emptyPathology(), []);

  const spec: Spec = useMemo(() => {
    if (mod === 'mri') return seq === 'CUSTOM' ? { modality: 'mri', seq, custom } : { modality: 'mri', seq };
    if (mod === 'ct') return { modality: 'ct' };
    if (mod === 'pet') return { modality: 'pet', tracer, fwhm };
    return { modality: 'mre', display: mreDisplay, freq };
  }, [mod, seq, custom, tracer, fwhm, mreDisplay, freq]);

  const setWL = useCallback((k: string, w: number, l: number) => setWlState((s) => ({ ...s, [k]: [w, l] })), []);
  const opts: PaneOpts = { wl, setWL, petBase, petOpacity, petCmap, mreOpacity, tool };

  const onScroll = useCallback((axis: Axis, d: number) => {
    setCross((c) => {
      const [lo, hi] = sliceRange(axis);
      const n = [...c] as V3;
      const idx = axis === 'axial' ? 1 : axis === 'coronal' ? 2 : 0;
      n[idx] = Math.max(lo, Math.min(hi, Math.round(n[idx] + d * 2)));
      return n;
    });
  }, []);

  const sp: SeqParams = seq === 'CUSTOM' ? custom : seq === 'FLAIR' ? { ...MRI_SEQS.FLAIR.params, ti: nullTI(9000) } : MRI_SEQS[seq].params;
  const findings = disease?.imaging.filter((f) => (mod === 'nifti' ? false : f.modality === ({ mri: 'MRI', ct: 'CT', pet: 'PET', mre: 'MRE' } as const)[mod as 'mri'])) ?? [];

  return (
    <div className="flex h-full flex-col">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b hairline bg-ink-900/80 px-4 py-2.5">
        <div>
          <div className="label-chip text-ink-400">Imaging simulator</div>
          <div className="font-display text-[15px] font-medium text-ink-50">Virtual scanner</div>
        </div>
        <span className="h-8 w-px bg-white/10" />
        <Segmented<Mod>
          value={mod}
          onChange={setMod}
          options={[
            { value: 'mri', label: 'MRI' },
            { value: 'ct', label: 'CT' },
            { value: 'pet', label: 'PET' },
            { value: 'mre', label: 'MRE' },
            { value: 'nifti', label: 'Real data (NIfTI)' },
          ]}
        />
        <span className="h-8 w-px bg-white/10" />
        <label className="flex items-center gap-2 text-[12px] text-ink-300">
          Case
          <select
            value={diseaseId}
            onChange={(e) => setDiseaseId(e.target.value)}
            className="max-w-[260px] rounded-lg border hairline bg-ink-850 px-2 py-1.5 text-[12.5px] text-ink-50 focus:outline-none"
          >
            <option value="healthy">Healthy reference phantom</option>
            {CATEGORIES.map((c) => (
              <optgroup key={c} label={c}>
                {DISEASES.filter((d) => d.category === c).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {disease && disease.stages.length > 1 && (
          <div className="flex items-center gap-2">
            <div className="w-40"><Slider value={t} min={0} max={1} step={0.01} onChange={setT} /></div>
            <span className="max-w-[170px] truncate text-[11.5px] text-ink-200">{nearestStage(disease.stages, t).label}</span>
          </div>
        )}
        {mod !== 'nifti' && (
          <>
            <span className="h-8 w-px bg-white/10" />
            <Segmented<Layout>
              size="sm"
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'ortho', label: 'Orthogonal', title: 'Axial / coronal / sagittal with synchronised crosshair' },
                { value: 'single', label: 'Single' },
                { value: 'compare', label: 'Healthy vs case', title: 'Same slice, same sequence' },
                { value: 'multi', label: 'Multimodal', title: 'Several modalities at the same registered slice' },
              ]}
            />
            <Segmented
              size="sm"
              value={tool}
              onChange={setTool}
              options={[
                { value: 'cross', label: <Crosshair className="h-3.5 w-3.5" />, title: 'Crosshair (drag)' },
                { value: 'wl', label: <SunMedium className="h-3.5 w-3.5" />, title: 'Window / level (drag)' },
                { value: 'pan', label: <Move className="h-3.5 w-3.5" />, title: 'Pan (drag)' },
              ]}
            />
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          {mod === 'nifti' ? <Provenance kind="clinical" /> : <Provenance kind="synthetic" />}
        </div>
      </div>

      {mod === 'nifti' ? (
        <div className="flex-1 p-4"><NiftiViewer /></div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* controls */}
          <div className="scroll-thin w-[270px] shrink-0 space-y-4 overflow-y-auto border-r hairline p-3">
            {mod === 'mri' && (
              <div>
                <div className="label-chip mb-2 text-ink-300">Sequence</div>
                <div className="space-y-1">
                  {(Object.keys(MRI_SEQS) as (keyof typeof MRI_SEQS)[]).map((k) => (
                    <button key={k} onClick={() => setSeq(k)} className={clsx('w-full rounded-lg border px-2.5 py-1.5 text-left transition-colors', seq === k ? 'border-primary-accent/40 bg-primary-accent/10' : 'hairline hover:bg-white/[0.03]')}>
                      <div className={clsx('text-[12.5px] font-medium', seq === k ? 'text-primary-accent' : 'text-ink-50')}>{k === 'T1C' ? 'T1 + Gd' : k}</div>
                      <div className="truncate text-[10.5px] text-ink-400">{MRI_SEQS[k].name}</div>
                    </button>
                  ))}
                  <button onClick={() => setSeq('CUSTOM')} className={clsx('w-full rounded-lg border px-2.5 py-1.5 text-left', seq === 'CUSTOM' ? 'border-tertiary-accent/40 bg-tertiary-accent/10' : 'hairline hover:bg-white/[0.03]')}>
                    <div className={clsx('text-[12.5px] font-medium', seq === 'CUSTOM' ? 'text-tertiary-accent' : 'text-ink-50')}>Sequence lab</div>
                    <div className="text-[10.5px] text-ink-400">Set TR / TE / TI / b yourself</div>
                  </button>
                </div>
                {seq === 'CUSTOM' && (
                  <div className="mt-3 space-y-2.5 rounded-lg border hairline p-2.5">
                    <Slider label="TR (ms)" value={custom.tr} min={200} max={10000} step={50} onChange={(v) => setCustom((c) => ({ ...c, tr: v }))} />
                    <Slider label="TE (ms)" value={custom.te} min={2} max={250} step={1} onChange={(v) => setCustom((c) => ({ ...c, te: v }))} />
                    <Slider label="TI (ms, 0 = off)" value={custom.ti} min={0} max={3500} step={10} onChange={(v) => setCustom((c) => ({ ...c, ti: v }))} />
                    <Slider label="b-value (s/mm²)" value={custom.b} min={0} max={2000} step={50} onChange={(v) => setCustom((c) => ({ ...c, b: v }))} />
                    <Button size="sm" variant="subtle" onClick={() => setCustom((c) => ({ ...c, ti: Math.round(nullTI(c.tr)) }))}>Set TI to null CSF</Button>
                  </div>
                )}
              </div>
            )}
            {mod === 'ct' && (
              <div>
                <div className="label-chip mb-2 text-ink-300">Window presets</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(CT_WINDOWS).map(([k, w]) => (
                    <Button key={k} size="sm" active={wl.ct?.[0] === w.w && wl.ct?.[1] === w.l} onClick={() => setWL('ct', w.w, w.l)}>
                      {w.label} <span className="font-mono text-[10px] text-ink-400">{w.w}/{w.l}</span>
                    </Button>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  <Slider label="Window width (HU)" value={wl.ct?.[0] ?? 80} min={10} max={3000} step={5} onChange={(v) => setWL('ct', v, wl.ct?.[1] ?? 40)} />
                  <Slider label="Window level (HU)" value={wl.ct?.[1] ?? 40} min={-200} max={1000} step={1} onChange={(v) => setWL('ct', wl.ct?.[0] ?? 80, v)} />
                </div>
              </div>
            )}
            {mod === 'pet' && (
              <div className="space-y-3">
                <div>
                  <div className="label-chip mb-2 text-ink-300">Radiotracer</div>
                  <div className="space-y-1">
                    {(Object.keys(PET_TRACERS) as PetTracer[]).map((k) => (
                      <button key={k} onClick={() => setTracer(k)} className={clsx('w-full rounded-lg border px-2.5 py-1.5 text-left', tracer === k ? 'border-tertiary-accent/40 bg-tertiary-accent/10' : 'hairline hover:bg-white/[0.03]')}>
                        <div className={clsx('text-[12px] font-medium', tracer === k ? 'text-tertiary-accent' : 'text-ink-50')}>{PET_TRACERS[k].name}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label-chip mb-1.5 text-ink-300">Display</div>
                  <Segmented size="sm" value={petBase} onChange={setPetBase} options={[{ value: 'none', label: 'PET only' }, { value: 'mri', label: 'PET/MRI' }, { value: 'ct', label: 'PET/CT' }]} />
                </div>
                {petBase !== 'none' && <Slider label="Fusion opacity" value={petOpacity} min={0} max={1} step={0.05} onChange={setPetOpacity} format={(v) => `${Math.round(v * 100)}%`} />}
                <Slider label="Scanner resolution (FWHM, mm)" value={fwhm} min={2} max={10} step={0.5} onChange={setFwhm} />
                <div>
                  <div className="label-chip mb-1.5 text-ink-300">Colour map</div>
                  <Segmented size="sm" value={petCmap} onChange={setPetCmap} options={(['hot', 'inferno', 'jet', 'viridis'] as Cmap[]).map((c) => ({ value: c, label: c }))} />
                  <div className="mt-2 h-2 rounded" style={{ background: cssGradient(petCmap) }} />
                  <div className="mt-0.5 flex justify-between font-mono text-[10px] text-ink-400"><span>low uptake</span><span>high</span></div>
                </div>
              </div>
            )}
            {mod === 'mre' && (
              <div className="space-y-3">
                <div>
                  <div className="label-chip mb-1.5 text-ink-300">Display</div>
                  <Segmented size="sm" value={mreDisplay} onChange={setMreDisplay} options={[{ value: 'wave', label: 'Shear waves' }, { value: 'elastogram', label: 'Elastogram' }]} />
                </div>
                <Slider label="Overlay opacity" value={mreOpacity} min={0} max={1} step={0.05} onChange={setMreOpacity} format={(v) => `${Math.round(v * 100)}%`} />
                <Slider label="Vibration frequency (Hz)" value={freq} min={20} max={90} step={5} onChange={setFreq} />
                {mreDisplay === 'elastogram' && (
                  <div>
                    <div className="h-2 rounded" style={{ background: cssGradient('inferno') }} />
                    <div className="mt-0.5 flex justify-between font-mono text-[10px] text-ink-400"><span>0 kPa</span><span>|G*| illustrative</span><span>4 kPa</span></div>
                  </div>
                )}
                {mreDisplay === 'wave' && <p className="text-[11px] text-ink-400">Animated displacement field (slowed for display). Wavelength shortens in softer tissue.</p>}
                <RegionStiffness pathology={pathology} healthy={healthy} caseName={disease?.name} />
              </div>
            )}
            <Readout cross={cross} pathology={pathology} />
          </div>

          {/* views */}
          <div className="min-w-0 flex-1 p-2">
            {layout === 'ortho' && (
              <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2 [&>*]:min-h-0">
                {(['axial', 'coronal', 'sagittal'] as Axis[]).map((a) => (
                  <ModalityPane key={a} axis={a} cross={cross} pathology={pathology} spec={spec} opts={opts} onCross={setCross} onScroll={onScroll} />
                ))}
                <Linked3D cross={cross} pathology={pathology} onCross={setCross}><CaseCard diseaseId={diseaseId} spec={spec} /></Linked3D>
              </div>
            )}
            {layout === 'single' && (
              <div className="flex h-full flex-col gap-2">
                <Segmented size="sm" className="self-start" value={singleAxis} onChange={setSingleAxis} options={[{ value: 'axial', label: 'Axial' }, { value: 'coronal', label: 'Coronal' }, { value: 'sagittal', label: 'Sagittal' }]} />
                <div className="min-h-0 flex-1"><ModalityPane axis={singleAxis} cross={cross} pathology={pathology} spec={spec} opts={opts} onCross={setCross} onScroll={onScroll} /></div>
              </div>
            )}
            {layout === 'compare' && (
              <div className="flex h-full flex-col gap-2">
                <Segmented size="sm" className="self-start" value={singleAxis} onChange={setSingleAxis} options={[{ value: 'axial', label: 'Axial' }, { value: 'coronal', label: 'Coronal' }, { value: 'sagittal', label: 'Sagittal' }]} />
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 [&>*]:min-h-0">
                  <ModalityPane axis={singleAxis} cross={cross} pathology={healthy} spec={spec} opts={opts} onCross={setCross} onScroll={onScroll} label={`Healthy reference · ${specLabel(spec)}`} />
                  <ModalityPane axis={singleAxis} cross={cross} pathology={pathology} spec={spec} opts={opts} onCross={setCross} onScroll={onScroll} label={`${disease?.name ?? 'Healthy'} · ${specLabel(spec)}`} />
                </div>
              </div>
            )}
            {layout === 'multi' && (
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Segmented size="sm" value={singleAxis} onChange={setSingleAxis} options={[{ value: 'axial', label: 'Axial' }, { value: 'coronal', label: 'Coronal' }, { value: 'sagittal', label: 'Sagittal' }]} />
                  <span className="text-[11px] text-ink-400">All panes are sampled from one co-registered phantom, so the slice and crosshair stay synchronised.</span>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
                  {multiSpecs.map((s, i) => (
                    <div key={i} className="relative min-h-0">
                      <ModalityPane axis={singleAxis} cross={cross} pathology={pathology} spec={s} opts={opts} onCross={setCross} onScroll={onScroll} />
                      <select
                        value={JSON.stringify(s)}
                        onChange={(e) => setMultiSpecs((m) => m.map((x, j) => (j === i ? JSON.parse(e.target.value) : x)))}
                        className="absolute right-2 top-2 rounded border hairline bg-ink-900/90 px-1.5 py-0.5 text-[11px] text-ink-100"
                      >
                        {ALL_SPECS.map((o) => (
                          <option key={JSON.stringify(o)} value={JSON.stringify(o)}>{specLabel(o)}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* explanations */}
          <div className="scroll-thin w-[360px] shrink-0 space-y-5 overflow-y-auto border-l hairline p-4">
            {disease && (
              <div>
                <div className="label-chip text-ink-400">Case findings · {mod.toUpperCase()}</div>
                <div className="mt-1 flex items-center justify-between">
                  <Link href={`/diseases/${disease.id}`} className="font-display text-[16px] font-medium text-ink-50 hover:text-primary-accent">{disease.name}</Link>
                  <span className="text-[11px] text-ink-300">{nearestStage(disease.stages, t).label}</span>
                </div>
                <p className="mt-1 text-[11.5px] text-ink-300">{nearestStage(disease.stages, t).note}</p>
                <div className="mt-2 space-y-2">
                  {findings.length ? findings.map((f, i) => (
                    <div key={i} className="rounded-lg border hairline bg-white/[0.02] p-2.5 text-[12px] leading-relaxed text-ink-100">
                      <Badge tone={f.evidence === 'established' ? 'emerald' : f.evidence === 'supportive' ? 'secondary' : 'amber'}>{f.evidence === 'research' ? 'research finding' : f.evidence}</Badge>
                      <div className="mt-1">{f.finding}</div>
                    </div>
                  )) : <p className="text-[12px] text-ink-400">No specific {mod.toUpperCase()} findings listed for this condition. {disease.oftenNormalImaging ? 'Conventional imaging is often normal.' : ''}</p>}
                </div>
                <p className="mt-2 text-[10.5px] leading-snug text-ink-500">The simulated appearance is a simplified physical model of these findings and does not reproduce any real patient.</p>
              </div>
            )}
            {mod === 'mri' && <MriPhysics seq={seq} sp={sp} />}
            {mod === 'ct' && <CtPhysics />}
            {mod === 'pet' && <PetPhysics tracer={tracer} />}
            {mod === 'mre' && <MrePhysics freq={freq} />}
          </div>
        </div>
      )}
    </div>
  );
}

const ALL_SPECS: Spec[] = [
  ...(['T1', 'T2', 'FLAIR', 'DWI', 'ADC', 'SWI', 'T1C'] as MriSeq[]).map((seq) => ({ modality: 'mri', seq }) as Spec),
  { modality: 'ct' },
  ...(['FDG', 'AMY', 'TAU', 'DOPA', 'FET'] as PetTracer[]).map((tracer) => ({ modality: 'pet', tracer, fwhm: 5 }) as Spec),
  { modality: 'mre', display: 'elastogram', freq: 60 },
];

function defaultMulti(id: string): Spec[] {
  const m = (seq: MriSeq): Spec => ({ modality: 'mri', seq });
  const p = (tracer: PetTracer): Spec => ({ modality: 'pet', tracer, fwhm: 5 });
  const mre: Spec = { modality: 'mre', display: 'elastogram', freq: 60 };
  switch (id) {
    case 'alzheimers': return [m('T1'), p('FDG'), p('AMY'), p('TAU')];
    case 'ischaemic-stroke': return [{ modality: 'ct' }, m('DWI'), m('ADC'), m('FLAIR')];
    case 'glioblastoma': case 'metastases': return [m('T1C'), m('FLAIR'), { modality: 'ct' }, p('FET')];
    case 'ms': return [m('FLAIR'), m('T2'), m('T1C'), mre];
    case 'parkinsons': return [m('T1'), m('SWI'), p('DOPA'), p('FDG')];
    case 'ich': case 'haemorrhagic-stroke': case 'sdh': case 'edh': return [{ modality: 'ct' }, m('T1'), m('T2'), m('SWI')];
    default: return [m('T1'), m('FLAIR'), { modality: 'ct' }, p('FDG')];
  }
}

function nearestStage<T extends { t: number }>(stages: T[], t: number): T {
  return stages.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), stages[0]);
}

function CaseCard({ diseaseId, spec }: { diseaseId: string; spec: Spec }) {
  const d = DISEASE_BY_ID[diseaseId];
  return (
    <div className="flex flex-col justify-between p-4">
      <div>
        <div className="label-chip text-ink-400">Current acquisition</div>
        <div className="mt-1 font-display text-[15px] text-ink-50">{specLabel(spec)}</div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-300">
          Click or drag on any plane to move the shared crosshair; scroll to step through slices (2 mm); Ctrl + scroll zooms; Shift-drag or the ☀ tool adjusts window/level.
        </p>
        {d && (
          <div className="mt-3 rounded-lg border hairline bg-white/[0.02] p-3">
            <div className="text-[12.5px] font-medium text-ink-50">{d.name}</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-300">{d.summary}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {d.structures.slice(0, 6).map((s) => STRUCTURE_BY_ID[s] && (
                <Link key={s} href={`/?s=${s}`} className="rounded border hairline px-1.5 py-0.5 text-[10.5px] text-ink-200 hover:text-primary-accent">{STRUCTURE_BY_ID[s].name}</Link>
              ))}
            </div>
            <Link href={`/progression?disease=${d.id}`} className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-primary-accent hover:underline">Open progression model <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
        )}
      </div>
      <div className="mt-3 rounded-lg border border-amber-accent/25 bg-amber-accent/5 p-2.5 text-[11px] leading-relaxed text-amber-accent">
        Synthetic images computed from a digital phantom with physical signal models. They are not patient scans and must not be used for diagnosis.
      </div>
    </div>
  );
}
