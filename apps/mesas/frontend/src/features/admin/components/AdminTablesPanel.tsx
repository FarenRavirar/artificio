import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Copy, Power, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { useConfirm } from '@artificio/ui';
import toast from 'react-hot-toast';
import { authDelete, authGet, authPost, authPut, isAbortError } from '../../../services/apiClient';
import { AdminTable, StatusPill } from './ui';
import { formatDate } from '../utils/format';
import { getMesasPublicOrigin } from '../../../utils/auth';
import { buildWhatsAppTableAnnouncement, copyTextToClipboard, fetchTableDetailBySlug, isTableAnnounceable } from '../../table/share/whatsappAnnouncement';

interface AdminTableRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  created_at: string;
  is_covil: boolean;
  featured: boolean;
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      // `data` vem de JSON: é `unknown` até ser validado. Sem a checagem de tipo,
      // um `error` que volte como objeto/array renderizaria "[object Object]" na
      // tela (AGENTS.md §Regras Gerais de Código — normalização obrigatória).
      // Achado real (review PR #280, coderabbit, inline).
      const data: unknown = await response.json();
      const raw = typeof data === 'object' && data !== null ? (data as { error?: unknown }).error : undefined;
      return typeof raw === 'string' && raw.length > 0 ? raw : fallback;
    }
    const text = await response.text();
    return text.slice(0, 200) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Executa uma mutação e devolve a Response, ou `null` se ela falhou — HTTP não-ok
 * OU rejeição de rede. O toast de erro sai aqui, uma vez, para os dois casos.
 *
 * As quatro mutações do painel (`authDelete`, 2× `authPut`, `authPost`) só tratavam
 * `response.ok`: com a rede caindo, a promise rejeitava sem captura e o admin
 * clicava em "Apagar" sem ver erro nem confirmação — a tela ficava idêntica, que
 * lê como "não aconteceu nada" quando a ação pode ter partido.
 * Achado real (review PR #280, coderabbit, outside-diff).
 */
async function runMutation(
  request: () => Promise<Response>,
  fallbackMessage: string,
): Promise<Response | null> {
  let response: Response;
  try {
    response = await request();
  } catch {
    toast.error(fallbackMessage);
    return null;
  }
  if (!response.ok) {
    toast.error(await extractErrorMessage(response, fallbackMessage));
    return null;
  }
  return response;
}

// Rótulo único por status: a coluna mostrava o valor cru do banco ("active",
// "full") enquanto a faceta ao lado já usava português ("Ativa", "Cheia") — mesma
// informação com dois vocabulários na mesma tela. Faceta e coluna leem daqui.
// Achado real (review PR #280, coderabbit, nitpick).
const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho (não publicada)',
  active: 'Ativa',
  full: 'Cheia',
  cancelled: 'Cancelada',
  ended: 'Encerrada',
};

// Verbo e particípio da mesma ação em um lugar só. Eram dois ternários aninhados
// (`action` e a mensagem de sucesso) que precisavam concordar entre si — nada
// impedia "publicar" acabar em "cancelada". Sonar (confusing, review PR #280)
// apontou o aninhamento; o mapa resolve a legibilidade e o acoplamento junto.
const STATUS_ACTION = {
  publicar: { infinitive: 'publicar', past: 'publicada' },
  ativar: { infinitive: 'ativar', past: 'ativada' },
  cancelar: { infinitive: 'cancelar', past: 'cancelada' },
} as const;

// Rótulo do resultado de cada ação em lote — mesma razão: era ternário aninhado.
const BATCH_VERB: Record<'archive' | 'unarchive' | 'delete', string> = {
  delete: 'apagada(s)',
  archive: 'arquivada(s)',
  unarchive: 'desarquivada(s)',
};

function normalizeTables(value: unknown): AdminTableRow[] {
  if (!Array.isArray(value)) return [];
  const rows: AdminTableRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || !row.id) continue;
    rows.push({
      id: row.id,
      slug: typeof row.slug === 'string' ? row.slug : '',
      title: typeof row.title === 'string' ? row.title : '',
      status: typeof row.status === 'string' ? row.status : 'unknown',
      created_at: typeof row.created_at === 'string' ? row.created_at : '',
      is_covil: row.is_covil === true,
      featured: row.featured === true,
    });
  }
  return rows;
}

/**
 * Aba "Mesas" de `/gestao/mesas` (R5/R6, spec 093) — extraída de
 * `ConteudoSection.tsx` para deixar de viver pendurada no catálogo de taxonomia.
 * Lista mesas de **qualquer status** via `GET /api/v1/admin/tables`, com busca,
 * 3 facetas, 3 ações em lote e 5 ações por linha (a de destaque entrou em T7.2c). O gate de "Copiar anúncio"
 * (`status === 'active'` e `slug` presente) sobrevive à extração — a mesma trava
 * de D1/R2. Extrair (não copiar) é o que impede dois lugares de divergirem.
 */
