'use client';
import { useMemo } from 'react';
import { MRI_SEQS, MriSeq, nullTI, PET_TRACERS, PetTracer, SeqParams, wavelengthMm } from '@/lib/imaging/modalities';
import { T_CSF, T_GM, T_WM, T1, T2, PD } from '@/lib/imaging/tissue';
import { SectionTitle } from '@/components/ui';
import { ref } from '@/data/references';

const TISSUES = [
  { name: 'WM', p: T_WM, c: '#e8e2cf' },
  { name: 'GM', p: T_GM, c: '#9aa3b5' },
  { name: 'CSF', p: T_CSF, c: '#8da3b5' },
];

/** Live relaxation curves: Mz recovery (sets T1 weighting at TR) and Mxy decay (sets T2 weighting at TE). */
export function RelaxationPlot({ sp }: { sp: SeqParams }) {
  const W = 320, H = 110;
  const curves = useMemo(() => {
    const tmax = Math.max(4500, sp.tr * 1.1);
    return TISSUES.map((t) => {
      const pts: string[] = [];
      for (let i = 0; i <= 80; i++) {
        const time = (i / 80) * tmax;
        const mz = sp.ti > 0 ? 1 - 2 * Math.exp(-time / t.p[T1]) : 1 - Math.exp(-time / t.p[T1]);
        pts.push(`${((i / 80) * W).toFixed(1)},${(H / 2 - mz * t.p[PD] * (H / 2 - 6)).toFixed(2)}`);
      }
      const pts2: string[] = [];
      for (let i = 0; i <= 80; i++) {
        const time = (i / 80) * 300;
        pts2.push(`${((i / 80) * W).toFixed(1)},${(H - 4 - Math.exp(-time / t.p[T2]) * t.p[PD] * (H / 2 - 12)).toFixed(2)}`);
      }
      return { ...t, mz: pts.join(' '), mxy: pts2.join(' '), tmax };
    });
  }, [sp.tr, sp.ti]);
  const tmax = curves[0].tmax;
  const markX = ((sp.ti > 0 ? sp.ti : sp.tr) / tmax) * W;
  const teX = (sp.te / 300) * W;
  return (
    <div className="rounded-lg border hairline bg-ink-900/60 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="#2a303c" />
        <text x={4} y={10} fill="#6b7385" fontSize={9}>Mz recovery (0–{Math.round(tmax)} ms){sp.ti > 0 ? ' after inversion' : ''}</text>
        <text x={4} y={H / 2 + 12} fill="#6b7385" fontSize={9}>Mxy decay (0–300 ms)</text>
        {curves.map((c) => (
          <g key={c.name}>
            <polyline points={c.mz} fill="none" stroke={c.c} strokeWidth={1.4} />
            <polyline points={c.mxy} fill="none" stroke={c.c} strokeWidth={1.4} strokeDasharray="3 2" />
          </g>
        ))}
        <line x1={markX} x2={markX} y1={0} y2={H / 2} stroke="#f2b45a" strokeDasharray="2 2" />
        <text x={markX + 3} y={20} fill="#f2b45a" fontSize={9}>{sp.ti > 0 ? 'TI' : 'TR'}</text>
        <line x1={teX} x2={teX} y1={H / 2} y2={H} stroke="#f2b45a" strokeDasharray="2 2" />
        <text x={teX + 3} y={H - 6} fill="#f2b45a" fontSize={9}>TE</text>
      </svg>
      <div className="mt-1 flex gap-3 text-[10.5px]">
        {TISSUES.map((t) => (
          <span key={t.name} className="flex items-center gap-1 text-ink-300"><span className="h-0.5 w-3" style={{ background: t.c }} />{t.name} (T1 {t.p[T1]} / T2 {t.p[T2]} ms)</span>
        ))}
      </div>
    </div>
  );
}

function Refs({ ids }: { ids: string[] }) {
  return (
    <ol className="mt-2 space-y-1">
      {ids.map((id) => (
        <li key={id} className="text-[10.5px] leading-snug text-ink-400">
          <a href={ref(id).url} target="_blank" rel="noreferrer" className="hover:text-primary-accent">{ref(id).cite}</a>
        </li>
      ))}
    </ol>
  );
}

