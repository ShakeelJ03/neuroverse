'use client';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, Environment, Html, Lightformer } from '@react-three/drei';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type CameraControlsImpl from 'camera-controls';
import { useBrainMeshes } from '@/lib/anatomy/useBrainMeshes';
import type { Pathology } from '@/lib/anatomy/model';
import { CORTEX_MESHES, MESH_TO_STRUCTURE, STRUCTURE_BY_ID } from '@/data/structures';
import { Loading } from '@/components/ui';

export type ViewPreset = 'left' | 'right' | 'anterior' | 'posterior' | 'superior' | 'inferior' | 'medial' | 'oblique';
export type RenderMode = 'anatomical' | 'atlas' | 'xray';
export interface ClipState {
  enabled: boolean;
  axis: 'sagittal' | 'coronal' | 'axial';
  position: number; // mm
  flip: boolean;
}

export interface BrainViewerHandle {
  setView: (v: ViewPreset, focus?: string | null) => void;
  focusMesh: (ids: string[]) => void;
  /** anatomical centroid of a mesh; for bilateral meshes, of the half on the same side as `nearX` */
  centroid: (id: string, nearX?: number) => [number, number, number] | null;
}

export interface BrainViewerProps {
  pathology: Pathology;
  quality?: 'high' | 'low';
  /** hide the small 'Anatomy: …' source caption */
  hideSourceBadge?: boolean;
  selected?: string[]; // mesh ids
  highlight?: Record<string, string>; // mesh id → colour
  hidden?: Set<string>;
  opacity?: Record<string, number>;
  isolate?: string[] | null;
  mode?: RenderMode;
  clip?: ClipState;
  labels?: boolean;
  showLesions?: boolean;
  onSelectMesh?: (id: string | null, e?: ThreeEvent<MouseEvent>) => void;
  initialView?: ViewPreset;
  autoRotate?: boolean;
  /** dim everything that is not highlighted */
  focusHighlight?: boolean;
  showWhiteMatter?: boolean;
  /** extra scene content in anatomical (R, S, A) millimetre coordinates */
  extra?: React.ReactNode;
  /** mesh ids to frame once geometry is ready */
  autoFocus?: string[] | null;
  className?: string;
  overlay?: React.ReactNode;
  /** exploded view: per-piece displacement in anatomical mm (key = mesh id, or `id|L` / `id|R` when split) */
  offsets?: Record<string, [number, number, number]>;
  /** render bilateral meshes as separate left/right halves (needed to pull the hemispheres apart) */
  splitSides?: boolean;
  /** multiply the default camera distance (e.g. 1.4 to fit an exploded view) */
  distanceScale?: number;
}

/** Meshes that cross the midline as one piece and are never split into halves. */
const MIDLINE = new Set(['corpus-callosum', 'third-ventricle', 'fourth-ventricle', 'midbrain', 'pons', 'medulla', 'pineal-gland', 'pituitary-gland', 'hypothalamus', 'cerebellum', 'fornix']);
const splitCache = new WeakMap<THREE.BufferGeometry, [THREE.BufferGeometry, THREE.BufferGeometry]>();
function splitGeometry(g: THREE.BufferGeometry): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const c = splitCache.get(g);
  if (c) return c;
  const idx = g.index!.array as ArrayLike<number>;
  const pos = g.attributes.position.array as ArrayLike<number>;
  const L: number[] = [], R: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const cx = pos[idx[t] * 3] + pos[idx[t + 1] * 3] + pos[idx[t + 2] * 3];
    (cx < 0 ? L : R).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  const make = (tris: number[]) => {
    const h = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) h.setAttribute(name, attr);
    h.setIndex(new THREE.BufferAttribute(new Uint32Array(tris), 1));
    h.computeBoundingSphere();
    h.computeBoundingBox();
    return h;
  };
  const out: [THREE.BufferGeometry, THREE.BufferGeometry] = [make(L), make(R)];
  splitCache.set(g, out);
  return out;
}

/** Eases its children toward a target displacement each frame. */
function OffsetGroup({ target, children }: { target: [number, number, number]; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4.5);
    g.position.x += (target[0] - g.position.x) * k;
    g.position.y += (target[1] - g.position.y) * k;
    g.position.z += (target[2] - g.position.z) * k;
  });
  return <group ref={ref}>{children}</group>;
}
const ZERO: [number, number, number] = [0, 0, 0];

