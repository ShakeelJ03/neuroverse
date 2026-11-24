'use client';
import { useMemo } from 'react';
import type { Pathology } from '@/lib/anatomy/model';
import type { V3 } from '@/lib/anatomy/sdf';
import { ADC, AMY, FDG, HU, K, LABEL_NAME, PD, sampleTissue, STIFF, T1, T2, TAU } from '@/lib/imaging/tissue';

export function Readout({ cross, pathology }: { cross: V3; pathology: Pathology }) {
  const r = useMemo(() => {
    const out = new Float32Array(K);
    const lab = sampleTissue(cross, pathology, out, pathology.lesions.some((l) => (l.massEffect ?? 0) > 0));
    return { lab, out };
  }, [cross, pathology]);
  const o = r.out;
  const rows: [string, string][] = [
    ['Proton density', o[PD].toFixed(2)],
    ['T1 / T2', `${Math.round(o[T1])} / ${Math.round(o[T2])} ms`],
    ['ADC', `${o[ADC].toFixed(2)} ×10⁻³ mm²/s`],
    ['CT attenuation', `${Math.round(o[HU])} HU`],
    ['FDG (rel.)', o[FDG].toFixed(2)],
    ['Amyloid / tau (rel.)', `${o[AMY].toFixed(2)} / ${o[TAU].toFixed(2)}`],
    ['|G*| (illustr.)', `${o[STIFF].toFixed(2)} kPa`],
  ];
  return (
    <div className="rounded-lg border hairline bg-ink-900/60 p-2.5">
      <div className="label-chip text-ink-400">Crosshair readout</div>
      <div className="mt-1 font-mono text-[10.5px] text-ink-300">
        R/L {cross[0].toFixed(0)} · S/I {cross[1].toFixed(0)} · A/P {cross[2].toFixed(0)} mm (MNI-like)
      </div>
      <div className="mt-1.5 text-[12.5px] font-medium text-primary-accent">{LABEL_NAME[r.lab] ?? '—'}</div>
      <table className="mt-1.5 w-full text-[11px]">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="py-0.5 text-ink-400">{k}</td>
              <td className="py-0.5 text-right font-mono text-ink-100">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 text-[10px] text-ink-500">Phantom ground-truth parameters at this point.</div>
    </div>
  );
}
