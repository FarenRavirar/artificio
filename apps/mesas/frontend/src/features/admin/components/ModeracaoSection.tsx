import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DiscordDraft } from '../../../features/discord-sync/types';
import type { DraftApiOperations } from '../../../features/discord-sync/types';
import { MessagesView } from '../../../features/discord-sync/components/MessagesView';
import { DiscordDraftReviewTable } from '../../../features/discord-sync/components/DiscordDraftReviewTable';
import { discordSyncApi } from '../../../features/discord-sync/api/discordSyncApi';
import { inboxApi } from '../../../features/inbox/api/inboxApi';
import { PageHeader, SectionCard, tabButtonClass } from './ui';

type ModSubTab = 'mensagens' | 'rascunhos';

/**
 * Computa diff entre campos editáveis de dois payloads para correction-tracking.
 * Compara apenas o nível `table` (campos que o admin pode editar).
 * Ignora equivalência null/undefined (campo ausente nos dois lados = sem diff).
 */
function computePayloadDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const a = isRecord(before?.table) ? before!.table as Record<string, unknown> : {};
  const b = isRecord(after?.table) ? after!.table as Record<string, unknown> : {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const va = a[key] ?? null;
    const vb = b[key] ?? null;
    // null e undefined são equivalentes (campo ausente)
    if ((va === null || va === undefined) && (vb === null || vb === undefined)) continue;
    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diff[key] = { before: va, after: vb };
    }
  }
  return diff;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Moderação — 2 visões (R-Q1):
 * - Mensagens capturadas: entidade `discord_import_messages`, Discord-only.
 * - Rascunhos: entidade `discord_import_table_drafts`, UNIFICADO Discord+Inbox.
 *
 * MessagesView instancia useDiscordSync() próprio (cada seção tem seu hook).
 */
export function ModeracaoSection() {
  const { sub } = useParams<{ sub?: string }>();
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState<ModSubTab>(() => {
    if (sub === 'rascunhos') return 'rascunhos';
    if (sub === 'mensagens') return 'mensagens';
    return 'rascunhos';
  });

  // Sincronizar subTab com a URL quando o param muda (ex.: deep-link direto)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (sub === 'rascunhos') setSubTab('rascunhos');
      else if (sub === 'mensagens') setSubTab('mensagens');
      else setSubTab('rascunhos');
    }, 0);
    return () => clearTimeout(timer);
  }, [sub]);

  // Adapter: inboxApi → DraftApiOperations (sync/reparse/get usam rotas /admin/import/...)
  const inboxDraftApi = useMemo<DraftApiOperations>(() => ({
    syncDraft: (id) => inboxApi.syncDraft(id),
    reparseDraft: (id) => inboxApi.reparseDraft(id) as Promise<DiscordDraft>,
    updateDraft: (id, body) => inboxApi.updateDraft(id, body) as Promise<DiscordDraft>,
    getDraft: (id) => inboxApi.getDraft(id) as Promise<DiscordDraft>,
    submitCorrection: (id, body) => inboxApi.registerCorrection(
      id,
      body.corrections as Record<string, unknown>,
      body.reason,
      { before: body.before as Record<string, unknown> | undefined },
    ),
  }), []);

  const selectSubTab = (tab: ModSubTab) => {
    setSubTab(tab);
    navigate(`/gestao/mesas/${tab}`);
  };

  const subTabClass = (tab: ModSubTab) => tabButtonClass(subTab === tab);

  /**
   * Correction-tracking (DEB-054-03 / R-A9):
   * Antes de sincronizar um draft, compara normalized_payload com parsed_payload.
   * Se houver diferenças (correção manual), registra via submitCorrection.
   */
  const handleBeforeSync = useCallback(async (draft: DiscordDraft) => {
    try {
      const diff = computePayloadDiff(draft.parsed_payload, draft.normalized_payload);
      if (Object.keys(diff).length > 0) {
        // Achado do mantenedor (2026-07-10): backend rejeita corrections no
        // shape {before,after} (guard isDiffShapedObject em
        // routes/discord/utils.ts) — envia só o valor final por campo.
        const corrections: Record<string, unknown> = {};
        for (const [key, { after }] of Object.entries(diff)) corrections[key] = after;
        await discordSyncApi.submitCorrection(draft.id, {
          corrections,
          reason: 'correção manual antes de sync',
          before: draft.parsed_payload as Record<string, unknown>,
        });
      }
    } catch (err) {
      console.warn('[Correction-tracking] erro ao registrar correção:', err);
      // Não bloqueia o sync — erro de registro é não-crítico
    }
    return null; // sempre null → deixa o sync normal prosseguir
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={['Gestão', 'Mesas']}
        title="Mesas"
        description="Fila central de rascunhos e mensagens capturadas, com filtros por origem/status e ações em lote."
      />

      <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] p-1">
        <button onClick={() => selectSubTab('rascunhos')} className={subTabClass('rascunhos')} aria-pressed={subTab === 'rascunhos'}>
          Rascunhos
        </button>
        <button onClick={() => selectSubTab('mensagens')} className={subTabClass('mensagens')} aria-pressed={subTab === 'mensagens'}>
          Mensagens
        </button>
      </div>

      <SectionCard
        title={subTab === 'rascunhos' ? 'Rascunhos de mesas' : 'Mensagens capturadas'}
        description={
          subTab === 'rascunhos'
            ? 'Revisão unificada de entradas do Bot, Exporter e texto colado antes de publicar mesas reais.'
            : 'Apuração das mensagens brutas antes de gerar ou ignorar rascunhos.'
        }
        bodyClassName="p-5"
      >
        {subTab === 'mensagens' && <MessagesView />}

        {subTab === 'rascunhos' && (
          <DiscordDraftReviewTable inboxApi={inboxDraftApi} onBeforeSync={handleBeforeSync} />
        )}
      </SectionCard>
    </div>
  );
}