const LESION_COLORS: Record<string, string> = {
  ms: '#f5e9a8', infarct: '#7aa7ff', gbm: '#c2416b', lowgrade: '#d58bd6', meningioma: '#d6a26e', metastasis: '#e36f8a',
  ich: '#a3141f', sdh: '#8c1520', edh: '#b31b26', sah: '#c0202c', contusion: '#9c2430', abscess: '#e2c56b',
  inflammation: '#f0b35a', fcd: '#f08f5a', avm: '#d43b5c', schwannoma: '#d9b36c', adenoma: '#e795b0',
  medulloblastoma: '#c15ab8', dai: '#7b1220', venous: '#4a3cc9', wmh: '#f3eccb', aneurysm: '#e0313d',
};

export const lesionColor = (kind: string) => LESION_COLORS[kind] ?? '#ff6680';

function meshBaseColor(id: string, mode: RenderMode): string {
  if (id.startsWith('cortex-')) {
    if (mode === 'atlas') return STRUCTURE_BY_ID[MESH_TO_STRUCTURE[id]]?.color ?? '#ffffff';
    if (id === 'cortex-hilum') return '#efe6d0';
    return '#ffffff';
  }
  const s = STRUCTURE_BY_ID[MESH_TO_STRUCTURE[id]];
  if (mode === 'atlas') return s?.color ?? '#cccccc';
  // realistic-ish tissue colouring
  if (id.includes('ventricle')) return '#7f9fd6';
  if (id === 'corpus-callosum' || id === 'internal-capsule' || id === 'fornix' || id === 'cerebral-white-matter') return '#eee5cf';
  if (id === 'substantia-nigra') return '#3a2b2b';
  if (id === 'cerebellum') return '#c99482';
  if (['midbrain', 'pons', 'medulla'].includes(id)) return '#d8b6a6';
  if (id === 'pituitary-gland') return '#d99aa8';
  if (id === 'pineal-gland') return '#d8b38a';
  return '#c08e86';
}

const CAMERA_DIST = 520;
const VIEWS: Record<ViewPreset, [number, number, number]> = {
  left: [-1, 0.05, 0.0],
  right: [1, 0.05, 0.0],
  anterior: [0, 0.05, -1],
  posterior: [0, 0.05, 1],
  superior: [0, 1, -0.001],
  inferior: [0, -1, 0.001],
  medial: [0.999, 0.02, 0.0],
  oblique: [-0.75, 0.42, -0.55],
};

