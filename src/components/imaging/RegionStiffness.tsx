'use client';
import { useMemo } from 'react';
import type { Pathology } from '@/lib/anatomy/model';
import { K, REGION_LABEL, sampleTissue, STIFF } from '@/lib/imaging/tissue';

const REGIONS: { key: string; name: string; label: number }[] = [
  { key: 'hippocampus', name: 'Hippocampus', label: REGION_LABEL.hippocampus },
  { key: 'cortex', name: 'Cerebral cortex', label: REGION_LABEL.cortex },
  { key: 'wm', name: 'White matter', label: REGION_LABEL.wm },
  { key: 'thalamus', name: 'Thalamus', label: REGION_LABEL.thalamus },
  { key: 'cerebellum', name: 'Cerebellum', label: REGION_LABEL.cerebellum },
];

/** Mean simulated |G*| per region, sampled on a 3D grid through the phantom. */
export function regionMeans(path: Pathology): Record<string, number> {
  const out = new Float32Array(K);
  const sums: Record<number, [number, number]> = {};
  const hasWarp = path.lesions.some((l) => (l.massEffect ?? 0) > 0);
  for (let x = -60; x <= 60; x += 7)
    for (let y = -55; y <= 70; y += 7)
      for (let z = -95; z <= 65; z += 7) {
        const lab = sampleTissue([x + 0.3, y + 0.2, z + 0.1], path, out, hasWarp);
        (sums[lab] ??= [0, 0]);
        sums[lab][0] += out[STIFF];
        sums[lab][1]++;
      }
  // hippocampus/thalamus are small: add a dense local grid
  for (const c of [[-28, -12, -22], [28, -12, -22], [-10, 6, -16], [10, 6, -16]] as const)
    for (let dx = -6; dx <= 6; dx += 1.5)
      for (let dy = -6; dy <= 6; dy += 1.5)
        for (let dz = -10; dz <= 10; dz += 2) {
          const lab = sampleTissue([c[0] + dx, c[1] + dy, c[2] + dz], path, out, hasWarp);
          if (lab !== REGION_LABEL.hippocampus && lab !== REGION_LABEL.thalamus) continue;
          (sums[lab] ??= [0, 0]);
          sums[lab][0] += out[STIFF];
          sums[lab][1]++;
        }
  const res: Record<string, number> = {};
  for (const r of REGIONS) res[r.key] = sums[r.label] ? sums[r.label][0] / sums[r.label][1] : NaN;
  return res;
}

const cacheH = new Map<string, Record<string, number>>();

export function RegionStiffness({ pathology, healthy, caseName }: { pathology: Pathology; healthy: Pathology; caseName?: string }) {
  const h = useMemo(() => {
    const k = 'h';
    if (!cacheH.has(k)) cacheH.set(k, regionMeans(healthy));
    return cacheH.get(k)!;
  }, [healthy]);
  const d = useMemo(() => regionMeans(pathology), [pathology]);
  const max = 4;
  return (
    <div className="rounded-lg border hairline bg-ink-900/60 p-2.5">
      <div className="label-chip text-ink-400">Region stiffness |G*|</div>
      <div className="mb-2 mt-0.5 text-[10.5px] text-amber-accent">Illustrative simulation values (kPa) — not reference data</div>
      <div className="space-y-2">
        {REGIONS.map((r) => (
          <div key={r.key}>
            <div className="flex justify-between text-[11px]"><span className="text-ink-200">{r.name}</span><span className="font-mono text-ink-100">{fmt(h[r.key])}{caseName ? ` → ${fmt(d[r.key])}` : ''}</span></div>
            <div className="mt-0.5 h-1.5 rounded bg-white/5"><div className="h-1.5 rounded bg-ink-300" style={{ width: `${(h[r.key] / max) * 100}%` }} /></div>
            {caseName && <div className="mt-0.5 h-1.5 rounded bg-white/5"><div className="h-1.5 rounded bg-primary-accent" style={{ width: `${(d[r.key] / max) * 100}%` }} /></div>}
          </div>
        ))}
      </div>
      {caseName && <div className="mt-2 flex gap-3 text-[10px] text-ink-400"><span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-ink-300" />healthy</span><span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded bg-primary-accent" />{caseName}</span></div>}
    </div>
  );
}
const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : '—');
