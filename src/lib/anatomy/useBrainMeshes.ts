'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MeshData, Quality } from './build';
import { emptyPathology, Pathology } from './model';
import { AnatomySource, effectiveSource } from '../atlas/source';
import { useSettings } from '@/store/settings';

export type GeometryMap = Map<string, THREE.BufferGeometry>;

const workers: Worker[] = [];
let reqId = 0;
const pending = new Map<number, (r: { meshes?: MeshData[]; error?: string; ms?: number }) => void>();
const cache = new Map<string, { geoms: GeometryMap; ms: number }>();
const inflight = new Map<string, Promise<{ geoms: GeometryMap; ms: number }>>();

// two workers: one meshes the cortex, the other the remaining structures, in parallel
function getWorker(i: number) {
  if (!workers[i]) {
    const w = new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev) => {
      const cb = pending.get(ev.data.id);
      if (cb) {
        pending.delete(ev.data.id);
        cb(ev.data);
      }
    };
    workers[i] = w;
  }
  return workers[i];
}

function runPart(p: Pathology, q: Quality, part: 'cortex' | 'rest', source: AnatomySource): Promise<{ meshes: MeshData[]; ms: number }> {
  return new Promise((resolve, reject) => {
    const id = ++reqId;
    pending.set(id, (r) => (r.error || !r.meshes ? reject(new Error(r.error ?? 'Mesh generation failed')) : resolve({ meshes: r.meshes, ms: r.ms ?? 0 })));
    getWorker(part === 'cortex' ? 0 : 1).postMessage({ id, pathology: p, quality: q, part, source });
  });
}

function toGeometry(m: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
  if (m.colors) g.setAttribute('color', new THREE.BufferAttribute(m.colors, 3));
  g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/** Source used for a request: the user's preference, unless the pathology needs the parametric model. */
export const sourceFor = (p: Pathology, pref?: AnatomySource) => effectiveSource(pref ?? useSettings.getState().anatomySource, p).source;
export const pathologyKey = (p: Pathology, q: Quality, source: AnatomySource = sourceFor(p)) => source + q + JSON.stringify(p);

export function requestMeshes(p: Pathology, q: Quality, pref?: AnatomySource): Promise<{ geoms: GeometryMap; ms: number }> {
  const source = sourceFor(p, pref);
  const key = pathologyKey(p, q, source);
  const c = cache.get(key);
  if (c) return Promise.resolve(c);
  const f = inflight.get(key);
  if (f) return f;
  const prom = Promise.all([runPart(p, q, 'cortex', source), runPart(p, q, 'rest', source)])
    .then(([a, b]) => {
      inflight.delete(key);
      const geoms: GeometryMap = new Map();
      for (const m of [...a.meshes, ...b.meshes]) geoms.set(m.id, toGeometry(m));
      const entry = { geoms, ms: Math.max(a.ms, b.ms) };
      cache.set(key, entry);
      if (cache.size > 14) {
        const first = cache.keys().next().value as string;
        if (!first.endsWith('high' + JSON.stringify(emptyPathology()))) cache.delete(first);
      }
      return entry;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });
  inflight.set(key, prom);
  return prom;
}

/** Generates (or retrieves cached) meshes for a pathology state. Keeps showing the previous
 *  geometry while a new state is computing, so the viewer never flashes empty. */
export function useBrainMeshes(p: Pathology, quality: Quality = 'high') {
  const pref = useSettings((s) => s.anatomySource);
  const { source, fallback } = effectiveSource(pref, p);
  const [state, setState] = useState<{ geoms: GeometryMap | null; loading: boolean; error: string | null; ms: number }>({
    geoms: cache.get(pathologyKey(p, quality, source))?.geoms ?? null,
    loading: !cache.has(pathologyKey(p, quality, source)),
    error: null,
    ms: 0,
  });
  const key = pathologyKey(p, quality, source);
  const latest = useRef(key);
  useEffect(() => {
    latest.current = key;
    const c = cache.get(key);
    if (c) {
      setState({ geoms: c.geoms, loading: false, error: null, ms: c.ms });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    requestMeshes(p, quality, pref)
      .then((r) => {
        if (latest.current === key) setState({ geoms: r.geoms, loading: false, error: null, ms: r.ms });
      })
      .catch((e: Error) => {
        if (latest.current === key) setState((s) => ({ ...s, loading: false, error: e.message }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { ...state, source, fallback };
}
