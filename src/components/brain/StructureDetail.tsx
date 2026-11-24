'use client';
import Link from 'next/link';
import { ArrowUpRight, Network, ScanLine, Stethoscope, BookMarked } from 'lucide-react';
import { STRUCTURE_BY_ID, StructureInfo } from '@/data/structures';
import { DISEASE_BY_ID } from '@/data/diseases';
import { ref } from '@/data/references';
import { Badge, Provenance, SectionTitle } from '@/components/ui';
import { useSettings } from '@/store/settings';
import { AnatomyProvenance } from './AnatomyProvenance';
import { MESH_SOURCE_TEXT, meshSource, MeshSource } from '@/lib/atlas/labels';

function ShapeSource({ meshes }: { meshes: string[] }) {
  const pref = useSettings((st) => st.anatomySource);
  if (!meshes.length) return null;
  const kinds = [...new Set(meshes.map((m) => (pref === 'atlas' ? meshSource(m) : null)))];
  const text = pref === 'model' ? 'Parametric model shape (schematic, positioned from atlas coordinates)' : kinds.map((k) => MESH_SOURCE_TEXT[k as MeshSource]).join(' · ');
  return <div className="mt-1.5 text-[11px] text-ink-400">3D shape: {text}</div>;
}

export function StructureDetail({ s, compact, onNavigate }: { s: StructureInfo; compact?: boolean; onNavigate?: (id: string) => void }) {
  const parent = s.parent ? STRUCTURE_BY_ID[s.parent] : null;
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">{s.category}</Badge>
          {parent && (
            <button onClick={() => onNavigate?.(parent.id)} className="text-[11px] text-ink-300 hover:text-primary-accent">
              part of {parent.name} ↗
            </button>
          )}
        </div>
        <h2 className={`mt-2 font-display font-semibold tracking-tight text-ink-50 ${compact ? 'text-[20px]' : 'text-[28px]'}`}>{s.name}</h2>
        {s.aliases.length > 0 && <div className="mt-1 text-[12px] text-ink-300">{s.aliases.join(' · ')}</div>}
        {s.brodmann && <div className="mt-1 font-mono text-[11px] text-ink-400">Brodmann: {s.brodmann}</div>}
        <ShapeSource meshes={s.meshes} />
      </div>

      <Block title="Anatomical location">{s.location}</Block>
      <Block title="Description">{s.description}</Block>

      <div className={compact ? 'space-y-5' : 'grid grid-cols-2 gap-5'}>
        <List title="Physiological functions" items={s.functions} />
        <List title="Cognitive functions" items={s.cognitive.length ? s.cognitive : ['No major direct cognitive role']} />
      </div>

      <div>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5"><Network className="h-3 w-3" /> Neural connections</span>
        </SectionTitle>
        <ul className="space-y-1.5">
          {s.connections.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-ink-100">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-tertiary-accent" />
              {c.id && STRUCTURE_BY_ID[c.id] && c.id !== s.id ? (
                <button onClick={() => onNavigate?.(c.id!)} className="text-left hover:text-primary-accent">
                  {c.label}
                </button>
              ) : (
                <span>{c.label}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Block title="Clinical significance">{s.clinical}</Block>

      <div>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3 w-3" /> Diseases commonly affecting it</span>
        </SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {s.diseases.map((d) => {
            const dz = DISEASE_BY_ID[d];
            if (!dz) return null;
            return (
              <Link key={d} href={`/diseases/${d}`} className="rounded-md border hairline bg-white/[0.03] px-2 py-1 text-[11.5px] text-ink-100 transition-colors hover:border-rose-accent/40 hover:text-rose-accent">
                {dz.name}
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5"><ScanLine className="h-3 w-3" /> Imaging appearance</span>
        </SectionTitle>
        <p className="text-[12.5px] leading-relaxed text-ink-100">{s.imaging}</p>
        <Link href={`/imaging?structure=${s.id}`} className="mt-2 inline-flex items-center gap-1 text-[12px] text-primary-accent hover:underline">
          View in the imaging simulator <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div>
        <SectionTitle>
          <span className="inline-flex items-center gap-1.5"><BookMarked className="h-3 w-3" /> References</span>
        </SectionTitle>
        <ol className="space-y-1.5">
          {s.refs.map((r, i) => {
            const R = ref(r);
            return (
              <li key={r} className="text-[11.5px] leading-snug text-ink-300">
                <span className="mr-1 font-mono text-ink-500">[{i + 1}]</span>
                <a href={R.url} target="_blank" rel="noreferrer" className="hover:text-primary-accent">
                  {R.cite}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex items-center gap-2 border-t hairline pt-3 text-[11px] text-ink-400">
        <AnatomyProvenance caption="none" /> 3D shape source is shown under the title; text is referenced.
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <p className="text-[12.5px] leading-relaxed text-ink-100">{children}</p>
    </div>
  );
}
function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it} className="flex gap-2 text-[12.5px] text-ink-100">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary-accent" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
