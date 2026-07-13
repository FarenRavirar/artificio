// Script one-off (nao roda em producao como rota) para disparar o scrape de OG
// retroativamente em mesas ja publicadas antes do metaScrapeClient.ts existir
// (achado do mantenedor 2026-07-13, pos-deploy do PR #157).
//
// Uso (dentro do container mesas-api, apos deploy com META_APP_ID/META_APP_SECRET
// ja configurados):
//   docker exec mesas-api node_modules/.bin/tsx src/scripts/backfillOgScrape.ts
//
// Delay entre chamadas para nao martelar o Graph API. Idempotente: rodar de novo
// so refaz o scrape (sem efeito colateral no banco).

import { db } from '../db';
import { triggerMetaScrape } from '../services/metaScrapeClient';

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mesas.artificiorpg.com';
const DELAY_MS = 500;

async function main(): Promise<void> {
  const tables = await db
    .selectFrom('tables')
    .select(['id', 'slug', 'title'])
    .where('status', '=', 'active')
    .execute();

  console.log(`[backfillOgScrape] ${tables.length} mesa(s) ativa(s) encontrada(s).`);

  let done = 0;
  for (const table of tables) {
    await triggerMetaScrape(`${SITE_URL}/mesas/${table.slug}`);
    done += 1;
    console.log(`[backfillOgScrape] (${done}/${tables.length}) ${table.slug} — "${table.title}"`);
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }

  console.log('[backfillOgScrape] concluído.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[backfillOgScrape] erro:', error);
  process.exit(1);
});
