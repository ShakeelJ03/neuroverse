'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Boxes, Check, ChevronRight, GraduationCap, RotateCcw, Stethoscope } from 'lucide-react';
import { Panel } from '@/components/ui';
import { useProgress } from '@/store/progress';
import { TOURS } from '@/data/learning';
import { LESION_CASES } from '@/data/lesionCases';
import { Dissection } from './Dissection';
import { LesionCases } from './LesionCases';

type Mode = { kind: 'home' } | { kind: 'tour'; id: string } | { kind: 'explode' } | { kind: 'cases' };

export function Learn() {
  const { tourSteps, toggleStep, casesStudied, reset } = useProgress();
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: 'home' });
  useEffect(() => {
    setHydrated(true);
    const lesson = new URLSearchParams(window.location.search).get('lesson');
    if (lesson === 'explode') setMode({ kind: 'explode' });
    if (lesson === 'cases') setMode({ kind: 'cases' });
  }, []);

  if (mode.kind === 'explode' || mode.kind === 'cases')
    return (
      <div className="scroll-thin h-full overflow-y-auto px-3 py-3 lg:overflow-hidden lg:px-6 lg:py-4">
        {mode.kind === 'explode' ? <Dissection onExit={() => setMode({ kind: 'home' })} /> : <LesionCases onExit={() => setMode({ kind: 'home' })} />}
      </div>
    );

  const totalSteps = TOURS.reduce((a, t) => a + t.steps.length, 0);
  const doneSteps = hydrated ? TOURS.reduce((a, t) => a + (tourSteps[t.id]?.length ?? 0), 0) : 0;
  const studied = hydrated ? casesStudied.length : 0;

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1300px] px-4 py-5 lg:px-8 lg:py-7">
        <div className="label-chip text-ink-400">Learning laboratory</div>
        <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-ink-50">Learn by exploring</h1>
        <p className="mt-1 text-[13px] text-ink-300">Interactive lessons with explanations at every step. Nothing is graded.</p>

        {mode.kind === 'home' && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Activity
                icon={<Boxes className="h-5 w-5 text-primary-accent" />}
                title="Take the brain apart"
                text="An animated exploded view in 8 steps: hemispheres, lobes, deep nuclei, limbic system, ventricles, brainstem and cerebellum."
                onClick={() => setMode({ kind: 'explode' })}
              />
              <Activity
                icon={<Stethoscope className="h-5 w-5 text-primary-accent" />}
                title="Where’s the lesion?"
                text={`${LESION_CASES.length} clinical stories. Work out where one lesion explains the symptoms, then see the reasoning, the 3D location and the scan.`}
                meta={`${studied} of ${LESION_CASES.length} cases studied`}
                pct={studied / LESION_CASES.length}
                onClick={() => setMode({ kind: 'cases' })}
              />
            </div>
            <h2 className="mt-8 font-display text-[16px] text-ink-50">Guided tours</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {TOURS.map((t) => {
                const done = hydrated ? tourSteps[t.id]?.length ?? 0 : 0;
                return (
                  <button key={t.id} onClick={() => setMode({ kind: 'tour', id: t.id })} className="glass rounded-xl p-4 text-left transition-colors hover:bg-white/[0.03]">
                    <GraduationCap className="h-5 w-5 text-primary-accent" />
                    <div className="mt-2 font-display text-[15px] text-ink-50">{t.title}</div>
                    <p className="mt-1 text-[12px] text-ink-300">{t.summary}</p>
                    <div className="mt-3 h-1 rounded bg-white/5"><div className="h-1 rounded bg-primary-accent" style={{ width: `${(done / t.steps.length) * 100}%` }} /></div>
                    <div className="mt-1 text-[11px] text-ink-400">{done} of {t.steps.length} steps</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 text-[11.5px] text-ink-400">
              {doneSteps} of {totalSteps} tour steps done · {studied} cases studied ·{' '}
              <button onClick={reset} className="inline-flex items-center gap-1 hover:text-rose-accent"><RotateCcw className="h-3 w-3" /> Reset</button>
              <span className="ml-2 text-ink-500">Progress is stored only in this browser.</span>
            </div>
          </>
        )}

        {mode.kind === 'tour' && (() => {
          const t = TOURS.find((x) => x.id === mode.id)!;
          const done = new Set(tourSteps[t.id] ?? []);
          return (
            <div className="mt-6">
              <button onClick={() => setMode({ kind: 'home' })} className="text-[12px] text-ink-400 hover:text-ink-100">← All activities</button>
              <h2 className="mt-2 font-display text-[20px] text-ink-50">{t.title}</h2>
              <div className="mt-4 space-y-2">
                {t.steps.map((s, i) => (
                  <Panel key={i} className="flex items-start gap-4 p-4">
                    <button onClick={() => toggleStep(t.id, i)} className={clsx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border', done.has(i) ? 'border-emerald-accent bg-emerald-accent/20 text-emerald-accent' : 'border-white/20 text-ink-400')} title="Mark complete">
                      {done.has(i) ? <Check className="h-3.5 w-3.5" /> : <span className="text-[11px]">{i + 1}</span>}
                    </button>
                    <div className="flex-1">
                      <div className="font-medium text-ink-50">{s.title}</div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-200">{s.body}</p>
                    </div>
                    <Link href={s.href} onClick={() => !done.has(i) && toggleStep(t.id, i)} className="shrink-0 rounded-lg border border-primary-accent/30 bg-primary-accent/5 px-3 py-1.5 text-[12px] text-primary-accent hover:bg-primary-accent/10">{s.cta} →</Link>
                  </Panel>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function Activity({ icon, title, text, meta, pct, onClick }: { icon: React.ReactNode; title: string; text: string; meta?: string; pct?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="glass flex items-start gap-4 rounded-xl p-4 text-left transition-colors hover:bg-white/[0.03]">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary-accent/25 to-tertiary-accent/15 ring-1 ring-white/10">{icon}</div>
      <div className="flex-1">
        <div className="font-display text-[15px] text-ink-50">{title}</div>
        <p className="mt-0.5 text-[12px] text-ink-300">{text}</p>
        {meta && (
          <>
            <div className="mt-2 h-1 rounded bg-white/5"><div className="h-1 rounded bg-primary-accent" style={{ width: `${Math.round((pct ?? 0) * 100)}%` }} /></div>
            <div className="mt-1 text-[11px] text-ink-400">{meta}</div>
          </>
        )}
      </div>
      <ChevronRight className="mt-1 h-4 w-4 text-ink-500" />
    </button>
  );
}
