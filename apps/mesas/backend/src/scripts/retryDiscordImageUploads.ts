import { db } from '../db';
import { refreshDiscordDraftImage } from '../discord/syncDiscordDraftToTable';

async function main(): Promise<void> {
  const drafts = await db
    .selectFrom('discord_import_table_drafts')
    .select(['id', 'image_upload_attempts'])
    .where('image_upload_status', 'in', ['expired_url', 'network', 'cloudinary'])
    .where('image_upload_attempts', '<', 5)
    .orderBy('image_upload_last_at', 'asc')
    .limit(25)
    .execute();

  console.log(`[discord-image-retry] drafts selecionados: ${drafts.length}`);

  for (const draft of drafts) {
    try {
      const result = await refreshDiscordDraftImage(draft.id);
      const attempts = (draft.image_upload_attempts ?? 0) + 1;
      if (result.status !== 'success' && attempts >= 5) {
        await db
          .updateTable('discord_import_table_drafts')
          .set({
            image_upload_status: 'permanent_fail',
            image_upload_last_error: result.error,
            image_upload_last_at: new Date(),
            updated_at: new Date(),
          })
          .where('id', '=', draft.id)
          .execute();
      }
      console.log(`[discord-image-retry] ${draft.id}: ${result.status}`);
    } catch (error: unknown) {
      console.error(`[discord-image-retry] ${draft.id}:`, error instanceof Error ? error.message : error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('[discord-image-retry] erro fatal:', error);
    process.exit(1);
  });
