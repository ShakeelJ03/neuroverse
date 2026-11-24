'use client';
import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Pause, Play, Shrink } from 'lucide-react';
import { BrainViewer } from '@/components/brain/BrainViewer';
import { StructureDetail } from '@/components/brain/StructureDetail';
import { Button, Panel, Slider } from '@/components/ui';
import { emptyPathology } from '@/lib/anatomy/model';
import { MESH_TO_STRUCTURE, STRUCTURE_BY_ID } from '@/data/structures';
import { BASAL_GANGLIA, BRAINSTEM, CORTEX, DEEP_WM, DIENCEPHALON, GLANDS, LIMBIC, STAGES, VENTRICLES } from '@/data/dissection';

type V = [number, number, number];
const ALL_MESHES = [...new Set([...CORTEX, ...BASAL_GANGLIA, ...DIENCEPHALON, ...LIMBIC, ...VENTRICLES, ...BRAINSTEM, ...DEEP_WM, ...GLANDS, 'cerebellum'])];
// must match the viewer's list of pieces that are never split
const MIDLINE = new Set(['corpus-callosum', 'third-ventricle', 'fourth-ventricle', 'midbrain', 'pons', 'medulla', 'pineal-gland', 'pituitary-gland', 'hypothalamus', 'cerebellum', 'fornix']);
const AUTO_MS = 11000;
const colourOf = (mesh: string) => STRUCTURE_BY_ID[MESH_TO_STRUCTURE[mesh]]?.color ?? '#a6a4a6';

export function Dissection({ onExit }: { onExit: () => void }) {
  const [stage, setStage] = useState(0);
  const [spread, setSpread] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [picked, setPicked] = useState<string | null>(null); // structure id
  const pathology = useMemo(() => emptyPathology(), []);
  const st = STAGES[stage];

  useEffect(() => {
    if (!playing) return;
    if (stage >= STAGES.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), AUTO_MS);
    return () => clearTimeout(t);
  }, [playing, stage]);

  const offsets = useMemo(() => {
    const o: Record<string, V> = {};
    const scale = (v: V): V => [v[0] * spread, v[1] * spread, v[2] * spread];
    for (const id of ALL_MESHES) {
      if (MIDLINE.has(id)) o[id] = scale(st.layout(id, 0));
      else {
        o[`${id}|L`] = scale(st.layout(id, -1));
        o[`${id}|R`] = scale(st.layout(id, 1));
      }
    }
    return o;
  }, [st, spread]);

  const highlight = useMemo(() => Object.fromEntries(st.spotlight.map((m) => [m, colourOf(m)])), [st]);
  const opacity = useMemo(() => Object.fromEntries((st.fade ?? []).map((m) => [m, 0.07])), [st]);
  const selectedMeshes = picked ? STRUCTURE_BY_ID[picked]?.meshes ?? [] : [];

  const go = (d: number) => {
    setPicked(null);
    setStage((s) => Math.max(0, Math.min(STAGES.length - 1, s + d)));
  };

  return (
    <div className="flex h-full flex-col">
      <button onClick={onExit} className="self-start text-[12px] text-ink-400 hover:text-ink-100">← All activities</button>
      <div className="mt-2">
        <h2 className="font-display text-[20px] text-ink-50">Take the brain apart</h2>
        <p className="text-[12px] text-ink-300">An exploded view, one system at a time. Drag to rotate, scroll to zoom, click any piece to read about it.</p>
      </div>
      <div className="mt-3 grid min-h-[520px] flex-1 grid-cols-[1fr_380px] gap-3">
        <Panel className="relative overflow-hidden">
          <BrainViewer
            pathology={pathology}
            splitSides
            offsets={offsets}
            highlight={highlight}
            focusHighlight={st.spotlight.length > 0}
            opacity={opacity}
            selected={selectedMeshes}
            mode={st.id === 'all' ? 'atlas' : 'anatomical'}
            initialView="oblique"
            distanceScale={1.45}
            onSelectMesh={(id) => {
              const s = id ? MESH_TO_STRUCTURE[id] : null;
              setPicked(s && STRUCTURE_BY_ID[s] ? s : null);
            }}
          />
          <div className="absolute left-3 top-3 flex flex-col gap-1">
            {STAGES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setPicked(null); setStage(i); }}
                className={clsx(
                  'flex items-center gap-2 rounded-md px-2 py-1 text-left text-[11.5px] backdrop-blur transition-colors',
                  i === stage ? 'bg-primary-accent/15 text-primary-accent' : 'bg-ink-900/60 text-ink-300 hover:text-ink-50',
                )}
              >
                <span className={clsx('grid h-4 w-4 place-items-center rounded-full text-[9.5px]', i === stage ? 'bg-primary-accent text-ink-950' : i < stage ? 'bg-white/20 text-ink-100' : 'bg-white/5')}>{i + 1}</span>
                {s.title}
              </button>
            ))}
          </div>
          <div className="glass absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl px-3 py-2">
            <Button size="sm" onClick={() => go(-1)} disabled={stage === 0} title="Previous step"><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={() => setPlaying((p) => !p)} title={playing ? 'Pause' : 'Play the lesson'}>
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {playing ? 'Pause' : 'Play'}
            </Button>
            <Button size="sm" onClick={() => go(1)} disabled={stage === STAGES.length - 1} title="Next step"><ChevronRight className="h-3.5 w-3.5" /></Button>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <div className="w-40"><Slider label="Spread" value={spread} min={0} max={1.8} step={0.05} onChange={setSpread} format={(v) => `${Math.round(v * 100)}%`} /></div>
            <span className="mx-1 h-5 w-px bg-white/10" />
            <Button size="sm" onClick={() => { setPlaying(false); setPicked(null); setStage(0); }} title="Put everything back together"><Shrink className="h-3.5 w-3.5" /> Reassemble</Button>
          </div>
        </Panel>

        <Panel className="scroll-thin flex flex-col overflow-y-auto p-4">
          {picked ? (
            <div>
              <button onClick={() => setPicked(null)} className="mb-3 text-[12px] text-ink-400 hover:text-ink-100">← Back to step {stage + 1}</button>
              <StructureDetail s={STRUCTURE_BY_ID[picked]} compact onNavigate={(id) => setPicked(id)} />
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="label-chip text-ink-400">Step {stage + 1} of {STAGES.length}</div>
              <h3 className="mt-1 font-display text-[19px] text-ink-50">{st.title}</h3>
              {playing && <div className="mt-2 h-0.5 overflow-hidden rounded bg-white/5"><div key={stage} className="h-full animate-[nvprogress_11s_linear] bg-primary-accent" /></div>}
              <p className="mt-3 text-[13px] leading-relaxed text-ink-100">{st.text}</p>
              {st.chips.length > 0 && (
                <div className="mt-4">
                  <div className="label-chip pb-2 text-ink-400">In this step — click to read more</div>
                  <div className="flex flex-wrap gap-1.5">
                    {st.chips.map((c) => {
                      const s = STRUCTURE_BY_ID[c];
                      if (!s) return null;
                      return (
                        <button key={c} onClick={() => setPicked(c)} className="inline-flex items-center gap-1.5 rounded-md border hairline bg-white/[0.03] px-2 py-1 text-[12px] text-ink-100 hover:border-primary-accent/40 hover:text-primary-accent">
                          <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} /> {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="mt-auto pt-6 text-[10.5px] leading-relaxed text-ink-500">Pieces are displaced for teaching; distances between them are not anatomical. Shapes follow the anatomy source chosen in the sidebar.</p>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
