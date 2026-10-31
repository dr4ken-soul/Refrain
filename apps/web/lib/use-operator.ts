'use client';

import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from './api';

export type OperatorState = 'loading' | 'unconfigured' | 'signedOut' | 'signedIn';

export function useOperator() {
  const [state, setState] = useState<OperatorState>('loading');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/operator/session`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        setState('unconfigured');
        return;
      }
      const body = (await response.json()) as { signedIn: boolean; configured: boolean };
      setState(!body.configured ? 'unconfigured' : body.signedIn ? 'signedIn' : 'signedOut');
    } catch {
      setState('unconfigured');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (secret: string) => {
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/operator/session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      if (response.ok) {
        setState('signedIn');
        return { ok: true as const };
      }
      if (response.status === 503) {
        setState('unconfigured');
        return { ok: false as const, error: 'Operator access is not configured on this host.' };
      }
      return { ok: false as const, error: 'That operator secret was not accepted.' };
    } catch {
      return { ok: false as const, error: 'The API did not answer, so the session was not opened.' };
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE}/operator/session`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setState('signedOut');
    } catch {
      setState('signedOut');
    } finally {
      setBusy(false);
    }
  }, []);

  const noteUnauthorized = useCallback(() => setState('signedOut'), []);

  return { state, busy, signIn, signOut, refresh, noteUnauthorized };
}