export function MriPhysics({ seq, sp }: { seq: MriSeq; sp: SeqParams }) {
  const info = seq === 'CUSTOM' ? null : MRI_SEQS[seq];
  return (
    <div className="space-y-3 text-[12.5px] leading-relaxed text-ink-100">
      <SectionTitle>How MRI makes this image</SectionTitle>
      <p>
        Hydrogen nuclei align in the static field B₀ and precess at the Larmor frequency (≈128 MHz at 3 T). An RF pulse tips magnetisation into the transverse plane;
        it then <b>recovers longitudinally (T1)</b> and <b>dephases transversely (T2)</b> at tissue-specific rates. Gradients encode position (k-space) and a Fourier transform forms the image.
        Contrast is chosen by timing: TR controls T1 weighting, TE controls T2 weighting.
      </p>
      {info && (
        <div className="rounded-lg border border-primary-accent/20 bg-primary-accent/5 p-3">
          <div className="font-medium text-primary-accent">{info.name}</div>
          <div className="mt-0.5 font-mono text-[10.5px] text-ink-300">
            TR {sp.tr} ms · TE {sp.te} ms{sp.ti ? ` · TI ${Math.round(sp.ti)} ms` : ''}{sp.b ? ` · b ${sp.b} s/mm²` : ''} · emphasises {info.emphasises}
          </div>
          <p className="mt-1.5 text-[12px]">{info.desc}</p>
        </div>
      )}
      <RelaxationPlot sp={sp} />
      <div className="grid grid-cols-2 gap-2 text-[11.5px]">
        <Fact k="CSF" v="T1 dark · T2 bright · FLAIR nulled · ADC high (~3.0)" />
        <Fact k="GM vs WM" v="T1: WM brighter (more myelin, shorter T1). T2: GM brighter." />
        <Fact k="Oedema" v="Long T1 & T2 → dark T1, bright T2/FLAIR; vasogenic = high ADC, cytotoxic = low ADC" />
        <Fact k="Lesions" v="Infarct: DWI↑ ADC↓. MS: T2/FLAIR ovoid ↑. GBM: rim enhancement + FLAIR oedema" />
      </div>
      <Refs ids={['stanisz2005', 'hajnal1992', 'lebihan1986', 'haacke2004']} />
      <p className="text-[11px] text-ink-400">Signal equations used: S = PD·(1−e^(−TR/T1))·e^(−TE/T2) (SE); S = PD·|1−2e^(−TI/T1)+e^(−TR/T1)|·e^(−TE/T2) (IR); DWI ×e^(−b·ADC); Rician noise added. FLAIR TI auto-set to the CSF null ({Math.round(nullTI(9000))} ms at TR 9000).</p>
    </div>
  );
}

export function CtPhysics() {
  const scale = [
    { n: 'Air', v: -1000 }, { n: 'Fat', v: -100 }, { n: 'Water / CSF', v: 0 }, { n: 'White matter', v: 28 }, { n: 'Grey matter', v: 38 },
    { n: 'Acute blood', v: 65 }, { n: 'Calcification', v: 150 }, { n: 'Bone', v: 1000 },
  ];
  return (
    <div className="space-y-3 text-[12.5px] leading-relaxed text-ink-100">
      <SectionTitle>How CT makes this image</SectionTitle>
      <p>
        A rotating X-ray tube and detector ring measure <b>attenuation</b> along thousands of paths (I = I₀e^(−∫μ dx)). Filtered back-projection or iterative reconstruction recovers μ per voxel,
        expressed in <b>Hounsfield units</b>: HU = 1000 × (μ − μ_water)/(μ_water − μ_air). Water is 0 HU, air −1000.
      </p>
      <div className="space-y-1 rounded-lg border hairline bg-ink-900/60 p-2.5">
        {scale.map((s) => (
          <div key={s.n} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-24 text-ink-300">{s.n}</span>
            <div className="h-1.5 flex-1 rounded bg-white/5">
              <div className="h-1.5 rounded bg-gradient-to-r from-ink-500 to-ink-50" style={{ width: `${((Math.log10(s.v + 1100) - 2) / 1.5) * 100}%` }} />
            </div>
            <span className="w-12 text-right font-mono text-ink-100">{s.v}</span>
          </div>
        ))}
      </div>
      <p>
        <b>Why acute haemorrhage is bright:</b> clotted blood concentrates haemoglobin protein (high electron density), raising attenuation to ~50–80 HU above brain (~20–45 HU). Density falls as the clot lyses (≈1–2 HU/day), so subacute haematomas can become <i>isodense</i>.
      </p>
      <p>
        <b>Emergency role:</b> fast, widely available, and highly sensitive for acute haemorrhage, mass effect, hydrocephalus and fractures — the first test in suspected stroke and trauma. <b>Limitations:</b> poor grey–white contrast, insensitive to early ischaemia, posterior-fossa beam-hardening artefact, ionising radiation.
      </p>
      <p className="text-[11.5px] text-ink-300">Windows map a HU range to grey levels: brain W80/L40, stroke W40/L40, subdural W200/L80, bone W2800/L600.</p>
      <Refs ids={['hounsfield1973', 'barber2000']} />
    </div>
  );
}

