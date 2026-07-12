import { useState } from 'react';
import { GestaoShell } from '../../components/GestaoShell';
import { useModerationBatchAction, useModerationQueue, useModerationSingleAction } from '../../hooks/useModerationQueue';

// T2.1-T2.3 (spec 075) — fila filtravel (so in_review chega da API), acoes
// batch e motivo estruturado obrigatorio em reprovacao.
export function GestaoModeracaoPage() {
  const { data: queue, isLoading } = useModerationQueue();
  const batchAction = useModerationBatchAction();
  const singleAction = useModerationSingleAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState('');

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
    if (action === 'reject' && !rejectReason.trim()) {
      window.alert('Motivo de reprovação é obrigatório para ação em lote.');
      return;
    }
    await batchAction.mutateAsync({ action, ids: Array.from(selected), reason: rejectReason || undefined });
    setSelected(new Set());
    setRejectReason('');
  }

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-white">Moderação</h1>

      {isLoading && <p className="mt-4 text-white/60">Carregando...</p>}
      {queue && queue.length === 0 && <p className="mt-4 text-white/60">Fila vazia.</p>}

      {queue && queue.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo (obrigatório para reprovar)"
              className="min-h-[44px] flex-1 rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              disabled={selected.size === 0 || batchAction.isPending}
              onClick={() => runBatch('approve')}
              className="min-h-[44px] rounded-md border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Aprovar selecionados
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || batchAction.isPending}
              onClick={() => runBatch('reject')}
              className="min-h-[44px] rounded-md border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Reprovar selecionados
            </button>
            <button
              type="button"
              disabled={selected.size === 0 || batchAction.isPending}
              onClick={() => runBatch('archive')}
              className="min-h-[44px] rounded-md border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Arquivar selecionados
            </button>
          </div>

          <ul className="mt-6 divide-y divide-white/10">
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
                  <p className="truncate font-semibold text-white">{material.title}</p>
                  <p className="text-xs text-white/60">{material.material_type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void singleAction.mutateAsync({ id: material.id, action: 'approve' })}
                  className="min-h-[44px] rounded-md border border-white/20 px-3 py-2 text-xs text-white"
                >
                  Aprovar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </GestaoShell>
  );
}
