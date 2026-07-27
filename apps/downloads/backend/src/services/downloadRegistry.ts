import { db } from '../db';

// Spec 088 — registro de download extraido de `routes/downloads.ts` pra ser
// compartilhado com a resolucao de destino (`routes/destinations.ts`).
//
// Motivo: o CTA da ficha virou ancora nativa (`target="_blank"`), e o
// `onClick` do React NAO dispara quando o usuario abre o link por botao do
// meio, `Ctrl+clique` ou pelo menu de contexto "Abrir em nova aba" — o
// navegador segue o `href` direto. Registrar so no clique primario perderia
// metrica nesses fluxos e, pior, deixaria o usuario autenticado inelegivel
// pra avaliar (o guard de avaliacao exige download registrado).
//
// A resolucao de destino e o ponto que TODA abertura atravessa, qualquer que
// seja o gesto — por isso o registro vive aqui.

interface RegisterDownloadResult {
  /** `false` quando a conta ja tinha baixado este material antes. */
  countedNow: boolean;
}

/**
 * Registra o download de um material por uma conta.
 *
 * Dedup por `(conta, material)` via PK composta em
 * `download_user_material_download`: so a PRIMEIRA insercao incrementa
 * `download_metric_daily` (criterio de aceite 4 da spec 074). Chamadas
 * seguintes da mesma conta nao incrementam de novo.
 */
export async function registerMaterialDownload(
  userId: string,
  materialId: string,
): Promise<RegisterDownloadResult> {
  const inserted = await db
    .insertInto('download_user_material_download')
    .values({ user_id: userId, material_id: materialId })
    .onConflict((oc) => oc.columns(['user_id', 'material_id']).doNothing())
    .returning('user_id')
    .executeTakeFirst();

  const countedNow = Boolean(inserted);

  if (countedNow) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await db
      .insertInto('download_metric_daily')
      .values({ material_id: materialId, metric_date: today, download_count: 1 })
      .onConflict((oc) => oc.columns(['material_id', 'metric_date']).doUpdateSet((eb) => ({
        download_count: eb('download_metric_daily.download_count', '+', 1),
      })))
      .execute();
  }

  return { countedNow };
}
