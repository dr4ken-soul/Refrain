import Link from 'next/link';
import { KolTable } from '@/components/kol-table';
import { DataLabel, PageHeader } from '@/components/ui';
import { safeGet } from '@/lib/api';
import { directionLabel, score, shortHash, timeOfDay, utcStamp } from '@/lib/format';
import type { Kol } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function KolsPage({
  searchParams,
}: {
  searchParams: Promise<{ handle?: string }>;
}) {
  const params = await searchParams;
  const data = await safeGet<{ rows: Kol[] }>('/api/kols');
  const rows = data?.rows ?? [];
  const selected =
    rows.find((row) => row.handle.toLowerCase() === (params.handle ?? '').toLowerCase()) ?? null;

  return (
    <div>
      <PageHeader
        title="KOL index"
        support="The audited watchlist, with calls tracked and the record each channel has settled."
        right={
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {rows.length} channels
          </span>
        }
      />

      <div className="px-4 md:px-8">
        {rows.length > 0 ? (
          <KolTable rows={rows} linkBase="/app/kols" />
        ) : (
          <div className="rounded-[8px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-10 text-center">
            <h3 className="font-body text-base font-semibold text-[var(--text-primary)]">
              The watchlist is empty
            </h3>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-[var(--text-secondary)]">
              Add a public channel from the watchlist screen to start a reliability record.
            </p>
            <Link
              href="/app/watchlist"
              className="mt-4 inline-flex min-h-[36px] items-center rounded-[6px] border border-[var(--border-default)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-primary)]"
            >
              Open watchlist
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6 px-4 md:px-8" id="channel-record">
        {selected ? (
          <section className="overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-4 md:px-5">
              <div>
                <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                  {selected.handle}
                </h2>
                <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
                  {selected.displayName} · {selected.platform}
                </p>
                <p className="mt-1 font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
                  {selected.sourceHash}
                </p>
              </div>
              <div className="text-right">
                <DataLabel>Reliability</DataLabel>
                <div className="mt-0.5 font-display text-3xl font-extrabold tabular-nums text-[var(--text-primary)]">
                  {score(selected.score)}
                </div>
                <a
                  href={`https://t.me/${selected.handle.replace(/^@/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block font-mono text-[11px] text-[var(--text-secondary)] underline-offset-4 hover:underline"
                >
                  t.me/{selected.handle.replace(/^@/, '')}
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-[var(--border-subtle)] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              <div className="p-4 md:p-5">
                <DataLabel>Recent calls</DataLabel>
                <div className="mt-3 space-y-3">
                  {selected.recentCalls.length > 0 ? (
                    selected.recentCalls.map((call) => (
                      <div key={call.id} className="border-t border-[var(--border-subtle)] pt-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[12px] text-[var(--text-primary)]">
                            {call.ticker} · {directionLabel(call.direction)}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                            {timeOfDay(call.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                          {call.excerpt}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      No call from this channel is in the replay set.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 md:p-5">
                <DataLabel>Score movement</DataLabel>
                <div className="mt-3 space-y-2.5">
                  {selected.scoreHistory.length > 0 ? (
                    selected.scoreHistory.map((row) => (
                      <div
                        key={`${row.date}-${row.reason}`}
                        className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5 font-mono text-[12px] tabular-nums"
                      >
                        <span className="text-[var(--text-secondary)]">{utcStamp(row.date)}</span>
                        <span className="text-[var(--text-primary)]">
                          {row.delta > 0 ? '+' : ''}
                          {row.delta} · {row.reason}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      No score movement yet. Scores move only when a tracked call settles, so a
                      quiet channel holds its neutral starting score.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 md:p-5">
                <DataLabel>Promotion flags</DataLabel>
                <div className="mt-3">
                  {selected.flags.length > 0 ? (
                    <ul className="space-y-2.5">
                      {selected.flags.map((flag) => (
                        <li
                          key={flag}
                          className="border-t border-[var(--border-subtle)] pt-2.5 text-[13px] leading-relaxed text-[var(--text-secondary)]"
                        >
                          {flag}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      No promotion flag has been recorded. A referral marker or paid placement would
                      appear here with the post that carried it.
                    </p>
                  )}
                </div>
                <div className="mt-4 border-t border-[var(--border-subtle)] pt-3 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                  {selected.callsTracked} calls tracked · {selected.wins} hit · {selected.losses} stopped ·{' '}
                  {selected.expired} expired
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-[8px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-8 text-center">
            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
              Select a channel to open its recent calls, score movement and promotion flags.
            </p>
          </div>
        )}
      </div>
      <div className="h-6" />
    </div>
  );
}
