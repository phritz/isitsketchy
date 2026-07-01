"use client";

// Shared client hook for the "load once on mount, expose data/error/loading"
// pattern used by the list pages. Guards against setting state after unmount and
// exposes `reload` (for post-mutation refreshes) and `setError` (so callers can
// surface their own mutation errors through the same channel).
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export type AsyncData<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useAsyncData<T>(
  load: () => Promise<T>,
  fallbackMessage: string,
): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const activeRef = useRef<boolean>(true);
  const loadRef = useRef<() => Promise<T>>(load);
  loadRef.current = load;

  const reload = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const result: T = await loadRef.current();
      if (activeRef.current) {
        setData(result);
      }
    } catch (e) {
      if (activeRef.current) {
        setError(e instanceof Error ? e.message : fallbackMessage);
      }
    } finally {
      if (activeRef.current) {
        setLoading(false);
      }
    }
  }, [fallbackMessage]);

  useEffect(() => {
    activeRef.current = true;
    void reload();
    return () => {
      activeRef.current = false;
    };
  }, [reload]);

  return { data, error, loading, reload, setError };
}
