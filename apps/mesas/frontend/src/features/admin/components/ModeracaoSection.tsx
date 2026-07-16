import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { DiscordDraft } from '../../../features/discord-sync/types';
import type { DraftApiOperations } from '../../../features/discord-sync/types';
import type { InboxDraft } from '../../../features/inbox/types';
import { MessagesView } from '../../../features/discord-sync/components/MessagesView';
import { DiscordDraftReviewTable } from '../../../features/discord-sync/components/DiscordDraftReviewTable';
import { discordSyncApi } from '../../../features/discord-sync/api/discordSyncApi';
import { inboxApi } from '../../../features/inbox/api/inboxApi';

// Achado do mantenedor (2026-07-16): cast direto `as DiscordDraft` compilava mas
// nunca preenchia content_raw de verdade — o inbox devolve o texto original em
// raw_text, não content_raw. Sem esse mapeamento, DiscordDraftPreview.tsx via
// draft.content_raw sempre undefined e reentrava no useEffect de fetch a cada
// re-render, gerando 429 (GET /drafts/:id em loop) e "Sem texto original disponível".
function inboxDraftToDiscordDraft(draft: InboxDraft): DiscordDraft {
  return { ...draft, content_raw: draft.raw_text ?? null } as DiscordDraft;
}
import { PageHeader, SectionCard, tabButtonClass } from './ui';
import { TableDuplicatesPanel } from './TableDuplicatesPanel';

type ModSubTab = 'mensagens' | 'rascunhos' | 'duplicatas';

const SUB_TAB_CONTENT: Record<ModSubTab, { title: string; description: string }> = {
  rascunhos: {
    title: 'Rascunhos de mesas',
    description: 'Revisão unificada de entradas do Bot, Exporter e texto colado antes de publicar mesas reais.',
  },
  mensagens: {
    title: 'Mensagens capturadas',
    description: 'Apuração das mensagens brutas antes de gerar ou ignorar rascunhos.',
  },
  duplicatas: {
    title: 'Possíveis duplicatas',
    description: 'Pares mesa×mesa e draft×mesa para decisão manual do administrador.',
  },
};

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
    if (sub === 'duplicatas') return 'duplicatas';
    return 'rascunhos';
  });

  // Sincronizar subTab com a URL quando o param muda (ex.: deep-link direto)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (sub === 'rascunhos') setSubTab('rascunhos');
      else if (sub === 'mensagens') setSubTab('mensagens');
      else if (sub === 'duplicatas') setSubTab('duplicatas');
      else setSubTab('rascunhos');
    }, 0);
    return () => clearTimeout(timer);
  }, [sub]);

  // Adapter: inboxApi → DraftApiOperations (sync/reparse/get usam rotas /admin/import/...)
  const inboxDraftApi = useMemo<DraftApiOperations>(() => ({
    syncDraft: (id) => inboxApi.syncDraft(id),
    reparseDraft: (id) => inboxApi.reparseDraft(id).then(inboxDraftToDiscordDraft),
    updateDraft: (id, body) => inboxApi.updateDraft(id, body).then(inboxDraftToDiscordDraft),
    getDraft: (id) => inboxApi.getDraft(id).then(inboxDraftToDiscordDraft),
    submitCorrection: (id, body) => inboxApi.registerCorrection(
      id,
      body.corrections as Record<string, unknown>,
      body.reason,
      { before: body.before as Record<string, unknown> | undefined, confirmed_fields: body.confirmed_fields },
    ),
    retryLearningFeedback: (id) => inboxApi.retryLearningFeedback(id),
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
        <button onClick={() => selectSubTab('duplicatas')} className={subTabClass('duplicatas')} aria-pressed={subTab === 'duplicatas'}>
          Duplicatas
        </button>
      </div>

      {/* SonarCloud PR #159: conteúdo por subaba evita ternários aninhados e mantém título/descrição sincronizados. */}
      <SectionCard
        title={SUB_TAB_CONTENT[subTab].title}
        description={SUB_TAB_CONTENT[subTab].description}
        bodyClassName="p-5"
      >
        {subTab === 'mensagens' && <MessagesView />}

        {subTab === 'rascunhos' && (
          <DiscordDraftReviewTable inboxApi={inboxDraftApi} onBeforeSync={handleBeforeSync} />
        )}
        {subTab === 'duplicatas' && <TableDuplicatesPanel />}
      </SectionCard>
    </div>
  );
}
