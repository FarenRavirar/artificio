import { useCallback } from "react";
import { ChangelogModal as SharedChangelogModal, useChangelogData } from "@artificio/ui";

interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function ChangelogModal({ isOpen, onClose }: Props) {
  const fetcher = useCallback(async (signal: AbortSignal) => {
    const res = await fetch("/api/v1/changelog", { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json: unknown = await res.json();
    return typeof json === "object" && json !== null && "data" in json
      ? (json as { data: unknown }).data
      : [];
  }, []);
  const { logs, loading, error, retry } = useChangelogData(fetcher, isOpen);

  return (
    <SharedChangelogModal
      isOpen={isOpen}
      onClose={onClose}
      changelogs={logs}
      loading={loading}
      error={error}
      onRetry={retry}
    />
  );
}
