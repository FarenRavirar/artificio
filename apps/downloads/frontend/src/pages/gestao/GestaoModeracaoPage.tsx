import { useState } from 'react';
import { GestaoShell } from '../../components/GestaoShell';
import { useModerationBatchAction, useModerationQueue, useModerationSingleAction } from '../../hooks/useModerationQueue';
import { useAdminRejectionCategories } from '../../hooks/useAdminRejectionCategories';
import { EmailLogPanel } from '../../components/EmailLogPanel';

// T2.1-T2.3 (spec 075) — fila filtravel (so in_review chega da API), acoes
// batch e motivo estruturado obrigatorio em reprovacao. T6.1 (spec 083):
// categoria (com base legal quando houver) + motivo em texto, ambos
// obrigatorios antes de reprovar.
export function GestaoModeracaoPage() {
  const { data: queue, isLoading } = useModerationQueue();
  const { data: categoriesData } = useAdminRejectionCategories();
  const batchAction = useModerationBatchAction();
  const singleAction = useModerationSingleAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCategoryId, setRejectCategoryId] = useState('');

  const categories = categoriesData?.items ?? [];
  const selectedCategory = categories.find((c) => c.id === rejectCategoryId);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBatch(action: 'approve' | 'reject' | 'archive') {
    if (selected.size === 0) return;
    if (action === 'reject' && (!rejectReason.trim() || !rejectCategoryId)) {
      window.alert('Categoria e motivo de reprovação são obrigatórios para ação em lote.');
      return;
    }
    await batchAction.mutateAsync({
      action,
      ids: Array.from(selected),
      reason: rejectReason || undefined,
      rejectionCategoryId: action === 'reject' ? rejectCategoryId : undefined,
    });
    setSelected(new Set());
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

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Moderação</h1>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}
      {queue?.length === 0 && <p className="mt-4 text-[var(--fg-muted)]">Fila vazia.</p>}

      {queue && queue.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={rejectCategoryId}
              onChange={(e) => setRejectCategoryId(e.target.value)}
              className="min-h-[44px] rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
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
              className="min-h-[44px] flex-1 rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
            />
            <button
              type="button"
              disabled={selected.size === 0 || batchAction.isPending}
              onClick={() => runBatch('approve')}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] disabled:opacity-40"
            >
              Aprovar selecionados
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || batchAction.isPending}
              onClick={() => runBatch('reject')}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] disabled:opacity-40"
            >
              Reprovar selecionados
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || batchAction.isPending}
              onClick={() => runBatch('archive')}
              className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)] disabled:opacity-40"
            >
              Arquivar selecionados
            </button>
          </div>
          {selectedCategory?.legal_basis && (
            <p className="mt-2 text-xs text-[var(--fg-muted)]">Base: {selectedCategory.legal_basis}</p>
          )}

          <ul className="mt-6 divide-y divide-[var(--line)]">
            {queue.map((material) => (
              <li key={material.id} className="flex items-center gap-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(material.id)}
                  onChange={() => toggle(material.id)}
                  className="h-5 w-5"
                  aria-label={`Selecionar ${material.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--fg)]">{material.title}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{material.material_type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => singleAction.mutateAsync({ id: material.id, action: 'approve' }).catch(() => undefined)}
                  className="min-h-[44px] rounded-md border border-[var(--line)] px-3 py-2 text-xs text-[var(--fg)]"
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  onClick={() => rejectSingle(material.id)}
                  disabled={singleAction.isPending}
                  className="min-h-[44px] rounded-md border border-[var(--line)] px-3 py-2 text-xs text-[var(--fg)] disabled:opacity-40"
                >
                  Reprovar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <EmailLogPanel />
    </GestaoShell>
  );
}
