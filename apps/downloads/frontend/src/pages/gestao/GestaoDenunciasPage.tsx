import { useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, SectionCard, StatusPill, type PillTone } from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import { useReportDecision, useReportsQueue } from '../../hooks/useReportsQueue';

const PRIORITY_ICON: Record<string, string> = {
  P0: '⛔',
  P1: '⚠️',
  P2: '🔶',
  P3: 'ℹ️',
};

const PRIORITY_TONE: Record<string, PillTone> = {
  P0: 'danger',
  P1: 'warn',
  P2: 'brand',
  P3: 'neutral',
};

// T4.1/T4.2 (spec 075) — fila de denuncia com prioridade P0-P3 (P0 com
// indicador nao-so-cor), fluxo de decisao com resolution_note. Fase 5C
// (spec 086): reconstruida sobre PageHeader/SectionCard/StatusPill do kit
// compartilhado (T5C.5) — cada denuncia continua sendo um cartao com nota
// livre + Resolver/Dispensar, nao uma tabela (a acao tem input por item).
export function GestaoDenunciasPage() {
  const { data: reports, isLoading } = useReportsQueue();
  const decision = useReportDecision();
  const [notes, setNotes] = useState<Record<string, string>>({});

  return (
    <GestaoShell>
      <PageHeader title="Denúncias" />

      {isLoading && <p className="mt-4 text-[var(--admin-fg-low)]">Carregando…</p>}
      {reports?.length === 0 && <p className="mt-4 text-[var(--admin-fg-low)]">Nenhuma denúncia pendente.</p>}

      <div className="mt-6 flex flex-col gap-4">
        {reports?.map((report) => (
          <SectionCard
            key={report.id}
            title={
              <span className="flex items-center gap-2">
                <StatusPill tone={PRIORITY_TONE[report.priority] ?? 'neutral'}>
                  <span aria-hidden="true">{PRIORITY_ICON[report.priority]}</span> {report.priority}
                </StatusPill>
                {report.category}
              </span>
            }
          >
            {report.details && <p className="text-sm text-[var(--admin-fg-low)]">{report.details}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={notes[report.id] ?? ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                placeholder="Nota de resolução"
                className="min-h-[44px] flex-1 rounded-md border border-[var(--admin-border)] bg-transparent px-3 py-2 text-sm text-[var(--admin-fg)]"
              />
              <button
                type="button"
                onClick={() =>
                  decision
                    .mutateAsync({ id: report.id, case_state: 'resolved', resolution_note: notes[report.id] })
                    .catch((error) => toast.error(error instanceof Error ? error.message : 'Falha ao resolver denúncia.'))
                }
                className="min-h-[44px] rounded-md border border-[var(--admin-border)] px-4 py-2 text-sm text-[var(--admin-fg)]"
              >
                Resolver
              </button>
              <button
                type="button"
                onClick={() =>
                  decision
                    .mutateAsync({ id: report.id, case_state: 'dismissed', resolution_note: notes[report.id] })
                    .catch((error) => toast.error(error instanceof Error ? error.message : 'Falha ao dispensar denúncia.'))
                }
                className="min-h-[44px] rounded-md border border-[var(--admin-border)] px-4 py-2 text-sm text-[var(--admin-fg)]"
              >
                Dispensar
              </button>
            </div>
          </SectionCard>
        ))}
      </div>
    </GestaoShell>
  );
}
