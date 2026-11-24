'use client';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { Search, Brain } from 'lucide-react';
import { BrainViewer } from './BrainViewer';
import { StructureDetail } from './StructureDetail';
import { emptyPathology } from '@/lib/anatomy/model';
import { STRUCTURES, STRUCTURE_BY_ID, Category } from '@/data/structures';
import { Panel, Segmented } from '@/components/ui';

const HEALTHY = emptyPathology();
const CATS: Category[] = ['Cerebral cortex', 'Subcortical structures', 'Other structures', 'White matter'];

export function Atlas() {
  const params = useSearchParams();
  const router = useRouter();
  const [id, setId] = useState(params.get('s') ?? 'hippocampus');
  const [q, setQ] = useState('');
  const [context, setContext] = useState<'isolated' | 'context'>('context');
  const s = STRUCTURE_BY_ID[id] ?? STRUCTURE_BY_ID.hippocampus;
  const list = useMemo(() => STRUCTURES.filter((x) => !q || (x.name + x.aliases.join(' ')).toLowerCase().includes(q.toLowerCase())), [q]);
  const pick = (n: string) => {
    setId(n);
    router.replace(`/atlas?s=${n}`, { scroll: false });
  };
  const hl = useMemo(() => Object.fromEntries(s.meshes.map((m) => [m, s.color])), [s]);
  return (
    <div className="flex h-full">
      <div className="flex w-[280px] shrink-0 flex-col border-r hairline bg-ink-900/60">
        <div className="border-b hairline p-3">
          <div className="label-chip mb-2 text-ink-400">Anatomy atlas · {STRUCTURES.length} entries</div>
          <div className="flex items-center gap-2 rounded-lg border hairline bg-ink-900/70 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full bg-transparent text-[12.5px] text-ink-50 placeholder:text-ink-400 focus:outline-none" />
          </div>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-2">
          {CATS.map((c) => (
            <div key={c} className="mb-3">
              <div className="label-chip px-2 pb-1 text-ink-500">{c}</div>
              {list.filter((x) => x.category === c).map((x) => (
                <button key={x.id} onClick={() => pick(x.id)} className={clsx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]', x.id === s.id ? 'bg-primary-accent/10 text-primary-accent' : 'text-ink-100 hover:bg-white/[0.04]')}>
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: x.color }} />
                  <span className="truncate">{x.name}</span>
                  {x.parent && <span className="ml-auto truncate text-[10px] text-ink-500">{STRUCTURE_BY_ID[x.parent]?.name}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1300px] grid-cols-1 gap-6 p-6 xl:grid-cols-[1fr_440px]">
          <div className="min-w-0">
            <StructureDetail s={s} onNavigate={pick} />
          </div>
          <div className="space-y-3 xl:sticky xl:top-6 xl:self-start">
            <Panel className="relative aspect-square overflow-hidden">
              {s.meshes.length ? (
                <BrainViewer
                  key={s.id + context}
                  pathology={HEALTHY}
                  isolate={context === 'isolated' ? s.meshes : null}
                  highlight={context === 'context' ? hl : {}}
                  focusHighlight={context === 'context'}
                  mode={context === 'context' ? 'xray' : 'atlas'}
                  autoFocus={s.meshes}
                  initialView="left"
                  labels={context === 'isolated'}
                />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center text-[12.5px] text-ink-300">
                  This pathway is visualised as tractography streamlines in the Brain Connections module.
                  <Link href="/connections" className="mt-2 text-primary-accent hover:underline">Open Brain Connections →</Link>
                </div>
              )}
              {s.meshes.length > 0 && (
                <div className="absolute left-3 top-3">
                  <Segmented size="sm" value={context} onChange={setContext} options={[{ value: 'context', label: 'In context' }, { value: 'isolated', label: 'Isolated' }]} />
                </div>
              )}
            </Panel>
            {s.meshes.length > 0 && (
              <Link href={`/?s=${s.id}`} className="glass flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12.5px] text-primary-accent hover:bg-white/[0.03]">
                <Brain className="h-4 w-4" /> Open in Brain Explorer
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
