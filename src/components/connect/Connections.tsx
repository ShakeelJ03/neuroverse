'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import * as THREE from 'three';
import { BrainViewer } from '@/components/brain/BrainViewer';
import { emptyPathology } from '@/lib/anatomy/model';
import { NETWORKS, NET_EDGES, NET_NODES, Tract, TRACTS, TRACT_BY_ID } from '@/data/tracts';
import { STRUCTURE_BY_ID } from '@/data/structures';
import { ref } from '@/data/references';
import { Badge, Panel, Provenance, Segmented, Slider, SectionTitle } from '@/components/ui';

const HEALTHY = emptyPathology();

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
}

/** Builds jittered streamlines with direction-encoded colour (red = L–R, green = A–P, blue = S–I). */
function buildTract(t: Tract, colorMode: 'dec' | 'bundle', bundleColor: THREE.Color): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const sides = t.bilateral ? [1, -1] : [1];
  let seed = t.id.length * 97;
  for (const s of sides)
    for (const path of t.paths)
      for (let k = 0; k < t.count; k++) {
        const r = mulberry(seed++);
        const off = new THREE.Vector3(r() * 2 * t.spread, r() * 2 * t.spread, r() * 2 * t.spread);
        const pts = path.map((p, i) => {
          const taper = i === 0 || i === path.length - 1 ? 1.6 : 1;
          return new THREE.Vector3(p[0] * s + off.x * taper, p[1] + off.y * taper, p[2] + off.z * taper);
        });
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const segs = 48, radial = 5;
        const g = new THREE.TubeGeometry(curve, segs, 0.32, radial, false);
        const col = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i <= segs; i++) {
          const tan = curve.getTangentAt(i / segs);
          const c = colorMode === 'dec' ? [Math.abs(tan.x), Math.abs(tan.z), Math.abs(tan.y)] : [bundleColor.r, bundleColor.g, bundleColor.b];
          for (let j = 0; j <= radial; j++) {
            const v = i * (radial + 1) + j;
            col[v * 3] = 0.15 + 0.85 * c[0];
            col[v * 3 + 1] = 0.15 + 0.85 * c[1];
            col[v * 3 + 2] = 0.15 + 0.85 * c[2];
          }
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        out.push(g);
      }
  return out;
}

const BUNDLE_COLORS: Record<string, string> = { cst: '#5b8cff', af: '#4cc99a', slf: '#7ee0c9', cingulum: '#e7c35d', uf: '#f2b45a', ifof: '#f0a06c', ilf: '#c59bd9', or: '#b47cf0', fornix: '#d8cfae', cc: '#f0717d' };

