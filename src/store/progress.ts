'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ProgressState {
  tourSteps: Record<string, number[]>; // tour id → completed step indices
  /** lesion-localisation cases opened to the explanation */
  casesStudied: string[];
  toggleStep: (tour: string, i: number) => void;
  markStudied: (id: string) => void;
  reset: () => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    const k = '__nv_test';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  }
});

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      tourSteps: {},
      casesStudied: [],
      toggleStep: (tour, i) =>
        set((s) => {
          const cur = new Set(s.tourSteps[tour] ?? []);
          if (cur.has(i)) cur.delete(i);
          else cur.add(i);
          return { tourSteps: { ...s.tourSteps, [tour]: [...cur] } };
        }),
      markStudied: (id) => set((s) => (s.casesStudied.includes(id) ? s : { casesStudied: [...s.casesStudied, id] })),
      reset: () => set({ tourSteps: {}, casesStudied: [] }),
    }),
    { name: 'neuroverse-progress', storage: safeStorage, version: 2, migrate: (old) => ({ ...(old as object), casesStudied: [] }) as unknown as ProgressState },
  ),
);
