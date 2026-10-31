import Link from 'next/link';
import { External } from './icons';
import { Stamp } from './stamp';
import {
  dayStamp,
  directionLabel,
  money,
  price,
  shortHash,
  timeOfDay,
  txUrl,
  utcStamp,
} from '@/lib/format';
import type { Call, Position, Rejection } from '@/lib/types';

type PositionRow = Position & {
  eventId: string;
  ticker: string | null;
  assetKey: string | null;
  decision: string;
};

export function CallsTable({ calls }: { calls: Call[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] md:block">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr>
              {[
                'Time',
                'Channel',
                'Asset',
                'Direction',
                'Entry, stop, target',
                'Conviction',
                'Parser',
                'Record',
              ].map((label) => (
                <th
                  key={label}
                  className="sticky top-0 z-20 bg-[var(--bg-secondary)] px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr
                key={call.id}
                className="border-t border-[var(--border-subtle)] transition-colors duration-150 hover:bg-[var(--bg-secondary)]"
              >
                <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                  {timeOfDay(call.timestamp)}
                </td>
                <td className="px-3 py-3 font-mono text-[12px] text-[var(--text-primary)]">
                  {call.sourceLabel}
                </td>
                <td className="px-3 py-3 font-mono text-[12px] text-[var(--text-primary)]">{call.ticker}</td>
                <td className="px-3 py-3 text-sm text-[var(--text-secondary)]">
                  {directionLabel(call.direction)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                  {price(call.entryPrice)} / {price(call.stopPrice)} / {price(call.targetPrice)}
                </td>
                <td className="px-3 py-3 font-mono text-sm tabular-nums text-[var(--text-primary)]">
                  {call.conviction}
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-[var(--text-muted)]">{call.parser}</td>
                <td className="px-3 py-3 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                  {call.isAdvertisement
                    ? call.filterReason ?? 'Advertisement'
                    : call.duplicateOf
                      ? 'Duplicate'
                      : shortHash(call.callHash, 8, 6)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {calls.map((call) => (
          <div
            key={call.id}
            className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[12px] text-[var(--text-primary)]">{call.sourceLabel}</span>
              <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                {timeOfDay(call.timestamp)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniField label="Asset" value={call.ticker} />
              <MiniField label="Direction" value={directionLabel(call.direction)} />
              <MiniField
                label="Levels"
                value={`${price(call.entryPrice)} / ${price(call.stopPrice)} / ${price(call.targetPrice)}`}
              />
              <MiniField label="Conviction" value={String(call.conviction)} />
              <MiniField label="Parser" value={call.parser} />
              <MiniField
                label="Record"
                value={
                  call.isAdvertisement
                    ? call.filterReason ?? 'Advertisement'
                    : shortHash(call.callHash, 8, 6)
                }
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function PositionsTable({ positions }: { positions: PositionRow[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] md:block">
        <table className="w-full min-w-[1080px] border-collapse text-left">
          <thead>
            <tr>
              {[
                'Opened',
                'Asset',
                'Direction',
                'Entry',
                'Size',
                'Stop',
                'Target',
                'State',
                'Exit',
                'Paper result',
                'Filing',
              ].map((label) => (
                <th
                  key={label}
                  className="sticky top-0 z-20 bg-[var(--bg-secondary)] px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((row) => {
              const link = txUrl(row.openTxHash);
              return (
                <tr
                  key={row.positionId}
                  className="border-t border-[var(--border-subtle)] transition-colors duration-150 hover:bg-[var(--bg-secondary)]"
                >
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                    {utcStamp(row.openedAt)}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] text-[var(--text-primary)]">{row.ticker}</td>
                  <td className="px-3 py-3 text-sm text-[var(--text-secondary)]">
                    {directionLabel(row.direction)}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] tabular-nums text-[var(--text-primary)]">
                    {price(row.entryPrice)}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">
                    {money(row.sizeUsdCents)}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">
                    {price(row.stopPrice)}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">
                    {price(row.targetPrice)}
                  </td>
                  <td className="px-3 py-3">
                    <Stamp kind={row.status === 'settled' ? 'settled' : 'open'} compact />
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                    {row.exitPrice ? price(row.exitPrice) : 'Not settled'}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                    {row.pnlUnits === null ? 'Open' : `${row.pnlUnits > 0 ? '+' : ''}${row.pnlUnits}`}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] tabular-nums">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--text-primary)] underline-offset-4 hover:underline"
                      >
                        {shortHash(row.openTxHash, 8, 6)}
                        <External className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-[var(--text-muted)]">Not filed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {positions.map((row) => (
          <div
            key={row.positionId}
            className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[13px] text-[var(--text-primary)]">
                {row.ticker} · {directionLabel(row.direction)}
              </span>
              <Stamp kind={row.status === 'settled' ? 'settled' : 'open'} compact />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniField label="Opened" value={utcStamp(row.openedAt)} />
              <MiniField label="Size" value={money(row.sizeUsdCents)} />
              <MiniField label="Entry" value={price(row.entryPrice)} />
              <MiniField label="Stop" value={price(row.stopPrice)} />
              <MiniField label="Target" value={price(row.targetPrice)} />
              <MiniField label="Exit" value={row.exitPrice ? price(row.exitPrice) : 'Not settled'} />
              <MiniField
                label="Paper result"
                value={row.pnlUnits === null ? 'Open' : `${row.pnlUnits > 0 ? '+' : ''}${row.pnlUnits}`}
              />
              <MiniField label="Filing" value={shortHash(row.openTxHash, 8, 6)} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function RejectionsTable({ rejections }: { rejections: Rejection[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] md:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr>
              {['Decided', 'Asset', 'Claimed direction', 'Reason code', 'Voices counted', 'Filing'].map(
                (label) => (
                  <th
                    key={label}
                    className="sticky top-0 z-20 bg-[var(--bg-secondary)] px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rejections.map((row) => {
              const link = txUrl(row.verdictTx);
              return (
                <tr
                  key={row.eventId}
                  className="border-t border-[var(--border-subtle)] transition-colors duration-150 hover:bg-[var(--bg-secondary)]"
                >
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                    {utcStamp(row.decidedAt)}
                  </td>
                  <td className="px-3 py-3 font-mono text-[12px] text-[var(--text-primary)]">
                    {row.ticker}
                  </td>
                  <td className="px-3 py-3 text-sm text-[var(--text-secondary)]">
                    {directionLabel(row.direction)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-[4px] border border-[var(--accent)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--accent-hover)]">
                      {row.reasonCode}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-sm tabular-nums text-[var(--text-primary)]">
                    {row.independentVoiceCount}
                  </td>
                  <td className="px-3 py-3 font-mono text-[11px] tabular-nums">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--text-primary)] underline-offset-4 hover:underline"
                      >
                        {shortHash(row.verdictTx, 8, 6)}
                        <External className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-[var(--text-muted)]">Not filed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {rejections.map((row) => (
          <div
            key={row.eventId}
            className="rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[13px] text-[var(--text-primary)]">{row.ticker}</span>
              <Stamp kind="rejected" compact />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniField label="Decided" value={dayStamp(row.decidedAt)} />
              <MiniField label="Direction" value={directionLabel(row.direction)} />
              <MiniField label="Reason code" value={row.reasonCode} />
              <MiniField label="Voices counted" value={String(row.independentVoiceCount)} />
              <MiniField label="Filing" value={shortHash(row.verdictTx, 8, 6)} />
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
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[12px] tabular-nums text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
