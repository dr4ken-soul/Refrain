'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { Check, Close, External } from '@/components/icons';
import { DataLabel, DataValue, SecondaryAction } from '@/components/ui';
import {
  directionLabel,
  excerptWithMention,
  price,
  shortHash,
  timeOfDay,
  txUrl,
  utcStamp,
} from '@/lib/format';
import type { CaseFile, CreRun } from '@/lib/types';

type TabKey = 'evidence' | 'rules' | 'outcome';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'evidence', label: 'Evidence' },
  { key: 'rules', label: 'Rules' },
  { key: 'outcome', label: 'Outcome' },
];

export function Anatomy({
  caseFile,
  run,
  full = false,
}: {
  caseFile: CaseFile | null;
  run: CreRun | null;
  full?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>('evidence');

  if (!caseFile) {
    return (
      <section
        id="anatomy-of-a-verdict"
        className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)] py-20 md:py-28"
      >
        <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent-hover)]">
            Case file
          </p>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.6rem] md:leading-[1.02]">
            Anatomy of a verdict
          </h2>
          <p className="mt-4 max-w-[64ch] font-body text-base leading-relaxed text-[var(--text-secondary)]">
            No decided case is available in this replay set, so there is no record to open here.
          </p>
        </div>
      </section>
    );
  }

  const firstCall = [...caseFile.posts].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )[0];
  const filingUrl = txUrl(caseFile.filing.txHash);
  const failedRule = caseFile.ruleResults.find((row) => !row.pass);

  const moveTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((row) => row.key === tab);
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setTab(TABS[(index + 1) % TABS.length].key);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setTab(TABS[(index - 1 + TABS.length) % TABS.length].key);
    }
  };

  return (
    <section
      id="anatomy-of-a-verdict"
      className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)] py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent-hover)]">
          Case file
        </p>
        <h2 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.6rem] md:leading-[1.02]">
          Anatomy of a verdict
        </h2>
        <p className="mt-4 max-w-[64ch] font-body text-base leading-relaxed text-[var(--text-secondary)]">
          One decided case, opened in full. The posts stay frozen at the moment of decision, the
          rule results stay beside the claim they judged, and the outcome is settled against
          recorded prices rather than memory.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--border-default)] lg:grid-cols-4">
          <SummaryCell label="Asset" value={`${caseFile.asset.ticker} · ${caseFile.asset.chain}`} />
          <SummaryCell label="First call" value={firstCall ? utcStamp(firstCall.timestamp) : 'Not recorded'} />
          <SummaryCell label="Decision time" value={utcStamp(caseFile.evaluatedAt)} />
          <div className="bg-[var(--bg-surface)] px-4 py-4">
            <DataLabel>Filing</DataLabel>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                href={`/app/convergence/${caseFile.eventId}`}
                className="truncate font-mono text-sm tabular-nums text-[var(--text-primary)] underline-offset-4 hover:underline"
              >
                {caseFile.decision === 'rejected' ? 'Open rejected file' : 'Open case file'}
              </Link>
              {filingUrl ? (
                <a
                  href={filingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-secondary)] underline-offset-4 hover:underline"
                >
                  {shortHash(caseFile.filing.txHash)}
                  <External className="h-3 w-3" />
                </a>
              ) : (
                <span className="font-mono text-[11px] text-[var(--text-muted)]">Not filed</span>
              )}
            </div>
          </div>
        </div>

        <div
          className="mt-8 flex gap-1 overflow-x-auto border-b border-[var(--border-default)]"
          role="tablist"
          aria-label="Case file sections"
          onKeyDown={moveTab}
        >
          {TABS.map((row) => (
            <button
              key={row.key}
              type="button"
              role="tab"
              id={`tab-${row.key}`}
              aria-selected={tab === row.key}
              aria-controls={`panel-${row.key}`}
              tabIndex={tab === row.key ? 0 : -1}
              onClick={() => setTab(row.key)}
              className={`min-h-[44px] shrink-0 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-200 md:px-5 ${
                tab === row.key
                  ? 'text-[var(--text-primary)] shadow-[inset_0_-2px_0_var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {row.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === 'evidence' ? (
            <Panel key="evidence" id="panel-evidence" labelledBy="tab-evidence">
              <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="space-y-3 lg:col-span-7">
                  {caseFile.posts.map((post) => (
                    <PostRecord key={post.id} post={post} ticker={caseFile.asset.ticker} />
                  ))}
                </div>
                <div className="lg:col-span-5">
                  <div className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                    <h3 className="font-body text-base font-semibold text-[var(--text-primary)]">
                      How to read this record
                    </h3>
                    <div className="mt-4 space-y-4">
                      {[
                        'A boxed mention is the exact span the parser extracted. Nothing outside a box influenced the asset choice.',
                        'Offsets are measured from the first independent call, so timing spread can be checked rather than trusted.',
                        'A forward is evidence of copying. It is shown, then removed from the independent voice count.',
                        'The evidence hash covers the frozen bundle. Change one character and the filed hash no longer matches.',
                      ].map((text) => (
                        <div key={text} className="flex gap-3">
                          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[var(--text-primary)]" />
                          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          {tab === 'rules' ? (
            <Panel key="rules" id="panel-rules" labelledBy="tab-rules">
              <div className="mt-8 overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
                {caseFile.ruleResults.map((result) => (
                  <div
                    key={result.rule}
                    className="grid grid-cols-[auto_1fr] gap-3 border-t border-[var(--border-subtle)] px-4 py-4 first:border-t-0 md:grid-cols-[44px_1fr_auto] md:items-center md:px-5"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-default)]">
                      {result.pass ? (
                        <Check className="h-4 w-4 text-[var(--text-primary)]" />
                      ) : (
                        <Close className="h-4 w-4 text-[var(--accent-hover)]" />
                      )}
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        {result.displayName}
                      </div>
                      <p className="mt-1 font-mono text-[12px] tabular-nums leading-relaxed text-[var(--text-secondary)]">
                        {result.evidence}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      {result.pass ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-4 md:px-5">
                  <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    The language model extracts claims and writes the explanation. These fixed
                    rules decide, so the same frozen bundle always reaches the same verdict.
                  </p>
                </div>
              </div>
              {failedRule ? (
                <p className="mt-4 font-mono text-[12px] leading-relaxed text-[var(--accent-hover)]">
                  Failed rule: {failedRule.displayName}. {caseFile.reasonCode ?? ''}
                </p>
              ) : null}
            </Panel>
          ) : null}

          {tab === 'outcome' ? (
            <Panel key="outcome" id="panel-outcome" labelledBy="tab-outcome">
              <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <div className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                    <PriceChart caseFile={caseFile} />
                    <p className="mt-3 font-mono text-[11px] leading-relaxed text-[var(--text-muted)]">
                      Outcome source {caseFile.pricePlan.primary.kind} · checked against{' '}
                      {caseFile.pricePlan.check.kind} · tolerance {caseFile.pricePlan.maxDeviationBps} bps
                    </p>
                  </div>
                </div>
                <div className="lg:col-span-5">
                  <div className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                    <div className="border-b border-[var(--border-subtle)] pb-1">
                      <DataLabel>Settlement</DataLabel>
                    </div>
                    <SettlementRow
                      label="Exit price"
                      value={caseFile.position?.exitPrice ? price(caseFile.position.exitPrice) : 'Not settled'}
                    />
                    <SettlementRow
                      label="Exit reason"
                      value={caseFile.position?.exitReason ?? 'Awaiting settlement'}
                    />
                    <SettlementRow
                      label="Paper result"
                      value={
                        caseFile.position?.pnlUnits !== null && caseFile.position?.pnlUnits !== undefined
                          ? `${caseFile.position.pnlUnits > 0 ? '+' : ''}${caseFile.position.pnlUnits}`
                          : 'Open'
                      }
                    />
                    <SettlementRow
                      label="Settled at"
                      value={caseFile.position?.status === 'settled' ? utcStamp(caseFile.filing.filedAt) : 'Not settled'}
                    />
                    <SettlementRow
                      label="Settlement filing"
                      value={caseFile.replay.settlementTx ? shortHash(caseFile.replay.settlementTx) : 'Pending'}
                    />
                    <div className="mt-4 rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
                      <DataLabel>Reliability effect</DataLabel>
                      {caseFile.scoreEffects.length === 0 ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                          No score moves until the position settles. The contribution list is
                          committed on-chain for attribution when it does.
                        </p>
                      ) : (
                        caseFile.scoreEffects.map((row) => (
                          <div
                            key={row.sourceHash}
                            className="mt-2.5 flex items-center justify-between font-mono text-[12px] tabular-nums"
                          >
                            <span>{shortHash(row.sourceHash, 8, 6)}</span>
                            <span>{row.delta > 0 ? '+' : ''}{row.delta}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}
        </AnimatePresence>

        {full && run ? (
          <div className="mt-8 rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <h3 className="font-body text-base font-semibold text-[var(--text-primary)]">Replay record</h3>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
              <ReplayRow label="Evidence hash" value={caseFile.bundleHash} />
              <ReplayRow label="Ruleset hash" value={caseFile.rulesetHash} />
              <ReplayRow label="Ruleset version" value={`v${caseFile.rulesetVersion}`} />
              <ReplayRow label="CRE run reference" value={run.runId} />
              <ReplayRow label="Verdict transaction" value={caseFile.replay.verdictTx ?? 'Not recorded'} />
              <ReplayRow label="Settlement transaction" value={caseFile.replay.settlementTx ?? 'Not recorded'} />
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Replay uses the frozen bundle and the recorded ruleset. Live prices are never
              substituted into a decided case.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Panel({
  children,
  id,
  labelledBy,
}: {
  children: React.ReactNode;
  id: string;
  labelledBy: string;
}) {
  return (
    <motion.div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-surface)] px-4 py-4">
      <DataLabel>{label}</DataLabel>
      <div className="mt-1.5 truncate font-mono text-sm tabular-nums text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

function PostRecord({ post, ticker }: { post: CaseFile['posts'][number]; ticker: string }) {
  const parts = excerptWithMention(post.excerpt, ticker);
  return (
    <div className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[13px] font-medium text-[var(--text-primary)]">
          {post.sourceLabel}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
          {utcStamp(post.timestamp)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        {parts.map((part, index) =>
          part.mention ? (
            <span key={index} className="relative px-1 font-mono text-[var(--text-primary)]">
              <span className="pointer-events-none absolute inset-0 rounded-[3px] border border-[var(--accent)]" />
              {part.text}
            </span>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <PostField label="Asset" value={post.ticker} />
        <PostField label="Direction" value={directionLabel(post.direction)} />
        <PostField label="Conviction" value={String(post.conviction)} />
        <PostField label="Urgency" value={post.urgency === null ? 'Not recorded' : String(post.urgency)} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="max-w-full truncate font-mono text-[11px] text-[var(--text-muted)]">
          {post.callHash
            ? `Call evidence · ${shortHash(post.callHash, 14, 8)}`
            : `Post content · ${shortHash(post.contentHash, 14, 8)}`}
        </span>
        {post.sourceUrl ? (
          <SecondaryAction href={post.sourceUrl} label="Open source post" external compact />
        ) : (
          <span className="inline-flex min-h-[36px] items-center rounded-[6px] border border-[var(--border-default)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)] opacity-60">
            No source URL recorded
          </span>
        )}
      </div>
    </div>
  );
}

function PostField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[var(--border-subtle)] pt-2.5">
      <DataLabel className="text-[10px]">{label}</DataLabel>
      <div className="mt-1 font-mono text-sm tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function SettlementRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border-subtle)] py-2.5 last:border-b-0">
      <DataLabel>{label}</DataLabel>
      <span className="text-right font-mono text-sm tabular-nums text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function ReplayRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <DataLabel>{label}</DataLabel>
      <div className="mt-1 truncate font-mono text-[12px] tabular-nums text-[var(--text-primary)]" title={value}>
        {value}
      </div>
    </div>
  );
}

function PriceChart({ caseFile }: { caseFile: CaseFile }) {
  const reduced = useReducedMotion();
  const observations = useMemo(
    () =>
      caseFile.entryObservations
        .filter((row) => Number.isFinite(Number(row.price)))
        .sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime()),
    [caseFile],
  );
  const position = caseFile.position;
  const entry = Number(position?.entryPrice ?? caseFile.terms?.stopPrice ?? 0);
  const stop = Number(position?.stopPrice ?? caseFile.terms?.stopPrice ?? 0);
  const target = Number(position?.targetPrice ?? caseFile.terms?.targetPrice ?? 0);
  const values = [
    entry,
    stop,
    target,
    ...observations.map((row) => Number(row.price)),
  ].filter((value) => value > 0);
  const min = Math.min(...values) * 0.96;
  const max = Math.max(...values) * 1.04;
  const width = 700;
  const height = 280;
  const left = 96;
  const right = 620;
  const y = (value: number) => {
    if (max === min) return height / 2;
    return height - 24 - ((value - min) / (max - min)) * (height - 48);
  };
  const points = observations.map((row, index) => {
    const x = observations.length === 1 ? (left + right) / 2 : left + (index * (right - left)) / (observations.length - 1);
    return { x, y: y(Number(row.price)), row };
  });

  return (
    <div className="evidence-grid relative h-[240px] overflow-hidden rounded-[6px] border border-[var(--border-subtle)] md:h-[280px]">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="Recorded entry observations against the filed stop and target">
        <line x1={left} x2={right} y1={y(stop)} y2={y(stop)} stroke="var(--accent)" strokeWidth={1} />
        <text x={12} y={y(stop) + 4} fill="var(--accent-hover)" fontSize={11} fontFamily="var(--font-mono)">
          Stop {price(stop)}
        </text>
        <line x1={left} x2={right} y1={y(target)} y2={y(target)} stroke="var(--success)" strokeWidth={1} />
        <text x={12} y={y(target) + 4} fill="var(--success)" fontSize={11} fontFamily="var(--font-mono)">
          Target {price(target)}
        </text>
        <line
          x1={left}
          x2={right}
          y1={y(entry)}
          y2={y(entry)}
          stroke="var(--text-muted)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text x={12} y={y(entry) + 4} fill="var(--text-muted)" fontSize={11} fontFamily="var(--font-mono)">
          Entry {price(entry)}
        </text>
        {points.length > 1 ? (
          <motion.polyline
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
            fill="none"
            stroke="var(--text-primary)"
            strokeWidth={2}
            initial={reduced ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
            whileInView={reduced ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
            viewport={{ once: false, amount: 0.1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
        ) : null}
        {points.map((point) => (
          <g key={point.row.observedAt}>
            <rect
              x={point.x - 4}
              y={point.y - 4}
              width={8}
              height={8}
              fill="var(--text-primary)"
              transform={`rotate(45 ${point.x} ${point.y})`}
            />
            <text
              x={point.x}
              y={point.y - 12}
              textAnchor="middle"
              fill="var(--text-primary)"
              fontSize={11}
              fontFamily="var(--font-mono)"
            >
              {price(point.row.price)}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute right-3 top-3 rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {position?.status === 'settled' ? 'Settled record' : 'Entry observations only'}
      </div>
    </div>
  );
}
