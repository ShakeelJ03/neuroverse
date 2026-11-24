'use client';
import { useEffect, useRef, useState } from 'react';
import type { Pathology } from '../anatomy/model';
import { Axis, SLICE_N, SliceData } from './slice';
import { AnatomySource, effectiveSource } from '../atlas/source';
import { useSettings } from '@/store/settings';

// small worker pool so the three orthogonal planes compute in parallel
const POOL = 3;
const workers: Worker[] = [];
const pending = new Map<number, (r: { slice?: SliceData; error?: string }) => void>();
let rid = 0;
let rr = 0;
const cache = new Map<string, SliceData>();
const inflight = new Map<string, Promise<SliceData>>();

function worker(): Worker {
  if (workers.length < POOL) {
    const w = new Worker(new URL('./slice.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev) => {
      const cb = pending.get(ev.data.id);
      if (cb) {
        pending.delete(ev.data.id);
        cb(ev.data);
      }
    };
    workers.push(w);
    return w;
  }
  return workers[rr++ % POOL];
}

const srcOf = (p: Pathology, pref?: AnatomySource) => effectiveSource(pref ?? useSettings.getState().anatomySource, p).source;
export const sliceKey = (axis: Axis, pos: number, p: Pathology, n: number, source: AnatomySource = srcOf(p)) => `${source}|${axis}|${pos.toFixed(1)}|${n}|${JSON.stringify(p)}`;

export function requestSlice(axis: Axis, pos: number, p: Pathology, n = SLICE_N, pref?: AnatomySource): Promise<SliceData> {
  const source = srcOf(p, pref);
  const key = sliceKey(axis, pos, p, n, source);
  const c = cache.get(key);
  if (c) return Promise.resolve(c);
  const f = inflight.get(key);
  if (f) return f;
  const prom = new Promise<SliceData>((res, rej) => {
    const id = ++rid;
    pending.set(id, (r) => {
      inflight.delete(key);
      if (!r.slice) return rej(new Error(r.error ?? 'slice failed'));
      cache.set(key, r.slice);
      if (cache.size > 90) cache.delete(cache.keys().next().value as string);
      res(r.slice);
    });
    worker().postMessage({ id, axis, pos, pathology: p, n, source });
  });
  inflight.set(key, prom);
  return prom;
}

/** Returns the latest available slice; keeps the previous one on screen while computing. */
export function useSlice(axis: Axis, pos: number, p: Pathology, n = SLICE_N) {
  const pref = useSettings((s) => s.anatomySource);
  const key = sliceKey(axis, pos, p, n, srcOf(p, pref));
  const [state, setState] = useState<{ slice: SliceData | null; loading: boolean; error: string | null }>({ slice: cache.get(key) ?? null, loading: !cache.has(key), error: null });
  const latest = useRef(key);
  useEffect(() => {
    latest.current = key;
    const c = cache.get(key);
    if (c) return setState({ slice: c, loading: false, error: null });
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      requestSlice(axis, pos, p, n, pref)
        .then((s) => latest.current === key && setState({ slice: s, loading: false, error: null }))
        .catch((e: Error) => latest.current === key && setState((st) => ({ ...st, loading: false, error: e.message })));
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
