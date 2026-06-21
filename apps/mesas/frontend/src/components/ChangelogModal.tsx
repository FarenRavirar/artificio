import { useCallback } from "react";
import { DynamicChangelogModal } from "@artificio/ui";

interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: Props) {
  const fetcher = useCallback(async (signal: AbortSignal) => {
    const res = await fetch("/api/v1/changelog", { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    if (typeof json === "object" && json !== null && "data" in json) {
      return (json as { data: unknown }).data;
    }
    return [];
  }, []);

  return (
    <DynamicChangelogModal
      isOpen={isOpen}
      onClose={onClose}
      fetcher={fetcher}
    />
  );
}
