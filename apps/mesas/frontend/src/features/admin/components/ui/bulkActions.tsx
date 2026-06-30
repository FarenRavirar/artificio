import { Archive, Trash2 } from 'lucide-react';
import type { AdminBulkAction } from './AdminTable';

/** Ações de lote padrão (R15) — apagar e arquivar. Helpers de conveniência. */
export const bulkDelete = (onRun: (ids: string[]) => void | Promise<void>): AdminBulkAction => ({
  key: 'delete',
  label: 'Apagar',
  icon: <Trash2 size={15} />,
  tone: 'danger',
  confirm: 'Apagar os itens selecionados? Esta ação não pode ser desfeita.',
  onRun,
});

export const bulkArchive = (onRun: (ids: string[]) => void | Promise<void>): AdminBulkAction => ({
  key: 'archive',
  label: 'Arquivar',
  icon: <Archive size={15} />,
  onRun,
});
