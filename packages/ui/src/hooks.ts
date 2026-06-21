import { useCallback, useState } from "react";

export function useChangelogBadge(storageKey: string, marker: string) {
  const [hasNewUpdate, setHasNewUpdate] = useState(() => {
    try {
      return window.localStorage.getItem(storageKey) !== marker;
    } catch {
      return false;
    }
  });

  const markSeen = useCallback(() => {
    setHasNewUpdate(false);
    try {
      window.localStorage.setItem(storageKey, marker);
    } catch {
      /* offline/pvt */
    }
  }, [storageKey, marker]);

  return { hasNewUpdate, markSeen };
}
