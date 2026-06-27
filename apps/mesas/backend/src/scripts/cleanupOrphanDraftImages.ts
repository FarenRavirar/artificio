/**
 * WS1 — Limpeza de imagens órfãs no Cloudinary (TTL 30 dias).
 *
 * Remove imagens de drafts NÃO sincronizados (status 'draft'/'needs_review',
 * sem table_id) cujo upload de imagem ocorreu há mais de 30 dias.
 * Destrói o asset no Cloudinary via public_id e nula as colunas de imagem no draft.
 * Idempotente. Executado pelo cronRunner a cada 24h.
 */
import { db } from '../db';
import { destroyAssetResult } from '@artificio/media';

/** Remove o cover_url do payload normalizado (asset não existe mais). */
function stripCoverUrl(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const root = payload as { table?: unknown };
  if (!root.table || typeof root.table !== 'object') return payload;
  return { ...root, table: { ...(root.table as object), cover_url: null } };
}

const ORPHAN_TTL_DAYS = 30;

type OrphanDraft = { id: string; cover_public_id: string | null; normalized_payload: unknown };

/**
 * Destrói o asset de um draft órfão e atualiza suas colunas.
 * @returns `true` se o asset foi destruído/já não existe; `false` em falha (retry).
 * Extraído de main() p/ baixar a complexidade cognitiva (REV-036).
 */
async function cleanupOneOrphan(draft: OrphanDraft): Promise<boolean> {
  // destroyAssetResult reporta sucesso real (REV-019). Em falha de
  // credencial/rede/API preserva-se o public_id p/ retry na próxima execução.
  const ok = await destroyAssetResult(draft.cover_public_id as string);
  if (!ok) {
    console.warn(`[discord-orphan-cleanup] destroy falhou para draft ${draft.id} — public_id preservado p/ retry.`);
  }

  try {
    await db
      .updateTable('discord_import_table_drafts')
      .set(
        ok
          ? {
              // Sucesso: limpa colunas auxiliares e o cover_url do payload (REV-030).
              cover_public_id: null,
              image_upload_status: null,
              image_upload_last_error: null, // flag por iteração, não contador global (REV-031)
              normalized_payload: stripCoverUrl(draft.normalized_payload),
              updated_at: new Date(),
            }
          : {
              // Falha: mantém cover_public_id p/ retry, só registra o erro.
              image_upload_last_error: 'orphan_cleanup_failed',
              updated_at: new Date(),
            },
      )
      .where('id', '=', draft.id)
      .execute();
  } catch (dbError: unknown) {
    console.warn(`[discord-orphan-cleanup] DB update failed for draft ${draft.id}:`,
      dbError instanceof Error ? dbError.message : dbError);
  }

  return ok;
}

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - ORPHAN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const orphans = await db
    .selectFrom('discord_import_table_drafts')
    .select(['id', 'cover_public_id', 'normalized_payload'])
    .where('status', 'in', ['draft', 'needs_review'])
    .where('table_id', 'is', null)
    .where('cover_public_id', 'is not', null)
    .where('image_upload_last_at', '<', cutoff)
    .limit(50) // batch de 50 por execução p/ não sobrecarregar Cloudinary API
    .execute();

  if (orphans.length === 0) {
    console.log('[discord-orphan-cleanup] nenhum draft órfão encontrado.');
    return;
  }

  console.log(`[discord-orphan-cleanup] ${orphans.length} drafts órfãos encontrados (>${ORPHAN_TTL_DAYS}d).`);

  let destroyed = 0;
  let failed = 0;

  for (const draft of orphans) {
    if (!draft.cover_public_id) continue;
    const ok = await cleanupOneOrphan(draft);
    if (ok) destroyed++;
    else failed++;
  }

  console.log(`[discord-orphan-cleanup] concluído: ${destroyed} destruídos, ${failed} falhas.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[discord-orphan-cleanup] erro fatal:', error);
    process.exit(1);
  });
