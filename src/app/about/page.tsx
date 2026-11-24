import { Provenance } from '@/components/ui';

const BUNDLED = [
  { name: 'FSL MNI152 T1 1 mm (MNI152NLin6Asym), via TemplateFlow', use: 'Template intensity → tissue classes, pial surface and imaging phantom', licence: 'FSL licence: free for non-commercial use; commercial use needs a licence', url: 'https://www.templateflow.org/' },
  { name: 'Harvard–Oxford cortical (lateralised) & subcortical atlases', use: 'Structure labels → meshes, cortical parcels, PET regions', licence: 'FSL licence (as above)', url: 'https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Atlases' },
  { name: 'Buckner 2011 cerebellar parcellation (7 networks)', use: 'Cerebellum mask only', licence: 'Free for research/education with citation (Buckner et al., J Neurophysiol 2011)', url: 'https://www.templateflow.org/' },
];

const DATASETS = [
  { name: 'MNI ICBM152 2009 nonlinear templates', use: 'Reference T1/T2/PD head templates; coordinate frame used by NEUROVERSE', licence: 'Permissive (McConnell Brain Imaging Centre licence; attribution required)', url: 'https://nist.mni.mcgill.ca/icbm-152-nonlinear-atlases-2009/' },
  { name: 'Harvard–Oxford cortical & subcortical atlases (FSL)', use: 'Probabilistic structure labels → per-structure meshes', licence: 'FSL licence (non-commercial); check redistribution terms', url: 'https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Atlases' },
  { name: 'FreeSurfer fsaverage / aseg', use: 'Cortical surfaces (pial/white) and subcortical segmentation', licence: 'FreeSurfer licence (free registration)', url: 'https://surfer.nmr.mgh.harvard.edu/' },
  { name: 'AAL3 / Brainnetome atlases', use: 'Alternative parcellations', licence: 'Academic use; check each licence', url: 'https://atlas.brainnetome.org/' },
  { name: 'OpenNeuro', use: 'Real MRI/PET/DWI datasets (many CC0)', licence: 'Per dataset (often CC0)', url: 'https://openneuro.org/' },
  { name: 'IXI dataset', use: 'Healthy T1, T2, PD, MRA, DTI from ~600 subjects', licence: 'CC BY-SA 3.0', url: 'https://brain-development.org/ixi-dataset/' },
  { name: 'BraTS / Medical Segmentation Decathlon', use: 'Glioma MRI (T1, T1c, T2, FLAIR) with tumour labels', licence: 'CC BY-SA 4.0 (MSD); BraTS per-year terms', url: 'http://medicaldecathlon.com/' },
  { name: 'ADNI / OASIS', use: 'Ageing & Alzheimer MRI/PET', licence: 'Data-use agreement — not redistributable in an app', url: 'https://adni.loni.usc.edu/' },
  { name: 'TCIA', use: 'Tumour imaging collections incl. CT/MRI/PET', licence: 'Per collection (often CC BY)', url: 'https://www.cancerimagingarchive.net/' },
  { name: 'Allen Human Brain Atlas / BigBrain', use: 'Gene expression; 20 µm histological reconstruction', licence: 'Allen terms of use; BigBrain CC BY-NC-SA', url: 'https://bigbrainproject.org/' },
];

