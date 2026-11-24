export type Cmap = 'gray' | 'hot' | 'inferno' | 'jet' | 'viridis' | 'wave';

const stops: Record<Exclude<Cmap, 'gray'>, [number, [number, number, number]][]> = {
  hot: [[0, [0, 0, 0]], [0.35, [180, 20, 0]], [0.65, [255, 150, 0]], [0.9, [255, 240, 120]], [1, [255, 255, 255]]],
  inferno: [[0, [0, 0, 4]], [0.25, [87, 16, 110]], [0.5, [188, 55, 84]], [0.75, [249, 142, 9]], [1, [252, 255, 164]]],
  jet: [[0, [0, 0, 140]], [0.15, [0, 40, 255]], [0.4, [0, 220, 255]], [0.6, [120, 255, 120]], [0.8, [255, 200, 0]], [1, [200, 0, 0]]],
  viridis: [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]],
  wave: [[0, [30, 90, 255]], [0.45, [10, 12, 30]], [0.5, [0, 0, 0]], [0.55, [30, 10, 12]], [1, [255, 80, 40]]],
};

const LUTS = new Map<Cmap, Uint8Array>();
export function lut(c: Cmap): Uint8Array {
  let l = LUTS.get(c);
  if (l) return l;
  l = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    if (c === 'gray') {
      l[i * 3] = l[i * 3 + 1] = l[i * 3 + 2] = i;
      continue;
    }
    const s = stops[c];
    let k = 0;
    while (k < s.length - 2 && t > s[k + 1][0]) k++;
    const [t0, c0] = s[k], [t1, c1] = s[k + 1];
    const f = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    for (let ch = 0; ch < 3; ch++) l[i * 3 + ch] = Math.round(c0[ch] + (c1[ch] - c0[ch]) * f);
  }
  LUTS.set(c, l);
  return l;
}

export const cssGradient = (c: Cmap) => {
  const l = lut(c);
  const parts = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const i = Math.round(t * 255);
    return `rgb(${l[i * 3]},${l[i * 3 + 1]},${l[i * 3 + 2]}) ${t * 100}%`;
  });
  return `linear-gradient(90deg, ${parts.join(',')})`;
};
