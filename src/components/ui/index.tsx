'use client';
import clsx from 'clsx';
import { ButtonHTMLAttributes, ReactNode } from 'react';

export function Panel({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('glass rounded-xl', className)} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({ title, kicker, right }: { title: ReactNode; kicker?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b hairline px-4 py-3">
      <div className="min-w-0">
        {kicker && <div className="label-chip mb-0.5 text-ink-300">{kicker}</div>}
        <div className="truncate font-display text-[14px] font-medium text-ink-50">{title}</div>
      </div>
      {right}
    </div>
  );
}

type Variant = 'default' | 'ghost' | 'accent' | 'subtle';
export function Button({
  variant = 'default',
  size = 'md',
  active,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'icon'; active?: boolean }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'h-7 px-2.5 text-[12px]',
        size === 'md' && 'h-8 px-3 text-[12.5px]',
        size === 'icon' && 'h-8 w-8 text-[12px]',
        variant === 'default' && 'border hairline bg-white/[0.04] text-ink-100 hover:bg-white/[0.08] hover:text-ink-50',
        variant === 'ghost' && 'text-ink-200 hover:bg-white/[0.05] hover:text-ink-50',
        variant === 'subtle' && 'bg-white/[0.03] text-ink-200 hover:bg-white/[0.07]',
        variant === 'accent' && 'bg-primary-accent/90 text-ink-950 hover:bg-primary-accent',
        active && 'border-primary-accent/40 bg-primary-accent/10 text-primary-accent hover:bg-primary-accent/15 hover:text-primary-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={clsx('inline-flex rounded-lg border hairline bg-ink-900/70 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12px]',
            value === o.value ? 'bg-white/[0.09] text-ink-50 shadow-sm' : 'text-ink-300 hover:text-ink-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  onCommit,
}: {
  label?: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => ReactNode;
  onCommit?: (v: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      {label !== undefined && (
        <div className="mb-1 flex items-center justify-between text-[11.5px]">
          <span className="text-ink-200">{label}</span>
          <span className="font-mono text-ink-100">{format ? format(value) : value}</span>
        </div>
      )}
      <input
        type="range"
        className="nv-range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={(e) => onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
      />
    </label>
  );
}

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'primary' | 'tertiary' | 'amber' | 'rose' | 'emerald' | 'secondary'; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset',
        tone === 'default' && 'bg-white/[0.04] text-ink-200 ring-white/10',
        tone === 'primary' && 'bg-primary-accent/10 text-primary-accent ring-primary-accent/25',
        tone === 'tertiary' && 'bg-tertiary-accent/10 text-tertiary-accent ring-tertiary-accent/25',
        tone === 'amber' && 'bg-amber-accent/10 text-amber-accent ring-amber-accent/25',
        tone === 'rose' && 'bg-rose-accent/10 text-rose-accent ring-rose-accent/25',
        tone === 'emerald' && 'bg-emerald-accent/10 text-emerald-accent ring-emerald-accent/25',
        tone === 'secondary' && 'bg-secondary-accent/10 text-secondary-accent ring-secondary-accent/25',
        className,
      )}
    >
      {children}
    </span>
  );
}

export type ProvenanceKind = 'clinical' | 'atlas' | 'synthetic' | 'conceptual';
const PROV: Record<ProvenanceKind, { label: string; tone: 'emerald' | 'secondary' | 'amber' | 'tertiary'; desc: string }> = {
  clinical: { label: 'Real imaging', tone: 'emerald', desc: 'Real clinical or research imaging data' },
  atlas: { label: 'Atlas data', tone: 'secondary', desc: 'Derived from an anatomical atlas' },
  synthetic: { label: 'Synthetic imaging', tone: 'amber', desc: 'Physics-based simulation from a digital phantom — not a patient scan' },
  conceptual: { label: 'Conceptual model', tone: 'tertiary', desc: 'Educational visualisation; not derived from patient data' },
};
export function Provenance({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  const p = PROV[kind];
  return (
    <span title={p.desc} className={className}>
      <Badge tone={p.tone}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {p.label}
      </Badge>
    </span>
  );
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('label-chip mb-2 text-ink-300', className)}>{children}</div>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border hairline bg-white/5 px-1 font-mono text-[10px] text-ink-200">{children}</kbd>;
}

export function Loading({ label = 'Loading', sub }: { label?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
        <div className="scanbar absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary-accent to-transparent" />
      </div>
      <div className="label-chip text-ink-200">{label}</div>
      {sub && <div className="max-w-xs text-[11.5px] text-ink-400">{sub}</div>}
    </div>
  );
}
