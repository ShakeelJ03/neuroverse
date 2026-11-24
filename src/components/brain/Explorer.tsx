'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import clsx from 'clsx';
import {
  ChevronRight, Eye, ListTree, EyeOff, Focus, Layers, Maximize2, RotateCcw, Scissors, Search, Tag, X, Box, Sparkles, Rotate3d, Boxes,
} from 'lucide-react';
import Link from 'next/link';
import { BrainViewer, BrainViewerHandle, ClipState, RenderMode, ViewPreset } from './BrainViewer';
import { StructureDetail } from './StructureDetail';
import { AnatomyProvenance } from './AnatomyProvenance';
import { emptyPathology } from '@/lib/anatomy/model';
import { MESH_TO_STRUCTURE, STRUCTURES, STRUCTURE_BY_ID, TREE } from '@/data/structures';
import { Button, Panel, Provenance, Segmented, Slider, Kbd } from '@/components/ui';
import { useWide } from '@/lib/useWide';

const HEALTHY = emptyPathology();
const VIEW_BUTTONS: { v: ViewPreset; label: string }[] = [
  { v: 'left', label: 'L lat' },
  { v: 'right', label: 'R lat' },
  { v: 'medial', label: 'Medial' },
  { v: 'anterior', label: 'Ant' },
  { v: 'posterior', label: 'Post' },
  { v: 'superior', label: 'Sup' },
  { v: 'inferior', label: 'Inf' },
  { v: 'oblique', label: '3/4' },
];

