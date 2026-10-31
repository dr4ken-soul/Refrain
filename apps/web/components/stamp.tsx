import { Check, Clock, Close } from './icons';

export type StampKind = 'approved' | 'rejected' | 'deferred' | 'open' | 'settled';

const styles: Record<StampKind, string> = {
  approved: 'border-[var(--text-primary)] text-[var(--text-primary)]',
  rejected: 'border-[var(--accent)] text-[var(--accent-hover)]',
  deferred: 'border-[var(--border-default)] text-[var(--text-secondary)]',
  open: 'border-[var(--border-default)] text-[var(--text-secondary)]',
  settled: 'border-[var(--text-primary)] text-[var(--text-primary)]',
};

const labels: Record<StampKind, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  deferred: 'Deferred',
  open: 'Open',
  settled: 'Settled',
};

export function Stamp({ kind, compact = false }: { kind: StampKind; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border-2 font-mono font-semibold uppercase tracking-[0.18em] ${styles[kind]} ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      {kind === 'approved' || kind === 'settled' ? <Check className="h-3.5 w-3.5" /> : null}
      {kind === 'rejected' ? <Close className="h-3.5 w-3.5" /> : null}
      {kind === 'deferred' ? <Clock className="h-3.5 w-3.5" /> : null}
      {kind === 'open' ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden="true" />
      ) : null}
      {labels[kind]}
    </span>
  );
}
