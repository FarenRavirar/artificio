import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  AdminTable,
  PageHeader,
  SectionCard,
  StatusPill,
  type AdminColumn,
  type AdminRowAction,
} from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import {
  useAdminSystemSuggestions,
  useResolveSystemSuggestion,
  useSystemSuggestionCandidates,
  type ResolveSystemSuggestionPayload,
  type SystemCandidate,
  type SystemSuggestion,
} from '../../hooks/useSystemSuggestions';

const ACTION_LABEL = {
  merge_existing: 'Casar com existente',
  create_alias: 'Criar alias',
  create_child: 'Criar edição/variante',
  create_system: 'Criar sistema',
} as const;

const inputClass =
  'min-h-11 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-input)] px-3 py-2 text-sm text-[var(--admin-fg)]';

export function GestaoSugestoesSistemaPage() {
  const { data: suggestions = [], isLoading, error } = useAdminSystemSuggestions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [targetNodeId, setTargetNodeId] = useState('');
  const [newNodeName, setNewNodeName] = useState('');
  const [editionName, setEditionName] = useState('');
  const [childType, setChildType] = useState<'edition' | 'variant'>('edition');
  const [rejectReason, setRejectReason] = useState('');
  const { data: candidateData, isLoading: candidatesLoading } = useSystemSuggestionCandidates(activeId);
  const resolveMutation = useResolveSystemSuggestion();
  const activeSuggestion = suggestions.find((suggestion) => suggestion.id === activeId) ?? candidateData?.suggestion;

  function openSuggestion(suggestion: SystemSuggestion) {
    setActiveId(suggestion.id);
    setTargetNodeId('');
    setNewNodeName(suggestion.raw_value);
    setEditionName('');
    setChildType('edition');
    setRejectReason('');
  }

  async function resolve(payload: ResolveSystemSuggestionPayload) {
    if (!activeId) return;
    try {
      await resolveMutation.mutateAsync({ suggestionId: activeId, payload });
      toast.success(payload.resolution_type === 'reject' ? 'Sugestão recusada.' : 'Sugestão resolvida.');
      setActiveId(null);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Falha ao resolver sugestão.');
    }
  }

  const suggestionColumns: Array<AdminColumn<SystemSuggestion>> = [
    { key: 'raw_value', header: 'Valor recebido', render: (row) => <strong className="text-[var(--admin-fg)]">{row.raw_value}</strong> },
    { key: 'source', header: 'Origem', render: (row) => <StatusPill tone={row.source === 'scraper' ? 'info' : 'brand'}>{row.source === 'scraper' ? 'Scraper' : 'Usuário'}</StatusPill> },
    { key: 'created_at', header: 'Recebida em', render: (row) => new Date(row.created_at).toLocaleString('pt-BR') },
  ];
  const suggestionActions: Array<AdminRowAction<SystemSuggestion>> = [
    { key: 'review', label: 'Analisar', onRun: openSuggestion },
  ];

  const candidateColumns: Array<AdminColumn<SystemCandidate>> = [
    { key: 'name', header: 'Candidato', render: (row) => row.name },
    { key: 'path_slug', header: 'Caminho', render: (row) => row.path_slug ?? '—' },
    { key: 'node_type', header: 'Tipo', render: (row) => row.node_type },
    { key: 'score', header: 'Confiança', render: (row) => `${Math.round(row.score * 100)}%` },
  ];
  const candidateActions: Array<AdminRowAction<SystemCandidate>> = [
    { key: 'select', label: 'Selecionar', onRun: (candidate) => setTargetNodeId(candidate.system_id) },
  ];

  return (
    <GestaoShell>
      <PageHeader
        title="Sugestões de sistema"
        description="Resolva valores não reconhecidos sem gravar taxonomia automaticamente a partir do marketplace."
      />

      <SectionCard className="mt-6" title="Fila pendente" description="Cada decisão ensina um alias ao catálogo central quando aplicável.">
        <AdminTable<SystemSuggestion>
          tableId="system-suggestions"
          rows={suggestions}
          getRowId={(row) => row.id}
          getRowLabel={(row) => row.raw_value}
          columns={suggestionColumns}
          searchKeys={['raw_value']}
          loading={isLoading}
          error={error instanceof Error ? error.message : null}
          rowActions={suggestionActions}
          emptyTitle="Nenhuma sugestão pendente."
        />
      </SectionCard>

      {activeSuggestion && (
        <div className="mt-6 space-y-6">
          <SectionCard
            title={`Triagem: ${activeSuggestion.raw_value}`}
            description="Candidatos pontuados pelo catálogo; decisão final continua humana."
            action={candidateData ? <StatusPill tone="warn">Recomendação: {ACTION_LABEL[candidateData.recommended_action]}</StatusPill> : undefined}
          >
            <AdminTable<SystemCandidate>
              tableId="system-suggestion-candidates"
              rows={candidateData?.candidates ?? []}
              getRowId={(row) => row.system_id}
              getRowLabel={(row) => row.name}
              columns={candidateColumns}
              loading={candidatesLoading}
              rowActions={candidateActions}
              emptyTitle="Nenhum candidato próximo."
              emptyHint="Crie um sistema raiz ou escolha manualmente um nome."
            />
            {targetNodeId && <p className="mt-3 text-sm text-[var(--admin-fg-low)]">Node selecionado: <code>{targetNodeId}</code></p>}
          </SectionCard>

          <SectionCard title="Casar ou ensinar alias" description="Use um candidato existente; o valor bruto passa a resolver automaticamente nos próximos materiais.">
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={!targetNodeId || resolveMutation.isPending} onClick={() => void resolve({ resolution_type: 'merge_existing', target_node_id: targetNodeId })} className="min-h-11 rounded-md bg-artificio-orange px-4 py-2 font-semibold text-white disabled:opacity-50">Casar com existente</button>
              <button type="button" disabled={!targetNodeId || resolveMutation.isPending} onClick={() => void resolve({ resolution_type: 'create_alias', target_node_id: targetNodeId })} className="min-h-11 rounded-md border border-[var(--admin-border)] px-4 py-2 text-[var(--admin-fg)] disabled:opacity-50">Criar alias no existente</button>
            </div>
          </SectionCard>

          <SectionCard title="Criar node" description="Criação acontece por decisão explícita nesta tela, nunca pelo scraper.">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold text-[var(--admin-fg)]">Sistema raiz</h3>
                <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
                  Nome do sistema
                  <input value={newNodeName} onChange={(event) => setNewNodeName(event.target.value)} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
                  Edição opcional
                  <input value={editionName} onChange={(event) => setEditionName(event.target.value)} className={inputClass} />
                </label>
                <button type="button" disabled={!newNodeName.trim() || resolveMutation.isPending} onClick={() => void resolve({ resolution_type: 'create_system', name: newNodeName.trim(), edition_name: editionName.trim() || undefined })} className="min-h-11 w-fit rounded-md bg-artificio-orange px-4 py-2 font-semibold text-white disabled:opacity-50">Criar sistema</button>
              </div>

              <div className="flex flex-col gap-3">
                <h3 className="font-semibold text-[var(--admin-fg)]">Filho do candidato selecionado</h3>
                <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
                  Tipo
                  <select value={childType} onChange={(event) => setChildType(event.target.value as 'edition' | 'variant')} className={inputClass}>
                    <option value="edition">Edição</option>
                    <option value="variant">Variante</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
                  Nome do filho
                  <input value={editionName} onChange={(event) => setEditionName(event.target.value)} className={inputClass} />
                </label>
                <button type="button" disabled={!targetNodeId || !editionName.trim() || resolveMutation.isPending} onClick={() => void resolve({ resolution_type: 'create_child', parent_id: targetNodeId, node_type: childType, name: editionName.trim() })} className="min-h-11 w-fit rounded-md border border-[var(--admin-border)] px-4 py-2 font-semibold text-[var(--admin-fg)] disabled:opacity-50">Criar {childType === 'edition' ? 'edição' : 'variante'}</button>
              </div>
            </div>

            <p role="note" className="mt-5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-hover)] p-3 text-sm text-[var(--admin-fg-low)]">
              Catálogo central é compartilhado com Mesas e Glossário. Conforme D099, node criado não é apagado: erro deve ser mesclado com redirect para o UUID correto.
            </p>
          </SectionCard>

          <SectionCard title="Recusar sugestão">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
                Motivo
                <textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={3} className={inputClass} />
              </label>
              <button type="button" disabled={resolveMutation.isPending} onClick={() => void resolve({ resolution_type: 'reject', reason: rejectReason.trim() || undefined })} className="min-h-11 w-fit rounded-md border border-[var(--admin-danger)] px-4 py-2 font-semibold text-[var(--admin-danger-soft)] disabled:opacity-50">Recusar</button>
            </div>
          </SectionCard>
        </div>
      )}
    </GestaoShell>
  );
}
