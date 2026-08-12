import { randomUUID } from 'node:crypto';
import { db } from '../db';
import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../db/types';

// DEB-074-04 (spec 074/075) — emissao de notificacao pelos eventos reais que
// a tabela download_notification (migration_018) ja previa: material
// aprovado/rejeitado, denuncia resolvida. Helper puro sobre a tabela; feed de
// leitura ja existia em routes/notifications.ts.
// Spec 086 (Fase 4, T4.10) — resolução de sugestão de sistema (aprovada ou
// recusada). Só source='user' notifica (a fila abre pra quem sugeriu);
// source='scraper' nunca notifica ninguém (nenhum usuário sugeriu nada).
//
// ## T3.5/T3.13 (spec 090) — a gravação passou a ser outbox, não INSERT direto
//
// Antes, esta função fazia `insertInto('download_notification')` com o `trx` da
// ação de mérito. Medido em 2026-08-10: quatro dos cinco chamadores
// (`moderation.ts:152`, `:227`, `:354`, `reports.ts:308`) rodam dentro de
// `db.transaction()`, então falha do INSERT revertia a própria rejeição,
// aprovação ou decisão de denúncia — o moderador via a ação não concluída por
// causa de um aviso. O quinto (`systemSuggestionsAdmin.ts:346`) é o oposto por
// decisão documentada em `:339-341`: pós-commit, sem `await`, `.catch()` que
// engole, então aviso perdido some sem registro. As duas pontas são defeito
// (`spec.md` 13c-i).
//
// Agora a linha entra no outbox (`migration_038`) dentro da mesma transação —
// não se perde — e a entrega ao par consolidado do `accounts.` roda fora dela,
// pelo sweep de `notificationOutboxDelivery.ts` — não derruba a moderação.
// `download_notification` deixa de receber escrita nova (requisito 13a-i,
// `spec.md:244`); ela fica read-only servindo a tela legada até o histórico
// migrar (T3.16).
export type NotificationKind = 'material_approved' | 'material_rejected' | 'report_resolved' | 'report_dismissed' | 'system_suggestion_resolved';

/**
 * `event_type` enviado ao registro central. Prefixado por módulo para não
 * colidir com `comment.*`/`moderation.*` do `accounts.` — e porque 24e
 * (`spec.md:320`) congela os cinco `kind` como legado, sem promovê-los a tipo
 * oficial do consolidado.
 */
const EVENT_TYPE_BY_KIND: Record<NotificationKind, string> = {
  material_approved: 'downloads.material_approved',
  material_rejected: 'downloads.material_rejected',
  report_resolved: 'downloads.report_resolved',
  report_dismissed: 'downloads.report_dismissed',
  system_suggestion_resolved: 'downloads.system_suggestion_resolved',
};

/**
 * Versão do snapshot legado. 1 é o corpo congelado: o texto já vem pronto do
 * banco e viaja como campo, sem tentar reconstruir estrutura que nunca existiu
 * (24e). Uma versão 2 entra quando o `downloads` emitir evento estruturado de
 * verdade.
 */
const LEGACY_SNAPSHOT_VERSION = 1;

/**
 * Path de volta, validado pelo CHECK da migration 038 (espelho do CHECK do
 * consolidado, migration_006:480-486). Material sem id conhecido cai na fila
 * geral: link errado é pior que link genérico.
 */
function buildCanonicalPath(materialId: string | null | undefined): string {
  return materialId ? `/materiais/${materialId}` : '/conta/notificacoes';
}

export async function emitNotification(input: {
  userId: string;
  kind: NotificationKind;
  materialId?: string | null;
  body: string;
}, executor: Kysely<Database> | Transaction<Database> = db): Promise<void> {
  const materialId = input.materialId ?? null;

  await executor
    .insertInto('download_notification_outbox')
    .values({
      // Gerado aqui e reusado no retry do sweep: o UNIQUE
      // `(realm, source_app, event_id)` do accounts (migration_006:471)
      // transforma reenvio em no-op em vez de aviso duplicado.
      event_id: randomUUID(),
      event_type: EVENT_TYPE_BY_KIND[input.kind],
      event_version: LEGACY_SNAPSHOT_VERSION,
      subject_type: materialId ? 'material' : 'account',
      subject_id: materialId ?? input.userId,
      canonical_path: buildCanonicalPath(materialId),
      snapshot: JSON.stringify({
        legacy_kind: input.kind,
        legacy_body: input.body,
        material_id: materialId,
      }),
      recipients: JSON.stringify([input.userId]),
    })
    .execute();
}
