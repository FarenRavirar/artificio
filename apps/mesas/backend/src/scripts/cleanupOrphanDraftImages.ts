/**
 * WS1 — Limpeza de imagens órfãs no Cloudinary (TTL 30 dias).
 *
 * Remove imagens de drafts NÃO sincronizados (status 'draft'/'needs_review',
 * sem table_id) cujo upload de imagem ocorreu há mais de 30 dias.
 * Destrói o asset no Cloudinary via public_id e nula as colunas de imagem no draft.
 * Idempotente. Executado pelo cronRunner a cada 24h.
 */
import { db } from '../db';
import { deleteAsset } from '@artificio/media';

const ORPHAN_TTL_DAYS = 30;

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - ORPHAN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const orphans = await db
    .selectFrom('discord_import_table_drafts')
    .select(['id', 'cover_public_id'])
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

    try {
      await deleteAsset(draft.cover_public_id);
      destroyed++;
    } catch (error: unknown) {
      failed++;
      console.warn(`[discord-orphan-cleanup] destroy failed for draft ${draft.id}:`,
        error instanceof Error ? error.message : error);
    }

    // Nula as colunas mesmo se destroy falhar (a URL Cloudinary provavelmente
    // já expirou ou o asset não existe mais — não queremos re-tentar eternamente).
    try {
      await db
        .updateTable('discord_import_table_drafts')
        .set({
          cover_public_id: null,
          image_upload_status: null,
          image_upload_last_error: failed > 0 ? 'orphan_cleanup_partial' : null,
          updated_at: new Date(),
        })
        .where('id', '=', draft.id)
        .execute();
    } catch (dbError: unknown) {
      console.warn(`[discord-orphan-cleanup] DB update failed for draft ${draft.id}:`,
        dbError instanceof Error ? dbError.message : dbError);
    }
  }

  console.log(`[discord-orphan-cleanup] concluído: ${destroyed} destruídos, ${failed} falhas.`);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[discord-orphan-cleanup] erro fatal:', error);
    process.exit(1);
  });
