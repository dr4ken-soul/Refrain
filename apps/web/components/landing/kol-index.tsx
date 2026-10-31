import { KolTable } from '@/components/kol-table';
import { Reveal } from '@/components/motion';
import type { Kol } from '@/lib/types';

export function KolIndex({ rows }: { rows: Kol[] | null }) {
  return (
    <section id="kol-index" className="bg-[var(--bg-primary)] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.6rem]">
            Every voice keeps its record
          </h2>
          <p className="mt-4 max-w-[64ch] font-body text-base leading-relaxed text-[var(--text-secondary)]">
            Scores move only when a tracked call settles. A loud week changes nothing on its own,
            and a channel that promotes without disclosure carries that flag in public beside its
            results.
          </p>
        </Reveal>
        <div className="mt-10">
          {rows && rows.length > 0 ? (
            <KolTable rows={rows} />
          ) : (
            <div className="rounded-[8px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-10 text-center">
              <h3 className="font-body text-base font-semibold text-[var(--text-primary)]">
                The watchlist is empty
              </h3>
              <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-[var(--text-secondary)]">
                No channel has been added to the audited watchlist yet, so there is no reliability
                record to show. Add a channel from the operator screen to start one.
              </p>
            </div>
          )}
        </div>
        <p className="mt-5 max-w-[68ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
          The starting score is neutral for every channel. Structured futures calls settle against
          their own stop and target. Memecoin calls settle against the mandate stop, target and
          expiry recorded at the moment of the call.
        </p>
      </div>
    </section>
  );
}
