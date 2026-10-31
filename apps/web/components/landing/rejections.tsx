import Link from 'next/link';
import { Reveal } from '@/components/motion';
import { Stamp } from '@/components/stamp';
import { DataLabel } from '@/components/ui';
import { shortHash, utcStamp } from '@/lib/format';
import type { CaseFile } from '@/lib/types';

export function RejectedTrades({ cases }: { cases: CaseFile[] | null }) {
  const rows = cases ?? [];
  return (
    <section
      id="rejected-trades"
      className="border-t border-[var(--border-default)] bg-[var(--bg-secondary)] py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1100px] px-4 md:px-8">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.6rem]">
            The trades Refrain refused
          </h2>
          <p className="mt-4 max-w-[62ch] font-body text-base leading-relaxed text-[var(--text-secondary)]">
            A signal product is judged by what it talks you out of. Each refusal below is a filed
            decision with the same evidence standard as a position.
          </p>
        </Reveal>

        <div className="mt-12 space-y-4 md:space-y-0">
          {rows.length === 0 ? (
            <div className="rounded-[8px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-10 text-center">
              <h3 className="font-body text-base font-semibold text-[var(--text-primary)]">
                No rejection has been filed yet
              </h3>
              <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-[var(--text-secondary)]">
                The replay set holds no rejected case, so this section stays empty rather than
                inventing one. A rejected claim appears here as soon as it is decided.
              </p>
            </div>
          ) : (
            rows.map((caseFile, index) => {
              const repeats = caseFile.contributions.length;
              const failed = caseFile.ruleResults.find((row) => !row.pass);
              return (
                <Reveal key={caseFile.eventId} delay={index * 0.05}>
                  <div
                    className="relative rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 md:sticky md:p-7"
                    style={{ top: `${88 + index * 16}px`, zIndex: 10 + index }}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-body text-lg font-semibold text-[var(--text-primary)] md:text-xl">
                        {caseFile.asset.ticker} {caseFile.asset.chain} · one voice repeated
                      </h3>
                      <Stamp kind="rejected" />
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <Field label="Asset" value={caseFile.asset.ticker} />
                      <Field label="Window closed" value={utcStamp(caseFile.window.closedAt)} />
                      <Field label="Voices counted" value={String(caseFile.independentVoiceCount)} />
                      <Field
                        label="Filed"
                        value={caseFile.filing.txHash ? shortHash(caseFile.filing.txHash) : 'Not filed'}
                      />
                    </div>
                    <p className="mt-5 max-w-[66ch] text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
                      {caseFile.explanation} The channel appears {repeats} times in the window, and
                      the failed rule is {failed?.displayName ?? 'the independence quorum'}.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Reason code {caseFile.reasonCode ?? 'Not recorded'}
                      </span>
                      <Link
                        href={`/app/convergence/${caseFile.eventId}`}
                        className="font-mono text-[12px] tabular-nums underline-offset-4 hover:underline"
                      >
                        Open case file
                      </Link>
                    </div>
                  </div>
                </Reveal>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[var(--border-subtle)] pt-2.5">
      <DataLabel className="text-[10px]">{label}</DataLabel>
      <div className="mt-1 truncate font-mono text-sm tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
