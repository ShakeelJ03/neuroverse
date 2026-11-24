'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { Pause, Play } from 'lucide-react';
import { BrainViewer } from '@/components/brain/BrainViewer';
import { ModalityPane, PaneOpts } from '@/components/imaging/ModalityPane';
import { CATEGORIES, DISEASES, DISEASE_BY_ID } from '@/data/diseases';
import { STRUCTURE_BY_ID } from '@/data/structures';
import type { Pathology } from '@/lib/anatomy/model';
import type { V3 } from '@/lib/anatomy/sdf';
import { requestMeshes } from '@/lib/anatomy/useBrainMeshes';
import { Badge, Button, Panel, Provenance, Slider } from '@/components/ui';
import { basisLabel } from './DiseaseDetail';
import type { MriSeq } from '@/lib/imaging/modalities';

const PROGRESSIVE = DISEASES.filter((d) => d.stages.length > 1);

interface Curve { name: string; color: string; f: (p: Pathology) => number }
function curvesFor(id: string): Curve[] {
  const c: Curve[] = [];
  const add = (name: string, color: string, f: (p: Pathology) => number) => c.push({ name, color, f });
  if (id === 'alzheimers') {
    add('Amyloid burden', '#f2b45a', (p) => p.amyloid);
    add('Tau (Braak stage / 6)', '#f0717d', (p) => p.tauBraak / 6);
    add('Posterior cingulate hypometabolism', '#8da3b5', (p) => -(p.fdg.pcc ?? 0) / 0.4);
    add('Hippocampal atrophy', '#e0895f', (p) => p.hippocampalAtrophy / 0.8);
    add('Ventricular enlargement', '#4cc99a', (p) => (p.ventricleScale - 1) / 0.85);
    return c;
  }
  if (id === 'parkinsons' || id === 'dlb' || id === 'msa' || id === 'psp') {
    add('Striatal dopamine loss', '#f2b45a', (p) => p.datLoss);
    add('Nigral neuron loss', '#f0717d', (p) => p.nigralLoss);
    add('Midbrain atrophy', '#8da3b5', (p) => p.midbrainAtrophy);
    add('Pontine/cerebellar atrophy', '#e0895f', (p) => Math.max(p.ponsAtrophy, p.cerebellarAtrophy));
    return c;
  }
  add('Lesion count / burden', '#f0717d', (p) => Math.min(1, p.lesions.reduce((a, l) => a + l.radii[0] * l.radii[1] * l.radii[2], 0) / 9000));
  add('Mass effect', '#f2b45a', (p) => Math.min(1, Math.max(0, ...p.lesions.map((l) => l.massEffect ?? 0)) / 9));
  add('Ventricular size', '#4cc99a', (p) => Math.min(1, (p.ventricleScale - 1) / 1.4));
  add('Atrophy (global)', '#e0895f', (p) => Math.min(1, (p.corticalAtrophy.global ?? 0) + p.hippocampalAtrophy + p.caudateAtrophy));
  return c;
}