export function PetPhysics({ tracer }: { tracer: PetTracer }) {
  return (
    <div className="space-y-3 text-[12.5px] leading-relaxed text-ink-100">
      <SectionTitle>How PET makes this image</SectionTitle>
      <p>
        A radiotracer labelled with a positron emitter (¹⁸F, t½ 110 min; ¹¹C, 20 min) is injected. Each emitted <b>positron</b> travels ~1 mm, then <b>annihilates</b> with an electron producing two 511 keV photons ~180° apart.
        Detector rings record <b>coincident</b> photon pairs, defining lines of response; iterative reconstruction (OSEM) with attenuation and scatter correction estimates tracer concentration.
      </p>
      <div className="rounded-lg border border-tertiary-accent/25 bg-tertiary-accent/5 p-3">
        <div className="font-medium text-tertiary-accent">{PET_TRACERS[tracer].name}</div>
        <p className="mt-1 text-[12px]">{PET_TRACERS[tracer].desc}</p>
      </div>
      <p>
        <b>SUV</b> = tissue activity concentration ÷ (injected dose / body weight). Brain PET is usually read visually and as SUV ratios to a reference region (e.g., cerebellum or pons). Spatial resolution (~4–5 mm FWHM) causes partial-volume blurring, visible here.
      </p>
      <p>
        <b>Metabolic vs structural:</b> PET maps a biological process (glucose use, protein deposition, transporter density). Function can fail before tissue is lost, so PET abnormalities may precede atrophy on MRI — but PET has lower spatial resolution and needs CT/MRI for anatomical localisation (fusion).
      </p>
      <Refs ids={['phelps1979', 'minoshima1997', 'klunk2004', 'schoell2016', 'albert2016']} />
    </div>
  );
}

export function MrePhysics({ freq }: { freq: number }) {
  return (
    <div className="space-y-3 text-[12.5px] leading-relaxed text-ink-100">
      <SectionTitle>How MR elastography works</SectionTitle>
      <ol className="list-decimal space-y-1.5 pl-4">
        <li><b>Excitation:</b> a pneumatic or electromechanical driver (e.g., a pillow under the head) vibrates the skull at 25–60 Hz, launching shear waves into the brain.</li>
        <li><b>Motion encoding:</b> oscillating motion-encoding gradients synchronised to the vibration make spin phase proportional to tissue displacement (μm scale).</li>
        <li><b>Wave images:</b> several phase offsets over one cycle capture the propagating wave; phase is unwrapped and temporally Fourier transformed.</li>
        <li><b>Inversion:</b> algorithms (direct/algebraic Helmholtz inversion, multifrequency MDEV, non-linear inversion) solve for the complex shear modulus G* = G′ + iG″.</li>
        <li><b>Elastogram:</b> maps of |G*| (stiffness) and damping ratio / loss angle (viscosity).</li>
      </ol>
      <div className="rounded-lg border hairline bg-ink-900/60 p-2.5 text-[11.5px]">
        Wave speed c = √(G/ρ); wavelength λ = c/f. At {freq} Hz: 1 kPa → λ ≈ {wavelengthMm(1, freq).toFixed(0)} mm; 3 kPa → λ ≈ {wavelengthMm(3, freq).toFixed(0)} mm. <b>Softer tissue shows shorter waves.</b>
      </div>
      <p>
        <b>Stiffness ≠ signal intensity:</b> MRE measures a mechanical property derived from motion, independent of T1/T2 contrast. Two tissues can look identical on T2 but differ in stiffness (and vice versa).
      </p>
      <p className="rounded-lg border border-amber-accent/25 bg-amber-accent/5 p-2.5 text-[11.5px] text-amber-accent">
        All kPa values here are an explicitly labelled illustrative simulation, chosen inside the ~1–4 kPa range reported in brain MRE literature. They are not reference values and no diagnostic thresholds exist.
      </p>
      <Refs ids={['muthupillai1995', 'hiscox2016', 'sack2009', 'murphy2011', 'wuerfel2010']} />
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border hairline bg-white/[0.02] p-2">
      <div className="label-chip text-primary-accent">{k}</div>
      <div className="mt-0.5 text-ink-200">{v}</div>
    </div>
  );
}
