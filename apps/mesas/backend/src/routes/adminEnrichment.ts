import { Router, Request, Response } from 'express';
import { db } from '../db';
import { prodDb } from '../db/prod';
import { authMiddleware } from '../middleware/auth';
import { sql, type Insertable, type Updateable } from 'kysely';
import { SYNC_FIELDS } from '../hydration/config';
import type { Database } from '../db/types';

const router = Router();

interface EnrichmentLogEntry {
  table: string;
  candidates: number;
  inserted: number;
  updated: number;
  ignored: number;
}

router.post('/sync/enrich', authMiddleware, async (req: Request, res: Response) => {
  const userRole = req.user?.role;
  const userId = req.user?.userId;

  if (!userId || userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return res.status(403).json({ error: 'ABORT: Execução bloqueada em ambiente de produção.' });
  }

  const dryRun = req.query.dry_run === 'true';
  const logs: EnrichmentLogEntry[] = [];

  try {
    await prodDb.selectFrom('users').select('id').limit(1).execute();
    // T006: Transação única
    await db.transaction().execute(async (trx) => {

      // T008: Ordem topológica de FKs
      const tablesToSync = [
        // Raízes
        'systems', 'scenarios', 'platforms', 'tags', 'vtt_platforms', 'communication_platforms', 'sources',
        // Extensões
        'scenario_aliases', 'scenario_suggestions', 'system_aliases', 'system_suggestions', 'vtt_platform_suggestions', 'setting_style_suggestions',
        // Identidade
        'users',
        // Dependentes diretos
        'auth_providers', 'profiles', 'player_profiles', 'gm_profiles', 'user_preferences', 'user_links', 'user_systems',
        // Negócio
        'tables',
        // Agregados
        'table_contacts', 'table_platforms', 'table_schedules', 'table_tags', 'table_history', 'imported_tables', 'table_metrics', 'gm_profile_metrics',
        // Interativos
        'bookmarks', 'table_interests', 'questions', 'reviews',
        // Folhas
        'answers'
      ] as const;

      for (const tableName of tablesToSync) {
        // Obter registros de Prod com identificadores semânticos para FKs
        // Registros são heterogêneos entre tabelas (colunas variam por tableName);
        // Record<string, unknown> reflete o shape real dinâmico vindo do prodDb.
        let prodRecords: Record<string, unknown>[];

        if (tableName === 'tables') {
          // T003-T006: Export com LEFT JOINs para capturar slugs das FKs
          prodRecords = await prodDb
            .selectFrom('tables')
            .leftJoin('communication_platforms', 'tables.communication_platform_id', 'communication_platforms.id')
            .leftJoin('vtt_platforms', 'tables.vtt_platform_id', 'vtt_platforms.id')
            .leftJoin('systems', 'tables.system_id', 'systems.id')
            .leftJoin('scenarios', 'tables.scenario_id', 'scenarios.id')
            .selectAll('tables')
            .select([
              'communication_platforms.slug as communication_platform_slug',
              'vtt_platforms.slug as vtt_platform_slug',
              'systems.slug as system_slug',
              'scenarios.slug as scenario_slug'
            ])
            .execute();
        } else {
          prodRecords = await prodDb.selectFrom(tableName as keyof Database).selectAll().execute();
        }

        // T010: Contadores
        const candidates = prodRecords.length;
        let inserted = 0;
        let updated = 0;
        let ignored = 0;

        for (const record of prodRecords) {
          try {
            // T009: Tratamento de PII e exclusão de colunas
            const rawSafeRecord = { ...record };

            if (tableName === 'users') {
              rawSafeRecord.email = `fake_${record.id}@example.com`;
              rawSafeRecord.google_id = `fake_${record.id}`;
              rawSafeRecord.refresh_token = null;
              rawSafeRecord.location = null;
            }
            if (tableName === 'auth_providers') {
              rawSafeRecord.provider_user_id = `fake_${record.id}`;
              rawSafeRecord.provider_data = null;
            }
            if (tableName === 'gm_profiles') {
              rawSafeRecord.discord_id = null;
              rawSafeRecord.discord_username = null;
              rawSafeRecord.contact_methods = null;
            }
            if (tableName === 'table_contacts') {
              rawSafeRecord.value = 'dummy_contact';
              if (rawSafeRecord.channel === 'discord') {
                rawSafeRecord.discord_server_url = 'https://discord.gg/dummy';
              } else {
                rawSafeRecord.discord_server_url = null;
              }
            }
            if (tableName === 'profiles') {
              rawSafeRecord.display_name = `User_${record.id}`;
              rawSafeRecord.avatar_url = null;
            }
            if (tableName === 'user_links') {
              rawSafeRecord.url = 'https://dummy.link';
            }

            const allowedFields = SYNC_FIELDS[tableName];
            if (!allowedFields) {
              console.warn(`[Enrichment] Tabela ${tableName} sem allowlist definida — pulando`);
              continue;
            }
            const safeRecord = Object.fromEntries(
              Object.entries(rawSafeRecord).filter(([key]) => allowedFields.includes(key))
            );

            const updateObj = { ...safeRecord };
            delete updateObj.id;
            delete updateObj.created_at;

            let result: { xmax: string } | undefined;

            switch (tableName) {
              // 1) CATÁLOGO (ON CONFLICT slug/url/composite DO UPDATE)
              case 'systems':
              case 'scenarios':
              case 'platforms':
              case 'tags':
              case 'vtt_platforms':
              case 'communication_platforms':
                delete updateObj.slug;
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('slug').doUpdateSet(updateObj))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'sources':
                delete updateObj.url;
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('url').doUpdateSet(updateObj))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'scenario_aliases':
                delete updateObj.alias_slug;
                delete updateObj.scenario_id;
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.columns(['scenario_id', 'alias_slug']).doUpdateSet(updateObj))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'system_aliases':
                delete updateObj.alias_slug;
                delete updateObj.system_id;
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.columns(['system_id', 'alias_slug']).doUpdateSet(updateObj))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'setting_style_suggestions':
                delete updateObj.setting_name;
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('setting_name').doUpdateSet(updateObj))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              // 2) SUGGESTIONS (ON CONFLICT id DO NOTHING)
              case 'vtt_platform_suggestions':
              case 'scenario_suggestions':
              case 'system_suggestions':
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('id').doNothing())
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              // 3) MESAS (ON CONFLICT id DO UPDATE) - COM RESOLUÇÃO SEMÂNTICA DE FKs
              case 'tables': {
                // T007-T010: Resolver FKs via subqueries por slug
                const resolvedRecord: Record<string, unknown> = { ...safeRecord };
                const communicationPlatformSlug = record.communication_platform_slug;
                const vttPlatformSlug = record.vtt_platform_slug;
                const systemSlug = record.system_slug;
                const scenarioSlug = record.scenario_slug;

                // T007: Resolver communication_platform_id por slug
                if (typeof communicationPlatformSlug === 'string' && communicationPlatformSlug) {
                  const cpResult = await trx
                    .selectFrom('communication_platforms')
                    .select('id')
                    .where('slug', '=', communicationPlatformSlug)
                    .executeTakeFirst();

                  if (!cpResult) {
                    // T011: FK órfã - skip com warning
                    console.warn(`[Enrichment] FK órfã: tabela=tables id=${record.id} communication_platform_slug=${communicationPlatformSlug}`);
                    ignored++;
                    continue;
                  }
                  resolvedRecord.communication_platform_id = cpResult.id;
                }

                // T008: Resolver vtt_platform_id por slug
                if (typeof vttPlatformSlug === 'string' && vttPlatformSlug) {
                  const vttResult = await trx
                    .selectFrom('vtt_platforms')
                    .select('id')
                    .where('slug', '=', vttPlatformSlug)
                    .executeTakeFirst();

                  if (!vttResult) {
                    // T011: FK órfã - skip com warning
                    console.warn(`[Enrichment] FK órfã: tabela=tables id=${record.id} vtt_platform_slug=${vttPlatformSlug}`);
                    ignored++;
                    continue;
                  }
                  resolvedRecord.vtt_platform_id = vttResult.id;
                }

                // T009: Resolver system_id por slug
                if (typeof systemSlug === 'string' && systemSlug) {
                  const sysResult = await trx
                    .selectFrom('systems')
                    .select('id')
                    .where('slug', '=', systemSlug)
                    .executeTakeFirst();

                  if (!sysResult) {
                    // T011: FK órfã - skip com warning
                    console.warn(`[Enrichment] FK órfã: tabela=tables id=${record.id} system_slug=${systemSlug}`);
                    ignored++;
                    continue;
                  }
                  resolvedRecord.system_id = sysResult.id;
                }

                // T010: Resolver scenario_id por slug
                if (typeof scenarioSlug === 'string' && scenarioSlug) {
                  const scResult = await trx
                    .selectFrom('scenarios')
                    .select('id')
                    .where('slug', '=', scenarioSlug)
                    .executeTakeFirst();

                  if (!scResult) {
                    // T011: FK órfã - skip com warning
                    console.warn(`[Enrichment] FK órfã: tabela=tables id=${record.id} scenario_slug=${scenarioSlug}`);
                    ignored++;
                    continue;
                  }
                  resolvedRecord.scenario_id = scResult.id;
                }

                // Remover campos de slug do registro final (não existem no schema)
                delete resolvedRecord.communication_platform_slug;
                delete resolvedRecord.vtt_platform_slug;
                delete resolvedRecord.system_slug;
                delete resolvedRecord.scenario_slug;

                const updateObjTables: Record<string, unknown> = { ...resolvedRecord };
                delete updateObjTables.id;
                delete updateObjTables.created_at;

                result = await trx.insertInto('tables')
                  .values(resolvedRecord as unknown as Insertable<Database['tables']>)
                  .onConflict((oc) => oc.column('id').doUpdateSet(updateObjTables as Updateable<Database['tables']>))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;
              }

              case 'table_contacts':
              case 'table_schedules':
              case 'table_history':
              case 'imported_tables':
              case 'table_interests':
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('id').doUpdateSet(updateObj))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'table_metrics':
                delete updateObj.table_id;
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('table_id').doUpdateSet(updateObj))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              // MESAS - COMPOSTAS (ON CONFLICT PK DO UPDATE/NOTHING)
              // table_platforms/table_tags não existem em `Database` (tabelas legadas sem
              // definição de schema tipado) — withTables() declara o shape mínimo localmente
              // para manter segurança de tipos sem introduzir `any`.
              case 'table_platforms': {
                delete updateObj.table_id;
                delete updateObj.platform_id;
                const legacyTrx = trx.withTables<{
                  table_platforms: { table_id: string; platform_id: string; [key: string]: unknown };
                }>();
                if (Object.keys(updateObj).length > 0) {
                  result = await legacyTrx.insertInto('table_platforms')
                    .values(safeRecord as Insertable<{ table_id: string; platform_id: string; [key: string]: unknown }>)
                    .onConflict((oc) => oc.columns(['table_id', 'platform_id']).doUpdateSet(updateObj))
                    .returning(['table_id', sql<string>`xmax`.as('xmax')])
                    .executeTakeFirst();
                } else {
                  result = await legacyTrx.insertInto('table_platforms')
                    .values(safeRecord as Insertable<{ table_id: string; platform_id: string; [key: string]: unknown }>)
                    .onConflict((oc) => oc.columns(['table_id', 'platform_id']).doNothing())
                    .returning(['table_id', sql<string>`xmax`.as('xmax')])
                    .executeTakeFirst();
                }
                break;
              }

              case 'table_tags': {
                delete updateObj.table_id;
                delete updateObj.tag_id;
                const legacyTrx = trx.withTables<{
                  table_tags: { table_id: string; tag_id: string; [key: string]: unknown };
                }>();
                if (Object.keys(updateObj).length > 0) {
                  result = await legacyTrx.insertInto('table_tags')
                    .values(safeRecord as Insertable<{ table_id: string; tag_id: string; [key: string]: unknown }>)
                    .onConflict((oc) => oc.columns(['table_id', 'tag_id']).doUpdateSet(updateObj))
                    .returning(['table_id', sql<string>`xmax`.as('xmax')])
                    .executeTakeFirst();
                } else {
                  result = await legacyTrx.insertInto('table_tags')
                    .values(safeRecord as Insertable<{ table_id: string; tag_id: string; [key: string]: unknown }>)
                    .onConflict((oc) => oc.columns(['table_id', 'tag_id']).doNothing())
                    .returning(['table_id', sql<string>`xmax`.as('xmax')])
                    .executeTakeFirst();
                }
                break;
              }

              // 4 e 5) IDENTIDADE e INTERAÇÕES (ON CONFLICT id/PK DO NOTHING)
              case 'users':
              case 'profiles':
              case 'gm_profiles':
              case 'user_preferences':
              case 'user_links':
              case 'questions':
              case 'answers':
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('id').doNothing())
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'gm_profile_metrics':
                delete updateObj.gm_profile_id;
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('gm_profile_id').doUpdateSet(updateObj))
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'player_profiles':
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('user_id').doNothing())
                  .returning(['user_id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'auth_providers':
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('id').doNothing())
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'user_systems':
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.column('id').doNothing())
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'bookmarks':
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.columns(['user_id', 'table_id']).doNothing())
                  .returning(['user_id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              case 'reviews':
                result = await trx.insertInto(tableName as keyof Database)
                  .values(safeRecord)
                  .onConflict((oc) => oc.columns(['table_id', 'user_id']).doNothing())
                  .returning(['id', sql<string>`xmax`.as('xmax')])
                  .executeTakeFirst();
                break;

              default:
                throw new Error(`Tabela ${tableName} não tem estratégia de hidratação definida no switch`);
            }

            if (!result) {
              ignored++;
            } else       if (result.xmax === '0') {
              inserted++;
            } else {
              updated++;
            }
          } catch (e) {
            // T009/spec: Se der erro de FK por estar órfão, apenas ignora
            const pgError = e && typeof e === 'object' ? (e as Record<string, unknown>) : undefined;
            if (pgError?.code === '23503') { // foreign_key_violation
              console.warn(`[Enrichment] FK violation: tabela=${tableName} id=${record.id}`, {
                error: pgError.message,
                detail: pgError.detail,
                constraint: pgError.constraint
              });
              ignored++;
            } else {
              throw e;
            }
          }
        }

        logs.push({
          table: tableName,
          candidates,
          inserted,
          updated,
          ignored
        });
      }

      if (dryRun) {
        // T007: Rollback for dry_run
        throw new Error('DRY_RUN_ROLLBACK');
      }
    });

    // T011: Retornar payload
    return res.json({ success: true, dry_run: dryRun, data: { tables: logs } });

  } catch (error) {
    if (error instanceof Error && error.message === 'DRY_RUN_ROLLBACK') {
      return res.json({ success: true, dry_run: true, data: { tables: logs } });
    }
    console.error('[Enrichment]', error);
    return res.status(500).json({ error: 'Erro durante o enriquecimento' });
  }
});

export default router;
