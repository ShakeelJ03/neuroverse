'use client';
import { useEffect, useRef, useState } from 'react';
import { Upload, FileWarning } from 'lucide-react';
import { Provenance, Segmented } from '@/components/ui';

/**
 * Real-data path: view your own NIfTI / DICOM-converted volumes with Niivue (WebGL2).
 * Files are read locally in the browser and never uploaded anywhere.
 */
export function NiftiViewer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const nv = useRef<unknown>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const [layout, setLayout] = useState<'multi' | 'axial' | 'coronal' | 'sagittal' | 'render'>('multi');
  const [info, setInfo] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Niivue } = await import('@niivue/niivue');
      if (cancelled || !canvas.current) return;
      const v = new Niivue({ backColor: [0.03, 0.035, 0.045, 1], show3Dcrosshair: true, crosshairColor: [0.31, 0.82, 0.91, 1] });
      await v.attachToCanvas(canvas.current);
      nv.current = v;
    })().catch((e) => {
      setStatus('error');
      setMsg(`Niivue could not start (WebGL2 required): ${String(e)}`);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = nv.current as any;
    if (!v) return;
    const map = { multi: v.sliceTypeMultiplanar, axial: v.sliceTypeAxial, coronal: v.sliceTypeCoronal, sagittal: v.sliceTypeSagittal, render: v.sliceTypeRender };
    v.setSliceType(map[layout]);
  }, [layout, status]);

  const load = async (files: FileList | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = nv.current as any;
    if (!files || !files.length || !v) return;
    const f = files[0];
    if (!/\.(nii|nii\.gz|mgz|mgh|nrrd|mha|mhd)$/i.test(f.name)) {
      setStatus('error');
      setMsg('Unsupported file type. Use NIfTI (.nii / .nii.gz), MGH/MGZ, NRRD or MHA. Convert DICOM series first (e.g., dcm2niix).');
      return;
    }
    setStatus('loading');
    try {
      await v.loadFromFile(f);
      const vol = v.volumes?.[0];
      const dims = vol?.hdr?.dims?.slice(1, 4)?.join(' × ');
      const pix = vol?.hdr?.pixDims?.slice(1, 4)?.map((x: number) => x.toFixed(2)).join(' × ');
      setInfo(`${f.name} · ${dims ?? '?'} voxels · ${pix ?? '?'} mm`);
      setStatus('ready');
    } catch (e) {
      setStatus('error');
      setMsg(`Could not read the file: ${String(e)}`);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary-accent/90 px-3 py-1.5 text-[12.5px] font-medium text-ink-950 hover:bg-primary-accent">
          <Upload className="h-3.5 w-3.5" /> Open NIfTI volume…
          <input type="file" className="hidden" accept=".nii,.gz,.mgz,.mgh,.nrrd,.mha,.mhd" onChange={(e) => load(e.target.files)} />
        </label>
        <Segmented
          size="sm"
          value={layout}
          onChange={setLayout}
          options={[{ value: 'multi', label: 'MPR' }, { value: 'axial', label: 'Axial' }, { value: 'coronal', label: 'Coronal' }, { value: 'sagittal', label: 'Sagittal' }, { value: 'render', label: '3D render' }]}
        />
        {status === 'ready' && <Provenance kind="clinical" />}
        <span className="font-mono text-[11px] text-ink-300">{info}</span>
      </div>
      <div
        className="relative flex-1 overflow-hidden rounded-xl border hairline bg-black"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          load(e.dataTransfer.files);
        }}
      >
        <canvas ref={canvas} className="h-full w-full" />
        {status !== 'ready' && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-8">
            <div className="max-w-lg text-center">
              {status === 'error' ? (
                <div className="text-[12.5px] text-rose-accent"><FileWarning className="mx-auto mb-2 h-6 w-6" />{msg}</div>
              ) : status === 'loading' ? (
                <div className="label-chip text-primary-accent">Loading volume…</div>
              ) : (
                <>
                  <div className="font-display text-[18px] text-ink-50">Bring real imaging data</div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-300">
                    Drop a NIfTI file here. It is read locally in your browser with Niivue and is never uploaded. Openly licensed sources include the MNI ICBM152 2009 templates, OpenNeuro datasets (CC0), IXI (CC BY-SA 3.0) and the BraTS / Medical Segmentation Decathlon tumour sets (check each licence). Data you load is labelled as real imaging; the simulator panes stay labelled synthetic.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