export function Connections() {
  const [active, setActive] = useState<Set<string>>(new Set(['cst', 'af', 'cingulum', 'cc', 'or', 'uf']));
  const [focus, setFocus] = useState<string>('af');
  const [colorMode, setColorMode] = useState<'dec' | 'bundle'>('dec');
  const [node, setNode] = useState<string | null>(null);
  const [net, setNet] = useState<string | null>(null);

  const geoms = useMemo(() => {
    const m = new Map<string, THREE.BufferGeometry[]>();
    TRACTS.forEach((t) => m.set(t.id, buildTract(t, colorMode, new THREE.Color(BUNDLE_COLORS[t.id]))));
    return m;
  }, [colorMode]);

  const nodeTracts = useMemo(() => (node ? NET_EDGES.filter((e) => (e.a === node || e.b === node) && e.tract).map((e) => e.tract!) : []), [node]);
  const shown = node && nodeTracts.length ? new Set(nodeTracts) : active;
  const extra = (
    <group>
      {TRACTS.filter((t) => shown.has(t.id)).map((t) =>
        geoms.get(t.id)!.map((g, i) => (
          <mesh key={`${t.id}-${i}`} geometry={g} onClick={(e) => { e.stopPropagation(); setFocus(t.id); }}>
            <meshStandardMaterial vertexColors roughness={0.45} metalness={0.05} emissive={focus === t.id ? '#223344' : '#000'} transparent opacity={focus && focus !== t.id && !node ? 0.55 : 1} />
          </mesh>
        )),
      )}
    </group>
  );
  const ft = TRACT_BY_ID[focus];

  return (
    <div className="flex h-full">
      <div className="scroll-thin w-[290px] shrink-0 space-y-4 overflow-y-auto border-r hairline p-4">
        <div>
          <div className="label-chip text-ink-400">Brain connectivity laboratory</div>
          <div className="mt-0.5 font-display text-[16px] text-ink-50">White-matter pathways</div>
          <div className="mt-2"><Provenance kind="conceptual" /></div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-400">Hand-placed schematic streamlines following atlas trajectories — not computed tractography.</p>
        </div>
        <div>
          <SectionTitle>Colour</SectionTitle>
          <Segmented size="sm" value={colorMode} onChange={setColorMode} options={[{ value: 'dec', label: 'Direction (DEC)' }, { value: 'bundle', label: 'By bundle' }]} />
          {colorMode === 'dec' && <div className="mt-1.5 flex gap-2 text-[10.5px]"><span className="text-[#ff6b6b]">■ L–R</span><span className="text-[#6bff8a]">■ A–P</span><span className="text-[#6b8cff]">■ S–I</span></div>}
        </div>
        {(['projection', 'association', 'commissural', 'limbic'] as const).map((cls) => (
          <div key={cls}>
            <SectionTitle>{cls} fibres</SectionTitle>
            {TRACTS.filter((t) => t.cls === cls).map((t) => (
              <div key={t.id} className={clsx('flex items-center gap-2 rounded-md px-1.5 py-1', focus === t.id && 'bg-white/[0.05]')}>
                <input type="checkbox" checked={active.has(t.id)} onChange={() => setActive((a) => { const n = new Set(a); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} className="accent-[#e0895f]" />
                <span className="h-2 w-2 rounded-sm" style={{ background: BUNDLE_COLORS[t.id] }} />
                <button onClick={() => { setFocus(t.id); setActive((a) => new Set(a).add(t.id)); setNode(null); }} className="truncate text-left text-[12.5px] text-ink-100 hover:text-primary-accent">{t.name}</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <BrainViewer pathology={HEALTHY} mode="xray" opacity={{}} extra={extra} initialView="left" focusHighlight highlight={{ 'cortex-hilum': '#efe6d0' }} />
        {ft && (
          <Panel className="absolute bottom-4 left-4 max-w-md p-4">
            <div className="flex items-center gap-2"><Badge tone="tertiary">{ft.cls}</Badge><span className="font-display text-[15px] text-ink-50">{ft.name}</span></div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-100">{ft.function}</p>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-300">{ft.clinical}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {ft.connects.map((c) => STRUCTURE_BY_ID[c] && <Link key={c} href={`/?s=${c}`} className="rounded border hairline px-1.5 py-0.5 text-[10.5px] text-ink-200 hover:text-primary-accent">{STRUCTURE_BY_ID[c].name}</Link>)}
            </div>
          </Panel>
        )}
      </div>
      <div className="scroll-thin w-[420px] shrink-0 space-y-5 overflow-y-auto border-l hairline p-4">
        <NetworkGraph node={node} setNode={setNode} net={net} setNet={setNet} />
        <TensorDemo />
        <DiffusionPrimer />
      </div>
    </div>
  );
}

function NetworkGraph({ node, setNode, net, setNet }: { node: string | null; setNode: (n: string | null) => void; net: string | null; setNet: (n: string | null) => void }) {
  const N = Object.fromEntries(NET_NODES.map((n) => [n.id, n]));
  const netNodes = net ? new Set(NETWORKS.find((x) => x.id === net)!.nodes) : null;
  const netColor = net ? NETWORKS.find((x) => x.id === net)!.color : '';
  return (
    <div>
      <SectionTitle>Structure–function network</SectionTitle>
      <svg viewBox="0 0 500 340" className="w-full rounded-lg border hairline bg-ink-900/60">
        {NET_EDGES.map((e, i) => {
          const a = N[e.a], b = N[e.b];
          const on = node && (e.a === node || e.b === node);
          const inNet = netNodes && netNodes.has(e.a) && netNodes.has(e.b);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={inNet ? netColor : on ? '#e0895f' : e.tract ? '#4a5263' : '#2a303c'} strokeWidth={on || inNet ? 2.2 : 1.2} strokeDasharray={e.tract ? undefined : '3 3'} />;
        })}
        {NET_NODES.map((n) => {
          const on = node === n.id;
          const inNet = netNodes?.has(n.id);
          return (
            <g key={n.id} onClick={() => setNode(on ? null : n.id)} className="cursor-pointer">
              <circle cx={n.x} cy={n.y} r={on ? 9 : 7} fill={inNet ? netColor : on ? '#e0895f' : '#1b1f29'} stroke={on ? '#e0895f' : '#6b7385'} />
              <text x={n.x} y={n.y - 12} textAnchor="middle" fill={on ? '#e0895f' : '#c7ccd8'} fontSize={10.5}>{n.name}</text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 text-[10.5px] text-ink-400">Solid edges = named white-matter tracts (click a node to show them in 3D); dashed = major circuit connections via grey-matter relays.</div>
      {node && (
        <div className="mt-2 rounded-lg border hairline p-2.5 text-[12px] text-ink-100">
          <b>{N[node].name}</b> — {N[node].fn}.{' '}
          {N[node].structure && <Link href={`/?s=${N[node].structure}`} className="text-primary-accent hover:underline">Open in explorer</Link>}
        </div>
      )}
      <div className="mt-3 label-chip text-ink-400">Resting-state functional networks</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {NETWORKS.map((n) => (
          <button key={n.id} onClick={() => setNet(net === n.id ? null : n.id)} className={clsx('rounded-full border px-2 py-0.5 text-[11px]', net === n.id ? 'text-ink-950' : 'hairline text-ink-200')} style={net === n.id ? { background: n.color, borderColor: n.color } : {}}>{n.name}</button>
        ))}
      </div>
      {net && <p className="mt-2 text-[11.5px] leading-relaxed text-ink-200">{NETWORKS.find((x) => x.id === net)!.desc} <span className="text-ink-400">(Schematic membership after Yeo et al. 2011; functional networks are defined by correlated BOLD fluctuations, not by a single tract.)</span></p>}
    </div>
  );
}

function TensorDemo() {
  const [l, setL] = useState<[number, number, number]>([1.7, 0.3, 0.25]);
  const md = (l[0] + l[1] + l[2]) / 3;
  const fa = Math.sqrt(0.5) * Math.sqrt((l[0] - l[1]) ** 2 + (l[1] - l[2]) ** 2 + (l[2] - l[0]) ** 2) / Math.sqrt(l[0] ** 2 + l[1] ** 2 + l[2] ** 2);
  const presets: [string, [number, number, number]][] = [['CSF', [3, 3, 3]], ['Grey matter', [0.95, 0.82, 0.72]], ['Corpus callosum', [1.7, 0.3, 0.25]], ['Crossing fibres', [1.1, 0.95, 0.4]], ['Demyelinated WM', [1.6, 0.75, 0.65]]];
  const sc = 42;
  return (
    <div>
      <SectionTitle>Diffusion tensor: FA & MD</SectionTitle>
      <div className="flex gap-3">
        <svg viewBox="-80 -80 160 160" className="h-36 w-36 shrink-0 rounded-lg border hairline bg-ink-900/60">
          <ellipse cx={0} cy={0} rx={Math.sqrt(l[0]) * sc} ry={Math.sqrt(l[1]) * sc} fill="rgba(224,137,95,0.18)" stroke="#e0895f" />
          <ellipse cx={0} cy={0} rx={Math.sqrt(l[0]) * sc} ry={Math.sqrt(l[2]) * sc * 0.45} fill="none" stroke="#e0895f" strokeOpacity={0.4} strokeDasharray="3 3" />
          <line x1={-Math.sqrt(l[0]) * sc} x2={Math.sqrt(l[0]) * sc} y1={0} y2={0} stroke="#f2b45a" strokeWidth={0.8} />
          <text x={-74} y={74} fill="#6b7385" fontSize={9}>λ1 axis = principal direction</text>
        </svg>
        <div className="flex-1 space-y-2">
          {[0, 1, 2].map((i) => (
            <Slider key={i} label={`λ${i + 1} (×10⁻³ mm²/s)`} value={l[i]} min={0.1} max={3} step={0.05} onChange={(v) => setL((x) => { const n = [...x] as [number, number, number]; n[i] = v; return n; })} />
          ))}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border hairline p-2"><div className="label-chip text-ink-400">FA</div><div className="font-mono text-[18px] text-primary-accent">{fa.toFixed(2)}</div></div>
        <div className="rounded-lg border hairline p-2"><div className="label-chip text-ink-400">MD</div><div className="font-mono text-[18px] text-tertiary-accent">{md.toFixed(2)}</div></div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">{presets.map(([n, v]) => <button key={n} onClick={() => setL(v)} className="rounded border hairline px-1.5 py-0.5 text-[10.5px] text-ink-200 hover:text-primary-accent">{n}</button>)}</div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-400">FA = √½·√((λ1−λ2)²+(λ2−λ3)²+(λ3−λ1)²)/√(λ1²+λ2²+λ3²). Note how crossing fibres lower FA in healthy tissue — FA is not a pure measure of “integrity”.</p>
    </div>
  );
}

function DiffusionPrimer() {
  const refs = ['basser1994', 'pierpaoli1996', 'pajevic1999', 'catani2008', 'jones2013', 'biswal1995', 'yeo2011', 'raichle2001', 'seeley2007'];
  return (
    <div className="space-y-2 text-[12px] leading-relaxed text-ink-100">
      <SectionTitle>Principles</SectionTitle>
      <p><b>Diffusion MRI</b> sensitises the signal to random water motion using strong gradient pulses. In white matter, myelinated axons hinder diffusion perpendicular to fibres, so diffusion is <b>anisotropic</b>.</p>
      <p><b>DTI</b> fits a 3×3 tensor per voxel (≥6 gradient directions). Its eigenvalues give <b>FA</b> (0 = isotropic, 1 = linear) and <b>MD</b>; the principal eigenvector gives fibre orientation, displayed with the red/green/blue direction-encoded colour convention.</p>
      <p><b>Tractography</b> follows orientation estimates voxel-to-voxel (deterministic) or samples distributions (probabilistic). It infers pathways indirectly and is prone to false positives/negatives, especially at crossing fibres; advanced models (CSD, multi-shell) help.</p>
      <p><b>Structural vs functional connectivity:</b> tractography estimates physical white-matter pathways; <b>resting-state fMRI</b> measures temporal correlation of BOLD signal between regions, which can exist without a direct tract (via polysynaptic paths).</p>
      <ol className="space-y-1 pt-1">{refs.map((r) => <li key={r} className="text-[10.5px] text-ink-400"><a href={ref(r).url} target="_blank" rel="noreferrer" className="hover:text-primary-accent">{ref(r).cite}</a></li>)}</ol>
    </div>
  );
}
