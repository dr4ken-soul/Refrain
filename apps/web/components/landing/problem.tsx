'use client';

import { Reveal, WordReveal } from '@/components/motion';

export function ProblemStatement() {
  return (
    <section id="problem" className="bg-[var(--bg-primary)] py-20 md:py-32">
      <div className="mx-auto w-full max-w-[1440px] px-4 md:px-8 xl:px-12">
        <WordReveal
          text="One loud caller is not a market consensus."
          className="max-w-[16ch] font-display text-[clamp(2.4rem,6vw,5.25rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-[var(--text-primary)] [text-wrap:balance]"
        />
        <Reveal delay={0.35}>
          <p className="mt-8 max-w-[62ch] font-body text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
            Call channels are paid in attention, so repetition is cheap and coordination is hard
            to see from inside one feed. Refrain reads across the watchlist, then asks whether
            separate voices arrived at the same claim without copying each other.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
