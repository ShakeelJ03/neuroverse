'use client';
import { useEffect, useState } from 'react';

/** True on screens at least as wide as Tailwind's `lg` breakpoint (1024 px). */
export function useWide(query = '(min-width: 1024px)') {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return wide;
}
