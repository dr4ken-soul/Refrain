'use client';

import { Counter } from '@/components/counter';
import { Stagger, StaggerItem } from '@/components/motion';
import type { Metrics } from '@/lib/types';

const CELLS: Array<{ key: keyof Metrics; label: string }> = [
  { key: 'callsParsed', label: 'Calls parsed' },
  { key: 'convergenceEvents', label: 'Convergence events' },
  { key: 'paperPositionsOpened', label: 'Paper positions opened' },
  { key: 'tradesRejected', label: 'Trades rejected' },
  { key: 'positionsSettled', label: 'Positions settled' },
];

export function CurrentRecord({ metrics, mode }: { metrics: Metrics | null; mode: 'live' | 'replay' }) {
  return (
    <section
      id="current-record"
      className="border-t border-[var(--border-default)] bg-[var(--bg-primary)] py-16 md:py-24"
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-[var(--text-primary)] md:text-[2rem]">
            The current record
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {mode === 'live' ? 'Read from the running system' : 'Read from the CRE fixture set'}
          </span>
        </div>

        <Stagger className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--border-default)] md:grid-cols-3 xl:grid-cols-5">
          {CELLS.map((cell) => (
            <StaggerItem key={cell.key} className="bg-[var(--bg-surface)] px-4 py-5 md:px-5 md:py-6">
              <Counter
                value={metrics ? metrics[cell.key] : 0}
                className="font-display text-[2rem] font-extrabold leading-none tabular-nums text-[var(--text-primary)] md:text-[2.75rem]"
              />
              <div className="mt-2.5 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[var(--text-muted)]">
                {cell.label}
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <p className="mt-5 max-w-[68ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
          Counts cover the monitored data set only. A rejected trade is a completed decision, so
          it is counted and filed beside every position.
        </p>
      </div>
    </section>
  );
}
