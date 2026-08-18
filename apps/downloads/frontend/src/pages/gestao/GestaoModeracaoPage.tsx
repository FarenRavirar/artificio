import { useState } from 'react';
import toast from 'react-hot-toast';
import { AdminTable, PageHeader, type AdminBulkAction, type AdminColumn, type AdminRowAction } from '@artificio/ui/admin';
import { Select } from '@artificio/ui';
import { GestaoShell } from '../../components/GestaoShell';
import { useModerationBatchAction, useModerationQueue, useModerationSingleAction } from '../../hooks/useModerationQueue';
import { useAdminRejectionCategories } from '../../hooks/useAdminRejectionCategories';
import { EmailLogPanel } from '../../components/EmailLogPanel';
import { ContentEditor, contentOverflow } from '@artificio/content-editor';

/**
 * Teto do motivo de reprovação — política de UI, não do servidor.
 *
 * Medido: `moderation.ts:88` valida só `z.string().trim().min(1)` e a coluna é
 * `TEXT` (`migration_011`), então nada do lado de lá recusa por tamanho. O
 * limite existe para o operador não colar um laudo inteiro num campo que vira
 * e-mail ao autor; por ser só UI, ele precisa ser respeitado AQUI ou não é
 * respeitado em lugar nenhum.
 *
 * Esta tela não tem `<form>` — reprovar sai de `rowActions`/`bulkActions` —, e
 * o `setCustomValidity` do `ContentEditor` só interrompe submit nativo. O aviso
 * em vermelho aparecia e o envio seguia assim mesmo (achado P1 do Codex, PR
 * #275, terceira rodada).
 */
const REJECT_REASON_MAX_LENGTH = 4_000;
import { CommunityModerationWorkspace } from '@artificio/comments/react';
import {
  useCommunityCase,
  useCommentVersions,
  useCommunityModerationActions,
  useCommunityModerationLog,
  useCommunityModerationQueue,
  useCommunitySanctions,
  useModeratorAppeal,
} from '../../hooks/useCommunityModeration';

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
  const [communityCaseId, setCommunityCaseId] = useState<string | null>(null);
  const [appealId, setAppealId] = useState('');
  const communityQueue = useCommunityModerationQueue();
  const communityLog = useCommunityModerationLog();
  const communityCase = useCommunityCase(communityCaseId);
  const commentVersions = useCommentVersions(communityCase.data?.comment_id);
  const moderatorAppeal = useModeratorAppeal(appealId.trim() || null);
  const sanctions = useCommunitySanctions(communityCase.data?.reported_author_actor_id);
  const communityActions = useCommunityModerationActions();

  const categories = categoriesData?.items ?? [];
  const selectedCategory = categories.find((c) => c.id === rejectCategoryId);

  // Mesmo ponto que já barra motivo vazio: é o único lugar por onde a reprovação
  // em lote passa, e esta tela não tem `<form>` para o `setCustomValidity` do
  // editor interromper.
  const reasonOverflow = contentOverflow(rejectReason, REJECT_REASON_MAX_LENGTH);

  async function runBatch(action: 'approve' | 'reject' | 'archive', ids: string[]) {
    if (action === 'reject' && (!rejectReason.trim() || !rejectCategoryId)) {
      window.alert('Categoria e motivo de reprovação são obrigatórios para ação em lote.');
      throw new Error('Categoria e motivo de reprovação são obrigatórios.');
    }
    if (action === 'reject' && reasonOverflow > 0) {
      window.alert(`Reduza ${reasonOverflow} caracteres do motivo: o limite é ${REJECT_REASON_MAX_LENGTH}.`);
      throw new Error('Motivo de reprovação acima do limite.');
    }
    try {
      await batchAction.mutateAsync({
        action,
        ids,
        reason: rejectReason || undefined,
        rejectionCategoryId: action === 'reject' ? rejectCategoryId : undefined,
      });
      setRejectReason('');
      setRejectCategoryId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao executar ação em lote.');
      throw error;
    }
  }

  async function rejectSingle(materialId: string) {
    if (!rejectReason.trim() || !rejectCategoryId) {
      window.alert('Selecione a categoria e preencha o motivo antes de reprovar.');
      return;
    }
    if (reasonOverflow > 0) {
      window.alert(`Reduza ${reasonOverflow} caracteres do motivo: o limite é ${REJECT_REASON_MAX_LENGTH}.`);
      return;
    }
    try {
      await singleAction.mutateAsync({
        id: materialId,
        action: 'reject',
        reason: rejectReason,
        rejectionCategoryId: rejectCategoryId,
      });
      setRejectReason('');
      setRejectCategoryId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao reprovar material.');
      throw error;
    }
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
      onRun: (row) =>
        singleAction.mutateAsync({ id: row.id, action: 'approve' }).then(
          () => undefined,
          (error) => {
            toast.error(error instanceof Error ? error.message : 'Falha ao aprovar material.');
            throw error;
          },
        ),
    },
    { key: 'reject', label: 'Reprovar', tone: 'danger', onRun: (row) => rejectSingle(row.id) },
  ];

  return (
    <GestaoShell>
      <PageHeader title="Moderação" />

      {queue && queue.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor="reject-category" className="sr-only">Categoria de reprovação</label>
          <Select
            id="reject-category"
            value={rejectCategoryId}
            onChange={(e) => setRejectCategoryId(e.target.value)}
          >
            <option value="">Categoria de reprovação...</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.label}</option>
            ))}
          </Select>
          <ContentEditor
            id="reject-reason"
            label="Motivo da reprovação"
            value={rejectReason}
            onChange={setRejectReason}
            placeholder="Motivo (obrigatório para reprovar)"
            maxLength={REJECT_REASON_MAX_LENGTH}
            minHeight={128}
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
          getRowLabel={(row) => row.title}
          columns={columns}
          searchKeys={['title']}
          loading={isLoading}
          bulkActions={bulkActions}
          rowActions={rowActions}
          emptyTitle="Fila vazia."
        />
      </div>

      <EmailLogPanel />

      <div className="mt-8">
        <label htmlFor="community-appeal-id">Abrir recurso por ID</label>
        <input id="community-appeal-id" value={appealId} onChange={(event) => setAppealId(event.target.value)} placeholder="UUID do recurso" />
        <CommunityModerationWorkspace
          queue={communityQueue.data}
          loading={communityQueue.isLoading}
          error={communityQueue.error instanceof Error ? communityQueue.error.message : null}
          selectedCase={communityCase.data ?? null}
          selectedAppeal={moderatorAppeal.data ?? null}
          sanctions={sanctions.data?.sanctions}
          log={communityLog.data?.entries}
          versions={commentVersions.data?.versions}
          adapter={communityActions}
          onOpenCase={setCommunityCaseId}
          onReload={() => void Promise.all([communityQueue.refetch(), communityLog.refetch()])}
        />
      </div>
    </GestaoShell>
  );
}
