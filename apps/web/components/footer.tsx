import Link from 'next/link';
import { Reveal } from '@/components/motion';
import { addressUrl } from '@/lib/format';

export function Footer({ ledger }: { ledger: string | null }) {
  const ledgerLink = addressUrl(ledger);
  return (
    <footer className="border-t border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-12 md:px-8 md:py-14 xl:px-12">
      <div className="mx-auto w-full max-w-[1440px]">
        <Reveal>
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
            <div>
              <div className="font-mono text-[13px] font-semibold uppercase tracking-[0.28em] text-[var(--text-primary)]">
                Refrain
              </div>
              <p className="mt-3 max-w-[46ch] font-body text-[13px] leading-relaxed text-[var(--text-secondary)]">
                Built for BLI Legal Tech Hackathon 2. Prepared for the RYO-CHAN Autonomous Agents
                bounty and the Chainlink Best Workflow with CRE bounty.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-7 gap-y-3">
              <Link
                href="/app"
                className="inline-flex min-h-[36px] items-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text-primary)]"
              >
                Evidence board
              </Link>
              <a
                href="https://github.com/dr4ken-soul/Refrain"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[36px] items-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text-primary)]"
              >
                GitHub
              </a>
              <span
                className="inline-flex min-h-[36px] items-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]"
                title="The DoraHacks Build is linked when the submission is created."
              >
                DoraHacks build
              </span>
              {ledgerLink ? (
                <a
                  href={ledgerLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[36px] items-center font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--text-primary)]"
                >
                  Sepolia ledger
                </a>
              ) : null}
            </div>
          </div>
        </Reveal>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-6 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
          <span>© 2026 Refrain</span>
          <span>Paper positions only · Ethereum Sepolia</span>
        </div>
      </div>
    </footer>
  );
}