const BIO: Record<string, string[]> = {
  alzheimers: [
    'Aβ42 aggregates into oligomers and plaques years before symptoms (amyloid PET becomes positive, CSF Aβ42 falls).',
    'Hyperphosphorylated tau forms neurofibrillary tangles, spreading from transentorhinal cortex (Braak I–II) to limbic (III–IV) and neocortex (V–VI).',
    'Synaptic dysfunction lowers glucose metabolism (FDG) in posterior cingulate, precuneus and temporoparietal cortex.',
    'Neuronal loss → hippocampal and cortical atrophy; CSF spaces enlarge ex vacuo.',
  ],
  parkinsons: [
    'α-synuclein misfolds into Lewy bodies, ascending from the medulla/olfactory bulb (Braak 1–2) to the substantia nigra (3) and cortex (5–6).',
    'Dopaminergic neurons of the SN pars compacta degenerate; striatal dopamine falls first in the posterior putamen.',
    'Loss of D1 (direct-pathway) excitation and D2 (indirect-pathway) inhibition increases GPi/SNr output → excessive thalamic inhibition → bradykinesia.',
  ],
  ms: ['Autoreactive lymphocytes cross the BBB → perivenular inflammation (enhancing lesion).', 'Demyelination and oligodendrocyte loss; partial remyelination.', 'Axonal loss accumulates → T1 black holes, atrophy, progressive disability.'],
  glioblastoma: ['Clonal proliferation with hypoxia → VEGF-driven leaky angiogenesis (enhancement).', 'Central necrosis surrounded by pseudopalisading cells.', 'Vasogenic oedema and infiltrating cells along white matter → mass effect, midline shift and herniation.'],
  'ischaemic-stroke': ['Minutes: energy failure → cytotoxic oedema (DWI bright, ADC low).', 'Hours: BBB breakdown → vasogenic oedema (T2/FLAIR bright, CT hypodense).', 'Days: swelling peaks; weeks: macrophage clearance, pseudonormalised ADC.', 'Months: cavitation, gliosis and volume loss.'],
  hydrocephalus: ['CSF production exceeds absorption or flow is obstructed.', 'Ventricles dilate, stretching periventricular white matter; transependymal CSF flow.', 'The corpus callosum thins and bows upward.'],
};

