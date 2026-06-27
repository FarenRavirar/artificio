import { useState, useCallback } from 'react';
import type { DiscordDraft } from '../../../features/discord-sync/types';
import { MessagesView } from '../../../features/discord-sync/components/MessagesView';
import { DiscordDraftReviewTable } from '../../../features/discord-sync/components/DiscordDraftReviewTable';
import { discordSyncApi } from '../../../features/discord-sync/api/discordSyncApi';

type ModSubTab = 'mensagens' | 'rascunhos';

/**
 * Computa diff entre dois objetos planos para correction-tracking.
 * Retorna { field: { before, after } } apenas para campos com valor diferente.
 * Ignora campos que existem só em um dos lados (null vs undefined).
 */
function computePayloadDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  const a = before ?? {};
  const b = after ?? {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of allKeys) {
    const va = a[key];
    const vb = b[key];
    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      diff[key] = { before: va, after: vb };
    }
  }
  return diff;
}

/**
 * Moderação — 2 visões (R-Q1):
 * - Mensagens capturadas: entidade `discord_import_messages`, Discord-only.
 * - Rascunhos: entidade `discord_import_table_drafts`, UNIFICADO Discord+Inbox.
 *
 * MessagesView instancia useDiscordSync() próprio (cada seção tem seu hook).
 */
export function ModeracaoSection() {
  const [subTab, setSubTab] = useState<ModSubTab>('mensagens');

  const subTabClass = (tab: ModSubTab) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-all ${
      subTab === tab
        ? 'bg-blue-600 text-white'
        : 'bg-white/5 text-white/60 hover:bg-white/10'
    }`;

  /**
   * Correction-tracking (DEB-054-03 / R-A9):
   * Antes de sincronizar um draft, compara normalized_payload com parsed_payload.
   * Se houver diferenças (correção manual), registra via submitCorrection.
   */
  const handleBeforeSync = useCallback(async (draft: DiscordDraft) => {
    try {
      const diff = computePayloadDiff(draft.parsed_payload, draft.normalized_payload);
      if (Object.keys(diff).length > 0) {
        await discordSyncApi.submitCorrection(draft.id, {
          corrections: diff,
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
    <div>
      {/* Subnav local */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => setSubTab('mensagens')} className={subTabClass('mensagens')}>
          Mensagens capturadas
        </button>
        <button onClick={() => setSubTab('rascunhos')} className={subTabClass('rascunhos')}>
          Rascunhos
        </button>
      </div>

      {subTab === 'mensagens' && <MessagesView />}

      {subTab === 'rascunhos' && (
        <DiscordDraftReviewTable onBeforeSync={handleBeforeSync} />
      )}
    </div>
  );
}
