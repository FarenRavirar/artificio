import { useCallback, useState } from "react";

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