export function AdminTablesPanel() {
  const { confirm } = useConfirm();
  const [tables, setTables] = useState<AdminTableRow[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesError, setTablesError] = useState<string | null>(null);
  const [copyingTableId, setCopyingTableId] = useState<string | null>(null);

  const fetchAllTables = useCallback(async () => {
    setTablesLoading(true);
    setTablesError(null);
    try {
      // Rota admin (spec 060), não a pública: GET /api/v1/tables filtra
      // status=active only e nunca lista mesa importada em draft (gm_id: null).
      const response = await authGet('/api/v1/admin/tables');
      if (!response.ok) throw new Error(await extractErrorMessage(response, 'Erro ao buscar mesas.'));
      const payload: unknown = await response.json();
      const raw = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : null;
      setTables(normalizeTables(raw));
    } catch (error) {
      // Abort = dedup do apiClient na chamada duplicada do mount; a vencedora
      // preenche a lista. Sem o guard, o texto do DOMException virava erro na
      // tela com os dados já carregados (mesmo defeito medido em 2026-08-27).
      if (isAbortError(error)) return;
      const message = error instanceof Error ? error.message : 'Erro ao buscar mesas.';
      setTablesError(message);
      toast.error(message);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  // O painel só monta quando a sub-aba "Mesas" está ativa (ModeracaoSection),
  // então buscar ao montar é o equivalente da antiga condição `tab === 'tables'`
  // (T8.4): nunca busca enquanto o admin está em "Rascunhos".
  useEffect(() => {
    const timer = setTimeout(() => void fetchAllTables(), 0);
    return () => clearTimeout(timer);
  }, [fetchAllTables]);

  const handleDeleteTable = async (table: AdminTableRow) => {
    if (!(await confirm({
      title: 'Apagar mesa',
      message: `Apagar a mesa "${table.title}"? Esta ação não pode ser desfeita.`,
      variant: 'danger',
    }))) return;
    const response = await runMutation(
      () => authDelete(`/api/v1/admin/tables/${table.id}`),
      'Erro ao apagar mesa.',
    );
    if (!response) return;
    toast.success('Mesa apagada.');
    await fetchAllTables();
  };

  const handleToggleTableStatus = async (table: AdminTableRow) => {
    if (table.status !== 'active' && table.status !== 'cancelled' && table.status !== 'draft') {
      toast.error('Só é possível ativar/cancelar mesas ativas, canceladas ou publicar rascunhos.');
      return;
    }
    // Rascunho (mesa importada via Discord sync, sem gm_id) só tem caminho
    // pra frente: publicar. Cancelar/reativar segue o ciclo normal (spec 060).
    const newStatus = table.status === 'active' ? 'cancelled' : 'active';
    let actionKey: keyof typeof STATUS_ACTION;
    if (table.status === 'draft') actionKey = 'publicar';
    else if (newStatus === 'active') actionKey = 'ativar';
    else actionKey = 'cancelar';
    const action = STATUS_ACTION[actionKey].infinitive;
    if (!(await confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} mesa`,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} a mesa "${table.title}"?`,
      variant: 'warning',
    }))) return;

    const response = await runMutation(
      () => authPut(`/api/v1/admin/tables/${table.id}`, { status: newStatus }),
      `Erro ao ${action} mesa.`,
    );
    if (!response) return;
    toast.success(`Mesa ${STATUS_ACTION[actionKey].past}.`);
    await fetchAllTables();
  };

  const handleToggleCovil = async (table: AdminTableRow) => {
    const response = await runMutation(
      () => authPut(`/api/v1/admin/tables/${table.id}`, { is_covil: !table.is_covil }),
      'Erro ao atualizar Covil.',
    );
    if (!response) return;
    toast.success(!table.is_covil ? 'Mesa marcada como Covil do Lich.' : 'Marca Covil removida.');
    await fetchAllTables();
  };

  // T7.2c (spec 096): `featured` tinha filtro, peso na ordenação do catálogo e
  // selo no perfil do mestre, mas nenhum escritor — nenhuma mesa conseguia ser
  // destacada. Mesmo formato do Covil ao lado: alternância direta, sem confirmar,
  // porque é reversível e não destrutiva.
  const handleToggleFeatured = async (table: AdminTableRow) => {
    const response = await runMutation(
      () => authPut(`/api/v1/admin/tables/${table.id}`, { featured: !table.featured }),
      'Erro ao atualizar destaque.',
    );
    if (!response) return;
    toast.success(!table.featured ? 'Mesa marcada como destaque.' : 'Destaque removido.');
    await fetchAllTables();
  };

  const handleCopyAnnouncement = async (table: AdminTableRow) => {
    if (copyingTableId) return;
    if (!table.slug || table.status !== 'active') {
      toast.error('Não foi possível copiar o anúncio.');
      return;
    }

    setCopyingTableId(table.id);
    try {
      const tableDetail = await fetchTableDetailBySlug(table.slug);
      if (!isTableAnnounceable(tableDetail)) {
        throw new Error('Mesa indisponível para anúncio');
      }

      const text = buildWhatsAppTableAnnouncement(tableDetail, {
        publicOrigin: getMesasPublicOrigin(),
      });
      await copyTextToClipboard(text);
      toast.success('Anúncio copiado.');
    } catch {
      toast.error('Não foi possível copiar o anúncio.');
    } finally {
      setCopyingTableId(null);
    }
  };

  const handleTablesBatch = async (ids: string[], action: 'archive' | 'unarchive' | 'delete') => {
    const response = await runMutation(
      () => authPost('/api/v1/admin/tables/batch', { ids, action }),
      'Erro na ação em lote.',
    );
    if (!response) return;
    // A rota devolve `data.updated` com a contagem REAL (`RETURNING id`, adminTables.ts:117):
    // id inexistente ou já no estado alvo não entra no retorno. Reportar `ids.length` dizia
    // ao admin que N mesas mudaram quando podiam ter mudado menos — número inventado sobre
    // ação destrutiva. Cai para `ids.length` só se a resposta não trouxer o campo.
    // Achado real (review PR #280, coderabbit, integridade de dados).
    const verb = BATCH_VERB[action];
    const payload: unknown = await response.json().catch(() => null);
    const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>).data : null;
    const rawUpdated = data && typeof data === 'object' ? (data as Record<string, unknown>).updated : undefined;
    const updated = typeof rawUpdated === 'number' && Number.isFinite(rawUpdated) ? rawUpdated : ids.length;
    toast.success(`${updated} mesa(s) ${verb}.`);
    await fetchAllTables();
  };

  const tableColumns = useMemo(() => [
    {
      key: 'title',
      header: 'Mesa',
      render: (table: AdminTableRow) => (
        <div>
          <div className="font-medium text-[var(--fg)]">{table.title || 'Sem título'}</div>
          <div className="text-xs text-[var(--fg-faint)]">Criada em {formatDate(table.created_at)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (table: AdminTableRow) => (
        <StatusPill tone={table.status === 'active' ? 'success' : 'neutral'}>
          {STATUS_LABEL[table.status] ?? table.status}
        </StatusPill>
      ),
    },
    {
      key: 'covil',
      header: 'Covil',
      render: (table: AdminTableRow) => table.is_covil ? <StatusPill tone="brand">Covil</StatusPill> : <StatusPill>não</StatusPill>,
    },
    {
      key: 'featured',
      header: 'Destaque',
      render: (table: AdminTableRow) => table.featured ? <StatusPill tone="brand">Destaque</StatusPill> : <StatusPill>não</StatusPill>,
    },
  ], []);

  return (
    <AdminTable
      tableId="catalog-tables"
      rows={tables}
      getRowId={(table) => table.id}
      columns={tableColumns}
      searchKeys={['title', 'status']}
      searchPlaceholder="Buscar mesa..."
      facets={[
        {
          key: 'status',
          label: 'Status',
          options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
          getValue: (table) => table.status,
        },
        {
          key: 'covil',
          label: 'Covil',
          options: [{ value: 'true', label: 'Covil' }, { value: 'false', label: 'Sem selo' }],
          getValue: (table) => String(table.is_covil),
        },
        {
          key: 'featured',
          label: 'Destaque',
          options: [{ value: 'true', label: 'Destaque' }, { value: 'false', label: 'Sem destaque' }],
          getValue: (table) => String(table.featured),
        },
      ]}
      loading={tablesLoading}
      error={tablesError}
      emptyTitle="Nenhuma mesa encontrada"
      bulkActions={[
        { key: 'archive', label: 'Arquivar', icon: <Archive size={15} />, onRun: (ids) => handleTablesBatch(ids, 'archive') },
        { key: 'unarchive', label: 'Desarquivar', icon: <ArchiveRestore size={15} />, onRun: (ids) => handleTablesBatch(ids, 'unarchive') },
        { key: 'delete', label: 'Apagar', icon: <Trash2 size={15} />, tone: 'danger', confirm: 'Apagar as mesas selecionadas? Ação irreversível.', onRun: (ids) => handleTablesBatch(ids, 'delete') },
      ]}
      rowActions={[
        {
          key: 'copy-announcement',
          label: copyingTableId ? 'Copiando anúncio' : 'Copiar anúncio',
          icon: <Copy size={15} />,
          hidden: (table) => table.status !== 'active' || !table.slug,
          onRun: handleCopyAnnouncement,
        },
        {
          key: 'status',
          label: 'Publicar/ativar/cancelar',
          icon: <Power size={15} />,
          // Espelha o guard do handler (`handleToggleTableStatus`): status fora de
          // active/cancelled/draft — `full` e `ended` — só recebia toast de erro ao
          // clicar. Ação visível que sempre falha é pior que ação ausente, e o gate
          // de T8.2 continua atendido: o botão segue nas linhas em que opera.
          // Achado real (review PR #280, coderabbit, inline).
          hidden: (table) => table.status !== 'active' && table.status !== 'cancelled' && table.status !== 'draft',
          onRun: handleToggleTableStatus,
        },
        { key: 'covil', label: 'Alternar Covil', icon: <ShieldCheck size={15} />, onRun: handleToggleCovil },
        { key: 'featured', label: 'Alternar destaque', icon: <Star size={15} />, onRun: handleToggleFeatured },
        { key: 'delete', label: 'Apagar', icon: <Trash2 size={15} />, tone: 'danger', onRun: handleDeleteTable },
      ]}
    />
  );
}
