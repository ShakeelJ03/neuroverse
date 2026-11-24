/// <reference lib="webworker" />
import { buildAll, buildLesions, MeshData, Part, Quality, wrapped } from './build';
import { DEEP_MESHES, Pathology } from './model';
import { surfaceNets } from './mesher';
import { loadMeshes } from '../atlas/load';
import { deformAtlasMeshes } from '../atlas/meshes';
import { MODEL_ONLY_MESHES } from '../atlas/labels';
import type { AnatomySource } from '../atlas/source';

interface Req {
  id: number;
  pathology: Pathology;
  quality: Quality;
  part: Part;
  source: AnatomySource;
}

async function buildAtlas(path: Pathology, quality: Quality, part: Part): Promise<MeshData[]> {
  const packed = await loadMeshes();
  if (part === 'cortex') return deformAtlasMeshes(packed, path, (id) => id.startsWith('cortex-'));
  const atlas = deformAtlasMeshes(packed, path, (id) => !id.startsWith('cortex-'));
  const model: MeshData[] = [];
  for (const def of DEEP_MESHES) {
    if (!MODEL_ONLY_MESHES.includes(def.id)) continue;
    const step = quality === 'high' ? def.step : def.step * 1.6;
    const raw = surfaceNets(wrapped(def.sdf, path), def.bmin, def.bmax, step, 2);
    if (raw.indices.length) model.push({ id: def.id, ...raw });
  }
  return [...atlas, ...model, ...buildLesions(path, quality)];
}

self.onmessage = async (ev: MessageEvent<Req>) => {
  const { id, pathology, quality, part, source } = ev.data;
  try {
    const t0 = performance.now();
    const meshes: MeshData[] = source === 'atlas' ? await buildAtlas(pathology, quality, part) : buildAll(pathology, quality, part);
    const transfer: Transferable[] = [];
    for (const m of meshes) {
      transfer.push(m.positions.buffer, m.normals.buffer, m.indices.buffer);
      if (m.colors) transfer.push(m.colors.buffer);
    }
    (self as unknown as Worker).postMessage({ id, meshes, ms: performance.now() - t0 }, transfer);
  } catch (e) {
    (self as unknown as Worker).postMessage({ id, error: String(e) });
  }
};
