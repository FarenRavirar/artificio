import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlusCircle, MapPin, Sparkles, PencilLine, Lightbulb } from 'lucide-react';
import { useAuth } from '../contexts/useAuth';
import { useConfirm, Badge, Button, Panel, toFiniteNumber } from '@artificio/ui';
import toast from 'react-hot-toast';
import { authGet, authPut, authPatch, authDelete } from '../services/apiClient';
import type { TableContact, TableContactChannel } from '../types/tables';
import { TableCardDashboard } from '../components/TableCardDashboard';
import { InlineDeleteConfirmation } from '../components/InlineDeleteConfirmation';
import { LinksManager } from '../components/LinksManager';
import { HelpCenter } from '../components/HelpCenter';
import { VttPlatformsEditor } from '../components/mestre/VttPlatformsEditor';
import { ContactMethodsEditor } from '../components/mestre/ContactMethodsEditor';
import { GmInsightsDashboard } from '../components/mestre/GmInsightsDashboard';
// Spec 099 B10 (D5/D8): prévia do perfil público com os dados REAIS do painel.
import { MestreProfilePreview } from '../components/mestre/editor/MestreProfilePreview';
import type { CropRect } from '@artificio/media/image-kinds';
import { buildMestrePreviewData } from '../components/mestre/editor/profilePreviewMapping';
import {
  mapApiToEditorState,
  toProfileContactMethods,
} from '../features/table-editor/utils/editorMapping';
// T4.0r/regra do repo: o fluxo do perfil de mestre usa authenticatedFetch,
// não apiClient (duplicação pré-existente; decisão registrada com o mantenedor).
import { authPut as authenticatedPut } from '../utils/authenticatedFetch';
// Editor de anúncio (spec 096, Fase 4): substitui o wizard CreateTableForm.
import { TableEditor } from '../features/table-editor/TableEditor';
import type { TableEditorInitialData } from '../features/table-editor/hooks/useTableEditor';

type TableStatus = 'draft' | 'active' | 'full' | 'cancelled' | 'ended' | 'pending_review';

interface GmProfile {
  id: string;
  slug: string;
  nickname: string | null;
  bio_long: string | null;
  avatar_url: string | null;
  // Foto do perfil geral, devolvida por `GET /gm/me` so quando `avatar_url`
  // acima e null — deixa a previa espelhar o COALESCE da rota publica sem
  // esta tela buscar `/profile/me` (achado Codex P2, PR #300).
  general_avatar?: {
    avatar_url: string | null;
    avatar_crop_data: CropRect | null;
    avatar_width: number | null;
    avatar_height: number | null;
  } | null;
  banner_url: string | null;
  tagline: string | null;
  promo_badge_text: string | null;
  selling_points: Array<{
    icon: string;
    title: string;
    description: string;
    highlight?: string | null;
  }> | null;
  closed_group_enabled: boolean | null;
  closed_group_systems: string[] | null;
  closed_group_description: string | null;
  closed_group_min_price_cents: number | null;
  languages: string[];
  specialties: string[];
  tables_count: number;
  avg_rating: number | null;
  preferred_vtt_platforms?: string[];
  // T4.0r: o perfil aceita os MESMOS 7 canais da mesa (TableContactChannel);
  // o GET /gm/me devolve label/discord_server_url ausentes/null quando vazios.
  contact_methods?: Array<{
    channel: TableContactChannel;
    value: string;
    label?: string | null;
    discord_server_url?: string | null;
  }>;
}

interface MyTable {
  id: string;
  slug: string;
  title: string;
  status: TableStatus;
  modality: string;
  slots_total: number;
  slots_filled: number;
  system_name: string | null;
  publisher_role: 'gm' | 'announcer';
  actual_gm_name: string | null;
  contacts: TableContact[];
  is_ddal?: boolean;
  is_covil?: boolean;
  ddal_code?: string | null;
  ddal_name?: string | null;
  ddal_tier?: number | null;
  created_at: string;
  archived_at?: string | null; // D-MESAS1
}

// Tipos para dashboard de métricas
interface TableMetrics {
  views: number;
  clicks: number;
  contacts: number;
  favorites: number;
}

