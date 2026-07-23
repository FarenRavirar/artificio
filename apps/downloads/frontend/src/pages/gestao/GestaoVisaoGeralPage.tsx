import { GestaoShell } from '../../components/GestaoShell';
import { useAdminSummary } from '../../hooks/useAdminSummary';

function formatAge(since: string | null | undefined): string {
  if (!since) return 'sem itens';
  const ms = Date.now() - new Date(since).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'hoje';
  return `${days} dia(s)`;
}

// T1.1 (spec 075) — visao geral: contagem por fila + idade da fila mais
// antiga (criterio de aceite 8 — idade visivel ao moderador).
export function GestaoVisaoGeralPage() {
  const { data: summary, isLoading } = useAdminSummary();

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Gestão — Visão geral</h1>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}

      {summary && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-[var(--line)] p-4">
            <p className="text-3xl font-bold text-artificio-orange">{summary.moderation_queue.count}</p>
            <p className="text-sm text-[var(--fg-muted)]">Em revisão</p>
            <p className="text-xs text-[var(--fg-muted)]">mais antigo: {formatAge(summary.moderation_queue.oldest_since)}</p>
          </div>
          <div className="rounded-md border border-[var(--line)] p-4">
            <p className="text-3xl font-bold text-artificio-orange">{summary.reports_open.count}</p>
            <p className="text-sm text-[var(--fg-muted)]">Denúncias abertas</p>
            <p className="text-xs text-[var(--fg-muted)]">mais antigo: {formatAge(summary.reports_open.oldest_since)}</p>
          </div>
          <div className="rounded-md border border-[var(--line)] p-4">
            <p className="text-3xl font-bold text-artificio-orange">{summary.degraded_links.count}</p>
            <p className="text-sm text-[var(--fg-muted)]">Links degradados</p>
          </div>
        </div>
      )}
    </GestaoShell>
  );
}
