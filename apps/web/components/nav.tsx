'use client';

import { AnimatePresence, motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Menu } from './icons';
import { PrimaryAction } from './ui';

const SECTION_LABELS: Array<{ id: string; label: string }> = [
  { id: 'evidence-board', label: 'Evidence board' },
  { id: 'current-record', label: 'Current record' },
  { id: 'problem', label: 'The problem' },
  { id: 'anatomy-of-a-verdict', label: 'Anatomy of a verdict' },
  { id: 'kol-index', label: 'KOL reliability index' },
  { id: 'rejected-trades', label: 'Rejected trades' },
  { id: 'rules', label: 'Rules before positions' },
  { id: 'cre-filing-path', label: 'CRE filing path' },
  { id: 'boundary', label: 'Boundary' },
];

const MENU_ROWS = [
  { href: '/#evidence-board', label: 'Evidence board' },
  { href: '/#current-record', label: 'Current record' },
  { href: '/#anatomy-of-a-verdict', label: 'Anatomy of a verdict' },
  { href: '/#kol-index', label: 'KOL index' },
  { href: '/#rejected-trades', label: 'Rejected trades' },
  { href: '/#rules', label: 'Rules' },
  { href: '/#cre-filing-path', label: 'CRE filing path' },
  { href: '/#boundary', label: 'Boundary' },
];

export function Nav({ mode, channels }: { mode: 'live' | 'replay'; channels: number }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState('Evidence board');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.4 });
  const isApp = pathname.startsWith('/app');

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isApp) {
      setSection('Record');
      return;
    }
    const elements = SECTION_LABELS.map((row) => document.getElementById(row.id)).filter(
      (element): element is HTMLElement => Boolean(element),
    );
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const match = SECTION_LABELS.find((row) => row.id === entry.target.id);
            if (match) setSection(match.label);
          }
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [isApp, pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-[60px] focus:z-[60] focus:rounded-[6px] focus:bg-[var(--text-primary)] focus:px-4 focus:py-2.5 focus:font-mono focus:text-[11px] focus:uppercase focus:tracking-[0.14em] focus:text-[var(--text-inverse)]"
      >
        Skip to main content
      </a>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--border-subtle)] bg-[oklch(0.972_0.006_228/0.92)] backdrop-blur-[14px]">
        <div className="mx-auto grid h-[52px] w-full max-w-[1440px] grid-cols-[1fr_auto] items-center gap-3 px-4 md:h-14 md:px-8 lg:grid-cols-[220px_1fr_auto] xl:px-12">
          {/* Logo slot: the owner has not supplied a mark, so the wordmark carries the identity. */}
          <Link
            href={isApp ? '/app' : '/'}
            className="font-mono text-[13px] font-semibold uppercase tracking-[0.28em] text-[var(--text-primary)]"
          >
            Refrain
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            <span className="h-4 w-px bg-[var(--border-default)]" aria-hidden="true" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={section}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]"
              >
                {section}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-end gap-3">
            <nav className="hidden items-center gap-7 lg:flex" aria-label="Proof links">
              <Link
                href="/app"
                className={`relative py-2 text-[13px] font-medium transition-colors duration-200 hover:text-[var(--text-primary)] ${
                  isApp ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                Evidence board
                {isApp ? (
                  <span className="absolute -bottom-[1px] left-0 h-[2px] w-full origin-left bg-[var(--accent)]" />
                ) : null}
              </Link>
              <Link
                href="/#kol-index"
                className={`relative py-2 text-[13px] font-medium transition-colors duration-200 hover:text-[var(--text-primary)] ${
                  section === 'KOL reliability index' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                KOL index
                {section === 'KOL reliability index' ? (
                  <span className="absolute -bottom-[1px] left-0 h-[2px] w-full origin-left bg-[var(--accent)]" />
                ) : null}
              </Link>
              <Link
                href="/#cre-filing-path"
                className={`relative py-2 text-[13px] font-medium transition-colors duration-200 hover:text-[var(--text-primary)] ${
                  section === 'CRE filing path' ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                }`}
              >
                CRE filing path
                {section === 'CRE filing path' ? (
                  <span className="absolute -bottom-[1px] left-0 h-[2px] w-full origin-left bg-[var(--accent)]" />
                ) : null}
              </Link>
            </nav>

            <div className="hidden lg:block">
              <PrimaryAction href="/app" label="Open evidence board" />
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <StatusDot mode={mode} reduced={Boolean(reduced)} />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                {mode === 'live' ? 'Live' : 'Fixture'}
              </span>
            </div>

            <button
              ref={buttonRef}
              type="button"
              aria-expanded={open}
              aria-haspopup="true"
              aria-label="Open section index"
              onClick={() => setOpen((value) => !value)}
              className="flex h-11 w-11 items-center justify-center rounded-[6px] border border-[var(--border-default)] text-[var(--text-primary)] lg:hidden"
            >
              <Menu className={`h-5 w-5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-[-1px] h-px bg-[var(--border-subtle)]">
          <motion.div
            className="h-full w-full origin-left bg-[var(--accent)]"
            style={{ scaleX: progress }}
          />
        </div>

        <AnimatePresence>
          {open ? (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 top-full z-40 border-b border-[var(--border-default)] bg-[var(--bg-primary)] shadow-[var(--shadow-overlay)]"
            >
              {MENU_ROWS.map((row) => (
                <Link
                  key={row.href}
                  href={row.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-[52px] items-center justify-between border-t border-[var(--border-subtle)] px-4 text-sm font-medium text-[var(--text-primary)] first:border-t-0"
                >
                  {row.label}
                </Link>
              ))}
              <Link
                href="/app"
                onClick={() => setOpen(false)}
                className="flex min-h-[52px] items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--text-inverse)]"
              >
                Open evidence board
              </Link>
              <p className="border-t border-[var(--border-subtle)] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                {mode === 'live' ? 'Live' : 'CRE fixture replay'} · {channels} watchlist channels
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>
    </>
  );
}

function StatusDot({ mode, reduced }: { mode: 'live' | 'replay'; reduced: boolean }) {
  if (mode === 'replay') {
    return <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />;
  }
  return (
    <motion.span
      className="h-2 w-2 rounded-full bg-[var(--success)]"
      animate={reduced ? undefined : { scale: [1, 1.35, 1], opacity: [1, 0.65, 1] }}
      transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    />
  );
}
