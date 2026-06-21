import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ChangelogModal as SharedChangelogModal } from "@artificio/ui";
import type { ChangelogEntry } from "@artificio/ui";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const renderMarkdown = (text: string): ReactNode => {
  return text.split("\n").map((line, lineIndex) => {
    const elements: ReactNode[] = [];
    let currentIndex = 0;
    const boldRegex = /\*\*([^*]+)\*\*/g;
    let match;

    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > currentIndex) {
        elements.push(
          <span key={`t-${lineIndex}-${currentIndex}`}>
            {line.substring(currentIndex, match.index)}
          </span>,
        );
      }
      elements.push(
        <strong key={`b-${lineIndex}-${match.index}`}>{match[1]}</strong>,
      );
      currentIndex = match.index + match[0].length;
    }

    if (currentIndex < line.length) {
      elements.push(
        <span key={`t-${lineIndex}-${currentIndex}`}>
          {line.substring(currentIndex)}
        </span>,
      );
    }

    if (elements.length === 0) {
      elements.push(<span key={`e-${lineIndex}`}>{line}</span>);
    }

    return <div key={`l-${lineIndex}`}>{elements}</div>;
  });
};

export function ChangelogModal({ isOpen, onClose }: Props) {
  const [logs, setLogs] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const controller = new AbortController();

      const fetchLogs = async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await fetch("/api/v1/changelog", { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json: unknown = await res.json();
          const data =
            typeof json === "object" && json !== null && "data" in json
              ? json.data
              : [];
          setLogs(Array.isArray(data) ? data : []);
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.error("Erro ao buscar changelogs:", err);
          setError("Não foi possível carregar as atualizações.");
        } finally {
          setLoading(false);
        }
      };

      fetchLogs();
      return () => controller.abort();
    }
  }, [isOpen]);

  const retry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/changelog");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      const data =
        typeof json === "object" && json !== null && "data" in json
          ? json.data
          : [];
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("Erro ao buscar changelogs:", err);
      setError("Não foi possível carregar as atualizações.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <SharedChangelogModal
      isOpen={isOpen}
      onClose={onClose}
      changelogs={logs}
      loading={loading}
      error={error}
      onRetry={retry}
      renderBody={renderMarkdown}
    />
  );
}
