import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from './icons';

export function PrimaryAction({
  href,
  label = 'Open evidence board',
  inverted = false,
}: {
  href: string;
  label?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-[44px] items-center gap-3 rounded-[6px] px-5 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-colors duration-200 ${
        inverted
          ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] hover:bg-[var(--accent)] hover:text-[var(--text-inverse)]'
          : 'bg-[var(--text-primary)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]'
      }`}
    >
      {label}
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[oklch(0.965_0.005_228/0.14)] transition-transform duration-200 group-hover:-translate-y-[1px] group-hover:translate-x-[1px]">
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

export function SecondaryAction({
  href,
  label,
  external = false,
  compact = false,
}: {
  href: string;
  label: string;
  external?: boolean;
  compact?: boolean;
}) {
  const classes = `inline-flex items-center gap-2 rounded-[6px] border border-[var(--border-default)] bg-transparent font-mono font-medium uppercase tracking-[0.14em] text-[var(--text-primary)] transition-colors duration-200 hover:border-[var(--text-primary)] ${
    compact ? 'min-h-[36px] px-3 py-2 text-[10px]' : 'min-h-[44px] px-5 py-3 text-[11px]'
  }`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes}>
        {label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-3.5 w-3.5"
        >
          <path d="M14 4h6v6M20 4l-9 9" />
          <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
        </svg>
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {label}
    </Link>
  );
}

export function DataLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)] ${className}`}
    >
      {children}
    </span>
  );
}

export function DataValue({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-sm tabular-nums text-[var(--text-primary)] ${className}`}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  support,
  right,
}: {
  title: string;
  support: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-5 pt-6 md:px-8 md:pt-8">
      <div>
        <h1 className="font-display text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.1rem]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-[var(--text-secondary)]">
          {support}
        </p>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function SectionShell({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12">{children}</div>
    </section>
  );
}
