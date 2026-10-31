import Link from 'next/link';
import { Flag } from '@/components/icons';
import { score, timeOfDay } from '@/lib/format';
import type { Kol } from '@/lib/types';

export function KolTable({ rows, linkBase = '/app/kols' }: { rows: Kol[]; linkBase?: string }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] md:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr>
              {['Channel', 'Role', 'Calls tracked', 'Settled record', 'Promotion flags', 'Reliability', 'Latest call'].map(
                (label) => (
                  <th
                    key={label}
                    className="sticky top-0 z-20 bg-[var(--bg-secondary)] px-4 py-3 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-[var(--border-subtle)] transition-colors duration-150 hover:bg-[var(--bg-secondary)]"
              >
                <td className="px-4 py-3.5 align-top">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
                      {row.handle.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`${linkBase}?handle=${encodeURIComponent(row.handle)}`}
                        className="block truncate font-mono text-[12px] text-[var(--text-primary)] underline-offset-4 hover:underline"
                      >
                        {row.handle}
                      </Link>
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">{row.platform}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 align-top text-sm text-[var(--text-secondary)]">
                  {roleName(row.role)}
                </td>
                <td className="px-4 py-3.5 align-top font-mono text-sm tabular-nums text-[var(--text-primary)]">
                  {row.callsTracked}
                </td>
                <td className="px-4 py-3.5 align-top font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">
                  {row.wins} hit · {row.losses} stopped · {row.expired} expired
                </td>
                <td className="px-4 py-3.5 align-top">
                  <span className="inline-flex items-center gap-1.5 font-mono text-sm tabular-nums text-[var(--text-primary)]">
                    {row.promotionFlags > 0 ? <Flag className="h-3.5 w-3.5 text-[var(--accent-hover)]" /> : null}
                    {row.promotionFlags}
                  </span>
                </td>
                <td className="px-4 py-3.5 align-top">
                  <span className="font-display text-xl font-bold tabular-nums text-[var(--text-primary)]">
                    {score(row.score)}
                  </span>
                  <div className="mt-1.5 h-1 w-[88px] rounded-[2px] bg-[var(--bg-elevated)]">
                    <div
                      className="h-full origin-left rounded-[2px] bg-[var(--text-primary)]"
                      style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3.5 align-top font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                  {row.latestCall ? timeOfDay(row.latestCall) : 'No call recorded'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-secondary)] font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
                  {row.handle.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`${linkBase}?handle=${encodeURIComponent(row.handle)}`}
                    className="block truncate font-mono text-[12px] text-[var(--text-primary)] underline-offset-4 hover:underline"
                  >
                    {row.handle}
                  </Link>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{row.platform}</span>
                </div>
              </div>
              <span className="font-display text-lg font-bold tabular-nums text-[var(--text-primary)]">
                {score(row.score)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniField label="Role" value={roleName(row.role)} />
              <MiniField label="Calls tracked" value={String(row.callsTracked)} />
              <MiniField
                label="Settled record"
                value={`${row.wins} hit · ${row.losses} stopped · ${row.expired} expired`}
              />
              <MiniField label="Promotion flags" value={String(row.promotionFlags)} />
              <MiniField label="Latest call" value={row.latestCall ? timeOfDay(row.latestCall) : 'Not recorded'} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[var(--border-subtle)] pt-2.5">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 font-mono text-[12px] tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function roleName(role: string) {
  if (role === 'core_signal') return 'Core signal';
  if (role === 'meme_radar') return 'Meme radar';
  if (role === 'noisy_source') return 'Noisy source';
  if (role === 'red_flag_specimen') return 'Red flag specimen';
  return role;
}
