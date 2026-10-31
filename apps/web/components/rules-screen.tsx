'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { OperatorGate } from './operator-gate';
import { Toast, type ToastState } from './toast';
import { DataLabel } from './ui';
import { API_BASE } from '@/lib/api';
import { shortHash, utcStamp } from '@/lib/format';
import { useOperator } from '@/lib/use-operator';
import type { Ruleset } from '@/lib/types';

type RulesConfig = {
  independentVoicesRequired?: number;
  weightedConvictionFloor?: number;
  windows?: { contractAssetHours?: number; listedPairHours?: number };
  paperSize?: { baseUsd?: number; capUsd?: number; referenceConviction?: number };
  priceAgreement?: { contractAssetMaxDeviationBps?: number; listedPairMaxDeviationBps?: number };
  promotionVeto?: { enabled?: boolean; trigger?: string };
  liquidity?: { contractAssetFloorUsd?: number; listedPairExempt?: boolean };
  defaultTerms?: {
    contractAsset?: { stopPctBps?: number; targetPctBps?: number; expiryHours?: number };
  };
  [key: string]: unknown;
};

export function RulesScreen({ ruleset, versions }: { ruleset: Ruleset | null; versions: Ruleset[] }) {
  const router = useRouter();
  const operator = useOperator();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [saving, setSaving] = useState(false);

  const config = (ruleset?.config ?? {}) as RulesConfig;
  const [voices, setVoices] = useState(String(config.independentVoicesRequired ?? 3));
  const [contractHours, setContractHours] = useState(String(config.windows?.contractAssetHours ?? 24));
  const [listedHours, setListedHours] = useState(String(config.windows?.listedPairHours ?? 6));
  const [conviction, setConviction] = useState(String(config.weightedConvictionFloor ?? 55));
  const [liquidity, setLiquidity] = useState(String(config.liquidity?.contractAssetFloorUsd ?? 5000));
  const [baseSize, setBaseSize] = useState(String(config.paperSize?.baseUsd ?? 100));
  const [capSize, setCapSize] = useState(String(config.paperSize?.capUsd ?? 500));
  const [promotion, setPromotion] = useState(config.promotionVeto?.enabled !== false);
  const [stop, setStop] = useState(
    String(Math.abs(config.defaultTerms?.contractAsset?.stopPctBps ?? 1500) / 100),
  );
  const [target, setTarget] = useState(
    String(Math.abs(config.defaultTerms?.contractAsset?.targetPctBps ?? 3500) / 100),
  );
  const [expiry, setExpiry] = useState(String(config.defaultTerms?.contractAsset?.expiryHours ?? 48));
  const [deviation, setDeviation] = useState(
    String(config.priceAgreement?.contractAssetMaxDeviationBps ?? 300),
  );

  useEffect(() => {
    setVoices(String(config.independentVoicesRequired ?? 3));
    setContractHours(String(config.windows?.contractAssetHours ?? 24));
    setListedHours(String(config.windows?.listedPairHours ?? 6));
    setConviction(String(config.weightedConvictionFloor ?? 55));
    setLiquidity(String(config.liquidity?.contractAssetFloorUsd ?? 5000));
    setBaseSize(String(config.paperSize?.baseUsd ?? 100));
    setCapSize(String(config.paperSize?.capUsd ?? 500));
    setPromotion(config.promotionVeto?.enabled !== false);
    setStop(String(Math.abs(config.defaultTerms?.contractAsset?.stopPctBps ?? 1500) / 100));
    setTarget(String(Math.abs(config.defaultTerms?.contractAsset?.targetPctBps ?? 3500) / 100));
    setExpiry(String(config.defaultTerms?.contractAsset?.expiryHours ?? 48));
    setDeviation(String(config.priceAgreement?.contractAssetMaxDeviationBps ?? 300));
    // Field values follow the active version after a save or a fresh read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruleset?.version]);

  const canEdit = operator.state === 'signedIn';

  const history = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ruleset) return;
    const numbers = [
      voices,
      contractHours,
      listedHours,
      conviction,
      liquidity,
      baseSize,
      capSize,
      stop,
      target,
      expiry,
      deviation,
    ].map((value) => Number(value));
    if (numbers.some((value) => !Number.isFinite(value))) {
      setToast({
        kind: 'error',
        title: 'Rules were not saved.',
        body: 'Every field needs a finite number before a version can be published.',
      });
      return;
    }
    const [
      voicesValue,
      contractValue,
      listedValue,
      convictionValue,
      liquidityValue,
      baseValue,
      capValue,
      stopValue,
      targetValue,
      expiryValue,
      deviationValue,
    ] = numbers.map((value) => Math.round(value));

    const next = {
      ...config,
      independentVoicesRequired: voicesValue,
      weightedConvictionFloor: convictionValue,
      windows: {
        ...config.windows,
        contractAssetHours: contractValue,
        listedPairHours: listedValue,
      },
      paperSize: {
        ...config.paperSize,
        baseUsd: baseValue,
        capUsd: capValue,
      },
      liquidity: {
        ...config.liquidity,
        contractAssetFloorUsd: liquidityValue,
      },
      promotionVeto: {
        ...config.promotionVeto,
        enabled: promotion,
      },
      defaultTerms: {
        ...config.defaultTerms,
        contractAsset: {
          ...config.defaultTerms?.contractAsset,
          stopPctBps: -Math.round(Math.abs(stopValue) * 100),
          targetPctBps: Math.round(Math.abs(targetValue) * 100),
          expiryHours: expiryValue,
        },
      },
      priceAgreement: {
        ...config.priceAgreement,
        contractAssetMaxDeviationBps: deviationValue,
      },
    };

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/operator/rules`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config: next }),
      });
      if (response.ok) {
        const saved = (await response.json()) as Ruleset;
        setToast({
          kind: 'ok',
          title: `Rules v${saved.version} is active.`,
          body: 'Earlier verdicts keep the version that decided them.',
        });
        router.refresh();
        return;
      }
      if (response.status === 401) {
        operator.noteUnauthorized();
        setToast({
          kind: 'error',
          title: 'The operator session expired.',
          body: 'Sign in again to publish a ruleset.',
        });
        return;
      }
      setToast({
        kind: 'error',
        title: 'Rules were not saved.',
        body: 'The API rejected the new version. Nothing changed.',
      });
    } catch {
      setToast({
        kind: 'error',
        title: 'Rules were not saved.',
        body: 'The API did not answer, so the active version was left untouched.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!ruleset) {
    return (
      <div className="px-4 md:px-8">
        <div className="rounded-[8px] border border-[var(--accent)] bg-[var(--accent-glow)] px-4 py-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">The active ruleset did not load.</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
            Check the API connection and retry loading. No version can be saved until the active
            mandate is readable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 md:px-8">
        <OperatorGate
          state={operator.state}
          busy={operator.busy}
          onSignIn={operator.signIn}
          onSignOut={operator.signOut}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 px-4 md:px-8 lg:grid-cols-12">
        <form onSubmit={save} className="lg:col-span-8">
          <div className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <Group title="Agreement">
              <Field label="Independent voices" value={voices} onChange={setVoices} suffix="channels" />
              <Field
                label="Contract asset window"
                value={contractHours}
                onChange={setContractHours}
                suffix="hours"
              />
              <Field label="Listed pair window" value={listedHours} onChange={setListedHours} suffix="hours" />
              <Field
                label="Weighted conviction floor"
                value={conviction}
                onChange={setConviction}
                suffix="points"
              />
            </Group>
            <Group title="Risk">
              <Field
                label="Liquidity floor"
                value={liquidity}
                onChange={setLiquidity}
                prefix="$"
              />
              <Field label="Base paper size" value={baseSize} onChange={setBaseSize} prefix="$" />
              <Field label="Paper size cap" value={capSize} onChange={setCapSize} prefix="$" />
              <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5">
                <div>
                  <span className="text-sm text-[var(--text-primary)]">Promotion veto</span>
                  <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-secondary)]">
                    Referral markers and paid placement language stop the trade and are filed.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={promotion}
                  disabled={!canEdit}
                  onClick={() => setPromotion((value) => !value)}
                  className={`relative h-6 w-10 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                    promotion
                      ? 'border-[var(--text-primary)] bg-[var(--text-primary)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-elevated)]'
                  }`}
                >
                  <span
                    className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${
                      promotion
                        ? 'left-[19px] bg-[var(--text-inverse)]'
                        : 'left-[3px] bg-[var(--text-muted)]'
                    }`}
                  />
                </button>
              </div>
            </Group>
            <Group title="Exit" last>
              <Field label="Stop" value={stop} onChange={setStop} suffix="% below entry" />
              <Field label="Target" value={target} onChange={setTarget} suffix="% above entry" />
              <Field label="Expiry" value={expiry} onChange={setExpiry} suffix="hours" />
              <Field
                label="Price agreement tolerance"
                value={deviation}
                onChange={setDeviation}
                suffix="bps"
              />
            </Group>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[52ch] text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Saving publishes a new version and a new hash. The change applies to future
              convergence events only.
            </p>
            <button
              type="submit"
              disabled={!canEdit || saving}
              className="inline-flex min-h-[44px] items-center rounded-[6px] bg-[var(--text-primary)] px-5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-inverse)] transition-colors duration-200 hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? 'Saving' : 'Save as new version'}
            </button>
          </div>
          {!canEdit && operator.state !== 'loading' ? (
            <p className="mt-2 font-mono text-[11px] text-[var(--text-muted)]">
              Operator access is required to publish a ruleset.
            </p>
          ) : null}
        </form>

        <aside className="lg:col-span-4">
          <div className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Active mandate
              </span>
            </div>
            <div className="px-4 py-4">
              <DataLabel>Version</DataLabel>
              <div className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[var(--text-primary)]">
                v{ruleset.version}
              </div>
              <div className="mt-3 truncate font-mono text-[11px] text-[var(--text-secondary)]" title={ruleset.hash}>
                {ruleset.hash}
              </div>
              <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
                Created {utcStamp(ruleset.createdAt)}
              </div>
            </div>
            <div className="border-t border-[var(--border-subtle)] px-4 py-4">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Past versions
              </span>
              <div className="mt-3 space-y-2.5">
                {history.map((row) => (
                  <div key={row.version} className="border-t border-[var(--border-subtle)] pt-2.5 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2 font-mono text-[12px] tabular-nums">
                      <span className="text-[var(--text-primary)]">v{row.version}</span>
                      {row.active ? (
                        <span className="rounded-[4px] border border-[var(--text-primary)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-[var(--text-primary)]">
                          Active
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">Retired</span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
                      {utcStamp(row.createdAt)}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]" title={row.hash}>
                      {shortHash(row.hash, 12, 8)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function Group({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? '' : 'border-b border-[var(--border-default)]'}>
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2.5 md:px-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {title}
        </span>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
      <span className="text-sm text-[var(--text-primary)]">{label}</span>
      <span className="flex items-center gap-2">
        {prefix ? <span className="font-mono text-[12px] text-[var(--text-muted)]">{prefix}</span> : null}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          className="min-h-[40px] w-[110px] rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-right font-mono text-sm tabular-nums text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
        />
        {suffix ? <span className="min-w-[92px] font-mono text-[11px] text-[var(--text-muted)]">{suffix}</span> : null}
      </span>
    </label>
  );
}
