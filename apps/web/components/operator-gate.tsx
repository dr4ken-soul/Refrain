'use client';

import { useState } from 'react';
import type { OperatorState } from '@/lib/use-operator';

export function OperatorGate({
  state,
  busy,
  onSignIn,
  onSignOut,
}: {
  state: OperatorState;
  busy: boolean;
  onSignIn: (secret: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSignOut: () => Promise<void>;
}) {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (state === 'loading') {
    return (
      <div className="rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
        Checking operator access
      </div>
    );
  }

  if (state === 'unconfigured') {
    return (
      <div className="rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2.5">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Read only
        </p>
        <p className="mt-1 text-[13px] leading-snug text-[var(--text-secondary)]">
          Operator access is not configured on this host, so the record cannot be changed here.
        </p>
      </div>
    );
  }

  if (state === 'signedIn') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[var(--success)]" aria-hidden="true" />
          Operator session active
        </span>
        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={busy}
          className="inline-flex min-h-[32px] items-center rounded-[4px] border border-[var(--border-default)] px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        const result = await onSignIn(secret);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSecret('');
      }}
      className="rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
    >
      <label
        htmlFor="operator-secret"
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]"
      >
        Operator secret
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          id="operator-secret"
          type="password"
          autoComplete="current-password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="min-h-[40px] min-w-0 flex-1 rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
        />
        <button
          type="submit"
          disabled={busy || secret.length === 0}
          className="inline-flex min-h-[40px] items-center rounded-[4px] bg-[var(--text-primary)] px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {busy ? 'Checking' : 'Sign in'}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-[12px] leading-snug text-[var(--accent-hover)]">{error}</p>
      ) : (
        <p className="mt-2 text-[12px] leading-snug text-[var(--text-secondary)]">
          Sign in to change the watchlist or publish a new ruleset version.
        </p>
      )}
    </form>
  );
}
