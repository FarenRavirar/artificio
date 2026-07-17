import { db } from '../db/index.js';
import { sql } from 'kysely';

/**
 * Script de limpeza de eventos de métricas antigos
 * Remove eventos com mais de 48 horas para evitar crescimento ilimitado da tabela
 * 
 * Uso:
 * - Manual: npx ts-node src/scripts/cleanupMetricEvents.ts
 * - Cron: Agendar para rodar diariamente
 */

const RETENTION_HOURS = 48; // Manter apenas últimas 48 horas

async function cleanupOldMetricEvents() {
  try {
    console.log(`[Cleanup] Iniciando limpeza de eventos de métricas com mais de ${RETENTION_HOURS}h...`);
    
    const cutoffDate = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000);
    
    const result = await db
      .deleteFrom('table_metric_events')
      .where('created_at', '<', cutoffDate)
      .executeTakeFirst();
    
    const deletedCount = Number(result.numDeletedRows || 0);
    
    console.log(`[Cleanup] ✅ Removidos ${deletedCount} eventos antigos (antes de ${cutoffDate.toISOString()})`);
    
    // Estatísticas pós-limpeza
    const stats = await db
      .selectFrom('table_metric_events')
      .select([
        sql<number>`COUNT(*)`.as('total_events'),
        sql<string>`MIN(created_at)`.as('oldest_event'),
        sql<string>`MAX(created_at)`.as('newest_event'),
      ])
      .executeTakeFirst();
    
    console.log('[Cleanup] Estatísticas atuais:');
    console.log(`  - Total de eventos: ${stats?.total_events || 0}`);
    console.log(`  - Evento mais antigo: ${stats?.oldest_event || 'N/A'}`);
    console.log(`  - Evento mais recente: ${stats?.newest_event || 'N/A'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('[Cleanup] ❌ Erro ao limpar eventos:', error);
    process.exit(1);
  }
}

cleanupOldMetricEvents();
