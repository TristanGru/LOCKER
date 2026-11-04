import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './store';

export interface ApiState<T> {
  data: T | null;
  error: unknown;
  loading: boolean; // true only while there is no data yet
  refreshing: boolean; // true while refetching with data on screen
  reload: () => void;
}

/**
 * Fetches via api.ts and refetches whenever the store's version bumps
 * (after events, approvals, STOP, reset) or when deps change.
 * Keeps showing the previous data while refreshing so the screen never flashes.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiState<T> {
  const { version } = useStore();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [inFlight, setInFlight] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);
  const depsKey = JSON.stringify(deps);
  const lastDeps = useRef(depsKey);

  useEffect(() => {
    const id = ++reqId.current;
    if (lastDeps.current !== depsKey) {
      lastDeps.current = depsKey;
      setData(null);
    }
    setInFlight(true);
    fetcher()
      .then((d) => {
        if (id !== reqId.current) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (id !== reqId.current) return;
        setError(e);
      })
      .finally(() => {
        if (id === reqId.current) setInFlight(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, nonce, depsKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading: inFlight && data === null, refreshing: inFlight && data !== null, reload };
}
