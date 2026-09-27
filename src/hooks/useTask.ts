import { useCallback, useRef, useState } from 'react';

import { formatError, type FriendlyError } from '../utils/formatError';
import { useMountedRef } from './useMountedRef';

export type TaskResult<T> = { ok: true; value: T } | { ok: false; error: FriendlyError | null };

/**
 * Runs one async downloader call at a time and exposes its pending label and
 * last error. A ref guard (not state) rejects double taps that land before
 * React re-renders the disabled button. `error: null` in a failed result
 * means the call was skipped because another one was in flight.
 */
export function useTask() {
  const mounted = useMountedRef();
  const inFlight = useRef(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  const run = useCallback(
    async <T>(label: string, task: () => Promise<T>): Promise<TaskResult<T>> => {
      if (inFlight.current) return { ok: false, error: null };
      inFlight.current = true;
      setRunning(label);
      setError(null);
      try {
        return { ok: true, value: await task() };
      } catch (caught) {
        const formatted = formatError(caught);
        if (mounted.current) setError(formatted);
        return { ok: false, error: formatted };
      } finally {
        inFlight.current = false;
        if (mounted.current) setRunning(null);
      }
    },
    [mounted],
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, running, error, clearError };
}
