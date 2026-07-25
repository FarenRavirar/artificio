import type { ReactNode } from "react";
import type { AdminBulkAction } from "./AdminTable.js";

export const bulkDelete = (
  icon: ReactNode,
  onRun: (ids: string[]) => void | Promise<void>,
): AdminBulkAction => ({
  key: "delete",
  label: "Apagar",
  icon,
  tone: "danger",
  confirm: "Apagar os itens selecionados? Esta ação não pode ser desfeita.",
  onRun,
});

export const bulkArchive = (
  icon: ReactNode,
  onRun: (ids: string[]) => void | Promise<void>,
): AdminBulkAction => ({
  key: "archive",
  label: "Arquivar",
  icon,
  onRun,
});
