import { useState, useEffect, useCallback } from "react";

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminFetch<T>(path: string, apiKey: string): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(path, {
      headers: apiKey ? { "x-api-key": apiKey } : {},
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<T>;
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [path, apiKey, tick]);

  return { data, loading, error, refetch };
}

export function adminFetch(path: string, apiKey: string, options?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
  });
}
