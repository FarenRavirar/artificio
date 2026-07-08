import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Archive, ArchiveRestore, Copy, Power, ShieldCheck, Trash2 } from 'lucide-react';
import { useConfirm } from '@artificio/ui';
import toast from 'react-hot-toast';
import { SystemsAdminView } from '../../../pages/SystemsAdminView';
import { ScenariosAdminView } from '../../../pages/ScenariosAdminView';
import { PlatformsPage } from '../platforms/PlatformsPage';
import { authDelete, authGet, authPost, authPut } from '../../../services/apiClient';
import { AdminTable, PageHeader, SectionCard, StatusPill, tabButtonClass } from './ui';
import { SettingSuggestionsPanel } from './SettingSuggestionsPanel';
import { formatDate } from '../utils/format';
import { getMesasPublicOrigin } from '../../../utils/auth';
import { buildWhatsAppTableAnnouncement, copyTextToClipboard, normalizeTableDetailPayload } from '../../table/share/whatsappAnnouncement';

interface AdminTableRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  created_at: string;
  is_covil: boolean;
}

type CatalogTab = 'systems' | 'platforms' | 'scenarios' | 'setting-styles' | 'tables';
type PlatformKind = 'vtt' | 'communication';

const TAB_LABEL: Record<CatalogTab, string> = {
  systems: 'Sistemas',
  platforms: 'Plataformas',
  scenarios: 'Cenários',
  'setting-styles': 'Estilos por cenário',
  tables: 'Mesas',
};

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      return data.error || fallback;
    }
    const text = await response.text();
    return text.slice(0, 200) || fallback;
  } catch {
    return fallback;
  }
}

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
    });
  }
  return rows;
}

const TAB_VALUES: CatalogTab[] = ['systems', 'platforms', 'scenarios', 'setting-styles', 'tables'];

