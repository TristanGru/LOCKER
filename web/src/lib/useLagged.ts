import { useEffect, useRef, useState } from 'react';

/**
 * Returns `value`, but only `ms` after it changes (0 = immediately).
 *
 * "Changes" means its JSON content changes, not its identity: callers often pass
 * a freshly built array each render, and comparing by reference would set state
 * every render (an endless render loop that starves React Router transitions,
 * which once made every navigation after the Change Feed silently do nothing).
 */
export function useLagged<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  const key = JSON.stringify(value);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    if (ms <= 0) {
      setV(latest.current);
      return;
    }
    const t = setTimeout(() => setV(latest.current), ms);
    return () => clearTimeout(t);
  }, [key, ms]);

  return v;
}
