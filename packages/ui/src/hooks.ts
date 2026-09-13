import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeChangelogEntries } from "./changelog.js";
import type { ChangelogEntry } from "./changelog.js";

function lerBadgeDoStorage(storageKey: string, marker: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey) !== marker;
  } catch (error) {
    if (error instanceof DOMException) return false;
    throw error;
  }
}

/**
 * Badge de novidade do changelog.
 *
 * O estado inicial é SEMPRE `false`, inclusive no cliente, e o `localStorage` só
 * é consultado depois da hidratação. Antes, o servidor devolvia `false` (não há
 * `window`) e o primeiro render do cliente devolvia `true` — `Header.tsx:314`
 * acrescenta um `<span>` nesse caso, então o DOM entregue pelo servidor diferia
 * do que o `hydrateRoot` recebia, forçando recuperação de hidratação e
 * descartando parte do benefício do HTML-first. Acontecia na primeira visita e
 * a cada versão nova, que são os casos comuns.
 *
 * `useEffect` e não `useState` com inicializador: o efeito roda depois do
 * primeiro commit, quando servidor e cliente já concordaram sobre o DOM. O
 * badge aparece um quadro depois — invisível para quem lê, e o preço correto
 * para não quebrar a hidratação da página inteira.
 *
 * Achado do Codex (P2) na PR #319.
 */
export function useChangelogBadge(storageKey: string, marker: string) {
  const [hasNewUpdate, setHasNewUpdate] = useState(false);

  useEffect(() => {
    setHasNewUpdate(lerBadgeDoStorage(storageKey, marker));
  }, [storageKey, marker]);

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

  const executeFetch = useCallback(async (controller: AbortController) => {
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

  useEffect(() => {
    if (!isOpen) return;

    cancelledRef.current = false;
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    const controller = controllerRef.current;

    executeFetch(controller);
    return () => {
      cancelledRef.current = true;
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [isOpen, executeFetch]);

  const retry = useCallback(async () => {
    cancelledRef.current = false;
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    const controller = controllerRef.current;

    await executeFetch(controller);
  }, [executeFetch]);

  return { logs, loading, error, retry };
}
