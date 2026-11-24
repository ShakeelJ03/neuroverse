'use client';
import { useEffect, useRef, useState } from 'react';
import type { Img } from '@/lib/imaging/modalities';
import { Cmap, lut } from '@/lib/imaging/colormaps';
import { Axis, pixelToScene, sceneToPixel } from '@/lib/imaging/slice';
import type { V3 } from '@/lib/anatomy/sdf';

export interface Overlay {
  img: Img;
  cmap: Cmap;
  opacity: number;
  /** values below this (relative 0..1 of window) are transparent */
  threshold?: number;
  window?: number;
  level?: number;
}

export interface SliceCanvasProps {
  axis: Axis;
  img: Img | null;
  window: number;
  level: number;
  cmap?: Cmap;
  overlay?: Overlay | null;
  cross: V3;
  onCross?: (p: V3) => void;
  onScroll?: (delta: number) => void;
  onWL?: (w: number, l: number) => void;
  tool?: 'cross' | 'wl' | 'pan';
  title?: React.ReactNode;
  corner?: React.ReactNode;
  loading?: boolean;
  /** per-frame overlay painter (MRE waves) */
  animate?: (ctx: ImageData, t: number) => boolean;
  showCross?: boolean;
}

const ORIENT: Record<Axis, [string, string, string, string]> = {
  // left, right, top, bottom
  axial: ['R', 'L', 'A', 'P'],
  coronal: ['R', 'L', 'S', 'I'],
  sagittal: ['A', 'P', 'S', 'I'],
};

