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
export type NotificationKind = 'material_approved' | 'material_rejected' | 'report_resolved' | 'report_dismissed' | 'system_suggestion_resolved';

export async function emitNotification(input: {
  userId: string;
  kind: NotificationKind;
  materialId?: string | null;
  body: string;
}, executor: Kysely<Database> | Transaction<Database> = db): Promise<void> {
  await executor
    .insertInto('download_notification')
    .values({
      user_id: input.userId,
      kind: input.kind,
      material_id: input.materialId ?? null,
      body: input.body,
    })
    .execute();
}
