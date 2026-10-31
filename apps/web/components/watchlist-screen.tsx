'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { OperatorGate } from './operator-gate';
import { Toast, type ToastState } from './toast';
import { timeOfDay } from '@/lib/format';
import { API_BASE } from '@/lib/api';
import { useOperator } from '@/lib/use-operator';
import type { Kol } from '@/lib/types';

const ROLES = [
  { value: 'core_signal', label: 'Core signal' },
  { value: 'meme_radar', label: 'Meme radar' },
  { value: 'noisy_source', label: 'Noisy source' },
  { value: 'red_flag_specimen', label: 'Red flag specimen' },
];

const CAP = 20;

function normaliseHandle(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  const match = value.match(/^(?:https?:\/\/)?(?:www\.)?t\.me\/([A-Za-z0-9_]{4,32})\/?(?:\?.*)?$/i);
  if (match) return match[1];
  value = value.replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{4,32}$/.test(value)) return null;
  return value;
}

export function WatchlistScreen({ rows }: { rows: Kol[] }) {
  const router = useRouter();
  const operator = useOperator();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('core_signal');
  const [note, setNote] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(() => rows.filter((row) => row.isActive).length, [rows]);
  const atCap = activeCount >= CAP;
  const canEdit = operator.state === 'signedIn';

  const addChannel = async (event: React.FormEvent) => {
    event.preventDefault();
    setHandleError(null);
    const normalised = normaliseHandle(handle);
    if (!normalised) {
      setHandleError('Enter a public handle such as @channelname, or a full t.me link.');
      return;
    }
    if (rows.some((row) => row.handle.toLowerCase().replace(/^@/, '') === normalised.toLowerCase())) {
      setHandleError('That channel is already on the watchlist, so nothing was added.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/operator/sources`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle: `@${normalised}`,
          displayName: normalised,
          role,
          note: note.trim() || null,
        }),
      });
      if (response.ok) {
        setHandle('');
        setRole('core_signal');
        setNote('');
        setToast({
          kind: 'ok',
          title: 'Channel added.',
          body: 'The channel is on the watchlist and will be read on the next collector run.',
        });
        router.refresh();
        return;
      }
      if (response.status === 401) {
        operator.noteUnauthorized();
        setToast({ kind: 'error', title: 'The operator session expired.', body: 'Sign in again to change the watchlist.' });
        return;
      }
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;
      setHandleError(body?.detail ?? 'The channel could not be added. Check the handle and retry.');
    } catch {
      setHandleError('The API did not answer, so nothing was added.');
    } finally {
      setSaving(false);
    }
  };

  const patchSource = async (source: Kol, patch: { role?: string; isActive?: boolean }) => {
    if (!canEdit) return;
    try {
      const response = await fetch(`${API_BASE}/operator/sources/${source.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        setToast({ kind: 'ok', title: 'Source updated.', body: `${source.handle} keeps the same record.` });
        router.refresh();
        return;
      }
      if (response.status === 401) {
        operator.noteUnauthorized();
        setToast({ kind: 'error', title: 'The operator session expired.', body: 'Sign in again to change the watchlist.' });
        return;
      }
      setToast({ kind: 'error', title: 'The source was not updated.', body: 'Retry after checking the API.' });
    } catch {
      setToast({ kind: 'error', title: 'The source was not updated.', body: 'The API did not answer.' });
    }
  };

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

      <div className="mt-5 overflow-hidden rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="hidden grid-cols-[1.6fr_1fr_0.8fr_1fr_0.7fr] gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 md:grid">
          {['Channel', 'Role', 'Active', 'Last ingested', 'Calls parsed'].map((label) => (
            <span key={label} className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {label}
            </span>
          ))}
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[var(--text-secondary)]">
              No source is on the watchlist. Add a public channel below to start the record.
            </p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-3 px-4 py-3.5 md:grid-cols-[1.6fr_1fr_0.8fr_1fr_0.7fr] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
                    {row.handle.replace(/^@/, '').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[12px] text-[var(--text-primary)]">{row.handle}</div>
                    <a
                      href={`https://t.me/${row.handle.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-mono text-[11px] text-[var(--text-muted)] underline-offset-4 hover:underline"
                    >
                      t.me/{row.handle.replace(/^@/, '')}
                    </a>
                    {row.note ? (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--text-secondary)]">
                        {row.note}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] md:hidden">
                    Role{' '}
                  </span>
                  <select
                    value={row.role}
                    disabled={!canEdit}
                    onChange={(event) => void patchSource(row, { role: event.target.value })}
                    aria-label={`Role for ${row.handle}`}
                    className="min-h-[36px] w-full rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 font-mono text-[11px] text-[var(--text-primary)] disabled:opacity-50"
                  >
                    {ROLES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={row.isActive}
                    aria-label={`${row.handle} active`}
                    disabled={!canEdit}
                    onClick={() => void patchSource(row, { isActive: !row.isActive })}
                    className={`relative h-6 w-10 rounded-full border transition-colors disabled:opacity-50 ${
                      row.isActive
                        ? 'border-[var(--text-primary)] bg-[var(--text-primary)]'
                        : 'border-[var(--border-default)] bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <span
                      className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${
                        row.isActive
                          ? 'left-[19px] bg-[var(--text-inverse)]'
                          : 'left-[3px] bg-[var(--text-muted)]'
                      }`}
                    />
                  </button>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    {row.isActive ? 'On' : 'Paused'}
                  </span>
                </div>
                <div className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                  {row.latestCall ? timeOfDay(row.latestCall, true) : 'No message'}
                </div>
                <div className="font-mono text-[12px] tabular-nums text-[var(--text-primary)]">
                  {row.callsTracked}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Add a channel</h2>
          <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {activeCount} of {CAP} active
          </span>
        </div>
        <form onSubmit={addChannel} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
          <label className="md:col-span-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Telegram handle or URL
            </span>
            <input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              disabled={!canEdit || atCap}
              placeholder="@channelname"
              aria-invalid={Boolean(handleError)}
              className="mt-1 min-h-[44px] w-full rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 font-mono text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] disabled:opacity-50"
            />
          </label>
          <label className="md:col-span-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Role
            </span>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              disabled={!canEdit || atCap}
              className="mt-1 min-h-[44px] w-full rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 font-mono text-[12px] text-[var(--text-primary)] disabled:opacity-50"
            >
              {ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Starting note
            </span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={!canEdit || atCap}
              placeholder="Why this channel is watched"
              className="mt-1 min-h-[44px] w-full rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--text-primary)] disabled:opacity-50"
            />
          </label>
          <div className="md:col-span-12">
            {handleError ? (
              <p className="mb-2 text-[12px] leading-snug text-[var(--accent-hover)]">{handleError}</p>
            ) : null}
            {atCap ? (
              <p className="mb-2 text-[12px] leading-snug text-[var(--text-secondary)]">
                The watchlist holds 20 active sources. Pause one source to add another.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={!canEdit || atCap || saving}
              className="inline-flex min-h-[44px] items-center rounded-[6px] bg-[var(--text-primary)] px-5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-inverse)] transition-colors duration-200 hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? 'Adding' : 'Add channel'}
            </button>
            {!canEdit && operator.state !== 'loading' ? (
              <p className="mt-2 text-[12px] leading-snug text-[var(--text-secondary)] opacity-80">
                Operator access is required to change the watchlist.
              </p>
            ) : null}
          </div>
        </form>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
