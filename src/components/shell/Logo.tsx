import { useId } from 'react';

/**
 * NEUROVERSE mark: a side-on brain cut like a linocut, with one axial slice lifted off the
 * top — anatomy and imaging in one shape. Two flat colours, no gradients or glow.
 * Keep in sync with src/app/icon.svg.
 */
const TILE = '#e0895f';
const PAPER = '#f3ead9';

const BRAIN =
  'M9 34C7 24 13 15 24 13C30 8 41 9 46 13C54 14 58 22 56.5 30C55.5 36 50.5 39 44.5 39H40.5C37.5 43 30.5 44 25.5 42C20.5 44 13.5 42 11.5 39C10 38 9 36 9 34Z' +
  'M42 41C47.5 39.5 53.5 41 53.5 45.5C53.5 49.5 47.5 51 43.5 49C41 47.5 40.5 43.5 42 41Z' +
  'M35 41.5L40 40.5C39.6 44.5 40 48 41 52H36C35.3 48.5 35 45.5 35 41.5Z';
const SULCI =
  'M31 11.5C29 16 33 19 30.5 25M18 30C23 27.5 30 28.5 36 32M14 20C17 21 18 24 16.5 27M44 13.5C42.5 17 45 20 49.5 20.5M23 19C25 21 24 23.5 26 25M39 22C41 25 45 25 48 27.5M44 39C42 37 40 37 38.5 38M44 44.5C47 43.5 50 44 52.5 45.5M43.5 47.5C46.5 47 49 47.5 51 48.5';

function Brain() {
  return (
    <>
      <path d={BRAIN} fill={PAPER} />
      <path d={SULCI} fill="none" stroke={TILE} strokeWidth="1.9" strokeLinecap="round" />
    </>
  );
}

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <clipPath id={`${id}t`}><rect width="64" height="25" /></clipPath>
        <clipPath id={`${id}b`}><rect y="28" width="64" height="36" /></clipPath>
      </defs>
      <rect width="64" height="64" rx="14" fill={TILE} />
      <g transform="translate(0 3)">
        <g clipPath={`url(#${id}t)`} transform="translate(0 -2.5)"><Brain /></g>
        <g clipPath={`url(#${id}b)`}><Brain /></g>
      </g>
    </svg>
  );
}
