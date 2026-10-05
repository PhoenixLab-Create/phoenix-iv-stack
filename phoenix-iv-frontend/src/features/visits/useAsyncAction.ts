import { useCallback, useState } from 'react';
import { ApiError } from '../../api/client';

/**
 * Shared busy/error handling for the "submit this step" actions across all
 * workflow screens, so each screen only writes the API call itself.
 */
export function useAsyncAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: Args) => {
      setBusy(true);
      setError(null);
      try {
        await action(...args);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [action],
  );

  return { run, busy, error, setError };
}
