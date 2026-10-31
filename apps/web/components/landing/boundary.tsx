import { BanknoteOff, Eye, Key, Scale } from '@/components/icons';
import { Reveal } from '@/components/motion';
import { PrimaryAction } from '@/components/ui';

const ROWS = [
  {
    icon: BanknoteOff,
    title: 'Paper positions only',
    text: 'No exchange account is connected, no order is placed and no contract in this system can move funds.',
  },
  {
    icon: Eye,
    title: 'Authorised sources only',
    text: 'The collector reads public channels and sources the operator is a member of. It does not enter private groups on a user behalf.',
  },
  {
    icon: Key,
    title: 'No private keys in the product',
    text: 'The only signer is the CRE report path into a ledger that records decisions. Telegram session material stays on the collector host and never reaches the browser.',
  },
  {
    icon: Scale,
    title: 'Not financial advice',
    text: 'Scores describe recorded paper outcomes under one public mandate. They are not a recommendation to buy or sell any asset.',
  },
];

export function Boundary() {
  return (
    <section id="boundary" className="bg-[var(--bg-primary)] py-20 md:py-28">
      <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-10 px-4 md:px-8 lg:grid-cols-12 xl:px-12">
        <Reveal className="lg:col-span-5">
          <h2 className="font-display text-3xl font-extrabold leading-[1.02] tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.6rem]">
            Built to refuse as well as to act
          </h2>
          <p className="mt-5 max-w-[52ch] font-body text-base leading-relaxed text-[var(--text-secondary)]">
            Refrain is an education and evidence system for a legal-tech hackathon. Its limits are
            part of the design, and they are printed here rather than buried in a footer.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-7">
          <div className="overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            {ROWS.map((row) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.title}
                  className="grid grid-cols-[auto_1fr] gap-3 border-t border-[var(--border-subtle)] px-4 py-4 first:border-t-0 md:px-5"
                >
                  <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border-default)]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{row.title}</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{row.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>

        <div className="lg:col-span-12">
          <Reveal>
            <div className="mt-4 overflow-hidden rounded-[12px] bg-[var(--bg-inverse)] px-5 py-14 text-[var(--text-inverse)] md:px-10 md:py-20">
              <div className="mx-auto flex max-w-[760px] flex-col items-center text-center">
                <h2 className="font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.04em] [text-wrap:balance] md:text-[3.4rem]">
                  Bring your own twenty voices
                </h2>
                <p className="mt-5 max-w-[54ch] font-body text-base leading-relaxed text-[oklch(0.965_0.005_228/0.76)]">
                  Start with the public Telegram channels you already read. Refrain keeps their
                  record, tests their agreement and files what it decided.
                </p>
                <div className="mt-8">
                  <PrimaryAction href="/app" inverted />
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
