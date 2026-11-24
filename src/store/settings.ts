'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AnatomySource } from '@/lib/atlas/source';

interface SettingsState {
  anatomySource: AnatomySource;
  setAnatomySource: (s: AnatomySource) => void;
}

const storage = createJSONStorage(() => {
  try {
    localStorage.setItem('__nv_s', '1');
    localStorage.removeItem('__nv_s');
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  }
});

export const useSettings = create<SettingsState>()(
  persist((set) => ({ anatomySource: 'atlas', setAnatomySource: (anatomySource) => set({ anatomySource }) }), {
    name: 'neuroverse-settings',
    storage,
  }),
);