export function ConteudoSection() {
  const { confirm } = useConfirm();
  const [urlParams] = useSearchParams();
  const tabFromUrl = urlParams.get('tab');
  const initialTab: CatalogTab = TAB_VALUES.includes(tabFromUrl as CatalogTab) ? (tabFromUrl as CatalogTab) : 'systems';
  const [tab, setTab] = useState<CatalogTab>(initialTab);
  const [platformKind, setPlatformKind] = useState<PlatformKind>('vtt');
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
      const message = error instanceof Error ? error.message : 'Erro ao buscar mesas.';
      setTablesError(message);
      toast.error(message);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'tables') return;
    const timer = setTimeout(() => void fetchAllTables(), 0);
    return () => clearTimeout(timer);
  }, [tab, fetchAllTables]);

  const handleDeleteTable = async (table: AdminTableRow) => {
    if (!(await confirm({
      title: 'Apagar mesa',
      message: `Apagar a mesa "${table.title}"? Esta ação não pode ser desfeita.`,
      variant: 'danger',
    }))) return;
    const response = await authDelete(`/api/v1/admin/tables/${table.id}`);
    if (!response.ok) {
      toast.error(await extractErrorMessage(response, 'Erro ao apagar mesa.'));
      return;
    }
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
    const action = table.status === 'draft' ? 'publicar' : newStatus === 'active' ? 'ativar' : 'cancelar';
    if (!(await confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} mesa`,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} a mesa "${table.title}"?`,
      variant: 'warning',
    }))) return;

    const response = await authPut(`/api/v1/admin/tables/${table.id}`, { status: newStatus });
    if (!response.ok) {
      toast.error(await extractErrorMessage(response, `Erro ao ${action} mesa.`));
      return;
    }
    toast.success(`Mesa ${action === 'publicar' ? 'publicada' : action === 'ativar' ? 'ativada' : 'cancelada'}.`);
    await fetchAllTables();
  };

  const handleToggleCovil = async (table: AdminTableRow) => {
    const response = await authPut(`/api/v1/admin/tables/${table.id}`, { is_covil: !table.is_covil });
    if (!response.ok) {
      toast.error(await extractErrorMessage(response, 'Erro ao atualizar Covil.'));
      return;
    }
    toast.success(!table.is_covil ? 'Mesa marcada como Covil do Lich.' : 'Marca Covil removida.');
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
      const response = await authGet(`/api/v1/tables/${encodeURIComponent(table.slug)}`);
      if (!response.ok) throw new Error('Erro ao carregar mesa');

      const payload: unknown = await response.json();
      const data = payload && typeof payload === 'object' && 'data' in payload
        ? (payload as { data?: unknown }).data
        : null;

      const tableDetail = normalizeTableDetailPayload(data);
      if (!tableDetail) {
        throw new Error('Mesa inválida');
      }

      if (tableDetail.status !== 'active' || tableDetail.archived_at) {
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
    const response = await authPost('/api/v1/admin/tables/batch', { ids, action });
    if (!response.ok) {
      toast.error(await extractErrorMessage(response, 'Erro na ação em lote.'));
      return;
    }
    const verb = action === 'delete' ? 'apagada(s)' : action === 'archive' ? 'arquivada(s)' : 'desarquivada(s)';
    toast.success(`${ids.length} mesa(s) ${verb}.`);
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
      render: (table: AdminTableRow) => <StatusPill tone={table.status === 'active' ? 'success' : 'neutral'}>{table.status}</StatusPill>,
    },
    {
      key: 'covil',
      header: 'Covil',
      render: (table: AdminTableRow) => table.is_covil ? <StatusPill tone="brand">Covil</StatusPill> : <StatusPill>não</StatusPill>,
    },
  ], []);

  const tabClass = (item: CatalogTab) => tabButtonClass(tab === item);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={['Gestão', 'Catálogo']}
        title="Catálogo"
        description="Sistemas, plataformas, cenários, estilos auxiliares e mesas publicadas."
      />

      <div className="inline-flex flex-wrap rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-1">
        {(Object.keys(TAB_LABEL) as CatalogTab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)} className={tabClass(item)} aria-pressed={tab === item}>
            {TAB_LABEL[item]}
          </button>
        ))}
      </div>

      <SectionCard title={TAB_LABEL[tab]} bodyClassName="p-5">
        {tab === 'systems' && <SystemsAdminView />}

        {tab === 'platforms' && (
          <div className="space-y-4">
            <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-1">
              <button onClick={() => setPlatformKind('vtt')} className={platformKind === 'vtt' ? tabClass('platforms') : 'rounded-md px-3 py-2 text-sm text-[var(--fg-low)] hover:bg-[var(--admin-hover)]'}>
                VTTs
              </button>
              <button onClick={() => setPlatformKind('communication')} className={platformKind === 'communication' ? tabClass('platforms') : 'rounded-md px-3 py-2 text-sm text-[var(--fg-low)] hover:bg-[var(--admin-hover)]'}>
                Comunicação
              </button>
            </div>
            <PlatformsPage key={platformKind} initialKind={platformKind} />
          </div>
        )}

        {tab === 'scenarios' && <ScenariosAdminView />}

        {tab === 'setting-styles' && <SettingSuggestionsPanel />}

        {tab === 'tables' && (
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
                options: [
                  { value: 'draft', label: 'Rascunho (não publicada)' },
                  { value: 'active', label: 'Ativa' },
                  { value: 'full', label: 'Cheia' },
                  { value: 'cancelled', label: 'Cancelada' },
                  { value: 'ended', label: 'Encerrada' },
                ],
                getValue: (table) => table.status,
              },
              {
                key: 'covil',
                label: 'Covil',
                options: [{ value: 'true', label: 'Covil' }, { value: 'false', label: 'Sem selo' }],
                getValue: (table) => String(table.is_covil),
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
              { key: 'status', label: 'Publicar/ativar/cancelar', icon: <Power size={15} />, onRun: handleToggleTableStatus },
              { key: 'covil', label: 'Alternar Covil', icon: <ShieldCheck size={15} />, onRun: handleToggleCovil },
              { key: 'delete', label: 'Apagar', icon: <Trash2 size={15} />, tone: 'danger', onRun: handleDeleteTable },
            ]}
          />
        )}
      </SectionCard>
    </div>
  );
}
