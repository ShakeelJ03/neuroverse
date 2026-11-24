'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowLeft, ArrowUpRight, Pause, Play, ScanLine, Activity, Brain } from 'lucide-react';
import { BrainViewer } from '@/components/brain/BrainViewer';
import { DISEASE_BY_ID } from '@/data/diseases';
import { STRUCTURE_BY_ID } from '@/data/structures';
import { ref, radiopaedia } from '@/data/references';
import { emptyPathology } from '@/lib/anatomy/model';
import { requestMeshes } from '@/lib/anatomy/useBrainMeshes';
import { Badge, Button, Panel, Provenance, Segmented, SectionTitle, Slider } from '@/components/ui';

const HEALTHY = emptyPathology();
const SECTIONS = [
  ['overview', 'Overview'], ['epidemiology', 'Epidemiology'], ['pathophysiology', 'Pathophysiology'], ['structures', 'Anatomy affected'],
  ['cellular', 'Cellular & tissue'], ['macroscopic', 'Macroscopic'], ['clinical', 'Clinical'], ['progression', 'Progression'],
  ['imaging', 'Imaging findings'], ['differentials', 'Differentials'], ['refs', 'References'],
] as const;

export function DiseaseDetail({ id }: { id: string }) {
  const d = DISEASE_BY_ID[id];
  const [t, setT] = useState(d.stages[d.stages.length - 1].t);
  const [view, setView] = useState<'disease' | 'split'>('disease');
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState<(typeof SECTIONS)[number][0]>('overview');
  const pathology = useMemo(() => d.model(t), [d, t]);

  const highlight = useMemo(() => {
    const h: Record<string, string> = {};
    d.structures.forEach((s) => STRUCTURE_BY_ID[s]?.meshes.forEach((m) => (h[m] = '#f0717d')));
    return h;
  }, [d]);

  // prefetch stage meshes so the animated comparison is smooth
  useEffect(() => {
    // visible state first, then the remaining stages one after another
    let cancelled = false;
    (async () => {
      await requestMeshes(d.model(d.stages[d.stages.length - 1].t), 'high').catch(() => undefined);
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
    if (!playing || d.stages.length < 2) return;
    let i = 0;
    const iv = setInterval(() => {
      i = (i + 1) % d.stages.length;
      setT(d.stages[i].t);
    }, 1800);
    return () => clearInterval(iv);
  }, [playing, d]);

  const stage = d.stages.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a), d.stages[0]);

  return (
    <div className="flex h-full">
      {/* 3D */}
      <div className="relative min-w-0 flex-1">
        {view === 'disease' ? (
          <BrainViewer pathology={pathology} highlight={highlight} mode="xray" focusHighlight initialView="oblique" />
        ) : (
          <div className="grid h-full grid-cols-2">
            <div className="relative border-r hairline">
              <BrainViewer pathology={HEALTHY} highlight={highlight} mode="xray" focusHighlight initialView="oblique" />
              <div className="absolute left-4 top-16 rounded-md bg-ink-900/80 px-2 py-1 text-[11.5px] text-ink-100">Healthy reference</div>
            </div>
            <div className="relative">
              <BrainViewer pathology={pathology} highlight={highlight} mode="xray" focusHighlight initialView="oblique" />
              <div className="absolute left-4 top-16 rounded-md bg-ink-900/80 px-2 py-1 text-[11.5px] text-rose-accent">{d.name} · {stage.label}</div>
            </div>
          </div>
        )}
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <Link href="/diseases" className="glass inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] text-ink-200 hover:text-ink-50"><ArrowLeft className="h-3.5 w-3.5" /> Library</Link>
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'disease', label: 'Disease' }, { value: 'split', label: 'Healthy vs disease' }]} />
          <Provenance kind="conceptual" />
        </div>
        {d.stages.length > 1 && (
          <Panel className="absolute bottom-4 left-4 right-4 mx-auto max-w-2xl p-3">
            <div className="flex items-center gap-3">
              <Button size="icon" onClick={() => setPlaying((p) => !p)} title="Animate stages">{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}</Button>
              <div className="flex-1">
                <Slider value={t} min={0} max={1} step={0.01} onChange={(v) => { setPlaying(false); setT(v); }} />
                <div className="mt-1 flex justify-between">
                  {d.stages.map((s) => (
                    <button key={s.label} onClick={() => { setPlaying(false); setT(s.t); }} className={clsx('text-[10.5px]', s === stage ? 'text-primary-accent' : 'text-ink-400 hover:text-ink-100')}>{s.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[11.5px] text-ink-200">{stage.note}</div>
            <div className="mt-1 text-[10.5px] text-ink-500">{basisLabel(d.progressionBasis)} — {d.progressionNote}</div>
          </Panel>
        )}
        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg bg-ink-900/70 px-2 py-1 text-[11px] text-ink-300 backdrop-blur">
          <span className="h-2 w-2 rounded-sm bg-rose-accent" /> affected structures · lesions in colour
        </div>
      </div>

      {/* text */}
      <div className="flex w-[480px] shrink-0 flex-col border-l hairline bg-ink-900/60">
        <div className="border-b hairline px-5 pb-3 pt-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="tertiary">{d.category}</Badge>
            <Badge tone={d.depth === 'comprehensive' ? 'primary' : 'default'}>{d.depth} entry</Badge>
          </div>
          <h1 className="mt-2 font-display text-[24px] font-semibold tracking-tight text-ink-50">{d.name}</h1>
          {d.aliases?.length ? <div className="text-[12px] text-ink-400">{d.aliases.join(' · ')}</div> : null}
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-200">{d.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {d.imagingLinks.map((l, i) => (
              <Link key={i} href={`/imaging?disease=${d.id}&modality=${l.modality}${l.sequence ? `&seq=${l.sequence}` : ''}${l.axis ? `&axis=${l.axis}` : ''}`} className="inline-flex items-center gap-1 rounded-md border border-primary-accent/30 bg-primary-accent/5 px-2 py-1 text-[11.5px] text-primary-accent hover:bg-primary-accent/10">
                <ScanLine className="h-3 w-3" /> {l.modality.toUpperCase()}{l.sequence ? ` ${l.sequence}` : ''}
              </Link>
            ))}
            <Link href={`/progression?disease=${d.id}`} className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-[11.5px] text-ink-100 hover:text-primary-accent"><Activity className="h-3 w-3" /> Progression</Link>
            <a href={radiopaedia(d.name)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border hairline px-2 py-1 text-[11.5px] text-ink-100 hover:text-primary-accent">Radiopaedia <ArrowUpRight className="h-3 w-3" /></a>
          </div>
        </div>
        <div className="scroll-thin flex gap-1 overflow-x-auto border-b hairline px-3 py-2">
          {SECTIONS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={clsx('shrink-0 rounded-md px-2 py-1 text-[11.5px]', tab === k ? 'bg-white/[0.08] text-ink-50' : 'text-ink-400 hover:text-ink-100')}>{label}</button>
          ))}
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-relaxed text-ink-100">
          {tab === 'overview' && <p>{d.overview}</p>}
          {tab === 'epidemiology' && <p>{d.epidemiology}</p>}
          {tab === 'pathophysiology' && <p>{d.pathophysiology}</p>}
          {tab === 'cellular' && <p>{d.cellular}</p>}
          {tab === 'macroscopic' && <p>{d.macroscopic}</p>}
          {tab === 'progression' && (
            <div className="space-y-3">
              <p>{d.progression}</p>
              <div className="rounded-lg border border-tertiary-accent/25 bg-tertiary-accent/5 p-3 text-[12px] text-tertiary-accent">{basisLabel(d.progressionBasis)}: {d.progressionNote}</div>
            </div>
          )}
          {tab === 'structures' && (
            <div className="space-y-2">
              {d.structures.map((s) => STRUCTURE_BY_ID[s] && (
                <Link key={s} href={`/?s=${s}`} className="flex items-center justify-between rounded-lg border hairline p-2.5 hover:border-primary-accent/30">
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: STRUCTURE_BY_ID[s].color }} /> {STRUCTURE_BY_ID[s].name}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary-accent"><Brain className="h-3 w-3" /> Explore</span>
                </Link>
              ))}
            </div>
          )}
          {tab === 'clinical' && <ul className="space-y-1.5">{d.clinical.map((c) => <li key={c} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary-accent" />{c}</li>)}</ul>}
          {tab === 'imaging' && (
            <div className="space-y-2.5">
              {d.oftenNormalImaging && <div className="rounded-lg border border-amber-accent/25 bg-amber-accent/5 p-2.5 text-[12px] text-amber-accent">Conventional structural imaging is often normal in this condition.</div>}
              {d.imaging.map((f, i) => (
                <div key={i} className="rounded-lg border hairline bg-white/[0.02] p-3">
                  <div className="flex items-center gap-1.5"><Badge tone="secondary">{f.modality}</Badge><Badge tone={f.evidence === 'established' ? 'emerald' : f.evidence === 'supportive' ? 'primary' : 'amber'}>{f.evidence === 'research' ? 'research finding' : f.evidence}</Badge></div>
                  <p className="mt-1.5 text-[12.5px]">{f.finding}</p>
                </div>
              ))}
              <p className="text-[11px] text-ink-500">“Established” = accepted clinical imaging finding; “supportive” = adjunct/supportive feature; “research finding” = reported in studies but not a clinical criterion.</p>
            </div>
          )}
          {tab === 'differentials' && <ul className="space-y-1.5">{d.differentials.map((c) => <li key={c} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-tertiary-accent" />{c}</li>)}</ul>}
          {tab === 'refs' && (
            <ol className="space-y-2">
              {d.refs.map((r, i) => (
                <li key={r} className="text-[12px] text-ink-200"><span className="mr-1 font-mono text-ink-500">[{i + 1}]</span><a href={ref(r).url} target="_blank" rel="noreferrer" className="hover:text-primary-accent">{ref(r).cite}</a></li>
              ))}
              <li className="text-[12px] text-ink-200"><a href={radiopaedia(d.name)} target="_blank" rel="noreferrer" className="hover:text-primary-accent">Radiopaedia articles on “{d.name}”</a></li>
            </ol>
          )}
          <SectionTitle className="mt-6">About the 3D model</SectionTitle>
          <p className="text-[11.5px] text-ink-400">Structural changes shown are an illustrative, parameterised representation of the established pattern of involvement. They are not derived from any patient and do not reproduce exact biological progression.</p>
        </div>
      </div>
    </div>
  );
}

export const basisLabel = (b: string) =>
  b === 'imaging-timecourse' ? 'Based on an established imaging time course' : b === 'pathological-staging' ? 'Ordered by a published pathological staging scheme' : b === 'longitudinal-cohort' ? 'Direction consistent with longitudinal cohort data' : 'Conceptual educational model';
