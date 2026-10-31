'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BoardIcon,
  CallsIcon,
  Close,
  KolsIcon,
  LedgerIcon,
  RulesIcon,
  WatchlistIcon,
} from './icons';

const RAIL = [
  { href: '/app', label: 'Board', icon: BoardIcon },
  { href: '/app/calls', label: 'Calls', icon: CallsIcon },
  { href: '/app/ledger', label: 'Ledger', icon: LedgerIcon },
  { href: '/app/kols', label: 'KOL index', icon: KolsIcon },
  { href: '/app/watchlist', label: 'Watchlist', icon: WatchlistIcon },
  { href: '/app/rules', label: 'Rules', icon: RulesIcon },
];

const BAR = [
  { href: '/app', label: 'Board', icon: BoardIcon },
  { href: '/app/calls', label: 'Calls', icon: CallsIcon },
  { href: '/app/ledger', label: 'Ledger', icon: LedgerIcon },
  { href: '/app/kols', label: 'KOLs', icon: KolsIcon },
];

export function AppShell({
  children,
  mode,
  rulesVersion,
  openPositions,
}: {
  children: React.ReactNode;
  mode: 'live' | 'replay';
  rulesVersion: number | null;
  openPositions: number;
}) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);

  const active = (href: string) =>
    href === '/app' ? pathname === '/app' : pathname.startsWith(href);

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-primary)] pt-[52px] md:pt-14">
      <div className="mx-auto w-full max-w-[1440px] lg:grid lg:grid-cols-[232px_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] flex-col border-r border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-4 lg:flex">
          <span className="px-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Record
          </span>
          <nav className="mt-1 flex flex-col" aria-label="Record">
            {RAIL.map((item) => {
              const Icon = item.icon;
              const isActive = active(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`mt-1 flex min-h-[44px] items-center gap-3 rounded-[6px] px-3 text-sm font-medium transition-colors duration-150 hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] ${
                    isActive
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[inset_2px_0_0_var(--accent)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-[6px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  mode === 'live' ? 'bg-[var(--success)]' : 'bg-[var(--accent)]'
                }`}
                aria-hidden="true"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                {mode === 'live' ? 'Live' : 'CRE fixture replay'}
              </span>
            </div>
            <div className="mt-1.5 font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
              Rules v{rulesVersion ?? 'n/a'} · {openPositions} open
            </div>
          </div>
        </aside>

        <div className="min-w-0 pb-[72px] lg:pb-0">{children}</div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--border-default)] bg-[oklch(0.972_0.006_228/0.94)] backdrop-blur-[14px] lg:hidden"
        aria-label="Record"
      >
        {BAR.map((item) => {
          const Icon = item.icon;
          const isActive = active(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
                isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
              }`}
            >
              {isActive ? (
                <span className="absolute inset-x-0 top-0 h-[2px] bg-[var(--accent)]" aria-hidden="true" />
              ) : null}
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore((value) => !value)}
          className={`flex min-h-[56px] flex-col items-center justify-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
            more ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
          }`}
        >
          <span className="flex h-5 w-5 items-center justify-center">
            {more ? <Close className="h-5 w-5" /> : <span className="tracking-[0.2em]">···</span>}
          </span>
          More
        </button>
      </nav>

      <AnimatePresence>
        {more ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-[56px] z-30 border-t border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-overlay)] lg:hidden"
          >
            <Link
              href="/app/watchlist"
              onClick={() => setMore(false)}
              className="flex min-h-[52px] items-center gap-3 border-b border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-primary)]"
            >
              <WatchlistIcon className="h-5 w-5" />
              Watchlist
            </Link>
            <Link
              href="/app/rules"
              onClick={() => setMore(false)}
              className="flex min-h-[52px] items-center gap-3 px-4 text-sm font-medium text-[var(--text-primary)]"
            >
              <RulesIcon className="h-5 w-5" />
              Rules
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
