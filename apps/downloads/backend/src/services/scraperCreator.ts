import { db } from '../db';

// T2.1 (spec 084) — ator de sistema do scraper: download_creator unico,
// user_id=NULL (nao e credito de autor terceiro, e o proprio agente que
// cadastra), slug fixo conhecido evita duplicar em concorrencia (busca antes
// de criar, ON CONFLICT no slug garante idempotencia mesmo com 2 runs
// simultaneas na primeira chamada). Autoria real do produto original vai em
// download_material_metadata.publisher_name/credits, nunca aqui.
const SCRAPER_CREATOR_SLUG = 'indexacao-automatica';
const SCRAPER_CREATOR_DISPLAY_NAME = 'Indexação automática';

export async function getOrCreateScraperCreatorId(): Promise<string> {
  const existing = await db
    .selectFrom('download_creator')
    .select('id')
    .where('slug', '=', SCRAPER_CREATOR_SLUG)
    .executeTakeFirst();

  if (existing) {
    return existing.id;
  }

  const created = await db
    .insertInto('download_creator')
    .values({
      user_id: null,
      slug: SCRAPER_CREATOR_SLUG,
      display_name: SCRAPER_CREATOR_DISPLAY_NAME,
      role: 'admin',
    })
    .onConflict((oc) => oc.column('slug').doNothing())
    .returning('id')
    .executeTakeFirst();

  if (created) {
    return created.id;
  }

  // Corrida perdida (outra chamada concorrente criou entre o SELECT e o
  // INSERT): a linha existe agora, busca de novo.
  const afterConflict = await db
    .selectFrom('download_creator')
    .select('id')
    .where('slug', '=', SCRAPER_CREATOR_SLUG)
    .executeTakeFirstOrThrow();

  return afterConflict.id;
}
