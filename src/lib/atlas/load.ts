// Fetches and decompresses atlas assets (runs inside workers; each worker keeps its own copy).
import { AtlasMeta, PackedMesh, unpackMeshes } from './volume';

const BASE = '/atlas/';

async function gunzip(name: string): Promise<ArrayBuffer> {
  const res = await fetch(BASE + name, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Atlas asset ${name} could not be loaded (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  // Some hosts serve .gz with Content-Encoding: gzip, so the browser has already unpacked it.
  const b = new Uint8Array(buf, 0, 2);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export interface AtlasVolumes {
  meta: AtlasMeta;
  t1: Uint8Array;
  seg: Uint8Array;
  ctx: Uint8Array;
}

let volP: Promise<AtlasVolumes> | null = null;
export function loadVolumes(): Promise<AtlasVolumes> {
  if (!volP)
    volP = Promise.all([
      fetch(BASE + 'meta.json', { cache: 'force-cache' }).then((r) => r.json() as Promise<AtlasMeta>),
      gunzip('t1.u8.gz'),
      gunzip('seg.u8.gz'),
      gunzip('ctx.u8.gz'),
    ]).then(([meta, t1, seg, ctx]) => ({ meta, t1: new Uint8Array(t1), seg: new Uint8Array(seg), ctx: new Uint8Array(ctx) }));
  volP.catch(() => (volP = null));
  return volP;
}

let meshP: Promise<PackedMesh[]> | null = null;
export function loadMeshes(): Promise<PackedMesh[]> {
  if (!meshP) meshP = gunzip('meshes.bin.gz').then(unpackMeshes);
  meshP.catch(() => (meshP = null));
  return meshP;
}
