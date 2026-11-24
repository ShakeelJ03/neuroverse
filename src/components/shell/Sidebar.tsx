'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from './Logo';
import { Activity, BookOpenCheck, Brain, Dna, GitBranch, Library, Menu, ScanLine, Info, X } from 'lucide-react';
import clsx from 'clsx';
import { useSettings } from '@/store/settings';
import { Segmented } from '@/components/ui';

const NAV = [
  { href: '/', label: 'Brain Explorer', icon: Brain, hint: '3D anatomy' },
  { href: '/atlas', label: 'Anatomy Atlas', icon: Library, hint: 'Structure reference' },
  { href: '/diseases', label: 'Disease Laboratory', icon: Dna, hint: '49 conditions' },
  { href: '/imaging', label: 'Imaging Simulator', icon: ScanLine, hint: 'MRI · CT · PET · MRE' },
  { href: '/connections', label: 'Brain Connections', icon: GitBranch, hint: 'Tracts & networks' },
  { href: '/progression', label: 'Disease Progression', icon: Activity, hint: 'Conceptual models' },
  { href: '/learn', label: 'Learning Laboratory', icon: BookOpenCheck, hint: 'Lessons & cases' },
];

export function Sidebar() {
  const path = usePathname();
  const source = useSettings((s) => s.anatomySource);
  const setSource = useSettings((s) => s.setAnatomySource);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const current = NAV.find((n) => (n.href === '/' ? path === '/' : path.startsWith(n.href)));
  const brand = (
    <div className="leading-none">
      <div className="font-serif text-[19px] font-medium tracking-[-0.01em] text-ink-50">Neuroverse</div>
      <div className="mt-1 text-[11px] italic text-ink-400">anatomy &amp; imaging lab</div>
    </div>
  );
  return (
    <>
    {/* small screens: top bar + slide-out menu */}
    <header className="relative z-30 flex shrink-0 items-center gap-2.5 border-b hairline bg-ink-900/95 px-3 py-2 lg:hidden">
      <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-100 hover:bg-white/5" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <LogoMark size={28} className="shrink-0" />
      {brand}
      {current && <span className="ml-auto truncate text-[12px] text-ink-300">{current.label}</span>}
    </header>
    {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
    <aside
      className={clsx(
        'z-50 w-[232px] shrink-0 flex-col overflow-y-auto border-r hairline bg-ink-900 lg:relative lg:z-20 lg:flex lg:bg-ink-900/95',
        open ? 'fixed inset-y-0 left-0 flex' : 'hidden',
      )}
    >
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <LogoMark size={34} className="shrink-0" />
        {brand}
        <button onClick={() => setOpen(false)} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-ink-300 hover:bg-white/5 lg:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 px-2.5">
        <div className="label-chip px-2.5 pb-2 text-ink-400">Workspace</div>
        {NAV.map((n) => {
          const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors',
                active ? 'bg-white/[0.055] text-ink-50' : 'text-ink-200 hover:bg-white/[0.03] hover:text-ink-50',
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary-accent" />}
              <Icon className={clsx('h-4 w-4 shrink-0', active ? 'text-primary-accent' : 'text-ink-300 group-hover:text-ink-100')} strokeWidth={1.7} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{n.label}</div>
                <div className="truncate text-[11px] text-ink-400">{n.hint}</div>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="mx-3 mt-3 rounded-lg border hairline bg-ink-850 p-3">
        <div className="label-chip pb-2 text-ink-400">Anatomy source</div>
        <Segmented
          value={source}
          size="sm"
          className="w-full"
          onChange={(v) => setSource(v)}
          options={[
            { value: 'atlas', label: 'MNI atlas' },
            { value: 'model', label: 'Model' },
          ]}
        />
        <p className="mt-2 text-[10.5px] leading-relaxed text-ink-400">
          {source === 'atlas'
            ? 'MNI152 template + Harvard–Oxford labels (population average). Used in 3D and imaging.'
            : 'Hand-built parametric shapes (cleaner, schematic). Malformations always use this model.'}
        </p>
      </div>
      <div className="m-3 rounded-lg border hairline bg-ink-850 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-accent">
          <Info className="h-3.5 w-3.5" /> Educational use only
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-300">
          Anatomy comes from a population-average atlas or a parametric model, and all scans are physics-based <em>synthetic</em> simulations — never patient data.{' '}
          <Link href="/about" className="text-primary-accent hover:underline">
            Provenance
          </Link>
        </p>
      </div>
    </aside>
    </>
  );
}
