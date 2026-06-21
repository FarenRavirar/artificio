import { useCallback, useEffect, useState } from "react";
import { ChangelogModal as SharedChangelogModal } from "@artificio/ui";
import type { ChangelogEntry } from "@artificio/ui";
import api from "../services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const LABELS = {
  typeApp: "SISTEMA",
  typeDados: "BASE DE DADOS",
  title: "Notas de Atualização",
  subtitle: "Confira as últimas melhorias e novos termos inseridos no Glossário.",
};

export function ChangelogModal({ isOpen, onClose }: Props) {
  const [logs, setLogs] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();

    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get("/changelog", {
          signal: controller.signal,
        });
        setLogs(Array.isArray(response.data) ? response.data : []);
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
  }, [isOpen]);

  const retry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/changelog");
      setLogs(Array.isArray(response.data) ? response.data : []);
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
      labels={LABELS}
    />
  );
}
