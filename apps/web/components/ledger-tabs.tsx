'use client';

import { useState } from 'react';
import { PositionsTable, RejectionsTable } from './tables';
import type { Position, Rejection } from '@/lib/types';

type PositionRow = Position & {
  eventId: string;
  ticker: string | null;
  assetKey: string | null;
  decision: string;
};

export function LedgerTabs({
  positions,
  rejections,
}: {
  positions: PositionRow[];
  rejections: Rejection[];
}) {
  const [tab, setTab] = useState<'positions' | 'rejections'>('positions');
  return (
    <div>
      <div className="flex gap-1 border-b border-[var(--border-default)]" role="tablist" aria-label="Ledger">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'positions'}
          onClick={() => setTab('positions')}
          className={`min-h-[44px] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 ${
            tab === 'positions'
              ? 'text-[var(--text-primary)] shadow-[inset_0_-2px_0_var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Positions ({positions.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rejections'}
          onClick={() => setTab('rejections')}
          className={`min-h-[44px] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 ${
            tab === 'rejections'
              ? 'text-[var(--text-primary)] shadow-[inset_0_-2px_0_var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Rejections ({rejections.length})
        </button>
      </div>
      <div className="pt-4">
        {tab === 'positions' ? (
          positions.length > 0 ? (
            <PositionsTable positions={positions} />
          ) : (
            <Empty title="No position has been filed" body="A filed approval appears here with its paper terms, state and settlement filing." />
          )
        ) : rejections.length > 0 ? (
          <RejectionsTable rejections={rejections} />
        ) : (
          <Empty title="No rejection has been filed" body="A rejected claim appears here with its reason code, voice count and filing." />
        )}
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-10 text-center">
      <h3 className="font-body text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}
