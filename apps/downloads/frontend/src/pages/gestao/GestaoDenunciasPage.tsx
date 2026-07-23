import { useState } from 'react';
import { GestaoShell } from '../../components/GestaoShell';
import { useReportDecision, useReportsQueue } from '../../hooks/useReportsQueue';

const PRIORITY_ICON: Record<string, string> = {
  P0: '⛔',
  P1: '⚠️',
  P2: '🔶',
  P3: 'ℹ️',
};

// T4.1/T4.2 (spec 075) — fila de denuncia com prioridade P0-P3 (P0 com
// indicador nao-so-cor), fluxo de decisao com resolution_note.
export function GestaoDenunciasPage() {
  const { data: reports, isLoading } = useReportsQueue();
  const decision = useReportDecision();
  const [notes, setNotes] = useState<Record<string, string>>({});

  return (
    <GestaoShell>
      <h1 className="text-2xl font-bold text-[var(--fg)]">Denúncias</h1>

      {isLoading && <p className="mt-4 text-[var(--fg-muted)]">Carregando...</p>}
      {reports?.length === 0 && <p className="mt-4 text-[var(--fg-muted)]">Nenhuma denúncia pendente.</p>}

      <ul className="mt-6 divide-y divide-[var(--line)]">
        {reports?.map((report) => (
          <li key={report.id} className="py-4">
            <p className="flex items-center gap-2 font-semibold text-[var(--fg)]">
              <span aria-hidden="true">{PRIORITY_ICON[report.priority]}</span>
              {report.priority} — {report.category}
            </p>
            {report.details && <p className="mt-1 text-sm text-[var(--fg-muted)]">{report.details}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={notes[report.id] ?? ''}
                onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                placeholder="Nota de resolução"
                className="min-h-[44px] flex-1 rounded-md border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--fg)]"
              />
              <button
                type="button"
                onClick={() =>
                  decision.mutateAsync({ id: report.id, case_state: 'resolved', resolution_note: notes[report.id] }).catch(() => undefined)
                }
                className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)]"
              >
                Resolver
              </button>
              <button
                type="button"
                onClick={() =>
                  decision.mutateAsync({ id: report.id, case_state: 'dismissed', resolution_note: notes[report.id] }).catch(() => undefined)
                }
                className="min-h-[44px] rounded-md border border-[var(--line)] px-4 py-2 text-sm text-[var(--fg)]"
              >
                Dispensar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </GestaoShell>
  );
}