function Scene(props: BrainViewerProps & { controls: React.RefObject<CameraControlsImpl | null>; geoms: Map<string, THREE.BufferGeometry> }) {
  const { geoms, mode = 'anatomical', selected = [], highlight = {}, hidden, opacity = {}, isolate, clip, labels, showLesions = true } = props;
  const { gl } = useThree();
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  const clipPlane = useMemo(() => {
    if (!clip?.enabled) return null;
    // normals expressed in the anatomical frame, then mapped to world (world z = −anterior)
    const n = clip.axis === 'sagittal' ? new THREE.Vector3(1, 0, 0) : clip.axis === 'coronal' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    if (clip.flip) n.negate();
    return new THREE.Plane(n.clone().negate(), clip.flip ? -clip.position : clip.position);
  }, [clip?.enabled, clip?.axis, clip?.position, clip?.flip]);

  const { offsets, splitSides } = props;
  const entries = useMemo(() => {
    const out: [string, string, THREE.BufferGeometry][] = [];
    for (const [id, g] of geoms) {
      const lesion = id.startsWith('lesion:') || id.startsWith('edema:');
      if (splitSides && !lesion && !MIDLINE.has(id) && g.index) {
        const [l, r] = splitGeometry(g);
        out.push([id, `${id}|L`, l], [id, `${id}|R`, r]);
      } else out.push([id, id, g]);
    }
    return out;
  }, [geoms, splitSides]);
  const anyHighlight = Object.keys(highlight).length > 0;

  return (
    // The anatomical frame (Right, Superior, Anterior) is left-handed; mirroring z makes it
    // right-handed for WebGL so left/right are rendered correctly.
    <group scale={[1, 1, -1]}>
      {entries.map(([id, pieceKey, g]) => {
        const isLesion = id.startsWith('lesion:') || id.startsWith('edema:');
        if (isLesion && !showLesions) return null;
        if (hidden?.has(id)) return null;
        if (isolate && isolate.length && !isolate.includes(id) && !isLesion) return null;
        const isCortex = CORTEX_MESHES.includes(id);
        const isSel = selected.includes(id);
        const isHi = id in highlight;
        let op = opacity[id] ?? 1;
        if (mode === 'xray' && (isCortex || id === 'cerebral-white-matter')) op = Math.min(op, isSel || isHi ? 0.55 : 0.12);
        if (props.focusHighlight && anyHighlight && !isHi && !isSel && !isLesion) op = Math.min(op, isCortex ? 0.16 : 0.3);
        if (id === 'cerebral-white-matter' && !props.showWhiteMatter && !isolate?.includes(id)) return null; // hidden unless asked for
        let color = meshBaseColor(id, mode);
        let kind = '';
        if (isLesion) {
          const lid = id.split(':')[1];
          const l = props.pathology.lesions.find((x) => x.id === lid);
          kind = l?.kind ?? '';
          color = id.startsWith('edema:') ? '#9fd8ff' : lesionColor(kind);
          op = id.startsWith('edema:') ? 0.28 : 0.95;
        }
        if (isHi && !isLesion) color = highlight[id];
        const transparent = op < 0.999;
        if (isSel && !isLesion) color = mode === 'atlas' ? color : '#f2b08c';
        const emissive = isSel ? '#7a3a1c' : hover === id ? '#3a2418' : isHi && !isLesion ? '#3a1a10' : '#000000';
        return (
          <OffsetGroup key={pieceKey} target={offsets?.[pieceKey] ?? offsets?.[id] ?? ZERO}>
          <mesh
            geometry={g}
            renderOrder={transparent ? (isCortex ? 10 : 5) : 0}
            onPointerOver={(e) => {
              if (isLesion || op < 0.2) return;
              e.stopPropagation();
              setHover(id);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHover((h) => (h === id ? null : h));
              document.body.style.cursor = '';
            }}
            onClick={(e) => {
              if (op < 0.2 && !isSel) return;
              if (e.delta > 4) return; // was a drag
              e.stopPropagation();
              props.onSelectMesh?.(isLesion ? id : id, e);
            }}
          >
            <meshPhysicalMaterial
              key={transparent ? "t" : "o"} // three.js compiles opacity support per material; recreate when it toggles
              vertexColors={isCortex && !isHi && !isSel}
              color={color}
              roughness={isLesion ? 0.4 : 0.58}
              metalness={0}
              clearcoat={isLesion ? 0.3 : 0.12}
              clearcoatRoughness={0.6}
              sheen={0.35}
              sheenColor={'#ffd9cf'}
              sheenRoughness={0.6}
              transparent={transparent}
              opacity={op}
              depthWrite={!transparent || op > 0.6}
              side={clipPlane ? THREE.DoubleSide : THREE.FrontSide}
              emissive={emissive}
              emissiveIntensity={isSel ? 0.9 : 0.6}
              clippingPlanes={clipPlane && !isLesion ? [clipPlane] : []}
            />
          </mesh>
          </OffsetGroup>
        );
      })}
      {labels && <Labels {...props} geoms={geoms} />}
      {props.extra}
    </group>
  );
}

function Labels({ geoms, hidden, isolate, selected = [] }: BrainViewerProps & { geoms: Map<string, THREE.BufferGeometry> }) {
  const items = useMemo(() => {
    const out: { id: string; name: string; pos: THREE.Vector3 }[] = [];
    const want = isolate?.length ? isolate : ['cortex-frontal', 'cortex-parietal', 'cortex-temporal', 'cortex-occipital', 'cerebellum', 'pons', 'cortex-precentral', 'cortex-postcentral', ...selected];
    for (const id of new Set(want)) {
      const g = geoms.get(id);
      if (!g || hidden?.has(id)) continue;
      const info = STRUCTURE_BY_ID[MESH_TO_STRUCTURE[id]];
      if (!info) continue;
      const box = g.boundingBox!;
      const c = new THREE.Vector3();
      box.getCenter(c);
      // put cortical labels on the left lateral surface, others above the centre
      if (id.startsWith('cortex-')) c.x = box.min.x + 4;
      out.push({ id, name: info.name, pos: c });
    }
    return out;
  }, [geoms, hidden, isolate, selected]);
  return (
    <>
      {items.map((it) => (
        <Html key={it.id} position={it.pos} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md border border-white/10 bg-ink-900/80 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-50 shadow-lg backdrop-blur">
            {it.name}
          </div>
        </Html>
      ))}
    </>
  );
}

