import { WatchlistScreen } from '@/components/watchlist-screen';
import { PageHeader } from '@/components/ui';
import { safeGet } from '@/lib/api';
import type { Kol } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const data = await safeGet<{ rows: Kol[] }>('/api/kols');
  const rows = data?.rows ?? [];
  return (
    <div>
      <PageHeader
        title="Watchlist"
        support="The public channels Refrain reads. Every source keeps its own reliability record."
        right={
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {rows.filter((row) => row.isActive).length} active
          </span>
        }
      />
      <WatchlistScreen rows={rows} />
      <div className="h-6" />
    </div>
  );
}
