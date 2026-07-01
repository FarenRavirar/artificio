import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { DiscordImportRun, DiscordIntegrationMetrics } from '../types';
import { discordSyncApi } from '../api/discordSyncApi';

const SOURCE_KIND_LABELS: Record<string, string> = {
  discord_bot: 'Discord (bot)',
  discord_chat_exporter_json: 'Importação JSON',
};

function sourceKindLabel(kind: string): string {
  return SOURCE_KIND_LABELS[kind] ?? kind;
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'em andamento';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms) || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}min ${seconds % 60}s`;
}

function RunRow({ run }: { readonly run: DiscordImportRun }) {
  const failed = run.messages_failed > 0;
  return (
    <div
      className="rounded-lg border px-4 py-3"
      style={{ backgroundColor: 'var(--admin-surface, #16223E)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-700/30 text-blue-300">
            {sourceKindLabel(run.source_kind)}
          </span>
          {!run.ended_at && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-700/40 text-yellow-300">Em andamento</span>
          )}
          {failed && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-700/40 text-red-300">
              {run.messages_failed} falha(s)
            </span>
          )}
        </div>
        <span className="text-white/40 text-xs tabular-nums">{formatDateTime(run.started_at)}</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/60 tabular-nums">
        <span>Mensagens: <strong className="text-white/80">{run.total_messages}</strong></span>
        <span>Drafts criados: <strong className="text-white/80">{run.drafts_created}</strong></span>
        <span>Drafts atualizados: <strong className="text-white/80">{run.drafts_updated}</strong></span>
        <span>Ignoradas: <strong className="text-white/80">{run.messages_ignored}</strong></span>
        <span>Duração: <strong className="text-white/80">{formatDuration(run.started_at, run.ended_at)}</strong></span>
      </div>

      {run.note && <p className="mt-2 text-xs text-white/50">{run.note}</p>}
    </div>
  );
}

/**
 * IntegrationLogsView — Logs de integração (entidade discord_import_runs).
 * Read-only: timeline das rodadas de importação Discord/JSON + resumo agregado.
 * Fonte: GET /api/v1/admin/discord/metrics.
 */
type SortKey = 'recent' | 'oldest' | 'failures';

export function IntegrationLogsView() {
  const [metrics, setMetrics] = useState<DiscordIntegrationMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await discordSyncApi.getIntegrationMetrics();
      setMetrics(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar logs de integração.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  const allRuns = Array.isArray(metrics?.runs) ? metrics.runs : [];
  const totals = metrics?.totals;

  const kindOptions = Array.from(new Set(allRuns.map((run) => run.source_kind)));

  const runs = allRuns
    .filter((run) => kindFilter === 'all' || run.source_kind === kindFilter)
    .slice()
    .sort((a, b) => {
      if (sortKey === 'failures') return b.messages_failed - a.messages_failed;
      const at = new Date(a.started_at).getTime();
      const bt = new Date(b.started_at).getTime();
      return sortKey === 'oldest' ? at - bt : bt - at;
    });

  let runsContent;
  if (loading) {
    runsContent = <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>;
  } else if (runs.length === 0) {
    runsContent = <p className="text-white/40 text-sm py-4 text-center">Nenhuma rodada de importação corresponde ao filtro.</p>;
  } else {
    runsContent = (
      <div className="space-y-2">
        {runs.map(run => <RunRow key={run.id} run={run} />)}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-white/80 text-sm font-medium">Rodadas de importação (últimas 20)</h2>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Carregando...' : 'Recarregar'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <select
            aria-label="Filtrar por origem"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            className="app-select rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-2 py-1.5 text-sm text-[var(--fg)]"
          >
            <option value="all">Todas as origens</option>
            {kindOptions.map((kind) => <option key={kind} value={kind}>{sourceKindLabel(kind)}</option>)}
          </select>
          <select
            aria-label="Ordenar"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="app-select rounded-lg border border-[var(--border)] bg-[var(--surface-input)] px-2 py-1.5 text-sm text-[var(--fg)]"
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
            <option value="failures">Mais falhas</option>
          </select>
        </div>
      </div>

      {totals && (
        <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/60 tabular-nums">
          <span>Drafts totais: <strong className="text-white/80">{totals.drafts}</strong></span>
          <span>Sincronizados: <strong className="text-green-300">{totals.synced}</strong></span>
          <span>A revisar: <strong className="text-orange-300">{totals.needs_review}</strong></span>
          <span>Rejeitados: <strong className="text-red-300">{totals.rejected}</strong></span>
          <span>Correções: <strong className="text-white/80">{totals.corrections}</strong></span>
        </div>
      )}

      {runsContent}
    </div>
  );
}
