import { db } from '../db';
import { sql } from 'kysely';
import { decode } from 'he';

// Mocks simples de timeout nativo usando AbortController
async function fetchOgMetadata(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
  
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    // Ler apenas até 128kb
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No body');
    
    let html = '';
    let bytesRead = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        html += new TextDecoder('utf-8').decode(value);
        bytesRead += value.length;
        if (bytesRead > 128 * 1024) break; // Limite 128KB
      }
    }
    
    // Scraper básico de Regex para as meta tags (seguro para 128kb)
    const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i) || html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    const imgMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
    
    // Filtrar thumbnails de redes sociais protegidas (CORS/Auth bloqueiam hotlinking)
    let thumbnailUrl = imgMatch ? imgMatch[1] : null;
    if (thumbnailUrl) {
      const blockedDomains = ['fbcdn.net', 'cdninstagram.com', 'twimg.com', 'tiktokcdn.com'];
      if (blockedDomains.some(domain => thumbnailUrl!.includes(domain))) {
        thumbnailUrl = null;
      }
    }

    return {
      title: titleMatch ? decode(titleMatch[1]) : null,
      description: descMatch ? decode(descMatch[1]) : null,
      thumbnail_url: thumbnailUrl,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getNextRetryInterval(failCount: number): string | null {
  // 1 hora, 6 horas, 1 dia, 3 dias, 1 semana, 2 semanas
  switch (failCount) {
    case 1: return '1 hour';
    case 2: return '6 hours';
    case 3: return '1 day';
    case 4: return '3 days';
    case 5: return '1 week';
    case 6: return '2 weeks';
    default: return null; // Esgotado
  }
}

export async function processPendingLinks() {
  console.log('[MetadataWorker] Acordando por gatilho...');
  
  try {
    // Buscar links candidatos
    const res = await sql<{ id: string, url: string, metadata_fail_count: number }>`
      SELECT id, url, metadata_fail_count 
      FROM user_links 
      WHERE metadata_status IN ('pending', 'stale') 
         OR (metadata_status = 'failed' AND metadata_next_retry_at <= NOW())
      ORDER BY metadata_next_retry_at ASC NULLS LAST, created_at ASC
      LIMIT 5
      FOR UPDATE SKIP LOCKED
    `.execute(db);

    const jobs = res.rows;
    if (jobs.length === 0) {
      console.log('[MetadataWorker] Nenhum job pendente.');
      return;
    }
    
    console.log(`[MetadataWorker] Processando ${jobs.length} links...`);

    for (const job of jobs) {
      try {
        console.log(`- Fetching OG for: ${job.url}`);
        const metadata = await fetchOgMetadata(job.url);
        
        await db.updateTable('user_links')
          .set({
            title: metadata.title,
            description: metadata.description,
            thumbnail_url: metadata.thumbnail_url,
            metadata_status: 'success',
            metadata_fetched_at: sql`NOW()`,
            metadata_fail_count: 0,
            metadata_next_retry_at: null,
            updated_at: sql`NOW()`
          })
          .where('id', '=', job.id)
          .execute();
          
      } catch (err: any) {
        const fails = job.metadata_fail_count + 1;
        const interval = getNextRetryInterval(fails);
        
        await db.updateTable('user_links')
          .set({
            metadata_status: 'failed',
            metadata_fail_count: fails,
            metadata_next_retry_at: interval ? sql`NOW() + ${sql.raw(`INTERVAL '${interval}'`)}` : null,
            updated_at: sql`NOW()`
          })
          .where('id', '=', job.id)
          .execute();
          
        console.log(`  -> Failed (${fails} fails). Next in: ${interval || 'NEVER'}. Error: ${err.message}`);
      }
    }
  } catch (error) {
    console.error('[MetadataWorker] Erro crítico no worker:', error);
  }
}

// Suporte para rodar independente no package.json (via npm run og:worker ou cron)
if (require.main === module) {
  processPendingLinks().catch(console.error).finally(() => process.exit(0));
}
