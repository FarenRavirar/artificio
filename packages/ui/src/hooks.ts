import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeChangelogEntries } from "./changelog.js";
import type { ChangelogEntry } from "./changelog.js";

export function useChangelogBadge(storageKey: string, marker: string) {
  const [hasNewUpdate, setHasNewUpdate] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) !== marker;
    } catch (error) {
      if (error instanceof DOMException) return false;
      throw error;
    }
  });

  const markSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    setHasNewUpdate(false);
    try {
      window.localStorage.setItem(storageKey, marker);
    } catch (error) {
      if (error instanceof DOMException) return;
      throw error;
    }
  }, [storageKey, marker]);

  return { hasNewUpdate, markSeen };
}

export function useChangelogData(
  fetcher: (signal: AbortSignal) => Promise<unknown>,
  isOpen: boolean,
) {
  const [logs, setLogs] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    cancelledRef.current = false;
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    const controller = controllerRef.current;

    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const raw = await fetcher(controller.signal);
        if (!cancelledRef.current) {
          setLogs(normalizeChangelogEntries(raw));
        }
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        console.error("Erro ao buscar changelogs:", err);
        setError("Não foi possível carregar as atualizações.");
      } finally {
        if (!cancelledRef.current) {
          setLoading(false);
        }
      }
    };

    fetchLogs();
    return () => {
      cancelledRef.current = true;
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [isOpen, fetcher]);

  const retry = useCallback(async () => {
    cancelledRef.current = false;
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    const controller = controllerRef.current;

    try {
      setLoading(true);
      setError(null);
      const raw = await fetcher(controller.signal);
      if (!cancelledRef.current) {
        setLogs(normalizeChangelogEntries(raw));
      }
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      console.error("Erro ao buscar changelogs:", err);
      setError("Não foi possível carregar as atualizações.");
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  return { logs, loading, error, retry };
}
