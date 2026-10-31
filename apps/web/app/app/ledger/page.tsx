import { LedgerTabs } from '@/components/ledger-tabs';
import { PageHeader } from '@/components/ui';
import { safeGet } from '@/lib/api';
import type { Position, Rejection } from '@/lib/types';

export const dynamic = 'force-dynamic';

type PositionRow = Position & {
  eventId: string;
  ticker: string | null;
  assetKey: string | null;
  decision: string;
};

export default async function LedgerPage() {
  const [positions, rejections] = await Promise.all([
    safeGet<{ positions: PositionRow[] }>('/api/ledger/positions'),
    safeGet<{ rejections: Rejection[] }>('/api/ledger/rejections'),
  ]);

  return (
    <div>
      <PageHeader
        title="Ledger"
        support="Paper positions and rejections, each with the filing that recorded it on Sepolia."
        right={
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Paper only
          </span>
        }
      />
      <div className="px-4 md:px-8">
        <LedgerTabs positions={positions?.positions ?? []} rejections={rejections?.rejections ?? []} />
      </div>
      <p className="px-4 py-5 text-[13px] leading-relaxed text-[var(--text-secondary)] md:px-8">
        A rejected trade is a completed decision. It is counted beside every position, not hidden
        from the record.
      </p>
    </div>
  );
}
