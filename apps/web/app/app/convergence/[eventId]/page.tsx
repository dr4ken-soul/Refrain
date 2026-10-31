import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Anatomy } from '@/components/landing/anatomy';
import { safeGet } from '@/lib/api';
import type { CaseDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CasePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const detail = await safeGet<CaseDetail>(`/api/events/${encodeURIComponent(eventId)}`);
  if (!detail) notFound();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 md:px-8">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
          <Link href="/app" className="underline-offset-4 hover:text-[var(--text-primary)] hover:underline">
            Board
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--text-secondary)]">Case file</span>
        </div>
        <Link
          href="/app/ledger"
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--text-primary)] hover:underline"
        >
          Open ledger
        </Link>
      </div>
      <Anatomy caseFile={detail.event} run={detail.run} full />
    </div>
  );
}