export default function About() {
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-8 text-[13.5px] leading-relaxed text-ink-100">
        <div className="label-chip text-ink-400">Scientific provenance</div>
        <h1 className="mt-1 font-display text-[28px] font-semibold text-ink-50">What is real, what is modelled</h1>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Card kind="atlas" title="3D anatomy — MNI atlas source (default)">Surfaces built from FSL’s MNI152 6th-generation T1 template (pial iso-surface) and Harvard–Oxford cortical and subcortical labels; cerebellum from Buckner 2011. This is a population average of 152 adults, so sulci are smoother than in any single brain. Brainstem divisions, corpus callosum, 3rd/4th ventricles and entorhinal cortex are derived from those labels by simple rules; hypothalamus, internal capsule, fornix, substantia nigra, pineal and pituitary are not in the atlas and stay parametric. Disease shape changes are approximate deformations.</Card>
          <Card kind="conceptual" title="3D anatomy — parametric model source">A hand-built signed-distance model positioned from approximate MNI152 coordinates and atlas extents, with explicit landmark sulci and procedural tertiary gyri. Used when you pick “Model” in the sidebar and always for malformations (lissencephaly, Chiari, Dandy–Walker, callosal agenesis, microcephaly). Not segmented from a scan — do not measure from it.</Card>
          <Card kind="synthetic" title="All imaging panes">Physics-based simulations computed from a tissue-property phantom built on the same geometry: MRI signal equations with 3 T relaxation times (Stanisz 2005), CT Hounsfield units, PET tracer maps with scanner blur and noise, MRE stiffness and simulated shear waves. Never patient scans.</Card>
          <Card kind="conceptual" title="Disease models & progression">Each disease maps a severity/stage parameter to illustrative changes (atrophy, lesions, tracer patterns). Stage order follows cited staging schemes or imaging time courses where they exist and is labelled conceptual otherwise. Not patient predictions.</Card>
          <Card kind="clinical" title="Real data path">The Imaging Simulator’s “Real data (NIfTI)” tab opens your own NIfTI volumes locally with Niivue. Those are labelled real imaging and are never uploaded.</Card>
        </div>
        <h2 className="mt-8 font-display text-[18px] text-ink-50">Atlas data bundled in this build</h2>
        <p className="mt-1 text-ink-300">Converted by <code className="font-mono text-[12px]">scripts/build-atlas.ts</code> into <code className="font-mono text-[12px]">public/atlas/</code> (see NOTICE.txt there). Citations: Grabner et al. 2006 (MNI152 6th gen.); Desikan et al. 2006, Makris et al. 2006, Frazier et al. 2005, Goldstein et al. 2007 (Harvard–Oxford); Buckner et al. 2011; Ciric et al. 2022 (TemplateFlow).</p>
        <Table rows={BUNDLED} />
        <h2 className="mt-8 font-display text-[18px] text-ink-50">Other resources evaluated</h2>
        <p className="mt-1 text-ink-300">Not bundled. The table records what each would provide and the licence checks required before redistribution.</p>
        <Table rows={DATASETS} />
        <p className="mt-6 text-[12px] text-ink-400">Neuroverse is an educational tool. It provides no medical advice and must not be used for diagnosis or treatment decisions.</p>
        <p className="mt-3 text-[12px] text-ink-400">
          Created by Shakeel J. Code under the MIT licence; Neuroverse™ and its logo are trademarks of the author. If you build on it, please credit “Based on Neuroverse by Shakeel J” with a link to{' '}
          <a href="https://github.com/ShakeelJ03/neuroverse" target="_blank" rel="noreferrer" className="text-primary-accent hover:underline">the GitHub repository</a>.
        </p>
      </div>
    </div>
  );
}

function Card({ kind, title, children }: { kind: 'clinical' | 'atlas' | 'synthetic' | 'conceptual'; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <Provenance kind={kind} />
      <div className="mt-2 font-medium text-ink-50">{title}</div>
      <p className="mt-1 text-[12.5px] text-ink-300">{children}</p>
    </div>
  );
}

function Table({ rows }: { rows: { name: string; use: string; licence: string; url: string }[] }) {
  return (
    <table className="mt-3 w-full text-[12.5px]">
      <thead><tr className="text-left text-ink-400"><th className="py-1.5">Resource</th><th>Use</th><th>Licence / access</th></tr></thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.name} className="border-t hairline align-top">
            <td className="py-2 pr-3"><a href={d.url} target="_blank" rel="noreferrer" className="text-primary-accent hover:underline">{d.name}</a></td>
            <td className="py-2 pr-3 text-ink-200">{d.use}</td>
            <td className="py-2 text-ink-300">{d.licence}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
