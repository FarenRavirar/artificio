import { sql } from 'kysely';
import { db } from '../db';

/** Idade (dias) após a publicação a partir da qual uma mesa é auto-arquivada. D-MESAS1. */
export const AUTO_ARCHIVE_AFTER_DAYS = 30;

export interface ArchivedTableRow {
  id: string;
  slug: string;
  title: string;
}

/**
 * Arquiva mesas "antigas" (D-MESAS1): publicadas há mais de `afterDays` dias,
 * ainda no catálogo (status `active`/`full`) e ainda não arquivadas.
 * Âncora de idade = `COALESCE(published_at, created_at)` (fallback para mesas
 * publicadas antes da migração 127). Operação idempotente: roda de novo só pega
 * as que cruzaram o limite desde a última execução. Retorna as mesas arquivadas.
 *
 * A política é PROD-only por decisão de produto — o gate de ambiente fica na rota
 * que chama esta função, não aqui (mantém a função testável/reusável).
 */
export async function autoArchiveStaleTables(
  afterDays: number = AUTO_ARCHIVE_AFTER_DAYS,
): Promise<ArchivedTableRow[]> {
  const rows = await db
    .updateTable('tables')
    .set({ archived_at: new Date() })
    .where('archived_at', 'is', null)
    .where('status', 'in', ['active', 'full'])
    .where(
      sql<boolean>`COALESCE(published_at, created_at) < NOW() - (${afterDays} * INTERVAL '1 day')`,
    )
    .returning(['id', 'slug', 'title'])
    .execute();

  return rows as ArchivedTableRow[];
}
