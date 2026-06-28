import { useState, useCallback } from 'react';
import { useConfirm } from '@artificio/ui';
import { SystemsAdminView } from '../../../pages/SystemsAdminView';
import { ScenariosAdminView } from '../../../pages/ScenariosAdminView';
import { PlatformsPage } from '../../../modules/admin/platforms/PlatformsPage';
import { InlineDeleteConfirmation } from '../../../components/InlineDeleteConfirmation';
import { authGet, authPut, authDelete } from '../../../services/apiClient';
import { useAuth } from '../../../contexts/useAuth';
import toast from 'react-hot-toast';

interface AdminTableRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  is_covil?: boolean;
}

type CrudSubTab = 'systems' | 'platforms' | 'scenarios' | 'tables';
type PlatformKind = 'vtt' | 'communication';

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

export function ConteudoSection() {
  const { isAuthenticated } = useAuth();
  const { confirm } = useConfirm();
  const [crudSubTab, setCrudSubTab] = useState<CrudSubTab>('systems');
  const [platformKind, setPlatformKind] = useState<PlatformKind>('vtt');
  const [allTables, setAllTables] = useState<AdminTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmTableId, setDeleteConfirmTableId] = useState<string | null>(null);
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);

  const fetchAllTables = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const response = await authGet('/api/v1/tables');
      if (response.ok) {
        const data = await response.json();
        setAllTables(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('[ConteudoSection] Erro ao buscar mesas:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const handleDeleteTable = async (id: string) => {
    if (!isAuthenticated) return;
    setDeletingTableId(id);
    try {
      const response = await authDelete(`/api/v1/admin/tables/${id}`);
      if (response.ok) {
        toast.success('Mesa deletada!');
        setDeleteConfirmTableId(null);
        fetchAllTables();
      } else {
        toast.error(await extractErrorMessage(response, 'Erro ao deletar mesa'));
      }
    } catch (error) {
      console.error('[ConteudoSection] Erro ao deletar mesa:', error);
      toast.error('Erro ao deletar mesa');
    } finally {
      setDeletingTableId(null);
    }
  };

  const handleToggleTableStatus = async (id: string, currentStatus: string, title: string) => {
    if (!isAuthenticated) return;
    const newStatus = currentStatus === 'active' ? 'cancelled' : 'active';
    const action = newStatus === 'active' ? 'ativar' : 'cancelar';
    if (!(await confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} mesa`,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} a mesa "${title}"?`,
      variant: 'warning',
    }))) return;
    try {
      const response = await authPut(`/api/v1/admin/tables/${id}`, { status: newStatus });
      if (response.ok) {
        toast.success(`Mesa ${action === 'ativar' ? 'ativada' : 'desativada'}!`);
        fetchAllTables();
      } else {
        toast.error(await extractErrorMessage(response, `Erro ao ${action} mesa`));
      }
    } catch (error) {
      console.error('[ConteudoSection] Erro ao alterar status:', error);
      toast.error(`Erro ao ${action} mesa`);
    }
  };

  const filteredTables = allTables.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const subTabClass = (tab: CrudSubTab) =>
    `px-4 py-2 rounded-lg transition-all ${
      crudSubTab === tab
        ? 'bg-blue-600 text-white'
        : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  const platformKindClass = (kind: PlatformKind) =>
    `px-3 py-1.5 rounded-lg text-sm transition-all ${
      platformKind === kind
        ? 'bg-blue-500/30 text-blue-200 border border-blue-500/40'
        : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  return (
    <div>
      {/* Subnav local */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button onClick={() => setCrudSubTab('systems')} className={subTabClass('systems')}>
          Sistemas de RPG
        </button>
        <button onClick={() => setCrudSubTab('platforms')} className={subTabClass('platforms')}>
          Plataformas
        </button>
        <button onClick={() => setCrudSubTab('scenarios')} className={subTabClass('scenarios')}>
          Cenários
        </button>
        <button onClick={() => setCrudSubTab('tables')} className={subTabClass('tables')}>
          Mesas
        </button>
      </div>

      {crudSubTab === 'systems' && <SystemsAdminView />}
      {crudSubTab === 'platforms' && (
        <div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setPlatformKind('vtt')} className={platformKindClass('vtt')}>
              VTTs
            </button>
            <button onClick={() => setPlatformKind('communication')} className={platformKindClass('communication')}>
              Comunicação
            </button>
          </div>
          <PlatformsPage key={platformKind} initialKind={platformKind} />
        </div>
      )}
      {crudSubTab === 'scenarios' && <ScenariosAdminView />}

      {crudSubTab === 'tables' && (
        <div>
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar mesas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (allTables.length === 0) fetchAllTables(); }}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40"
            />
          </div>
          {loading ? (
            <div className="text-white/60 text-center py-8">Carregando...</div>
          ) : (
            <div className="space-y-3">
              {filteredTables.map((table) => (
                <div key={table.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{table.title}</h3>
                      <p className="text-white/60 text-sm mt-1">
                        Status: {table.status} | Criada em: {new Date(table.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      <label className="flex items-center gap-2 mt-2 text-sm text-white/80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={table.is_covil || false}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            try {
                              const res = await authPut(`/api/v1/admin/tables/${table.id}`, { is_covil: newValue });
                              if (!res.ok) throw new Error('Erro ao atualizar');
                              toast.success(newValue ? 'Mesa marcada como Covil do Lich' : 'Marca Covil removida');
                              fetchAllTables();
                            } catch (error) {
                              toast.error('Erro ao atualizar mesa');
                              console.error(error);
                            }
                          }}
                          className="w-4 h-4"
                        />
                        🏰 Covil do Lich
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleTableStatus(table.id, table.status, table.title)}
                        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors text-white text-sm"
                      >
                        {table.status === 'active' ? 'Cancelar' : 'Ativar'}
                      </button>
                      <InlineDeleteConfirmation
                        title={table.title}
                        isOpen={deleteConfirmTableId === table.id}
                        onOpen={() => setDeleteConfirmTableId(table.id)}
                        onCancel={() => setDeleteConfirmTableId(null)}
                        onConfirm={() => handleDeleteTable(table.id)}
                        isProcessing={deletingTableId === table.id}
                        triggerLabel=""
                        className="min-w-10"
                        compact
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
