import Link from 'next/link';
import { Stamp } from '@/components/stamp';
import { PositionsTable } from '@/components/tables';
import { PageHeader } from '@/components/ui';
import { safeGet } from '@/lib/api';
import { directionLabel, money, price, shortHash, timeOfDay, txUrl, utcStamp } from '@/lib/format';
import type {
  Board,
  CaseDetail,
  Position,
  Rejection,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

type PositionRow = Position & {
  eventId: string;
  ticker: string | null;
  assetKey: string | null;
  decision: string;
};

export default async function BoardPage() {
  const [board, positions, rejections] = await Promise.all([
    safeGet<Board>('/api/board'),
    safeGet<{ positions: PositionRow[] }>('/api/ledger/positions'),
    safeGet<{ rejections: Rejection[] }>('/api/ledger/rejections'),
  ]);
  const featured = board?.featuredEventId
    ? await safeGet<CaseDetail>(`/api/events/${board.featuredEventId}`)
    : null;

  const openPositions = (positions?.positions ?? []).filter((row) => row.status === 'open');
  const rejectionRows = (rejections?.rejections ?? []).slice(0, 3);
  const caseFile = featured?.event ?? null;

  return (
    <div>
      <PageHeader
        title="Board"
        support="The committed CRE fixture set shows calls, verdicts and paper positions."
        right={
          <div className="flex items-center gap-2 rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {board?.mode === 'live' ? 'Live' : 'CRE fixture replay'}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
              {board ? timeOfDay(board.updatedAt, true) : 'No read'}
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 px-4 md:px-8 lg:grid-cols-12">
        <Panel title="Latest calls" right={`${board?.callsParsed ?? 0} parsed`} className="lg:col-span-7">
          <div className="divide-y divide-[var(--border-subtle)]">
            {(board?.latestCalls ?? []).map((call) => (
              <div key={call.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[12px] text-[var(--text-primary)]">{call.sourceLabel}</span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                    {timeOfDay(call.timestamp)}
                  </span>
                  <span className="rounded-[4px] border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                    {call.ticker}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {directionLabel(call.direction)}
                  </span>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                  {call.excerpt}
                </p>
              </div>
            ))}
            {(board?.latestCalls ?? []).length === 0 ? (
              <p className="px-4 py-8 text-sm text-[var(--text-secondary)]">
                No calls are loaded in this replay set.
              </p>
            ) : null}
          </div>
          <div className="flex justify-end border-t border-[var(--border-subtle)] px-4 py-3">
            <Link
              href="/app/calls"
              className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline"
            >
              All calls
            </Link>
          </div>
        </Panel>

        <Panel
          title="Verdict"
          right={caseFile ? `Rules v${caseFile.rulesetVersion}` : 'No case'}
          className="lg:col-span-5"
        >
          {caseFile ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5">
                <span className="font-mono text-sm text-[var(--text-primary)]">
                  {caseFile.asset.ticker} · {caseFile.asset.chain}
                </span>
                <Stamp kind={caseFile.decision === 'approved' ? 'approved' : caseFile.decision === 'rejected' ? 'rejected' : 'deferred'} />
              </div>
              <div className="px-4 py-2">
                <Row label="Asset" value={caseFile.asset.ticker} />
                {caseFile.position ? (
                  <>
                    <Row label="Direction" value={directionLabel(caseFile.position.direction)} />
                    <Row label="Entry" value={price(caseFile.position.entryPrice)} />
                    <Row label="Paper size" value={money(caseFile.position.sizeUsdCents)} />
                    <Row label="Stop" value={price(caseFile.position.stopPrice)} />
                    <Row label="Target" value={price(caseFile.position.targetPrice)} />
                    <Row label="Expires" value={utcStamp(caseFile.position.expiresAt)} />
                  </>
                ) : (
                  <Row label="Reason code" value={caseFile.reasonCode ?? 'Not recorded'} />
                )}
                <Row label="Case hash" value={shortHash(caseFile.bundleHash, 10, 6)} />
              </div>
              <div className="border-t border-[var(--border-subtle)] px-4 py-3">
                <Link
                  href={`/app/convergence/${caseFile.eventId}`}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-primary)] underline-offset-4 hover:underline"
                >
                  Open case file
                </Link>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-sm leading-relaxed text-[var(--text-secondary)]">
              No approved case with an open position is available in this replay set.
            </p>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 md:px-8">
        <Panel title="Open positions" right={`${openPositions.length} open`}>
          {openPositions.length > 0 ? (
            <div className="p-0">
              <PositionsTable positions={openPositions} />
            </div>
          ) : (
            <p className="px-4 py-8 text-sm leading-relaxed text-[var(--text-secondary)]">
              No paper position is open. A filed approval appears here with its stop, target and
              expiry.
            </p>
          )}
        </Panel>

        <Panel title="Latest rejections" right={`${rejectionRows.length} shown`}>
          {rejectionRows.length > 0 ? (
            <div className="divide-y divide-[var(--border-subtle)]">
              {rejectionRows.map((row) => (
                <div key={row.eventId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Stamp kind="rejected" compact />
                    <div>
                      <div className="font-mono text-[12px] text-[var(--text-primary)]">
                        {row.ticker} · {directionLabel(row.direction)}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                        {row.reasonCode} · {row.independentVoiceCount} voices · {utcStamp(row.decidedAt)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {txUrl(row.verdictTx) ? (
                      <a
                        href={txUrl(row.verdictTx) as string}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] tabular-nums text-[var(--text-muted)] underline-offset-4 hover:underline"
                      >
                        {shortHash(row.verdictTx, 8, 6)}
                      </a>
                    ) : null}
                    <Link
                      href={`/app/convergence/${row.eventId}`}
                      className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-primary)] underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-8 text-sm leading-relaxed text-[var(--text-secondary)]">
              No rejection is filed in this replay set.
            </p>
          )}
        </Panel>
      </div>
      <div className="h-6" />
    </div>
  );
}

function Panel({
  title,
  right,
  children,
  className = '',
}: {
  title: string;
  right?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {title}
        </h2>
        {right ? (
          <span className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">{right}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border-subtle)] py-2.5 last:border-b-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="text-right font-mono text-sm tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