function ControlsBridge({ controls, initial, autoRotate, dist = CAMERA_DIST }: { controls: React.RefObject<CameraControlsImpl | null>; initial: ViewPreset; autoRotate?: boolean; dist?: number }) {
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const v = VIEWS[initial];
    c.setLookAt(v[0] * dist, v[1] * dist + 5, v[2] * dist + 12, 0, -5, 12, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!autoRotate) return;
    let raf = 0;
    const tick = () => {
      controls.current?.rotate(0.0016, 0, false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate, controls]);
  return null;
}

export const BrainViewer = forwardRef<BrainViewerHandle, BrainViewerProps>(function BrainViewer(props, ref) {
  const { geoms, loading, error, ms, source, fallback } = useBrainMeshes(props.pathology, props.quality ?? 'high');
  const controls = useRef<CameraControlsImpl | null>(null);
  const handleRef = useRef<BrainViewerHandle | null>(null);
  const focusKey = props.autoFocus?.join(',') ?? '';
  useEffect(() => {
    if (!geoms || !focusKey) return;
    const t = setTimeout(() => handleRef.current?.focusMesh(focusKey.split(',')), 150);
    return () => clearTimeout(t);
  }, [geoms, focusKey]);

  const imperative: BrainViewerHandle = {
    centroid: (id, nearX) => {
      const g = geoms?.get(id);
      if (!g) return null;
      const p = g.attributes.position.array as ArrayLike<number>;
      let all = [0, 0, 0, 0];
      const side = [0, 0, 0, 0];
      for (let i = 0; i < p.length; i += 3) {
        all[0] += p[i]; all[1] += p[i + 1]; all[2] += p[i + 2]; all[3]++;
        if (nearX !== undefined && Math.sign(p[i]) === Math.sign(nearX)) { side[0] += p[i]; side[1] += p[i + 1]; side[2] += p[i + 2]; side[3]++; }
      }
      const bilateral = !MIDLINE.has(id) && side[3] > 0 && side[3] < all[3] * 0.85;
      if (bilateral) all = side;
      if (!all[3]) return null;
      // snap to the nearest vertex so curved structures (e.g. the callosal arch) are hit, not the space they enclose
      const m = [all[0] / all[3], all[1] / all[3], all[2] / all[3]];
      let best = Infinity, bi = 0;
      for (let i = 0; i < p.length; i += 3) {
        if (bilateral && Math.sign(p[i]) !== Math.sign(nearX!)) continue;
        const d = (p[i] - m[0]) ** 2 + (p[i + 1] - m[1]) ** 2 + (p[i + 2] - m[2]) ** 2;
        if (d < best) { best = d; bi = i; }
      }
      const n = g.attributes.normal?.array as ArrayLike<number> | undefined;
      const inset = n ? 1.2 : 0; // step just inside the surface
      return [p[bi] - (n ? n[bi] : 0) * inset, p[bi + 1] - (n ? n[bi + 1] : 0) * inset, p[bi + 2] - (n ? n[bi + 2] : 0) * inset];
    },
    setView: (v, focus) => {
      const c = controls.current;
      if (!c) return;
      const d = VIEWS[v];
      let target = new THREE.Vector3(0, -5, 12);
      let dist = CAMERA_DIST * (props.distanceScale ?? 1);
      if (focus && geoms?.get(focus)) {
        const s = geoms.get(focus)!.boundingSphere!;
        target = s.center.clone();
        target.z = -target.z;
        dist = Math.max(90, s.radius * 3.2);
      }
      c.setLookAt(target.x + d[0] * dist, target.y + d[1] * dist, target.z + d[2] * dist, target.x, target.y, target.z, true);
    },
    focusMesh: (ids) => {
      const c = controls.current;
      if (!c || !geoms) return;
      const box = new THREE.Box3();
      ids.forEach((id) => {
        const g = geoms.get(id);
        if (g?.boundingBox) box.union(g.boundingBox);
      });
      if (box.isEmpty()) return;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      sphere.center.z = -sphere.center.z;
      const pos = new THREE.Vector3();
      c.getPosition(pos);
      const tgt = new THREE.Vector3();
      c.getTarget(tgt);
      const dir = pos.sub(tgt).normalize();
      const dist = Math.max(70, sphere.radius * 3.4);
      const p = sphere.center.clone().add(dir.multiplyScalar(dist));
      c.setLookAt(p.x, p.y, p.z, sphere.center.x, sphere.center.y, sphere.center.z, true);
    },
  };
  handleRef.current = imperative;
  useImperativeHandle(ref, () => imperative);

  return (
    <div className={props.className ?? 'relative h-full w-full'}>
      <div className="viewport-bg absolute inset-0" />
      <div className="grid-overlay pointer-events-none absolute inset-0" />
      <Canvas
        camera={{ fov: 30, near: 1, far: 3000, position: [-CAMERA_DIST, 10, 0] }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
        onPointerMissed={() => props.onSelectMesh?.(null)}
        className="!absolute inset-0"
      >
        <ambientLight intensity={0.12} />
        <directionalLight position={[-200, 260, 180]} intensity={1.15} color={'#fff1e8'} />
        <directionalLight position={[220, -60, -200]} intensity={0.35} color={'#9fb8ff'} />
        <directionalLight position={[0, -200, 120]} intensity={0.15} color={'#ffd0c0'} />
        <Environment resolution={128} environmentIntensity={0.55}>
          <Lightformer intensity={1.2} position={[0, 4, 6]} scale={[10, 4, 1]} color="#ffffff" />
          <Lightformer intensity={0.6} position={[-6, 1, -2]} scale={[4, 8, 1]} color="#7fb6ff" />
          <Lightformer intensity={0.4} position={[6, -2, 2]} scale={[4, 6, 1]} color="#ffd6c4" />
        </Environment>
        <CameraControls ref={controls} makeDefault minDistance={40} maxDistance={900} smoothTime={0.35} draggingSmoothTime={0.08} />
        <ControlsBridge controls={controls} initial={props.initialView ?? 'oblique'} autoRotate={props.autoRotate} dist={CAMERA_DIST * (props.distanceScale ?? 1)} />
        {geoms && <Scene {...props} controls={controls} geoms={geoms} />}
      </Canvas>
      {!geoms && !error && (
        <div className="absolute inset-0 grid place-items-center">
          <Loading
            label={source === 'atlas' ? 'Loading MNI152 atlas anatomy' : 'Generating anatomical model'}
            sub={source === 'atlas' ? 'Fetching pre-built Harvard–Oxford surfaces (~5 MB, cached after the first visit)…' : 'Extracting iso-surfaces for 35 structures from the signed-distance model (runs in a Web Worker)…'}
          />
        </div>
      )}
      {geoms && loading && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border hairline bg-ink-900/80 px-3 py-1 text-[11px] text-ink-200 backdrop-blur">
          Recomputing anatomy…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="glass max-w-sm rounded-xl p-4 text-center text-[12.5px] text-rose-accent">
            Could not generate the 3D model: {error}
            <div className="mt-2 text-ink-300">Your browser must support Web Workers and WebGL2.</div>
          </div>
        </div>
      )}
      {geoms && !props.hideSourceBadge && (
        <div className="pointer-events-none absolute bottom-2 left-3 max-w-[60%] font-mono text-[10px] leading-snug text-ink-400">
          {source === 'atlas' ? 'Anatomy: MNI152 · Harvard–Oxford atlas' : 'Anatomy: parametric model'}
          {fallback && <span className="block text-amber-accent/90">Atlas can’t show {fallback} — using the model</span>}
        </div>
      )}
      {geoms && ms > 0 && (
        <div className="pointer-events-none absolute bottom-2 right-3 font-mono text-[10px] text-ink-500">mesh {Math.round(ms)} ms</div>
      )}
      {props.overlay}
    </div>
  );
});
