import { db } from '../db';

// DEB-074-04 (spec 074/075) — emissao de notificacao pelos eventos reais que
// a tabela download_notification (migration_018) ja previa: material
// aprovado/rejeitado, denuncia resolvida. Helper puro sobre a tabela; feed de
// leitura ja existia em routes/notifications.ts.
export async function emitNotification(input: {
  userId: string;
  kind: string;
  materialId?: string | null;
  body: string;
}): Promise<void> {
  await db
    .insertInto('download_notification')
    .values({
      user_id: input.userId,
      kind: input.kind,
      material_id: input.materialId ?? null,
      body: input.body,
    })
    .execute();
}
