import { RulesScreen } from '@/components/rules-screen';
import { PageHeader } from '@/components/ui';
import { safeGet } from '@/lib/api';
import type { RulesResponse, Ruleset } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const [active, all] = await Promise.all([
    safeGet<Ruleset>('/api/rules/active'),
    safeGet<RulesResponse>('/api/rules'),
  ]);
  return (
    <div>
      <PageHeader
        title="Rules"
        support="One public mandate, versioned by hash. Every verdict keeps the rules that produced it."
        right={
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {active ? `Active v${active.version}` : 'No read'}
          </span>
        }
      />
      <RulesScreen ruleset={active} versions={all?.versions ?? []} />
      <div className="h-6" />
    </div>
  );
}
