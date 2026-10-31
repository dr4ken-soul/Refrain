'use client';

import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { External } from '@/components/icons';
import { Reveal, Stagger, StaggerItem } from '@/components/motion';
import { shortHash, timeOfDay, txUrl } from '@/lib/format';
import type { CreRun } from '@/lib/types';

const STAGES = [
  {
    name: 'Telegram collector',
    fact: 'Public channels are read with an operator account and stored with their original timestamps.',
  },
  {
    name: 'Evidence store',
    fact: 'Posts become a frozen bundle with a content hash. Edits and forwards stay visible in the record.',
  },
  {
    name: 'Extraction agent',
    fact: 'Deterministic parsers read structured calls first. The model handles unstructured text and narrative tags.',
  },
  {
    name: 'Fixed rules',
    fact: 'The mandate decides. The output is approved, rejected or deferred, with a reason code in every case.',
  },
  {
    name: 'CRE verdict workflow',
    fact: 'The workflow fetches the bundle and market prices under consensus, replays the rule results and signs one report.',
  },
  {
    name: 'Sepolia ledger',
    fact: 'The consumer contract records the verdict, the paper position terms and the ruleset hash. It holds no funds.',
  },
  {
    name: 'CRE settlement workflow',
    fact: 'Due positions are priced again under consensus. The settlement report closes the position and moves scores.',
  },
];

export function CreFilingPath({ run }: { run: CreRun | null }) {
  const filing = txUrl(run?.txHash ?? null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [run]);

  return (
    <section
      id="cre-filing-path"
      className="relative overflow-hidden border-t border-[var(--border-default)] bg-[var(--bg-secondary)] py-20 md:py-28"
    >
      <motion.div
        className="absolute inset-y-0 left-[8%] hidden w-px origin-top bg-[var(--border-subtle)] lg:block"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute inset-y-0 left-[38%] hidden w-px origin-top bg-[var(--border-subtle)] lg:block"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute inset-y-0 left-[72%] hidden w-px origin-top bg-[var(--border-subtle)] lg:block"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: false, amount: 0.1 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12">
        <Reveal>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--accent-hover)]">
            Chainlink CRE
          </p>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.6rem]">
            How a verdict gets filed
          </h2>
          <p className="mt-4 max-w-[64ch] font-body text-base leading-relaxed text-[var(--text-secondary)]">
            The workflow is the filing clerk, not a badge at the end. Remove CRE and no position
            opens, no rejection is filed and no score moves.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Stagger className="relative space-y-3">
              <span
                className="absolute bottom-4 left-[15px] top-4 w-px bg-[var(--border-default)]"
                aria-hidden="true"
              />
              {STAGES.map((stage, index) => (
                <StaggerItem key={stage.name} className="relative flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3.5">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{stage.name}</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{stage.fact}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-[12px] border border-[var(--border-default)] bg-[var(--bg-secondary)] p-[6px]">
              <div className="overflow-hidden rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-inverse)] text-[var(--text-inverse)]">
                <div className="flex h-12 items-center justify-between border-b border-[oklch(0.965_0.005_228/0.14)] px-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[oklch(0.965_0.005_228/0.72)]">
                    CRE simulation
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[oklch(0.965_0.005_228/0.72)]">
                    {run ? timeOfDay(run.recordedAt, true) : 'No run recorded'}
                  </span>
                </div>
                <div
                  ref={logRef}
                  className="max-h-[420px] overflow-y-auto px-4 py-4 md:px-5"
                >
                  {run && run.logLines.length > 0 ? (
                    run.logLines.map((line, index) => (
                      <div
                        key={`${index}-${line.slice(0, 24)}`}
                        className="whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.75] tabular-nums text-[oklch(0.965_0.005_228/0.86)]"
                      >
                        {line}
                      </div>
                    ))
                  ) : (
                    <p className="font-mono text-[12px] leading-relaxed text-[oklch(0.965_0.005_228/0.72)]">
                      No broadcast run has been recorded yet. Dry-run output will appear here after
                      the first simulation, labelled as a dry run.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[oklch(0.965_0.005_228/0.14)] px-4 py-3.5">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[oklch(0.965_0.005_228/0.72)]">
                    Sepolia · simulation with broadcast
                  </span>
                  {filing ? (
                    <a
                      href={filing}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-h-[32px] items-center gap-1.5 font-mono text-[12px] tabular-nums underline-offset-4 hover:underline"
                    >
                      {shortHash(run?.txHash ?? null)}
                      <External className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="font-mono text-[11px] text-[oklch(0.965_0.005_228/0.72)]">
                      Awaiting filing
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                {
                  label: 'Consensus fetch',
                  text: 'Bundle and price reads are aggregated, so one faulty response cannot file a verdict on its own.',
                },
                {
                  label: 'Signed report',
                  text: 'The ledger accepts reports only through the configured forwarder, and each case hash can be filed once.',
                },
                {
                  label: 'Open simulation',
                  text: 'Deployment to the DON needs Early Access, so the submitted proof is the CLI simulation with broadcast and its log.',
                },
              ].map((callout) => (
                <div key={callout.label} className="border-t-2 border-[var(--text-primary)] pt-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    {callout.label}
                  </span>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {callout.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
