import { AlertTriangle, CheckCircle2, Clock3, Database, FileClock, LayoutDashboard } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ActivityPanel } from '../activity/components/ActivityPanel';
import { useAdminDashboardMetrics } from '../hooks/useAdminDashboardMetrics';
import { useAdminPendencias } from '../hooks/useAdminPendencias';
import { MetricCard, SectionCard, StatusPill } from './ui';

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return 'Sem importações';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export function DashboardSection() {
  const { data: metrics, isLoading: loadingMetrics, isError: metricsError } = useAdminDashboardMetrics();
  const { data: pendencias, isLoading: loadingPendencias, isError: pendenciasError } = useAdminPendencias();

  const latestRun = metrics?.latestImportRun ?? null;
  const pendingDrafts = metrics?.draftTotals.needsReview ?? 0;
  const readyDrafts = metrics?.draftTotals.ready ?? 0;
  const totalPendencias = pendencias?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Mesas ativas"
          value={metrics?.activeTables ?? 0}
          hint={metricsError ? 'Falha ao carregar catálogo' : 'Catálogo público'}
          icon={<LayoutDashboard size={18} />}
          to="/gestao/catalogo"
          loading={loadingMetrics}
        />
        <MetricCard
          label="Rascunhos em revisão"
          value={pendingDrafts}
          hint={`${readyDrafts} pronto(s) para publicar`}
          icon={<FileClock size={18} />}
          to="/gestao/mesas/rascunhos"
          tone={pendingDrafts > 0 ? 'warn' : 'neutral'}
          loading={loadingMetrics}
        />
        <MetricCard
          label="Pendências"
          value={totalPendencias}
          hint={pendenciasError ? 'Falha ao consultar pendências' : 'Sugestões + fila de rascunhos'}
          icon={<AlertTriangle size={18} />}
          to="/gestao/comunidade"
          tone={totalPendencias > 0 ? 'warn' : 'neutral'}
          loading={loadingPendencias}
        />
        <MetricCard
          label="Última importação"
          value={latestRun ? latestRun.drafts_created + latestRun.drafts_updated : 0}
          hint={formatDateTime(latestRun?.started_at)}
          icon={<Database size={18} />}
          to="/gestao/importacao"
          tone={latestRun && latestRun.messages_failed > 0 ? 'danger' : 'brand'}
          loading={loadingMetrics}
        />
      </div>

      <SectionCard
        title="Pendências operacionais"
        description="Fila curta do que precisa de decisão humana."
        bodyClassName="space-y-3"
      >
        {loadingPendencias ? (
          <p className="text-sm text-[var(--fg-faint)]">Carregando pendências...</p>
        ) : totalPendencias === 0 ? (
          <div className="flex items-center gap-2 text-sm text-[var(--fg-low)]">
            <CheckCircle2 size={16} className="text-[var(--success)]" />
            Nada pendente agora.
          </div>
        ) : (
          <>
            {(pendencias?.sugestoes ?? 0) > 0 && (
              <NavLink
                to="/gestao/comunidade"
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--admin-hover)] px-3 py-2 transition-colors hover:border-[var(--border-strong)]"
              >
                <span className="text-sm text-[var(--fg)]">Sugestões de catálogo aguardando revisão</span>
                <StatusPill tone="warn">{pendencias?.sugestoes}</StatusPill>
              </NavLink>
            )}
            {pendencias?.hasDraftsToReview && (
              <NavLink
                to="/gestao/mesas/rascunhos"
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--admin-hover)] px-3 py-2 transition-colors hover:border-[var(--border-strong)]"
              >
                <span className="text-sm text-[var(--fg)]">Rascunhos de mesa aguardando revisão</span>
                <StatusPill tone="warn">1+</StatusPill>
              </NavLink>
            )}
          </>
        )}
      </SectionCard>

      {latestRun && (
        <SectionCard title="Última rodada de importação" bodyClassName="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-[var(--fg-faint)]">Origem</p>
            <p className="mt-1 text-sm font-medium text-[var(--fg)]">{latestRun.source_kind}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--fg-faint)]">Mensagens</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-[var(--fg)]">{latestRun.total_messages}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--fg-faint)]">Criados/atualizados</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-[var(--fg)]">
              {latestRun.drafts_created}/{latestRun.drafts_updated}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--fg-faint)]">Falhas</p>
            <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium tabular-nums text-[var(--fg)]">
              {latestRun.messages_failed}
              {latestRun.messages_failed > 0 && <StatusPill tone="danger">verificar</StatusPill>}
            </p>
          </div>
        </SectionCard>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--admin-surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center gap-2 text-sm text-[var(--fg-low)]">
          <Clock3 size={16} className="text-[var(--color-artificio-orange)]" />
          Feed único da gestão
        </div>
        <ActivityPanel />
      </div>
    </div>
  );
}
