import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async API function and tracks { data, loading, error }.
 * Re-runs when `deps` change. `reload()` refetches without clearing current data.
 */
export function useApi(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  const callId = useRef(0);
  fnRef.current = fn;

  const run = useCallback(async (...args) => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      if (id === callId.current) setData(result);
      return result;
    } catch (e) {
      if (id === callId.current) setError(e);
      throw e;
    } finally {
      if (id === callId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (immediate) run().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => run().catch(() => {}), [run]);
  return { data, loading, error, reload, setData, run };
}

/** Debounces a value (used for search inputs). */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