interface MyTableEnhanced extends MyTable {
  image_url?: string | null;
  metrics?: TableMetrics;
  archived?: boolean; // D-MESAS1
}

interface MyTableApi extends MyTable {
  image_url?: string | null;
  metrics_views?: number | null;
  metrics_clicks?: number | null;
  metrics_contacts?: number | null;
  metrics_favorites?: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getPayloadData(payload: unknown): unknown {
  return isRecord(payload) && 'data' in payload ? payload.data : null;
}

function isGmProfile(value: unknown): value is GmProfile {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    Array.isArray(value.languages) &&
    Array.isArray(value.specialties)
  );
}

/**
 * Normaliza o payload externo antes de entrar no estado. `isGmProfile` afirma
 * `avg_rating: number | null` mas não valida esse campo, e a coluna é
 * NUMERIC(3,2) — o parser default do `pg` entrega string. Hoje `GET /gm/me`
 * devolve `avg_rating: null` fixo (gmPanel.ts), então nada quebra; sem esta
 * normalização, porém, passar a expor o valor real reintroduz o
 * `TypeError: toFixed is not a function` que derrubou o catálogo em produção.
 */
function normalizeGmProfile(value: unknown): GmProfile | null {
  if (!isGmProfile(value)) return null;
  return { ...value, avg_rating: toFiniteNumber(value.avg_rating) };
}

function isMyTableApi(value: unknown): value is MyTableApi {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.contacts)
  );
}

function toEnhancedTable(table: MyTableApi): MyTableEnhanced {
  return {
    ...table,
    image_url: table.image_url ?? null,
    archived: !!table.archived_at,
    metrics: {
      views: table.metrics_views ?? 0,
      clicks: table.metrics_clicks ?? 0,
      contacts: table.metrics_contacts ?? 0,
      favorites: table.metrics_favorites ?? 0,
    },
  };
}

/**
 * Card de mesa em rascunho (spec 096, R10/T4.7): selo "Rascunho" + CTA de
 * continuar edição. Rascunho não aparece no catálogo e não tem
 * ativar/arquivar/copiar — só continuar ou deletar.
 */
function DraftTableCard({
  table,
  onContinue,
  onDelete,
  isDeleting,
}: Readonly<{
  table: MyTableEnhanced;
  onContinue: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}>) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  return (
    <Panel tone="subtle" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="warning">Rascunho</Badge>
        <span className="text-[length:var(--text-label)] leading-[var(--leading-label)] opacity-60">
          {table.modality} · {table.system_name ?? 'Sistema livre'}
        </span>
      </div>
      <p className="font-[var(--weight-strong)] line-clamp-2">{table.title}</p>
      <p className="text-[length:var(--text-label)] leading-[var(--leading-label)] opacity-60">
        Não publicado — não aparece no catálogo. O rascunho segue você entre
        dispositivos, sem prazo.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onContinue} className="flex-1">
          Continuar edição
        </Button>
        <InlineDeleteConfirmation
          title={table.title}
          isOpen={isDeleteConfirmOpen}
          onOpen={() => setIsDeleteConfirmOpen(true)}
          onCancel={() => setIsDeleteConfirmOpen(false)}
          onConfirm={onDelete}
          isProcessing={isDeleting}
          className="flex-1"
          compact
          triggerLabel="Excluir rascunho"
        />
      </div>
    </Panel>
  );
}

// T4.0p2 (spec 096, R12): o formulário CreateGmProfileForm foi REMOVIDO —
// o perfil de mestre nasce DENTRO do editor, junto com a mesa, no primeiro
// publish (useTableEditor.ts, createGmProfileOnFirstPublish). O painel deixa
// de ser pré-requisito: sem perfil, o mestre publica direto e o perfil é
// criado com nickname/bio/contatos preenchidos na parte "Mestre e contato".

