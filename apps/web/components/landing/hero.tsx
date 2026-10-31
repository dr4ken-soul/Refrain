'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Counter } from '@/components/counter';
import { External } from '@/components/icons';
import { HeroLoad } from '@/components/motion';
import { Stamp } from '@/components/stamp';
import { PrimaryAction, SecondaryAction } from '@/components/ui';
import { apiGet } from '@/lib/api';
import {
  directionLabel,
  directionLabel as dirLabel,
  excerptWithMention,
  formatOffset,
  money,
  offsetBetween,
  price,
  shortHash,
  timeOfDay,
  txUrl,
  utcStamp,
} from '@/lib/format';
import type { Board, CaseFile, Call } from '@/lib/types';

type Tab = 'calls' | 'convergence' | 'verdict';

export function Hero({
  board: initialBoard,
  caseFile,
  error,
}: {
  board: Board | null;
  caseFile: CaseFile | null;
  error: boolean;
}) {
  const [board, setBoard] = useState(initialBoard);
  const [tab, setTab] = useState<Tab>('calls');

  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await apiGet<Board>('/api/board');
        if (!cancelled) setBoard(next);
      } catch {
        // The rendered record stays on screen; the next visible tick retries.
      }
    };
    const interval = window.setInterval(load, 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const calls = board?.latestCalls ?? [];
  const contributions = useMemo(
    () =>
      [...(caseFile?.contributions ?? [])].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      ),
    [caseFile],
  );
  const reliability = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of caseFile?.reliability ?? []) {
      map.set(row.sourceHash, row.scoreHundredths / 100);
    }
    return map;
  }, [caseFile]);

  const mode = board?.mode ?? 'replay';

  return (
    <section
      id="evidence-board"
      className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--bg-primary)] pt-[52px] md:pt-14"
    >
      <div className="mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 gap-10 px-4 pb-12 pt-10 md:px-8 md:pb-16 md:pt-16 lg:grid-cols-12 xl:px-12">
        <div className="relative z-10 lg:col-span-7 xl:col-span-6">
          <HeroLoad delay={0.15}>
            <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              {mode === 'live' ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]" />
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              )}
              {mode === 'live' ? 'Live' : 'CRE fixture replay'} · {board?.channelsMonitored ?? 0} watchlist channels
            </div>
          </HeroLoad>

          <HeroLoad delay={0.28}>
            <h1 className="mt-6 font-display text-[2.85rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-[var(--text-primary)] [text-wrap:balance] sm:text-6xl lg:text-[4.35rem] xl:text-[5rem]">
              <span className="block xl:whitespace-nowrap">KOL calls become evidence</span>
              <span className="block xl:whitespace-nowrap">before they become trades</span>
            </h1>
          </HeroLoad>

          <HeroLoad delay={0.46}>
            <p className="mt-6 max-w-[58ch] font-body text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
              Refrain watches public Telegram market voices, tests agreement against fixed
              rules, and records paper positions or rejections through Chainlink CRE.
            </p>
          </HeroLoad>

          <HeroLoad delay={0.62}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryAction href="/app" />
              <SecondaryAction href="#anatomy-of-a-verdict" label="Read one verdict" />
            </div>
          </HeroLoad>
        </div>

        <HeroLoad
          delay={0.74}
          className="relative z-10 lg:col-span-10 lg:col-start-3 xl:col-span-9 xl:col-start-4"
        >
          <div className="rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-[6px]">
            <div className="overflow-hidden rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[var(--shadow-board)]">
              <div className="flex h-12 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Evidence board
                </span>
                <span className="hidden rounded-[4px] border border-[var(--border-default)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)] sm:block">
                  Paper only
                </span>
                <span className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                  Updated {board ? timeOfDay(board.updatedAt, true) : 'not recorded'}
                </span>
              </div>

              <div className="grid grid-cols-3 border-b border-[var(--border-subtle)] md:hidden" role="tablist">
                {(['calls', 'convergence', 'verdict'] as Tab[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                    className={`min-h-[44px] border-b-2 px-2 font-mono text-[10px] uppercase tracking-[0.14em] ${
                      tab === value
                        ? 'border-[var(--accent)] bg-[var(--bg-secondary)] text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-muted)]'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:min-h-[432px] md:grid-cols-12">
                <div
                  className={`border-[var(--border-subtle)] md:col-span-4 md:border-r ${
                    tab === 'calls' ? '' : 'hidden md:block'
                  }`}
                >
                  <div className="flex h-11 items-center justify-between border-b border-[var(--border-subtle)] px-4">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Latest calls
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
                      {board?.callsParsed ?? 0}
                    </span>
                  </div>
                  {calls.length === 0 ? (
                    <p className="px-4 py-8 text-sm leading-relaxed text-[var(--text-secondary)]">
                      No calls have been ingested yet, so the board is waiting for the collector.
                      Recorded calls appear here as soon as the replay set loads.
                    </p>
                  ) : (
                    <div className="divide-y divide-[var(--border-subtle)]">
                      {calls.slice(0, 5).map((call, index) => (
                        <CallRow key={call.id} call={call} index={index} ticker={call.ticker} />
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className={`evidence-grid relative border-[var(--border-subtle)] md:col-span-4 md:border-r ${
                    tab === 'convergence' ? '' : 'hidden md:block'
                  }`}
                >
                  <div className="flex h-11 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Convergence
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
                      {caseFile?.asset.ticker ?? 'Waiting'}
                    </span>
                  </div>
                  {contributions.length === 0 || !caseFile ? (
                    <p className="px-4 py-8 text-sm leading-relaxed text-[var(--text-secondary)]">
                      No convergence event has been recorded for this replay set.
                    </p>
                  ) : (
                    <Convergence
                      caseFile={caseFile}
                      contributions={contributions}
                      reliability={reliability}
                    />
                  )}
                </div>

                <div
                  className={`relative bg-[var(--bg-secondary)] md:col-span-4 ${
                    tab === 'verdict' ? '' : 'hidden md:block'
                  }`}
                >
                  <div className="flex h-11 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4">
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Verdict
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
                      Rules v{caseFile?.rulesetVersion ?? 1}
                    </span>
                  </div>
                  {caseFile ? (
                    <VerdictSheet caseFile={caseFile} />
                  ) : (
                    <p className="px-4 py-8 text-sm leading-relaxed text-[var(--text-secondary)]">
                      No filed verdict is available in this replay set.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <BoardCount value={board?.channelsMonitored ?? 0} label="Watchlist channels" />
                <BoardCount value={board?.callsParsed ?? 0} label="Calls parsed" />
                <BoardCount value={board?.realFundsAtRisk ?? 0} label="Real funds at risk" />
              </div>
            </div>
          </div>
          {error ? (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent-hover)]">
              The live read failed, so this board is showing the last recorded state. Retry from the app.
            </p>
          ) : null}
        </HeroLoad>
      </div>
    </section>
  );
}

function BoardCount({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-3 py-3 text-center md:px-4">
      <Counter
        value={value}
        immediate
        className="font-display text-lg font-bold tabular-nums text-[var(--text-primary)] md:text-xl"
      />
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}

function CallRow({ call, index, ticker }: { call: Call; index: number; ticker: string | null }) {
  const reduced = useReducedMotion();
  const parts = excerptWithMention(call.excerpt, ticker);
  const direction = directionLabel(call.direction);
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { filter: 'blur(6px)', opacity: 0, y: -6 }}
      animate={reduced ? { opacity: 1 } : { filter: 'blur(0px)', opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.2 : 0.45, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] }}
      className="grid min-h-[76px] grid-cols-[1fr_auto] gap-3 px-4 py-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
            {call.sourceLabel.slice(0, 2).toUpperCase()}
          </span>
          <span className="truncate font-mono text-[12px] text-[var(--text-primary)]">
            {call.sourceLabel}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {timeOfDay(call.timestamp)}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-[var(--text-secondary)]">
          {parts.map((part, partIndex) =>
            part.mention ? (
              <motion.span
                key={partIndex}
                className="relative px-1 font-mono text-[var(--text-primary)]"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: 0.18 }}
              >
                <span className="pointer-events-none absolute inset-0 rounded-[3px] border border-[var(--accent)]" />
                {part.text}
              </motion.span>
            ) : (
              <span key={partIndex}>{part.text}</span>
            ),
          )}
        </p>
      </div>
      <span className="self-start rounded-[4px] border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
        {direction}
      </span>
    </motion.div>
  );
}

function Convergence({
  caseFile,
  contributions,
  reliability,
}: {
  caseFile: CaseFile;
  contributions: CaseFile['contributions'];
  reliability: Map<string, number>;
}) {
  const groups: Array<{
    sourceHash: string;
    sourceLabel: string;
    rows: CaseFile['contributions'];
  }> = [];
  for (const row of contributions) {
    const existing = groups.find((group) => group.sourceHash === row.sourceHash);
    if (existing) existing.rows.push(row);
    else groups.push({ sourceHash: row.sourceHash, sourceLabel: row.sourceLabel, rows: [row] });
  }
  const first = contributions[0];
  const last = contributions[contributions.length - 1];
  const spread = first && last ? offsetBetween(last.timestamp, first.timestamp) : 0;
  const threshold = 3;
  const filled = Math.min(caseFile.independentVoiceCount, threshold);

  return (
    <>
      <div className="relative space-y-3 px-4 py-4">
        <span className="absolute bottom-6 left-[27px] top-6 w-px bg-[var(--border-default)]" aria-hidden="true" />
        {groups.map((group) => {
          const score = reliability.get(group.sourceHash);
          return (
            <div key={group.sourceHash} className="relative flex gap-3">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--text-primary)]" />
              <div className="min-w-0 flex-1 rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-[12px] text-[var(--text-primary)]">
                    {group.sourceLabel}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                    {formatOffset(offsetBetween(group.rows[0].timestamp, first.timestamp))}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                  <span>Conviction {group.rows[0].conviction}</span>
                  {score !== undefined ? <span>Score {score.toFixed(1)}</span> : null}
                </div>
                {group.rows.slice(1).map((row) => (
                  <div
                    key={row.callId}
                    className="mt-1 flex items-center justify-between font-mono text-[11px] tabular-nums text-[var(--text-muted)]"
                  >
                    <span>Repeated post</span>
                    <span>{formatOffset(offsetBetween(row.timestamp, first.timestamp))}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[var(--border-subtle)] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Independent voices
          </span>
          <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
            {caseFile.independentVoiceCount} of {threshold}
          </span>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {Array.from({ length: threshold }).map((_, index) => (
            <div key={index} className="h-1.5 rounded-[2px] bg-[var(--bg-elevated)]">
              {index < filled ? (
                <motion.div
                  className="h-full origin-left rounded-[2px] bg-[var(--text-primary)]"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: false, amount: 0.1 }}
                  transition={{ duration: 0.5, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
                />
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-2.5 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
          Spread {formatOffset(spread).replace('+', '')} · window {caseFile.windowHours}h · forwards
          excluded
        </p>
      </div>
    </>
  );
}

function VerdictSheet({ caseFile }: { caseFile: CaseFile }) {
  const position = caseFile.position;
  const approved = caseFile.decision === 'approved';
  const failed = caseFile.ruleResults.find((row) => !row.pass);
  const link = txUrl(caseFile.filing.txHash);
  return (
    <div className="relative">
      <div className="absolute right-4 top-[18px] z-20">
        <motion.div
          initial={{ opacity: 0, scale: 1.18, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: -6 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        >
          <Stamp kind={approved ? 'approved' : 'rejected'} />
        </motion.div>
      </div>
      <div className="px-4 py-4 md:pt-14">
        <Row label="Asset" value={caseFile.asset.ticker} />
        {approved && position ? (
          <>
            <Row label="Direction" value={dirLabel(position.direction)} />
            <Row label="Entry" value={price(position.entryPrice)} />
            <Row label="Paper size" value={money(position.sizeUsdCents)} />
            <Row label="Stop" value={price(position.stopPrice)} />
            <Row label="Target" value={price(position.targetPrice)} />
            <Row label="Expires" value={utcStamp(position.expiresAt)} />
          </>
        ) : (
          <>
            <Row label="Direction claimed" value={directionLabel(caseFile.terms?.direction)} />
            <Row label="Reason code" value={caseFile.reasonCode ?? 'Not recorded'} />
            <Row label="Rule failed" value={failed?.displayName ?? 'Not recorded'} />
            <Row label="Filed as" value="Rejected" />
          </>
        )}
      </div>
      <p className="px-4 pb-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
        {caseFile.explanation}
      </p>
      <div className="mx-4 mb-4 mt-2 flex items-center justify-between gap-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          CRE filing
        </span>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[32px] items-center gap-1.5 font-mono text-[12px] tabular-nums text-[var(--text-primary)] underline-offset-4 hover:underline"
          >
            {shortHash(caseFile.filing.txHash)}
            <External className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="font-mono text-[11px] text-[var(--text-muted)]">Awaiting simulation run</span>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border-subtle)] py-2.5 last:border-b-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="text-right font-mono text-sm tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}
