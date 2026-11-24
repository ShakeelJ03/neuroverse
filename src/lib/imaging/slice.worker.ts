/// <reference lib="webworker" />
import { computeSlice, Axis } from './slice';
import type { Pathology } from '../anatomy/model';
import type { AnatomySource } from '../atlas/source';
import { loadVolumes } from '../atlas/load';

self.onmessage = async (ev: MessageEvent<{ id: number; axis: Axis; pos: number; pathology: Pathology; n: number; source: AnatomySource }>) => {
  const { id, axis, pos, pathology, n, source } = ev.data;
  try {
    const atlas = source === 'atlas' ? await loadVolumes() : undefined;
    const s = computeSlice(axis, pos, pathology, n, atlas);
    (self as unknown as Worker).postMessage({ id, slice: s }, [s.props.buffer, s.labels.buffer]);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, error: String(e) });
  }
};