export const PainelMestrePage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // T3.4b (spec 096): diálogo do design system no lugar do confirm() nativo
  // do navegador (inacessível e fora do tema). ConfirmProvider já monta no
  // App.tsx:159 cobrindo esta página — o hook só consome o contexto.
  const { confirm } = useConfirm();

  const [gmProfile, setGmProfile] = useState<GmProfile | null>(null);
  const [myTables, setMyTables] = useState<MyTableEnhanced[]>([]);
  const [view, setView] = useState<'dashboard' | 'create-table' | 'help'>('dashboard');
  const [loadingProfile, setLoadingProfile] = useState(true);
  // Dado da mesa para o editor (criar e editar são a MESMA tela — spec 096;
  // null = criação). O parser "colar anúncio" mora dentro do editor agora,
  // então a página não guarda mais estado de escolha/colagem.
  const [editingTableData, setEditingTableData] = useState<TableEditorInitialData | null>(null);
  const [togglingTableId, setTogglingTableId] = useState<string | null>(null); // CORREÇÃO B3
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null); // CORREÇÃO B4
  const [archivingTableId, setArchivingTableId] = useState<string | null>(null); // D-MESAS1

  useEffect(() => {
    if (!user || !isAuthenticated) {
      navigate('/');
      return;
    }

    const loadPanelData = async () => {
      setLoadingProfile(true);

      try {
        const profileRes = await authGet('/api/v1/gm/me');

        // T4.0p2: SEM perfil não é mais pré-requisito — o painel segue para o
        // dashboard e o perfil nasce dentro do editor, no primeiro publish
        // (useTableEditor.ts). Sem perfil não há mesas para listar (gm_id vem
        // do perfil), então o grid começa vazio.
        if (!profileRes.ok) {
          setGmProfile(null);
          setMyTables([]);
          return;
        }

        const profileJson: unknown = await profileRes.json();
        const profile = normalizeGmProfile(getPayloadData(profileJson));

        if (!profile) {
          setGmProfile(null);
          setMyTables([]);
          return;
        }

        setGmProfile(profile);

        const tablesRes = await authGet('/api/v1/gm/tables');

        if (tablesRes.ok) {
        const tablesJson: unknown = await tablesRes.json();
        const tablesData = getPayloadData(tablesJson);
        const tables = Array.isArray(tablesData) ? tablesData.filter(isMyTableApi) : [];

        // Mapear para MyTableEnhanced com métricas
          const enhancedTables: MyTableEnhanced[] = tables.map(toEnhancedTable);

          setMyTables(enhancedTables);
        } else {
          setMyTables([]);
        }

        // Não forçar dashboard se há parâmetro edit ou action=nova-mesa na URL
        const urlParams = searchParams;
        if (!urlParams.has('edit') && urlParams.get('action') !== 'nova-mesa') {
          setView('dashboard');
        } else if (urlParams.get('action') === 'nova-mesa') {
          setView('create-table');
        }
      } catch {
        setGmProfile(null);
        setMyTables([]);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadPanelData();
  }, [navigate, isAuthenticated, user, searchParams]);

  const editIdFromUrl = searchParams.get('edit');

  useEffect(() => {
    if (!editIdFromUrl || !isAuthenticated) {
      // setState deferido p/ fora do corpo síncrono do effect.
      void (async () => {
        await Promise.resolve();
        setEditingTableData(null);
      })();
      return;
    };
    let active = true;
    // setState deferido p/ fora do corpo síncrono do effect.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      try {
        const response = await authGet(`/api/v1/gm/tables/${editIdFromUrl}`);
        if (!active) return;
        if (response.ok) {
          const data: unknown = await response.json();
          if (!active) return;
          // Editor novo (spec 096): o mapper do editor substitui o do wizard
          // antigo (is_covil/schedules corretos — T3.1 — e estado do editor).
          setEditingTableData(mapApiToEditorState(getPayloadData(data)));
          setView('create-table');
        } else {
          toast.error('Mesa não encontrada');
        }
      } catch (error) {
        // AbortError é ruído esperado do dedup de apiClient.ts (cancela GET
        // duplicada em StrictMode/re-render rápido) — a chamada sobrevivente
        // resolve normal, não é falha real. Achado do mantenedor 2026-07-08.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('[PainelMestrePage] Erro ao carregar mesa para edição:', error);
        toast.error('Erro ao carregar mesa');
      }
    })();
    return () => { active = false; };
  }, [isAuthenticated, editIdFromUrl]);

  const refreshData = () => {
    if (!isAuthenticated) {
      console.warn('[PainelMestrePage] refreshData chamado sem autenticação');
      return;
    }

    setEditingTableData(null);
    // navigate (e não window.history.replaceState) porque `editIdFromUrl` vem
    // de useSearchParams: mexer no history nativo tira o `?edit=` da barra sem
    // avisar o router, então o param seguia "presente" para o efeito e reabrir
    // o MESMO rascunho depois não disparava recarga (o valor nunca mudava).
    navigate('/painel', { replace: true });

    setView('dashboard');
    setLoadingProfile(true);

    Promise.all([
      authGet('/api/v1/gm/me'),
      authGet('/api/v1/gm/tables'),
    ])
      .then(async ([profileRes, tablesRes]) => {
        if (profileRes.ok) {
          const profileJson: unknown = await profileRes.json();
          setGmProfile(normalizeGmProfile(getPayloadData(profileJson)));
        }


        if (tablesRes.ok) {
          const tablesJson: unknown = await tablesRes.json();
          const tablesData = getPayloadData(tablesJson);
          const tables = Array.isArray(tablesData) ? tablesData.filter(isMyTableApi) : [];

          // Mapear para MyTableEnhanced com métricas
          const enhancedTables: MyTableEnhanced[] = tables.map(toEnhancedTable);

          setMyTables(enhancedTables);
        }
      })
      .catch(() => { })
      .finally(() => setLoadingProfile(false));
  };

  // KPIs antigos removidos - agora usando métricas de engajamento


  const handleToggleTableStatus = async (tableId: string, currentStatus: string, title: string) => {
    if (!isAuthenticated) return;
    const newStatus = currentStatus === 'active' ? 'cancelled' : 'active';
    const action = newStatus === 'active' ? 'ativar' : 'desativar';
    // Texto preservado do confirm() nativo ("Ativar mesa "T"?") — agora no
    // dialog do design system (T3.4b, spec 096). Variante warning = ação de
    // mesa reversível, mesmo padrão do AdminTablesPanel.
    const actionLabel = `${action.charAt(0).toUpperCase() + action.slice(1)} mesa`;
    if (!(await confirm({
      title: actionLabel,
      message: `${actionLabel} "${title}"?`,
      variant: 'warning',
    }))) return;

    setTogglingTableId(tableId);
    try {
      // CORREÇÃO BUG 2 (REQ-30): Usar PATCH /tables/:id/status em vez de PUT /tables/:id
      // PUT exige todos os campos obrigatórios, PATCH /status só altera o status
      // Backend aceita: 'active', 'full', 'cancelled', 'ended'
      const response = await authPatch(`/api/v1/gm/tables/${tableId}/status`, { status: newStatus });

      if (response.ok) {
        toast.success(`Mesa ${action === 'ativar' ? 'ativada' : 'desativada'}!`);
        refreshData();
      } else {
        // CORREÇÃO: Tratamento robusto de erro (pode retornar HTML em vez de JSON)
        let errorMessage = `Erro ao ${action} mesa`;
        
        try {
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('application/json')) {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.slice(0, 200) || errorMessage;
          }
        } catch {
          // Se falhar ao parsear, usar mensagem padrão
        }
        
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('[PainelMestrePage] Erro ao alterar status da mesa:', error);
      toast.error(`Erro ao ${action} mesa`);
    } finally {
      setTogglingTableId(null);
    }
  };

  // D-MESAS1: arquivar/desarquivar (tira do catálogo público, reversível)
  const handleArchiveTable = async (tableId: string, archived: boolean, title: string) => {
    if (!isAuthenticated) return;
    const verb = archived ? 'arquivar' : 'desarquivar';
    // Texto preservado do confirm() nativo ("Arquivar mesa "T"?") — agora no
    // dialog do design system (T3.4b, spec 096).
    const verbLabel = `${verb.charAt(0).toUpperCase() + verb.slice(1)} mesa`;
    if (!(await confirm({
      title: verbLabel,
      message: `${verbLabel} "${title}"?`,
      variant: 'warning',
    }))) return;

    setArchivingTableId(tableId);
    try {
      const response = await authPatch(`/api/v1/gm/tables/${tableId}/archive`, { archived });

      if (response.ok) {
        toast.success(`Mesa ${archived ? 'arquivada' : 'desarquivada'}!`);
        refreshData();
      } else {
        const data = await response.json().catch(() => null);
        toast.error(data?.error || `Erro ao ${verb} mesa`);
      }
    } catch (error) {
      console.error('[PainelMestrePage] Erro ao arquivar mesa:', error);
      toast.error(`Erro ao ${verb} mesa`);
    } finally {
      setArchivingTableId(null);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!isAuthenticated) return;

    setDeletingTableId(tableId);
    try {
      const endpoint = user?.role === 'admin'
        ? `/api/v1/admin/tables/${tableId}`
        : `/api/v1/gm/tables/${tableId}`;

      const response = await authDelete(endpoint);

      if (response.ok) {
        toast.success('Mesa deletada!');
        refreshData();
      } else {
        // CORREÇÃO: Tratamento robusto de erro (pode retornar HTML em vez de JSON)
        let errorMessage = 'Erro ao deletar mesa';
        
        try {
          const contentType = response.headers.get('content-type');
          
          if (contentType?.includes('application/json')) {
            const data = await response.json();
            errorMessage = data.error || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = text.slice(0, 200) || errorMessage;
          }
        } catch {
          // Se falhar ao parsear, usar mensagem padrão
        }
        
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('[PainelMestrePage] Erro ao deletar mesa:', error);
      toast.error('Erro ao deletar mesa');
    } finally {
      setDeletingTableId(null);
    }
  };

  if (!user) return null;

  // R10/T4.7: o painel distingue rascunho de mesa no ar. O catálogo público
  // já filtra status='active' (6 pontos medidos) — o painel é o que muda.
  const draftTables = myTables.filter((table) => table.status === 'draft');
  const publishedTables = myTables.filter((table) => table.status !== 'draft');

  // Editor de anúncio (spec 096): criar e editar são a MESMA tela. Renderizado
  // fora do container com padding — o editor é uma casca `position: fixed;
  // height: 100dvh` (zero rolagem, A1) e o container da página atrapalharia.
  if (view === 'create-table') {
    const handleEditorBack = () => {
      // Sair da edição precisa desfazer o que a abriu: o estado E o `?edit=`
      // da URL. O efeito que carrega o painel depende de `searchParams` e
      // reabre a edição enquanto o parâmetro estiver lá (achado PR #275).
      setEditingTableData(null);
      // Mesma razão do refreshData: sair da edição precisa limpar o `?edit=`
      // PELO router, senão o efeito continua vendo o id antigo em searchParams.
      navigate('/painel', { replace: true });
      setView('dashboard');
    };

    return (
      <TableEditor
        initialData={editingTableData ?? undefined}
        onPublished={refreshData}
        onBack={handleEditorBack}
      />
    );
  }

  return (
    <main className="w-full">
      <div className="container mx-auto px-6 py-10">
        {loadingProfile ? (
          <div className="flex justify-center py-20 animate-pulse text-[var(--fg-ghost)]">Carregando painel...</div>
        ) : view === 'help' ? (
          <div className="space-y-6">
            <button
              onClick={() => setView('dashboard')}
              className="text-[var(--fg-ghost)] hover:text-[var(--fg)] transition-colors cursor-pointer text-[length:var(--text-support)] leading-[var(--leading-support)]"
            >
              ← Voltar ao painel
            </button>
            <HelpCenter />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-[length:var(--text-display)] leading-[var(--leading-display)] font-[var(--weight-strong)]">
                  {gmProfile ? `Olá, ${gmProfile.nickname ?? `@${gmProfile.slug}`}` : 'Painel do Mestre'}
                </h1>
                {gmProfile && (
                  <p className="text-[var(--fg-ghost)] mt-1 text-[length:var(--text-support)] leading-[var(--leading-support)]">
                    {gmProfile.tables_count} mesa{gmProfile.tables_count !== 1 ? 's' : ''} publicada{gmProfile.tables_count !== 1 ? 's' : ''}
                    {/* avg_rating já chega normalizado por normalizeGmProfile.
                        Condição truthy (não `!== null`): rating 0 significa "sem
                        nota", e não deve renderizar "★ 0.0". */}
                    {gmProfile.avg_rating ? ` · ★ ${gmProfile.avg_rating.toFixed(1)}` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="btn-ajuda"
                  onClick={() => setView('help')}
                  className="flex items-center gap-2 px-4 py-3 border border-[var(--border-strong)] hover:border-[var(--border-strong)] text-[var(--fg)] font-[var(--weight-strong)] rounded-[var(--radius-lg)] transition-colors cursor-pointer"
                  title="Central de Ajuda"
                >
                  <span className="text-[length:var(--text-section)] leading-[var(--leading-section)]">❓</span>
                  Ajuda
                </button>
                {/* T4.0k (spec 096): entrada da tela "minhas sugestões"
                    (/perfil/minhas-sugestoes). Fora do `gmProfile &&` — sugerir
                    sistema/cenário não depende de perfil de mestre criado. */}
                <button
                  id="btn-minhas-sugestoes"
                  onClick={() => navigate('/perfil/minhas-sugestoes')}
                  className="flex items-center gap-2 px-4 py-3 border border-[var(--border-strong)] hover:border-[var(--border-strong)] text-[var(--fg)] font-[var(--weight-strong)] rounded-[var(--radius-lg)] transition-colors cursor-pointer"
                  title="Minhas sugestões"
                >
                  <Lightbulb className="w-4 h-4" />
                  Minhas sugestões
                </button>
                {gmProfile && (
                  <button
                    id="btn-editar-perfil-mestre"
                    onClick={() => navigate('/perfil?tab=mestre')}
                    className="flex items-center gap-2 px-4 py-3 border border-[var(--border-strong)] hover:border-[var(--border-strong)] text-[var(--fg)] font-[var(--weight-strong)] rounded-[var(--radius-lg)] transition-colors cursor-pointer"
                  >
                    <PencilLine className="w-4 h-4" />
                    Editar perfil
                  </button>
                )}
                <button
                  id="btn-nova-mesa"
                  onClick={() => {
                    setEditingTableData(null);
                    setView('create-table');
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] text-[var(--fg)] font-[var(--weight-strong)] rounded-[var(--radius-lg)] transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-5 h-5" />
                  Nova Mesa
                </button>
              </div>
            </div>

            {/* DASHBOARD DE INSIGHTS COMPLETO */}
            {gmProfile && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-[length:var(--text-title)] leading-[var(--leading-title)] font-[var(--weight-strong)] text-[var(--fg)]">📊 Insights das suas Mesas</h2>
                  <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-faint)] mt-1">
                    Acompanhe o desempenho e receba recomendações para otimizar suas mesas
                  </p>
                </div>
                <GmInsightsDashboard />
              </section>
            )}

            {/* Contact Methods Editor - PRIORIDADE: Contato é o principal.
                T4.0r: o MESMO editor de contatos do editor de mesa (7 canais,
                ícone por canal, setas ↑↓, menu de adicionar) — "se o painel do
                mestre não tem, tem que adicionar também". Salva no perfil via
                PUT /gm/profile com authenticatedFetch (regra do repo). */}
            {gmProfile && (
              <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fill-5)] p-5">
                <div className="mb-4">
                  <h2 className="text-[length:var(--text-section)] leading-[var(--leading-section)] font-[var(--weight-strong)] text-[var(--fg)]">Formas de Contato</h2>
                  <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] text-[var(--fg-low)] mt-1">
                    Configure como os jogadores podem entrar em contato com você.
                  </p>
                </div>
                <ContactMethodsEditor
                  contacts={gmProfile.contact_methods || []}
                  idPrefix="painel-mestre"
                  onSave={async (contacts) => {
                    const res = await authenticatedPut('/api/v1/gm/profile', {
                      contact_methods: toProfileContactMethods(contacts),
                    });
                    if (!res.ok) {
                      const body: unknown = await res.json().catch(() => null);
                      const apiError = isRecord(body) && typeof body.error === 'string'
                        ? body.error
                        : 'Erro ao salvar contatos';
                      throw new Error(apiError);
                    }
                    toast.success('Contatos atualizados!');
                    refreshData();
                  }}
                />
              </section>
            )}

            {/* VTT Platforms Editor */}
            {gmProfile && (
              <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fill-5)] p-5">
                <VttPlatformsEditor
                  selectedPlatforms={gmProfile.preferred_vtt_platforms || []}
                  onSave={async (platformIds) => {
                    const res = await authPut('/api/v1/gm/profile', { preferred_vtt_platforms: platformIds });
                    if (!res.ok) throw new Error('Erro ao salvar plataformas');
                    toast.success('Plataformas atualizadas!');
                    refreshData();
                  }}
                />
              </section>
            )}

            {/* Links - Após contatos */}
            {gmProfile && (
              <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fill-5)] p-5">
                <LinksManager />
              </section>
            )}

            {/* Spec 099 B10 (D5/D8): prévia do perfil público ao fim do bloco de
                edição do perfil (contatos → VTT → links). O painel não usa
                ProfileContext — o MESMO mapeamento do editor alimenta a MESMA
                prévia; display_name cai para `user.name` quando o nickname
                está vazio (COALESCE do GET público). Véu do banner = scrim fixo
                do MestreHero real (D8), sem controle de opacidade. */}
            {gmProfile && (
              <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fill-5)] p-5">
                <MestreProfilePreview
                  profile={buildMestrePreviewData(gmProfile, user?.name, gmProfile.general_avatar)}
                />
              </section>
            )}

            {myTables.length > 0 ? (
              <>
                {/* Rascunhos (spec 096, R10/T4.7): mesa não publicada fica no
                    painel, distinguida da que está no ar, com CTA de
                    continuar edição. */}
                {draftTables.length > 0 && (
                  <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fill-5)] p-5 space-y-4">
                    <h2 className="text-[length:var(--text-section)] leading-[var(--leading-section)] font-[var(--weight-strong)] inline-flex items-center gap-2">
                      <PencilLine className="w-4 h-4 text-[var(--color-artificio-orange)]" />
                      Rascunhos
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {draftTables.map((table) => (
                        <DraftTableCard
                          key={table.id}
                          table={table}
                          onContinue={() => navigate(`/painel?edit=${table.id}`)}
                          onDelete={() => handleDeleteTable(table.id)}
                          isDeleting={deletingTableId === table.id}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Só com mesa NO AR: mestre que tem apenas rascunho via a
                    seção "Suas mesas" vazia logo abaixo dos rascunhos, como se
                    tivesse perdido as mesas. */}
                {publishedTables.length > 0 && (
                <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--fill-5)] p-5 space-y-4">
                  <h2 className="text-[length:var(--text-section)] leading-[var(--leading-section)] font-[var(--weight-strong)] inline-flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--color-artificio-orange)]" />
                    Suas mesas
                  </h2>

                  {/* GRID DE CARDS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {publishedTables.map((table) => (
                      <TableCardDashboard
                        key={table.id}
                        table={table}
                        onEdit={(id: string) => navigate(`/painel?edit=${id}`)}
                        onToggle={(table) => handleToggleTableStatus(table.id, table.status, table.title)}
                        onDelete={(table) => handleDeleteTable(table.id)}
                        onArchive={(table) => handleArchiveTable(table.id, !table.archived, table.title)}
                        isToggling={togglingTableId === table.id}
                        isDeleting={deletingTableId === table.id}
                        isArchiving={archivingTableId === table.id}
                      />
                    ))}
                  </div>
                </section>
                )}
              </>
            ) : (
              <div className="text-center py-20 text-[var(--fg-ghost)] border border-dashed border-[var(--border)] rounded-[var(--radius-lg)]">
                <MapPin className="w-10 h-10 mx-auto mb-4 opacity-30" />
                <p className="text-[length:var(--text-section)] leading-[var(--leading-section)] font-[var(--weight-medium)]">Nenhuma mesa ainda.</p>
                <p className="text-[length:var(--text-support)] leading-[var(--leading-support)] mt-2">Clique em "Nova Mesa" para começar.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
};
