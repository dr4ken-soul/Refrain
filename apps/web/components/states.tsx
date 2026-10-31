'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function RetryPanel({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-[8px] border border-[var(--accent)] bg-[var(--accent-glow)] px-4 py-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
      <button
        type="button"
        onClick={() => {
          setBusy(true);
          router.refresh();
          window.setTimeout(() => setBusy(false), 800);
        }}
        className="mt-3 inline-flex min-h-[36px] items-center gap-2 rounded-[6px] border border-[var(--border-default)] bg-transparent px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-primary)] transition-colors duration-200 hover:border-[var(--text-primary)]"
      >
        {busy ? 'Retrying' : 'Retry loading'}
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-10 text-center">
      <h3 className="font-body text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-[var(--text-secondary)]">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
