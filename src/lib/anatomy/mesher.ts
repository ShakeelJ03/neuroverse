// Naive Surface Nets isosurface extraction + Laplacian smoothing + vertex normals.
import type { V3 } from './sdf';

export interface RawMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

export function surfaceNets(f: (x: number, y: number, z: number) => number, bmin: V3, bmax: V3, step: number, smoothIters = 2): RawMesh {
  const nx = Math.ceil((bmax[0] - bmin[0]) / step) + 1;
  const ny = Math.ceil((bmax[1] - bmin[1]) / step) + 1;
  const nz = Math.ceil((bmax[2] - bmin[2]) / step) + 1;
  const field = new Float32Array(nx * ny * nz);
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) {
    const z = bmin[2] + k * step;
    for (let j = 0; j < ny; j++) {
      const y = bmin[1] + j * step;
      for (let i = 0; i < nx; i++) {
        // force the bounding box border to be "outside" so meshes are closed
        const border = i === 0 || j === 0 || k === 0 || i === nx - 1 || j === ny - 1 || k === nz - 1;
        field[idx(i, j, k)] = border ? 1 : f(bmin[0] + i * step, y, z);
      }
    }
  }

  const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
  const cellVert = new Int32Array(cnx * cny * cnz).fill(-1);
  const cidx = (i: number, j: number, k: number) => i + cnx * (j + cny * k);
  const pos: number[] = [];
  const corner = new Float32Array(8);
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (let k = 0; k < cnz; k++)
    for (let j = 0; j < cny; j++)
      for (let i = 0; i < cnx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = field[idx(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a], vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1;
          const bx = b & 1, by = (b >> 1) & 1, bz = (b >> 2) & 1;
          sx += ax + (bx - ax) * t;
          sy += ay + (by - ay) * t;
          sz += az + (bz - az) * t;
          n++;
        }
        cellVert[cidx(i, j, k)] = pos.length / 3;
        pos.push(bmin[0] + (i + sx / n) * step, bmin[1] + (j + sy / n) * step, bmin[2] + (k + sz / n) * step);
      }

  const tri: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tri.push(a, c, b, a, d, c);
    else tri.push(a, b, c, a, c, d);
  };
  for (let k = 0; k < cnz; k++)
    for (let j = 0; j < cny; j++)
      for (let i = 0; i < cnx; i++) {
        const v0 = field[idx(i, j, k)] < 0;
        // x-edge
        if (j > 0 && k > 0 && v0 !== field[idx(i + 1, j, k)] < 0)
          quad(cellVert[cidx(i, j - 1, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j - 1, k)], !v0);
        // y-edge
        if (i > 0 && k > 0 && v0 !== field[idx(i, j + 1, k)] < 0)
          quad(cellVert[cidx(i - 1, j, k - 1)], cellVert[cidx(i - 1, j, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j, k - 1)], !v0);
        // z-edge
        if (i > 0 && j > 0 && v0 !== field[idx(i, j, k + 1)] < 0)
          quad(cellVert[cidx(i - 1, j - 1, k)], cellVert[cidx(i, j - 1, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], !v0);
      }

  const positions = new Float32Array(pos);
  const indices = new Uint32Array(tri);
  if (smoothIters > 0) laplacian(positions, indices, smoothIters);
  // ensure outward winding (positive signed volume)
  let vol = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
    vol +=
      positions[a] * (positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1]) -
      positions[a + 1] * (positions[b] * positions[c + 2] - positions[b + 2] * positions[c]) +
      positions[a + 2] * (positions[b] * positions[c + 1] - positions[b + 1] * positions[c]);
  }
  if (vol < 0) for (let t = 0; t < indices.length; t += 3) { const s = indices[t + 1]; indices[t + 1] = indices[t + 2]; indices[t + 2] = s; }
  const normals = vertexNormals(positions, indices);
  return { positions, normals, indices };
}

function laplacian(p: Float32Array, idx: Uint32Array, iters: number) {
  const n = p.length / 3;
  const acc = new Float32Array(p.length);
  const cnt = new Uint16Array(n);
  for (let it = 0; it < iters; it++) {
    acc.fill(0);
    cnt.fill(0);
    for (let t = 0; t < idx.length; t += 3) {
      for (let e = 0; e < 3; e++) {
        const a = idx[t + e], b = idx[t + ((e + 1) % 3)];
        acc[a * 3] += p[b * 3]; acc[a * 3 + 1] += p[b * 3 + 1]; acc[a * 3 + 2] += p[b * 3 + 2]; cnt[a]++;
        acc[b * 3] += p[a * 3]; acc[b * 3 + 1] += p[a * 3 + 1]; acc[b * 3 + 2] += p[a * 3 + 2]; cnt[b]++;
      }
    }
    const lam = 0.45;
    for (let v = 0; v < n; v++) {
      if (!cnt[v]) continue;
      for (let c = 0; c < 3; c++) {
        const avg = acc[v * 3 + c] / cnt[v];
        p[v * 3 + c] += (avg - p[v * 3 + c]) * lam;
      }
    }
  }
}

export function vertexNormals(p: Float32Array, idx: Uint32Array): Float32Array {
  const nrm = new Float32Array(p.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) {
      nrm[o] += nx; nrm[o + 1] += ny; nrm[o + 2] += nz;
    }
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
  }
  return nrm;
}
