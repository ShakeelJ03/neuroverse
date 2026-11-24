'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Search, ArrowUpRight } from 'lucide-react';
import { CATEGORIES, DISEASES } from '@/data/diseases';
import { STRUCTURE_BY_ID } from '@/data/structures';
import { Badge } from '@/components/ui';

const CAT_TONE: Record<string, string> = {
  Neurodegenerative: '#c79a6b', Cerebrovascular: '#f0717d', 'Brain tumours': '#f2b45a', 'Demyelinating & inflammatory': '#8da3b5',
  'Epilepsy & seizure disorders': '#4cc99a', 'Traumatic brain injury': '#e36f8a', 'Congenital & developmental': '#a3b88f',
};

export default function DiseasesPage() {
  const [cat, setCat] = useState<string>('All');
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      DISEASES.filter((d) => (cat === 'All' || d.category === cat) && (!q || (d.name + ' ' + (d.aliases ?? []).join(' ') + ' ' + d.summary).toLowerCase().includes(q.toLowerCase()))),
    [cat, q],
  );
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1400px] px-8 py-8">
        <div className="label-chip text-ink-400">Disease laboratory</div>
        <h1 className="mt-1 font-display text-[30px] font-semibold tracking-tight text-ink-50">Neurological disease library</h1>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-200">
          {DISEASES.length} conditions across seven categories. Each page links the affected anatomy in 3D, the underlying biology, and simulated imaging across MRI, CT, PET and MRE. Pages marked <b className="text-primary-accent">comprehensive</b> have extended content; <b>core</b> pages cover every section more briefly.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border hairline bg-ink-900/70 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search diseases…" className="w-56 bg-transparent text-[12.5px] text-ink-50 placeholder:text-ink-400 focus:outline-none" />
          </div>
          {['All', ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={clsx('rounded-full border px-3 py-1 text-[12px] transition-colors', cat === c ? 'border-primary-accent/40 bg-primary-accent/10 text-primary-accent' : 'hairline text-ink-200 hover:text-ink-50')}>
              {c} {c !== 'All' && <span className="ml-1 text-ink-500">{DISEASES.filter((d) => d.category === c).length}</span>}
            </button>
          ))}
        </div>
        {CATEGORIES.filter((c) => cat === 'All' || c === cat).map((c) => {
          const items = list.filter((d) => d.category === c);
          if (!items.length) return null;
          return (
            <section key={c} className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: CAT_TONE[c] }} />
                <h2 className="font-display text-[16px] font-medium text-ink-50">{c}</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((d) => (
                  <Link key={d.id} href={`/diseases/${d.id}`} className="group glass flex flex-col rounded-xl p-4 transition-all hover:border-white/15 hover:bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-display text-[15px] font-medium text-ink-50 group-hover:text-primary-accent">{d.name}</div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-500 group-hover:text-primary-accent" />
                    </div>
                    {d.aliases?.length ? <div className="mt-0.5 truncate text-[11px] text-ink-400">{d.aliases.join(' · ')}</div> : null}
                    <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-ink-200">{d.summary}</p>
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                      <Badge tone={d.depth === 'comprehensive' ? 'primary' : 'default'}>{d.depth}</Badge>
                      {d.oftenNormalImaging && <Badge tone="amber">imaging often normal</Badge>}
                      {d.structures.slice(0, 3).map((s) => (
                        <span key={s} className="text-[10.5px] text-ink-400">{STRUCTURE_BY_ID[s]?.name}</span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