export function Progression() {
  const params = useSearchParams();
  const initial = params.get('disease');
  const [id, setId] = useState<string>(initial && DISEASE_BY_ID[initial]?.stages.length > 1 ? initial : 'alzheimers');
  const d = DISEASE_BY_ID[id];
  const [t, setT] = useState(0);
  const [committed, setCommitted] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setT(0); setCommitted(0); }, [id]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await requestMeshes(d.model(0), 'high').catch(() => undefined);
      for (const s of d.stages) {
        if (cancelled) return;
        await requestMeshes(d.model(s.t), 'high').catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [d]);
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => {
      setT((x) => {
        const n = x >= 1 ? 0 : Math.min(1, x + 0.02);
        return n;
      });
    }, 120);
    return () => clearInterval(iv);
  }, [playing]);
  // snap 3D remeshing to stage points during playback (meshing is ~1–2 s); imaging follows continuously
  useEffect(() => {
    if (!playing) return;
    const s = d.stages.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), d.stages[0]);
    setCommitted(s.t);
  }, [t, playing, d]);

  const meshPath = useMemo(() => d.model(committed), [d, committed]);
  const imgPath = useMemo(() => d.model(t), [d, t]);
  const curves = useMemo(() => curvesFor(id), [id]);
  const highlight = useMemo(() => {
    const h: Record<string, string> = {};
    d.structures.forEach((s) => STRUCTURE_BY_ID[s]?.meshes.forEach((m) => (h[m] = '#f0717d')));
    return h;
  }, [d]);
  const stage = d.stages.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), d.stages[0]);
  const link = d.imagingLinks.find((l) => l.modality === 'mri') ?? d.imagingLinks[0];
  const [cross, setCross] = useState<V3>(link?.focus ?? [0, 10, -10]);
  useEffect(() => setCross(link?.focus ?? [0, 10, -10]), [link]);
  const opts: PaneOpts = { wl: {}, setWL: () => undefined, petBase: 'mri', petOpacity: 0.7, petCmap: 'hot', mreOpacity: 0.7, tool: 'cross' };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b hairline bg-ink-900/80 px-4 py-2.5">
        <div>
          <div className="label-chip text-ink-400">Disease progression simulator</div>
          <div className="font-display text-[15px] font-medium text-ink-50">Change over time</div>
        </div>
        <select value={id} onChange={(e) => setId(e.target.value)} className="rounded-lg border hairline bg-ink-850 px-2 py-1.5 text-[12.5px] text-ink-50">
          {CATEGORIES.map((c) => (
            <optgroup key={c} label={c}>{PROGRESSIVE.filter((x) => x.category === c).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
          ))}
        </select>
        <Badge tone={d.progressionBasis === 'conceptual' ? 'tertiary' : 'emerald'}>{basisLabel(d.progressionBasis)}</Badge>
        <div className="ml-auto"><Provenance kind="conceptual" /></div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <BrainViewer pathology={meshPath} highlight={highlight} mode="xray" focusHighlight initialView="oblique" />
          <Panel className="absolute bottom-4 left-4 right-4 p-3">
            <div className="flex items-center gap-3">
              <Button size="icon" onClick={() => setPlaying((p) => !p)}>{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</Button>
              <div className="flex-1">
                <Slider value={t} min={0} max={1} step={0.01} onChange={(v) => { setPlaying(false); setT(v); }} onCommit={(v) => setCommitted(v)} />
                <div className="relative mt-1 h-4">
                  {d.stages.map((s) => (
                    <button key={s.label} onClick={() => { setPlaying(false); setT(s.t); setCommitted(s.t); }} style={{ left: `${s.t * 100}%` }} className={clsx('absolute -translate-x-1/2 whitespace-nowrap text-[10.5px]', s === stage ? 'text-primary-accent' : 'text-ink-400 hover:text-ink-100')}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-1.5 text-[12px] text-ink-100">{stage.note}</div>
            <div className="mt-1 text-[10.5px] text-ink-500">Educational model, not an individual prediction. {d.progressionNote} 3D anatomy updates when you release the slider (re-meshing takes ~1–2 s); the MRI slice updates continuously.</div>
          </Panel>
        </div>
        <div className="scroll-thin flex w-[440px] shrink-0 flex-col gap-4 overflow-y-auto border-l hairline p-4">
          <div>
            <Link href={`/diseases/${d.id}`} className="font-display text-[18px] font-medium text-ink-50 hover:text-primary-accent">{d.name}</Link>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-300">{d.progression}</p>
          </div>
          <div className="aspect-square w-full">
            <ModalityPane axis={(link?.axis ?? 'axial')} cross={cross} pathology={imgPath} spec={{ modality: 'mri', seq: ((link?.modality === 'mri' && link.sequence) || 'T1') as MriSeq }} opts={opts} onCross={setCross} onScroll={() => undefined} />
          </div>
          <BiomarkerChart curves={curves} model={d.model} t={t} />
          {(BIO[id] ?? []).length > 0 && (
            <div>
              <div className="label-chip mb-2 text-ink-400">Underlying biological processes</div>
              <ol className="space-y-1.5">
                {BIO[id].map((b, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink-100"><span className="font-mono text-primary-accent">{i + 1}</span>{b}</li>
                ))}
              </ol>
            </div>
          )}
          {id === 'parkinsons' && <BasalGangliaCircuit loss={imgPath.datLoss} />}
          {!BIO[id] && <p className="text-[12px] leading-relaxed text-ink-200">{d.pathophysiology}</p>}
        </div>
      </div>
    </div>
  );
}

function BiomarkerChart({ curves, model, t }: { curves: Curve[]; model: (t: number) => Pathology; t: number }) {
  const W = 400, H = 150;
  const data = useMemo(() => {
    const samples = Array.from({ length: 41 }, (_, i) => model(i / 40));
    return curves.map((c) => ({ ...c, pts: samples.map((p, i) => `${(i / 40) * W},${H - Math.max(0, Math.min(1, c.f(p))) * (H - 10) - 4}`).join(' ') }));
  }, [curves, model]);
  return (
    <div>
      <div className="label-chip mb-1 text-ink-400">Model parameters over the timeline</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border hairline bg-ink-900/60">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={W} y1={H - g * (H - 10) - 4} y2={H - g * (H - 10) - 4} stroke="#1b1f29" />)}
        {data.map((c) => <polyline key={c.name} points={c.pts} fill="none" stroke={c.color} strokeWidth={1.8} />)}
        <line x1={t * W} x2={t * W} y1={0} y2={H} stroke="#e8ebf1" strokeDasharray="3 3" />
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {curves.map((c) => <span key={c.name} className="flex items-center gap-1 text-[10.5px] text-ink-300"><span className="h-0.5 w-3" style={{ background: c.color }} />{c.name}</span>)}
      </div>
      <div className="mt-1 text-[10px] text-ink-500">Normalised illustrative model values (0–1); ordering reflects the literature cited on the disease page, magnitudes do not.</div>
    </div>
  );
}

/** Classical rate model of the basal ganglia (Albin/DeLong). Edge weight reflects activity in this simple scheme. */
function BasalGangliaCircuit({ loss }: { loss: number }) {
  const da = 1 - loss;
  const direct = 0.4 + 0.6 * da; // D1 excitation of direct pathway
  const indirect = 1 - 0.6 * da + 0.2; // disinhibited indirect pathway
  const gpi = Math.min(1.4, 0.6 + loss * 0.8); // increased GPi output
  const thal = Math.max(0.2, 1 - loss * 0.7);
  const nodes = { ctx: [200, 20], str: [200, 80], gpe: [320, 130], stn: [320, 190], gpi: [200, 190], sn: [70, 110], th: [200, 250] } as const;
  const E = (a: keyof typeof nodes, b: keyof typeof nodes, w: number, color: string, label?: string) => {
    const [x1, y1] = nodes[a], [x2, y2] = nodes[b];
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1 + w * 4} strokeOpacity={0.35 + 0.5 * Math.min(1, w)} markerEnd="url(#arr)" />
        {label && <text x={(x1 + x2) / 2 + 6} y={(y1 + y2) / 2} fill="#6b7385" fontSize={9}>{label}</text>}
      </g>
    );
  };
  return (
    <div>
      <div className="label-chip mb-1 text-ink-400">Basal ganglia circuit (classical rate model)</div>
      <svg viewBox="0 0 400 280" className="w-full rounded-lg border hairline bg-ink-900/60">
        <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#98a0b2" /></marker></defs>
        {E('ctx', 'str', 0.8, '#4cc99a', 'glu')}
        {E('sn', 'str', da, '#f2b45a', 'dopamine')}
        {E('str', 'gpi', direct, '#f0717d', 'direct (D1)')}
        {E('str', 'gpe', indirect, '#f0717d', 'indirect (D2)')}
        {E('gpe', 'stn', 1.2 - indirect * 0.6, '#f0717d')}
        {E('stn', 'gpi', 0.4 + loss * 0.8, '#4cc99a')}
        {E('gpi', 'th', gpi, '#f0717d', 'inhibition')}
        {Object.entries(nodes).map(([k, [x, y]]) => (
          <g key={k}>
            <circle cx={x} cy={y} r={16} fill="#13161e" stroke={k === 'sn' ? '#f2b45a' : '#4a5263'} strokeOpacity={k === 'sn' ? 0.3 + 0.7 * da : 1} />
            <text x={x} y={y + 3} textAnchor="middle" fill="#e8ebf1" fontSize={9}>{({ ctx: 'Cortex', str: 'Striatum', gpe: 'GPe', stn: 'STN', gpi: 'GPi/SNr', sn: 'SNc', th: 'Thalamus' } as Record<string, string>)[k]}</text>
          </g>
        ))}
        <text x={10} y={270} fill="#98a0b2" fontSize={9}>Thalamocortical drive: {(thal * 100).toFixed(0)}% of reference</text>
      </svg>
      <div className="mt-1 text-[10px] text-ink-500">Simplified textbook model (Albin et al. 1989; DeLong 1990). Red = inhibitory, green = excitatory; line width ∝ modelled activity. Real basal ganglia dynamics (oscillations, pathway interactions) are more complex.</div>
    </div>
  );
}
