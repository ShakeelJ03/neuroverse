'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Check, Eye, Lightbulb, MapPin, RotateCcw } from 'lucide-react';
import { BrainViewer, RenderMode } from '@/components/brain/BrainViewer';
import { ModalityPane, PaneOpts } from '@/components/imaging/ModalityPane';
import { Badge, Button, Panel, Segmented } from '@/components/ui';
import { LESION_CASES, LesionCase, casePathology } from '@/data/lesionCases';
import { MESH_TO_STRUCTURE, STRUCTURE_BY_ID } from '@/data/structures';
import { DISEASE_BY_ID } from '@/data/diseases';
import { useProgress } from '@/store/progress';
import type { Axis } from '@/lib/imaging/slice';
import type { V3 } from '@/lib/anatomy/sdf';

const LEVEL_NAME = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' } as const;
const paneOpts: PaneOpts = { wl: { ct: [80, 40] }, setWL: () => undefined, petBase: 'mri', petOpacity: 0.7, petCmap: 'hot', mreOpacity: 0.7, tool: 'cross' };
const AXIS_INDEX: Record<Axis, number> = { sagittal: 0, axial: 1, coronal: 2 };

export function LesionCases({ onExit }: { onExit: () => void }) {
  const { casesStudied, markStudied } = useProgress();
  const [caseId, setCaseId] = useState(LESION_CASES[0].id);
  const c = LESION_CASES.find((x) => x.id === caseId)!;
  return (
    <div className="flex h-full flex-col">
      <button onClick={onExit} className="self-start text-[12px] text-ink-400 hover:text-ink-100">← All activities</button>
      <div className="mt-2">
        <h2 className="font-display text-[20px] text-ink-50">Where’s the lesion?</h2>
        <p className="text-[12px] text-ink-300">Read the story, decide where one lesion would explain everything, then reveal the reasoning and the scan.</p>
      </div>
      <div className="mt-3 grid min-h-[540px] flex-1 grid-cols-[210px_1fr_390px] gap-3">
        <Panel className="scroll-thin overflow-y-auto p-2">
          {([1, 2, 3] as const).map((lvl) => (
            <div key={lvl} className="mb-2">
              <div className="label-chip px-2 py-1.5 text-ink-400">{LEVEL_NAME[lvl]}</div>
              {LESION_CASES.filter((x) => x.level === lvl).map((x) => (
                <button
                  key={x.id}
                  onClick={() => setCaseId(x.id)}
                  className={clsx('flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors', x.id === caseId ? 'bg-primary-accent/12 text-primary-accent' : 'text-ink-200 hover:bg-white/[0.03] hover:text-ink-50')}
                >
                  <span className="mt-0.5 w-3 shrink-0">{casesStudied.includes(x.id) && <Check className="h-3 w-3 text-emerald-accent" />}</span>
                  {x.title}
                </button>
              ))}
            </div>
          ))}
        </Panel>
        <CaseView key={c.id} c={c} onRevealed={() => markStudied(c.id)} />
      </div>
    </div>
  );
}

