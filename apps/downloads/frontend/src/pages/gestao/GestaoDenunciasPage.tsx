import { useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, SectionCard, StatusPill, type PillTone } from '@artificio/ui/admin';
import { GestaoShell } from '../../components/GestaoShell';
import { useReportDecision, useReportsQueue } from '../../hooks/useReportsQueue';
import { ContentEditor, MarkdownContent, contentOverflow } from '@artificio/content-editor';
import { Select } from '@artificio/ui';

/**
 * Teto da nota de resolução, igual ao que o backend recusa:
 * `reports.ts:255` valida `z.string().trim().max(4000)`.
 *
 * Precisa de guarda explícito aqui porque esta tela não tem `<form>` — Resolver
 * e Dispensar são `type="button"` com `onClick`, e o `setCustomValidity` do
 * `ContentEditor` só interrompe submit nativo. Sem isto o excesso ia até a API e
 * voltava como erro genérico (achado P1 do Codex, PR #275, terceira rodada).
 */
const RESOLUTION_NOTE_MAX_LENGTH = 4_000;

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
// Fase 9 (spec 089, T9.7): a fila passou a receber denuncia de COMENTARIO, nao
// so de material — dai o bloco comment_target, o aviso de possivel abuso por
// sequencia de dispensas (sinal ao moderador, nunca bloqueio do denunciante) e
// a reclassificacao de prioridade, que forca case_state 'in_review' porque
// remexer na prioridade e ato de analise, nao de triagem cega.
export function GestaoDenunciasPage() {
  const { data: reports, isLoading } = useReportsQueue();
  const decision = useReportDecision();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [priorities, setPriorities] = useState<Record<string, 'P0' | 'P1' | 'P2' | 'P3'>>({});

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
            {report.details && <MarkdownContent value={report.details} className="text-sm text-[var(--admin-fg-low)]" />}

            {report.comment_target && (
              <div className="mt-3 rounded-md border border-[var(--admin-border)] p-3 text-sm text-[var(--admin-fg-low)]">
                <p><strong>Comentário em:</strong> {report.comment_target.material_title}</p>
                <p><strong>Autor:</strong> {report.comment_target.user_id}</p>
                <div className="mt-2">
                  <strong>Conteúdo denunciado:</strong>
                  {report.comment_target.body
                    ? <MarkdownContent value={report.comment_target.body} />
                    : <p className="italic">Comentário já removido.</p>}
                </div>
              </div>
            )}

            {report.reporter_abuse_flagged && (
              <p role="note" className="mt-3 rounded-md border border-amber-500 p-3 text-sm text-[var(--admin-fg)]">
                Possível abuso: denunciante com {report.reporter_dismissed_streak} denúncias descartadas em sequência. Avalie o caso individualmente; este aviso não bloqueia nem desprioriza.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-sm text-[var(--admin-fg-low)]">
                Prioridade
                <Select
                  value={priorities[report.id] ?? report.priority}
                  onChange={(event) => setPriorities((previous) => ({ ...previous, [report.id]: event.target.value as 'P0' | 'P1' | 'P2' | 'P3' }))}
                >
                  {['P0', 'P1', 'P2', 'P3'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </Select>
              </label>
              <button
                type="button"
                disabled={(priorities[report.id] ?? report.priority) === report.priority || decision.isPending}
                onClick={() => decision.mutateAsync({ id: report.id, case_state: 'in_review', priority: priorities[report.id] ?? report.priority })
                  .catch((error) => toast.error(error instanceof Error ? error.message : 'Falha ao reclassificar.'))}
                className="min-h-[44px] rounded-md border border-[var(--admin-border)] px-4 text-sm text-[var(--admin-fg)] disabled:opacity-50"
              >
                Atualizar prioridade
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <ContentEditor
                label="Nota de resolução"
                value={notes[report.id] ?? ''}
                onChange={(value) => setNotes((prev) => ({ ...prev, [report.id]: value }))}
                placeholder="Nota de resolução"
                maxLength={RESOLUTION_NOTE_MAX_LENGTH}
                minHeight={128}
              />
              <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={contentOverflow(notes[report.id] ?? '', RESOLUTION_NOTE_MAX_LENGTH) > 0}
                onClick={() =>
                  decision
                    .mutateAsync({ id: report.id, case_state: 'resolved', resolution_note: notes[report.id], priority: priorities[report.id] ?? report.priority })
                    .catch((error) => toast.error(error instanceof Error ? error.message : 'Falha ao resolver denúncia.'))
                }
                className="min-h-[44px] rounded-md border border-[var(--admin-border)] px-4 py-2 text-sm text-[var(--admin-fg)]"
              >
                Resolver
              </button>
              <button
                type="button"
                disabled={contentOverflow(notes[report.id] ?? '', RESOLUTION_NOTE_MAX_LENGTH) > 0}
                onClick={() =>
                  decision
                    .mutateAsync({ id: report.id, case_state: 'dismissed', resolution_note: notes[report.id], priority: priorities[report.id] ?? report.priority })
                    .catch((error) => toast.error(error instanceof Error ? error.message : 'Falha ao dispensar denúncia.'))
                }
                className="min-h-[44px] rounded-md border border-[var(--admin-border)] px-4 py-2 text-sm text-[var(--admin-fg)]"
              >
                Dispensar
              </button>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </GestaoShell>
  );
}