export function Explorer() {
  const params = useSearchParams();
  const router = useRouter();
  const viewer = useRef<BrainViewerHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('s'));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [opacity, setOpacity] = useState<Record<string, number>>({});
  const [isolate, setIsolate] = useState<string[] | null>(null);
  const [mode, setMode] = useState<RenderMode>('anatomical');
  const [labels, setLabels] = useState(false);
  const [clip, setClip] = useState<ClipState>({ enabled: false, axis: 'sagittal', position: 0, flip: false });
  const [query, setQuery] = useState('');
  const [autoRotate, setAutoRotate] = useState(false);
  const [showWM, setShowWM] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false); // small screens only
  const wide = useWide();
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const on = () => setVh(window.innerHeight);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const [initialFocus] = useState<string[] | null>(() => {
    const s0 = params.get('s');
    return s0 && STRUCTURE_BY_ID[s0] ? STRUCTURE_BY_ID[s0].meshes : null;
  });

  const selected = selectedId ? STRUCTURE_BY_ID[selectedId] : null;
  const selectedMeshes = selected?.meshes ?? [];

  useEffect(() => {
    const s = params.get('s');
    if (s && STRUCTURE_BY_ID[s]) {
      setSelectedId(s);
      const deep = !STRUCTURE_BY_ID[s].meshes.some((m) => m.startsWith('cortex-'));
      if (deep) setMode('xray');
    }
  }, [params]);

  const select = (id: string | null, focus = false) => {
    setTreeOpen(false);
    setSelectedId(id);
    const url = id ? `/?s=${id}` : '/';
    router.replace(url, { scroll: false });
    if (id && focus) viewer.current?.focusMesh(STRUCTURE_BY_ID[id].meshes);
  };

  const toggleHidden = (meshes: string[]) => {
    setHidden((h) => {
      const n = new Set(h);
      const allHidden = meshes.every((m) => n.has(m));
      meshes.forEach((m) => (allHidden ? n.delete(m) : n.add(m)));
      return n;
    });
  };

  const setOpacityFor = (meshes: string[], v: number) =>
    setOpacity((o) => {
      const n = { ...o };
      meshes.forEach((m) => (n[m] = v));
      return n;
    });

  const resetAll = () => {
    setHidden(new Set());
    setOpacity({});
    setIsolate(null);
    setClip((c) => ({ ...c, enabled: false }));
    setMode('anatomical');
    viewer.current?.setView('oblique');
  };

  const filteredTree = useMemo(() => {
    if (!query.trim()) return TREE;
    const q = query.toLowerCase();
    const match = (id: string) => {
      const s = STRUCTURE_BY_ID[id];
      return s && (s.name.toLowerCase().includes(q) || s.aliases.some((a) => a.toLowerCase().includes(q)));
    };
    return TREE.map((g) => ({
      ...g,
      items: g.items
        .map((it) => ({ ...it, children: it.children?.filter(match) }))
        .filter((it) => match(it.id) || (it.children && it.children.length)),
    })).filter((g) => g.items.length);
  }, [query]);

  const selOpacity = selectedMeshes.length ? opacity[selectedMeshes[0]] ?? 1 : 1;

  return (
    <div className="relative h-full w-full">
      <BrainViewer
        ref={viewer}
        pathology={HEALTHY}
        selected={selectedMeshes}
        hidden={hidden}
        opacity={opacity}
        isolate={isolate}
        mode={mode}
        clip={clip}
        labels={labels}
        autoRotate={autoRotate}
        showWhiteMatter={showWM}
        autoFocus={initialFocus}
        inset={wide ? { left: 296, right: 396 } : { bottom: selectedId ? vh * 0.46 + 60 : 60 }}
        distanceScale={wide ? 1.12 : 1.25}
        onSelectMesh={(m) => {
          if (!m) return;
          const sid = MESH_TO_STRUCTURE[m];
          if (sid) select(sid);
        }}
      />

      {/* header */}
      <div className="pointer-events-none absolute left-[300px] right-[400px] top-4 hidden items-start justify-center lg:flex">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border hairline bg-ink-900/70 px-3 py-1.5 backdrop-blur">
          <span className="font-display text-[13px] font-medium text-ink-50">Brain Explorer</span>
          <span className="h-3 w-px bg-white/10" />
          <AnatomyProvenance />
        </div>
      </div>

      {/* structure tree */}
      <Panel className={clsx('absolute inset-x-2 bottom-[104px] top-2 z-10 flex-col overflow-hidden lg:inset-x-auto lg:bottom-20 lg:left-4 lg:top-4 lg:flex lg:w-[280px]', treeOpen ? 'flex' : 'hidden')}>
        <div className="border-b hairline p-3">
          <div className="label-chip mb-2 text-ink-300">Anatomical hierarchy</div>
          <div className="flex items-center gap-2 rounded-lg border hairline bg-ink-900/70 px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search structures…"
              className="w-full bg-transparent text-[12.5px] text-ink-50 placeholder:text-ink-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-2">
          {filteredTree.map((group) => (
            <div key={group.title}>
              <div className="label-chip px-2 pb-1 text-ink-400">{group.title}</div>
              {group.items.map((it) => (
                <TreeRow
                  key={it.id}
                  id={it.id}
                  childrenIds={it.children}
                  selectedId={selectedId}
                  hidden={hidden}
                  onSelect={(id) => select(id, true)}
                  onToggle={toggleHidden}
                  forceOpen={!!query}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="border-t hairline p-3">
          <label className="flex cursor-pointer items-center justify-between text-[12px] text-ink-200">
            Show cerebral white-matter surface
            <input type="checkbox" checked={showWM} onChange={(e) => setShowWM(e.target.checked)} className="accent-[#e0895f]" />
          </label>
        </div>
      </Panel>

      {/* info panel */}
      <Panel className={clsx('absolute inset-x-2 bottom-[104px] h-[46%] flex-col overflow-hidden lg:inset-x-auto lg:bottom-20 lg:right-4 lg:top-4 lg:flex lg:h-auto lg:w-[380px]', selected && !treeOpen ? 'flex' : 'hidden')}>
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b hairline px-4 py-2.5">
              <div className="label-chip text-ink-300">Structure</div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" title="Focus camera" onClick={() => viewer.current?.focusMesh(selectedMeshes)}>
                  <Focus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  active={!!isolate}
                  title="Isolate structure"
                  onClick={() => {
                    if (isolate) setIsolate(null);
                    else {
                      setIsolate(selectedMeshes);
                      setTimeout(() => viewer.current?.focusMesh(selectedMeshes), 50);
                    }
                  }}
                >
                  <Maximize2 className="h-3.5 w-3.5" /> {isolate ? 'Exit isolate' : 'Isolate'}
                </Button>
                <Button size="sm" variant="ghost" title="Hide structure" onClick={() => toggleHidden(selectedMeshes)}>
                  {selectedMeshes.every((m) => hidden.has(m)) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" title="Deselect" onClick={() => select(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {selectedMeshes.length > 0 && (
              <div className="border-b hairline px-4 py-2.5">
                <Slider label="Structure opacity" value={selOpacity} min={0.05} max={1} step={0.05} onChange={(v) => setOpacityFor(selectedMeshes, v)} format={(v) => `${Math.round(v * 100)}%`} />
              </div>
            )}
            <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4">
              <StructureDetail s={selected} compact onNavigate={(id) => select(id, true)} />
            </div>
          </>
        ) : (
          <EmptyInfo onPick={(id) => select(id, true)} />
        )}
      </Panel>

      {/* toolbar */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-center lg:bottom-4 lg:left-4 lg:right-4">
        <Panel className="flex flex-wrap items-center justify-center gap-2 px-2.5 py-2">
          <span className="contents lg:hidden">
            <Button size="sm" active={treeOpen} onClick={() => setTreeOpen((o) => !o)}>
              <ListTree className="h-3.5 w-3.5" /> Structures
            </Button>
          </span>
          <span className="hidden lg:contents">
          <Segmented size="sm" value={'' as ViewPreset} options={VIEW_BUTTONS.map((b) => ({ value: b.v, label: b.label }))} onChange={(v) => {
            if (v === 'medial') {
              // medial surface of the left hemisphere: section at the midline, view from the right
              setClip({ enabled: true, axis: 'sagittal', position: 0.5, flip: false });
              viewer.current?.setView('right');
              return;
            }
            viewer.current?.setView(v);
          }} />
          </span>
          <span className="hidden h-5 w-px bg-white/10 sm:block" />
          <Segmented<RenderMode>
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'anatomical', label: <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" />Tissue</span>, title: 'Realistic tissue shading' },
              { value: 'atlas', label: <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />Atlas</span>, title: 'Atlas colour-coding (FreeSurfer-style LUT)' },
              { value: 'xray', label: <span className="inline-flex items-center gap-1"><Box className="h-3 w-3" />X-ray</span>, title: 'Translucent cortex reveals deep structures' },
            ]}
          />
          <span className="hidden h-5 w-px bg-white/10 sm:block" />
          <Button size="sm" active={labels} onClick={() => setLabels((l) => !l)}>
            <Tag className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Labels</span>
          </Button>
          <Button size="sm" active={clip.enabled} onClick={() => setClip((c) => ({ ...c, enabled: !c.enabled }))}>
            <Scissors className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Section</span>
          </Button>
          {clip.enabled && (
            <div className="flex items-center gap-2">
              <Segmented
                size="sm"
                value={clip.axis}
                onChange={(a) => setClip((c) => ({ ...c, axis: a, position: 0 }))}
                options={[
                  { value: 'sagittal', label: 'Sag' },
                  { value: 'coronal', label: 'Cor' },
                  { value: 'axial', label: 'Ax' },
                ]}
              />
              <div className="w-36">
                <Slider value={clip.position} min={clip.axis === 'coronal' ? -100 : clip.axis === 'axial' ? -60 : -70} max={clip.axis === 'coronal' ? 72 : clip.axis === 'axial' ? 78 : 70} onChange={(v) => setClip((c) => ({ ...c, position: v }))} />
              </div>
              <span className="w-12 font-mono text-[11px] text-ink-200">{clip.position > 0 ? '+' : ''}{clip.position} mm</span>
              <Button size="sm" variant="ghost" onClick={() => setClip((c) => ({ ...c, flip: !c.flip }))} title="Flip kept side">
                ⇄
              </Button>
            </div>
          )}
          <span className="hidden h-5 w-px bg-white/10 sm:block" />
          <Button size="sm" active={autoRotate} onClick={() => setAutoRotate((a) => !a)} title="Auto-rotate">
            <Rotate3d className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={resetAll} title="Return to full-brain view">
            <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reset</span>
          </Button>
          <Link href="/learn?lesson=explode" title="Exploded-view lesson: take the brain apart step by step" className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-primary-accent/30 bg-primary-accent/5 px-2.5 text-[12px] font-medium text-primary-accent hover:bg-primary-accent/10">
            <Boxes className="h-3.5 w-3.5" /> Take apart
          </Link>
        </Panel>
      </div>
      <div className="pointer-events-none absolute bottom-[78px] left-1/2 hidden -translate-x-1/2 text-[10.5px] text-ink-400 lg:block">
        <Kbd>drag</Kbd> rotate · <Kbd>right-drag</Kbd> pan · <Kbd>scroll</Kbd> zoom · <Kbd>click</Kbd> select
      </div>
    </div>
  );
}

function TreeRow({ id, childrenIds, selectedId, hidden, onSelect, onToggle, forceOpen, depth = 0 }: {
  id: string; childrenIds?: string[]; selectedId: string | null; hidden: Set<string>; onSelect: (id: string) => void; onToggle: (m: string[]) => void; forceOpen?: boolean; depth?: number;
}) {
  const s = STRUCTURE_BY_ID[id];
  const [open, setOpen] = useState(false);
  if (!s) return null;
  const isHidden = s.meshes.length > 0 && s.meshes.every((m) => hidden.has(m));
  const active = selectedId === id;
  const expanded = open || forceOpen || (childrenIds?.includes(selectedId ?? '') ?? false);
  return (
    <div>
      <div
        className={clsx(
          'group flex items-center gap-1 rounded-md py-1 pr-1 transition-colors',
          active ? 'bg-primary-accent/10 text-primary-accent' : 'text-ink-100 hover:bg-white/[0.04]',
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        {childrenIds?.length ? (
          <button onClick={() => setOpen((o) => !o)} className="grid h-4 w-4 place-items-center text-ink-400">
            <ChevronRight className={clsx('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.color, opacity: isHidden ? 0.3 : 1 }} />
        <button onClick={() => onSelect(id)} className={clsx('min-w-0 flex-1 truncate text-left text-[12.5px]', isHidden && 'opacity-50')}>
          {s.name}
        </button>
        {s.meshes.length > 0 && (
          <button onClick={() => onToggle(s.meshes)} className="grid h-5 w-5 place-items-center rounded text-ink-400 opacity-0 hover:text-ink-50 group-hover:opacity-100" title={isHidden ? 'Show' : 'Hide'}>
            {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        )}
      </div>
      {expanded && childrenIds?.map((c) => (
        <TreeRow key={c} id={c} selectedId={selectedId} hidden={hidden} onSelect={onSelect} onToggle={onToggle} depth={depth + 1} />
      ))}
    </div>
  );
}

function EmptyInfo({ onPick }: { onPick: (id: string) => void }) {
  const picks = ['hippocampus', 'thalamus', 'brocas-area', 'insular-cortex', 'substantia-nigra', 'cerebellum'];
  return (
    <div className="flex h-full flex-col p-5">
      <div className="label-chip text-ink-300">Brain Explorer</div>
      <h2 className="mt-2 font-display text-[22px] font-semibold leading-tight text-ink-50">Select any structure to study it</h2>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-200">
        Click the model or choose from the hierarchy. Use <b className="text-ink-50">X-ray</b> mode or a <b className="text-ink-50">section</b> plane to reach deep nuclei, and <b className="text-ink-50">Isolate</b> to study one structure alone.
      </p>
      <div className="mt-5 label-chip text-ink-400">Suggested starting points</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {picks.map((p) => (
          <button key={p} onClick={() => onPick(p)} className="rounded-lg border hairline bg-white/[0.02] p-2.5 text-left transition-colors hover:border-primary-accent/30 hover:bg-primary-accent/5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: STRUCTURE_BY_ID[p].color }} />
              <span className="text-[12.5px] font-medium text-ink-50">{STRUCTURE_BY_ID[p].name}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-ink-400">{STRUCTURE_BY_ID[p].category}</div>
          </button>
        ))}
      </div>
      <div className="mt-auto rounded-lg border hairline bg-ink-900/60 p-3 text-[11.5px] leading-relaxed text-ink-300">
        {STRUCTURES.length} catalogued structures.
        <AnatomyProvenance caption="long" className="mt-1 block" />
      </div>
    </div>
  );
}
