import { useCallback } from "react";
import { DynamicChangelogModal } from "@artificio/ui";
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
    (signal: AbortSignal) => api.get("/changelog", { signal }).then((r) => r.data.data),
    [],
  );

  return (
    <DynamicChangelogModal
      isOpen={isOpen}
      onClose={onClose}
      fetcher={fetcher}
      labels={LABELS}
    />
  );
}
