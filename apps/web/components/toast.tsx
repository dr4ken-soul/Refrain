'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Close } from './icons';

export type ToastState = {
  kind: 'ok' | 'error';
  title: string;
  body?: string;
};

export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast || toast.kind === 'error') return;
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 right-4 z-[90] w-[calc(100vw-2rem)] max-w-[360px] rounded-[8px] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3.5 shadow-[var(--shadow-overlay)] lg:bottom-4 lg:right-4"
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">{toast.title}</div>
              {toast.body ? (
                <p className="mt-1 text-[13px] leading-snug text-[var(--text-secondary)]">{toast.body}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss message"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <Close className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
