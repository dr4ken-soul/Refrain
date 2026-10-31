'use client';

import { Stagger, StaggerItem } from '@/components/motion';
import type { Ruleset } from '@/lib/types';

type Config = {
  independentVoicesRequired?: number;
  weightedConvictionFloor?: number;
  windows?: { contractAssetHours?: number; listedPairHours?: number };
  paperSize?: { baseUsd?: number; capUsd?: number; referenceConviction?: number };
  priceAgreement?: { contractAssetMaxDeviationBps?: number; listedPairMaxDeviationBps?: number };
  promotionVeto?: { enabled?: boolean };
  liquidity?: { contractAssetFloorUsd?: number };
  defaultTerms?: {
    contractAsset?: { stopPctBps?: number; targetPctBps?: number; expiryHours?: number };
  };
};

export function RulesSection({ ruleset }: { ruleset: Ruleset | null }) {
  const config = (ruleset?.config ?? {}) as Config;
  const stop = Math.abs(config.defaultTerms?.contractAsset?.stopPctBps ?? 1500) / 100;
  const target = Math.abs(config.defaultTerms?.contractAsset?.targetPctBps ?? 3500) / 100;
  const expiry = config.defaultTerms?.contractAsset?.expiryHours ?? 48;

  const layers = [
    {
      name: 'Independent voices',
      copy: 'Separate channels, with forwards and reposts removed.',
      value: `${config.independentVoicesRequired ?? 3} voices`,
    },
    {
      name: 'Time window',
      copy: 'Contract-address assets have a 24-hour window. Listed pairs have a 6-hour window.',
      value: `${config.windows?.contractAssetHours ?? 24}h / ${config.windows?.listedPairHours ?? 6}h`,
    },
    {
      name: 'Weighted conviction',
      copy: 'Conviction counts only after reliability weighting.',
      value: `Floor ${config.weightedConvictionFloor ?? 55}`,
    },
    {
      name: 'Liquidity floor',
      copy: 'Thin pools are refused before any size is calculated.',
      value: `$${(config.liquidity?.contractAssetFloorUsd ?? 5000).toLocaleString('en-US')}`,
    },
    {
      name: 'Promotion veto',
      copy: 'Referral markers, paid placement language and scheduled call events stop the trade and are filed as promotion evidence.',
      value: config.promotionVeto?.enabled === false ? 'Off' : 'Enabled',
    },
    {
      name: 'Paper size',
      copy: 'Size is capped as a share of the paper bankroll, then scaled by weighted conviction inside that cap.',
      value: `$${config.paperSize?.baseUsd ?? 100} base · $${config.paperSize?.capUsd ?? 500} cap`,
    },
    {
      name: 'Stop, target, expiry',
      copy: 'A position without all three cannot be filed.',
      value: `${stop}% / ${target}% / ${expiry}h`,
    },
  ];

  return (
    <section id="rules" className="bg-[var(--bg-primary)] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[920px] px-4 md:px-8">
        <h2 className="text-center font-display text-3xl font-extrabold tracking-[-0.03em] text-[var(--text-primary)] md:text-[2.6rem]">
          Rules before positions
        </h2>
        <p className="mx-auto mt-4 max-w-[60ch] text-center font-body text-base leading-relaxed text-[var(--text-secondary)]">
          The mandate is a public record with a version and a hash. Change a value and the version
          changes, so an old verdict can always be replayed against the rules that produced it.
        </p>

        <Stagger className="mt-12 flex flex-col gap-3">
          {layers.map((layer, index) => (
            <StaggerItem
              key={layer.name}
              className="flex items-start gap-4 rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 transition-colors duration-200 hover:border-[var(--text-secondary)] md:p-6"
            >
              <span className="min-w-[2rem] pt-0.5 font-mono text-[12px] tabular-nums text-[var(--text-muted)]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-[var(--text-primary)]">{layer.name}</div>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{layer.copy}</p>
              </div>
              <span className="shrink-0 rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2.5 py-1.5 font-mono text-[12px] tabular-nums text-[var(--text-primary)]">
                {layer.value}
              </span>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-4 md:px-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Active ruleset v{ruleset?.version ?? 'Not loaded'}
          </span>
          <span className="truncate font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">
            {ruleset?.hash ?? 'No hash recorded'}
          </span>
        </div>
      </div>
    </section>
  );
}
