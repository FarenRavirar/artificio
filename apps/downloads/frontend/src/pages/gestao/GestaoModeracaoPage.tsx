import { useState } from 'react';
import { AdminTable, PageHeader, type AdminBulkAction, type AdminColumn, type AdminRowAction } from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import { useModerationBatchAction, useModerationQueue, useModerationSingleAction } from '../../hooks/useModerationQueue';
import { useAdminRejectionCategories } from '../../hooks/useAdminRejectionCategories';
import { EmailLogPanel } from '../../components/EmailLogPanel';

interface ModerationRow {
  id: string;
  title: string;
  material_type: string;
}

// T2.1-T2.3 (spec 075) — fila filtravel (so in_review chega da API), acoes
// batch e motivo estruturado obrigatorio em reprovacao. T6.1 (spec 083):
// categoria (com base legal quando houver) + motivo em texto, ambos
// obrigatorios antes de reprovar. Fase 5C (spec 086): reconstruida sobre
// PageHeader/AdminTable do kit compartilhado (T5C.5) — seleção, ações em
// lote e ações de linha vêm nativas do AdminTable.
export function GestaoModeracaoPage() {
  const { data: queue, isLoading } = useModerationQueue();
  const { data: categoriesData } = useAdminRejectionCategories();
  const batchAction = useModerationBatchAction();
  const singleAction = useModerationSingleAction();
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCategoryId, setRejectCategoryId] = useState('');

  const categories = categoriesData?.items ?? [];
  const selectedCategory = categories.find((c) => c.id === rejectCategoryId);

  async function runBatch(action: 'approve' | 'reject' | 'archive', ids: string[]) {
    if (action === 'reject' && (!rejectReason.trim() || !rejectCategoryId)) {
      window.alert('Categoria e motivo de reprovação são obrigatórios para ação em lote.');
      return;
    }
    await batchAction.mutateAsync({
      action,
      ids,
      reason: rejectReason || undefined,
      rejectionCategoryId: action === 'reject' ? rejectCategoryId : undefined,
    });
    setRejectReason('');
    setRejectCategoryId('');
  }

  async function rejectSingle(materialId: string) {
    if (!rejectReason.trim() || !rejectCategoryId) {
      window.alert('Selecione a categoria e preencha o motivo antes de reprovar.');
      return;
    }
    await singleAction.mutateAsync({
      id: materialId,
      action: 'reject',
      reason: rejectReason,
      rejectionCategoryId: rejectCategoryId,
    });
    setRejectReason('');
    setRejectCategoryId('');
  }

  const columns: Array<AdminColumn<ModerationRow>> = [
    { key: 'title', header: 'Título', render: (row) => row.title },
    { key: 'material_type', header: 'Tipo', render: (row) => row.material_type },
  ];

  const bulkActions: AdminBulkAction[] = [
    { key: 'approve', label: 'Aprovar selecionados', onRun: (ids) => runBatch('approve', ids) },
    { key: 'reject', label: 'Reprovar selecionados', tone: 'danger', onRun: (ids) => runBatch('reject', ids) },
    { key: 'archive', label: 'Arquivar selecionados', onRun: (ids) => runBatch('archive', ids) },
  ];

  const rowActions: Array<AdminRowAction<ModerationRow>> = [
    {
      key: 'approve',
      label: 'Aprovar',
      onRun: (row) => singleAction.mutateAsync({ id: row.id, action: 'approve' }).then(() => undefined),
    },
    { key: 'reject', label: 'Reprovar', tone: 'danger', onRun: (row) => rejectSingle(row.id) },
  ];

  return (
    <GestaoShell>
      <PageHeader title="Moderação" />

      {queue && queue.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={rejectCategoryId}
            onChange={(e) => setRejectCategoryId(e.target.value)}
            className="min-h-[44px] rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-fg)]"
          >
            <option value="">Categoria de reprovação...</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo (obrigatório para reprovar)"
            className="min-h-[44px] flex-1 rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-fg)]"
          />
        </div>
      )}
      {selectedCategory?.legal_basis && (
        <p className="mt-2 text-xs text-[var(--admin-fg-low)]">Base: {selectedCategory.legal_basis}</p>
      )}

      <div className="mt-6">
        <AdminTable<ModerationRow>
          tableId="gestao-moderacao"
          rows={queue ?? []}
          getRowId={(row) => row.id}
          columns={columns}
          searchKeys={['title']}
          loading={isLoading}
          bulkActions={bulkActions}
          rowActions={rowActions}
          emptyTitle="Fila vazia."
        />
      </div>

      <EmailLogPanel />
    </GestaoShell>
  );
}
