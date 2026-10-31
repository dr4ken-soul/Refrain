import { AppShell } from '@/components/app-shell';
import { safeGet } from '@/lib/api';
import type { Position, ReplayStatus, Ruleset } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RecordLayout({ children }: { children: React.ReactNode }) {
  const [replay, rules, positions] = await Promise.all([
    safeGet<ReplayStatus>('/api/replay/status'),
    safeGet<Ruleset>('/api/rules/active'),
    safeGet<{ positions: Position[] }>('/api/ledger/positions'),
  ]);
  const open = (positions?.positions ?? []).filter((row) => row.status === 'open').length;
  return (
    <AppShell mode={replay?.mode ?? 'replay'} rulesVersion={rules?.version ?? null} openPositions={open}>
      {children}
    </AppShell>
  );
}
