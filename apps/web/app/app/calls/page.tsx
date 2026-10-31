import Link from 'next/link';
import { CallsTable } from '@/components/tables';
import { PageHeader } from '@/components/ui';
import { safeGet } from '@/lib/api';
import type { Call } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'structured', label: 'Structured' },
  { key: 'memecoin', label: 'Memecoin' },
  { key: 'ads', label: 'Ads filtered' },
  { key: 'duplicates', label: 'Duplicates' },
];

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const params = await searchParams;
  const filter = FILTERS.some((row) => row.key === params.filter) ? params.filter ?? 'all' : 'all';
  const data = await safeGet<{ calls: Call[]; total: number }>('/api/calls?limit=200');
  const calls = data?.calls ?? [];

  const rows = calls.filter((call) => {
    if (filter === 'structured') return call.parser === 'structured';
    if (filter === 'memecoin') return call.assetKey.startsWith('solana:');
    if (filter === 'ads') return call.isAdvertisement;
    if (filter === 'duplicates') return call.duplicateOf !== null;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Calls"
        support="Every ingested call, including the ones the parser filtered out before convergence."
        right={
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {rows.length} {rows.length === 1 ? 'record' : 'records'}
          </span>
        }
      />

      <div className="flex flex-wrap gap-2 px-4 md:px-8">
        {FILTERS.map((row) => (
          <Link
            key={row.key}
            href={row.key === 'all' ? '/app/calls' : `/app/calls?filter=${row.key}`}
            className={`inline-flex min-h-[40px] items-center rounded-[6px] border px-3.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-200 ${
              filter === row.key
                ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverse)]'
                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {row.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 px-4 md:px-8">
        {rows.length > 0 ? (
          <CallsTable calls={rows} />
        ) : (
          <div className="rounded-[8px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-10 text-center">
            <h3 className="font-body text-base font-semibold text-[var(--text-primary)]">
              No call matches this filter
            </h3>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-[var(--text-secondary)]">
              {filter === 'ads'
                ? 'No advertisement has been filtered in this replay set, so the record is empty.'
                : filter === 'duplicates'
                  ? 'No duplicate post has been detected in this replay set.'
                  : 'The replay set holds no call for this filter. Clear the filter to see the full record.'}
            </p>
            <Link
              href="/app/calls"
              className="mt-4 inline-flex min-h-[36px] items-center rounded-[6px] border border-[var(--border-default)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-primary)]"
            >
              Show all calls
            </Link>
          </div>
        )}
      </div>
      <p className="px-4 py-5 text-[13px] leading-relaxed text-[var(--text-secondary)] md:px-8">
        A filtered advertisement never enters convergence. Repeated posts from one channel are shown
        so the independence rule can be inspected rather than assumed.
      </p>
    </div>
  );
}