export function SliceCanvas(p: SliceCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<[number, number]>([0, 0]);
  const [size, setSize] = useState(300);
  const drag = useRef<{ x: number; y: number; w: number; l: number; px: number; py: number; mode: string } | null>(null);
  const imageData = useRef<ImageData | null>(null);
  const baseRGBA = useRef<Uint8ClampedArray | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.max(120, Math.min(el.clientWidth, el.clientHeight))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // compose base + overlay into an offscreen ImageData
  useEffect(() => {
    const img = p.img;
    if (!img) return;
    const n = img.n;
    const out = new ImageData(n, n);
    const L = lut(p.cmap ?? 'gray');
    const lo = p.level - p.window / 2;
    const w = p.window || 1;
    const ov = p.overlay;
    const OL = ov ? lut(ov.cmap) : null;
    const olo = ov ? (ov.level ?? ov.img.level) - (ov.window ?? ov.img.window) / 2 : 0;
    const ow = ov ? ov.window ?? ov.img.window : 1;
    for (let i = 0; i < n * n; i++) {
      let t = (img.data[i] - lo) / w;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const k = Math.round(t * 255) * 3;
      let r = L[k], g = L[k + 1], b = L[k + 2];
      if (ov && OL) {
        let u = (ov.img.data[i] - olo) / ow;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        if (u > (ov.threshold ?? 0.02)) {
          const q = Math.round(u * 255) * 3;
          const a = ov.opacity;
          r = r + (OL[q] - r) * a;
          g = g + (OL[q + 1] - g) * a;
          b = b + (OL[q + 2] - b) * a;
        }
      }
      out.data[i * 4] = r;
      out.data[i * 4 + 1] = g;
      out.data[i * 4 + 2] = b;
      out.data[i * 4 + 3] = 255;
    }
    imageData.current = out;
    baseRGBA.current = new Uint8ClampedArray(out.data);
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.img, p.window, p.level, p.cmap, p.overlay]);

  const off = useRef<HTMLCanvasElement | null>(null);
  const draw = (frameT?: number) => {
    const c = canvas.current;
    const id = imageData.current;
    if (!c || !id) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== size * dpr) {
      c.width = size * dpr;
      c.height = size * dpr;
    }
    const ctx = c.getContext('2d')!;
    if (!off.current) off.current = document.createElement('canvas');
    const o = off.current;
    o.width = id.width;
    o.height = id.height;
    if (p.animate && frameT !== undefined && baseRGBA.current) {
      id.data.set(baseRGBA.current);
      p.animate(id, frameT);
    }
    o.getContext('2d')!.putImageData(id, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, c.width, c.height);
    const s = (size * dpr * zoom) / id.width;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(s, 0, 0, s, (size * dpr * (1 - zoom)) / 2 + pan[0] * dpr, (size * dpr * (1 - zoom)) / 2 + pan[1] * dpr);
    ctx.drawImage(o, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (p.showCross !== false) {
      const [ci, cj] = sceneToPixel(p.axis, p.cross, id.width);
      const X = ((ci / id.width) * size * zoom + (size * (1 - zoom)) / 2 + pan[0]) * dpr;
      const Y = ((cj / id.width) * size * zoom + (size * (1 - zoom)) / 2 + pan[1]) * dpr;
      ctx.strokeStyle = 'rgba(79,209,232,0.55)';
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(X, 0); ctx.lineTo(X, Y - 10 * dpr);
      ctx.moveTo(X, Y + 10 * dpr); ctx.lineTo(X, c.height);
      ctx.moveTo(0, Y); ctx.lineTo(X - 10 * dpr, Y);
      ctx.moveTo(X + 10 * dpr, Y); ctx.lineTo(c.width, Y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, zoom, pan, p.cross, p.axis]);

  useEffect(() => {
    if (!p.animate) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      draw((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.animate, size, zoom, pan, p.cross]);

  const toScene = (e: React.PointerEvent | React.MouseEvent): V3 | null => {
    const c = canvas.current;
    const n = p.img?.n;
    if (!c || !n) return null;
    const r = c.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const i = ((mx - pan[0] - (size * (1 - zoom)) / 2) / (size * zoom)) * n;
    const j = ((my - pan[1] - (size * (1 - zoom)) / 2) / (size * zoom)) * n;
    if (i < 0 || j < 0 || i >= n || j >= n) return null;
    const pos = p.axis === 'axial' ? p.cross[1] : p.axis === 'coronal' ? p.cross[2] : p.cross[0];
    return pixelToScene(p.axis, pos, i - 0.5, j - 0.5, n);
  };

  const [L, R, T, B] = ORIENT[p.axis];
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-lg border hairline bg-black">
      <div ref={wrap} className="absolute inset-0 overflow-hidden">
        <canvas
          ref={canvas}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: size, height: size, cursor: (p.tool ?? 'cross') === 'cross' ? 'crosshair' : p.tool === 'wl' ? 'ns-resize' : 'grab', touchAction: 'none' }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            const mode = e.button === 2 || e.button === 1 || p.tool === 'pan' ? 'pan' : p.tool === 'wl' || e.shiftKey ? 'wl' : 'cross';
            drag.current = { x: e.clientX, y: e.clientY, w: p.window, l: p.level, px: pan[0], py: pan[1], mode };
            if (mode === 'cross') {
              const s = toScene(e);
              if (s) p.onCross?.(s);
            }
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (d.mode === 'pan') setPan([d.px + dx, d.py + dy]);
            else if (d.mode === 'wl') p.onWL?.(Math.max(1e-3, d.w * (1 + dx / 200)), d.l * (1 - dy / 300) + (d.l === 0 ? -dy * 0.01 : 0));
            else {
              const s = toScene(e);
              if (s) p.onCross?.(s);
            }
          }}
          onPointerUp={() => (drag.current = null)}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) setZoom((z) => Math.min(6, Math.max(0.6, z * (e.deltaY < 0 ? 1.12 : 0.89))));
            else p.onScroll?.(e.deltaY > 0 ? -1 : 1);
          }}
        />
        {/* orientation markers */}
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold text-amber-accent/80">{L}</span>
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] font-semibold text-amber-accent/80">{R}</span>
        <span className="pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 font-mono text-[11px] font-semibold text-amber-accent/80">{T}</span>
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 font-mono text-[11px] font-semibold text-amber-accent/80">{B}</span>
        {p.loading && (
          <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-primary-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-accent" /> computing
          </div>
        )}
        {!p.img && <div className="absolute inset-0 grid place-items-center font-mono text-[11px] text-ink-400">simulating slice…</div>}
      </div>
      <div className="pointer-events-none absolute left-2 top-2 max-w-[70%] font-mono text-[10.5px] leading-tight text-ink-100 [text-shadow:0_1px_2px_#000]">{p.title}</div>
      <div className="pointer-events-none absolute bottom-2 left-2 font-mono text-[10px] leading-tight text-ink-300 [text-shadow:0_1px_2px_#000]">
        {p.corner}
        <div>
          W {fmt(p.window)} L {fmt(p.level)} · {zoom.toFixed(1)}×
        </div>
      </div>
      <div className="absolute bottom-1.5 right-1.5 flex gap-1">
        <button className="rounded bg-white/5 px-1.5 text-[11px] text-ink-200 hover:bg-white/10" onClick={() => setZoom((z) => Math.min(6, z * 1.25))}>＋</button>
        <button className="rounded bg-white/5 px-1.5 text-[11px] text-ink-200 hover:bg-white/10" onClick={() => setZoom((z) => Math.max(0.6, z / 1.25))}>－</button>
        <button className="rounded bg-white/5 px-1.5 text-[10px] text-ink-200 hover:bg-white/10" onClick={() => { setZoom(1); setPan([0, 0]); }}>fit</button>
      </div>
    </div>
  );
}

const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2));