function CaseView({ c, onRevealed }: { c: LesionCase; onRevealed: () => void }) {
  const pathology = useMemo(() => casePathology(c), [c]);
  const [revealed, setRevealed] = useState(false);
  const [mark, setMark] = useState<{ p: V3; mesh: string } | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const [mode, setMode] = useState<RenderMode>('anatomical');
  const [cross, setCross] = useState<V3>(c.lesion.center);
  useEffect(() => { if (revealed) onRevealed(); }, [revealed, onRevealed]);

  const lit = step !== null ? c.steps[step].structures : revealed ? c.structures : [];
  const highlight = useMemo(() => {
    const h: Record<string, string> = {};
    for (const s of lit) for (const m of STRUCTURE_BY_ID[s]?.meshes ?? []) h[m] = STRUCTURE_BY_ID[s].color;
    return h;
  }, [lit]);

  const dist = mark ? Math.round(Math.hypot(mark.p[0] - c.lesion.center[0], mark.p[1] - c.lesion.center[1], mark.p[2] - c.lesion.center[2])) : null;
  const markedName = mark ? STRUCTURE_BY_ID[MESH_TO_STRUCTURE[mark.mesh]]?.name ?? 'brain' : null;
  const sameSide = mark ? Math.sign(mark.p[0]) === Math.sign(c.lesion.center[0]) || Math.abs(c.lesion.center[0]) < 4 : false;

  const extra = (
    <>
      {mark && (
        <mesh position={mark.p}>
          <sphereGeometry args={[3.2, 20, 20]} />
          <meshBasicMaterial color="#e6b450" depthTest={false} transparent opacity={0.95} />
        </mesh>
      )}
    </>
  );

  return (
    <>
      <div className="grid min-h-0 grid-rows-[1fr_auto] gap-3">
        <Panel className="relative min-h-[300px] overflow-hidden">
          <BrainViewer
            pathology={pathology}
            showLesions={revealed}
            highlight={highlight}
            focusHighlight={lit.length > 0}
            mode={mode}
            initialView={c.view}
            extra={extra}
            onSelectMesh={(id, e) => {
              if (revealed || !id || !e || id.startsWith('lesion:')) return;
              setMark({ p: [e.point.x, e.point.y, -e.point.z], mesh: id });
            }}
          />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'anatomical', label: 'Surface' }, { value: 'xray', label: 'X-ray' }]} />
            {!revealed && <span className="glass rounded-md px-2 py-1 text-[11px] text-ink-300"><MapPin className="mr-1 inline h-3 w-3 text-amber-accent" />Click the brain to mark your guess (optional)</span>}
          </div>
        </Panel>
        {revealed && (
          <div className="h-[300px]">
            <ModalityPane
              axis={c.scan.axis}
              cross={cross}
              pathology={pathology}
              spec={{ modality: 'mri', seq: c.scan.seq }}
              opts={paneOpts}
              onCross={setCross}
              onScroll={(axis, d) => setCross((p) => { const n = [...p] as V3; n[AXIS_INDEX[axis]] += d * 2; return n; })}
              label="Simulated scan of this case"
            />
          </div>
        )}
      </div>

      <Panel className="scroll-thin overflow-y-auto p-4">
        <Badge tone="tertiary">{LEVEL_NAME[c.level]}</Badge>
        <h3 className="mt-2 font-display text-[18px] text-ink-50">{c.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-100">{c.presentation}</p>
        <div className="label-chip mt-4 pb-1.5 text-ink-400">On examination</div>
        <ul className="space-y-1">
          {c.findings.map((f) => (
            <li key={f} className="flex gap-2 text-[12.5px] text-ink-100"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary-accent" />{f}</li>
          ))}
        </ul>

        {!revealed ? (
          <div className="mt-5 rounded-lg border border-primary-accent/25 bg-primary-accent/5 p-3">
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-50"><Lightbulb className="h-4 w-4 text-primary-accent" /> Think first</div>
            <p className="mt-1 text-[12px] text-ink-300">Which side? Cortex, deep structures or brainstem? What single place explains every finding?</p>
            {mark && <p className="mt-2 text-[12px] text-amber-accent">Your mark: {markedName}</p>}
            <Button size="sm" className="mt-3" onClick={() => setRevealed(true)}><Eye className="h-3.5 w-3.5" /> Reveal the reasoning</Button>
          </div>
        ) : (
          <div className="mt-5">
            <div className="label-chip pb-1.5 text-ink-400">The lesion</div>
            <p className="text-[13.5px] font-medium leading-snug text-primary-accent">{c.answer}</p>
            {mark && (
              <p className="mt-1.5 text-[12px] text-ink-300">
                You marked the {markedName?.toLowerCase()}, {dist} mm from the lesion centre{sameSide ? '' : ', on the opposite side'}.
              </p>
            )}
            <div className="label-chip mt-4 pb-1.5 text-ink-400">How to get there — click a clue to light it up</div>
            <div className="space-y-1.5">
              {c.steps.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStep(step === i ? null : i)}
                  className={clsx('w-full rounded-lg border px-3 py-2 text-left transition-colors', step === i ? 'border-primary-accent/40 bg-primary-accent/8' : 'hairline bg-white/[0.02] hover:bg-white/[0.04]')}
                >
                  <div className="text-[12.5px] font-medium text-ink-50">{s.clue}</div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-ink-200">{s.means}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-accent/25 bg-amber-accent/5 p-3 text-[12.5px] leading-relaxed text-ink-100">
              <b className="text-amber-accent">Remember: </b>{c.pearl}
            </div>
            <div className="label-chip mt-4 pb-1 text-ink-400">The scan</div>
            <p className="text-[12px] text-ink-200">{c.scan.why}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {c.disease && DISEASE_BY_ID[c.disease] && (
                <Link href={`/diseases/${c.disease}`} className="text-[12px] text-primary-accent hover:underline">Read about {DISEASE_BY_ID[c.disease].name} →</Link>
              )}
              <button onClick={() => { setRevealed(false); setMark(null); setStep(null); }} className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-ink-400 hover:text-ink-100"><RotateCcw className="h-3 w-3" /> Start this case again</button>
            </div>
            <p className="mt-4 text-[10.5px] text-ink-500">Teaching vignette, not a real patient. The scan is a physics-based simulation.</p>
          </div>
        )}
      </Panel>
    </>
  );
}
