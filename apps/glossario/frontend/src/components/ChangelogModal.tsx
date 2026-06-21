import { useCallback } from "react";
import { ChangelogModal as SharedChangelogModal, useChangelogData } from "@artificio/ui";
import api from "../services/api";

interface Props {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

const LABELS = {
  typeApp: "SISTEMA",
  typeDados: "BASE DE DADOS",
  title: "Notas de Atualização",
  subtitle: "Confira as últimas melhorias e novos termos inseridos no Glossário.",
};

export function ChangelogModal({ isOpen, onClose }: Props) {
  const fetcher = useCallback(
    (signal: AbortSignal) => api.get("/changelog", { signal }).then((r) => r.data),
    [],
  );
  const { logs, loading, error, retry } = useChangelogData(fetcher, isOpen);

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
