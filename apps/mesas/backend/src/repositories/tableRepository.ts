import { db } from '../db';
import { Insertable, Updateable } from 'kysely';
import { TablesTable, TableContactsTable, TableSchedulesTable } from '../db/types';
import { sql } from 'kysely';

export class TableRepository {
  private static baseTableQuery() {
    return db
      .selectFrom('tables as t')
      .leftJoin('systems as s', 's.id', 't.system_id')
      .leftJoin('scenarios as sc', 'sc.id', 't.scenario_id')
      .leftJoin('communication_platforms as cp', 'cp.id', 't.communication_platform_id')
      .selectAll('t')
      .select([
        sql<string | null>`s.name`.as('system_name'),
        sql<string | null>`s.path_slug`.as('system_path'),
        sql<string | null>`sc.name`.as('scenario_name'),
        sql<string | null>`sc.slug`.as('scenario_path'),
        sql<string | null>`COALESCE(cp.name, t.communication_platform)`.as('communication_platform'),
      ]);
  }

  /**
   * Busca mesa por ID e GM
   */
  static async findByIdAndGm(tableId: string, gmProfileId: string) {
    return await this.baseTableQuery()
      .where('t.id', '=', tableId)
      .where('t.gm_id', '=', gmProfileId)
      .executeTakeFirst();
  }

  /**
   * Busca mesa por ID, sem exigir gm_id — uso admin-only (mesa importada
   * tem gm_id: null e nunca bate com findByIdAndGm). Caller precisa
   * garantir role==='admin' antes de chamar (spec 060).
   */
  static async findById(tableId: string) {
    return await this.baseTableQuery()
      .where('t.id', '=', tableId)
      .executeTakeFirst();
  }

  /**
   * Busca contatos da mesa
   */
  static async findContactsByTableId(tableId: string) {
    return await db
      .selectFrom('table_contacts')
      .select(['channel', 'value', 'label', 'discord_server_url', 'sort_order'])
      .where('table_id', '=', tableId)
      .orderBy('sort_order', 'asc')
      .execute();
  }

  /**
   * Busca schedules da mesa
   */
  static async findSchedulesByTableId(tableId: string) {
    return await db
      .selectFrom('table_schedules')
      .selectAll()
      .where('table_id', '=', tableId)
      .orderBy('sort_order', 'asc')
      .execute();
  }

  /**
   * Insere mesa com contatos e schedules em transação
   */
  static async createTableWithRelations(
    tableData: Insertable<TablesTable>,
    contacts: Array<Omit<Insertable<TableContactsTable>, 'table_id'>>,
    schedules?: Array<Omit<Insertable<TableSchedulesTable>, 'table_id'>>
  ) {
    return await db.transaction().execute(async (trx) => {
      const [insertedTable] = await trx
        .insertInto('tables')
        .values(tableData)
        .returning([
          'id',
          'slug',
          'title',
          'status',
          'publisher_role',
          'actual_gm_name',
          'is_ddal',
          'is_covil',
          'ddal_code',
          'ddal_name',
          'ddal_tier',
          'created_at',
        ])
        .execute();

      if (contacts && contacts.length > 0) {
        await trx
          .insertInto('table_contacts')
          .values(
            contacts.map((contact, index) => ({
              table_id: insertedTable.id,
              ...contact,
              sort_order: contact.sort_order ?? index,
            }))
          )
          .execute();
      }

      if (schedules && schedules.length > 0) {
        await trx
          .insertInto('table_schedules')
          .values(
            schedules.map((schedule, index) => ({
              table_id: insertedTable.id,
              ...schedule,
              sort_order: schedule.sort_order ?? index,
            }))
          )
          .execute();
      }

      return insertedTable;
    });
  }

  /**
   * Atualiza mesa com contatos e schedules
   */
  static async updateTableWithRelations(
    tableId: string,
    gmProfileId: string,
    tableData: Updateable<TablesTable>,
    contacts?: Array<Omit<Insertable<TableContactsTable>, 'table_id'>>,
    schedules?: Array<Omit<Insertable<TableSchedulesTable>, 'table_id'>>
  ) {
    return await db.transaction().execute(async (trx) => {
      const [updatedTable] = await trx
        .updateTable('tables')
        .set(tableData)
        .where('id', '=', tableId)
        .where('gm_id', '=', gmProfileId)
        .returning(['id', 'slug', 'title', 'status', 'updated_at'])
        .execute();

      if (!updatedTable) return null;

      if (contacts !== undefined) {
        await trx.deleteFrom('table_contacts').where('table_id', '=', tableId).execute();
        
        if (contacts.length > 0) {
          await trx
            .insertInto('table_contacts')
            .values(
              contacts.map((contact, index) => ({
                table_id: tableId,
                ...contact,
                sort_order: contact.sort_order ?? index,
              }))
            )
            .execute();
        }
      }

      if (schedules !== undefined) {
        await trx.deleteFrom('table_schedules').where('table_id', '=', tableId).execute();
        
        if (schedules.length > 0) {
          await trx
            .insertInto('table_schedules')
            .values(
              schedules.map((schedule, index) => ({
                table_id: tableId,
                ...schedule,
                sort_order: index,
              }))
            )
            .execute();
        }
      }

      return updatedTable;
    });
  }

  /**
   * Deleta mesa com relações
   */
  static async deleteTableWithRelations(tableId: string) {
    return await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('table_schedules').where('table_id', '=', tableId).execute();
      await trx.deleteFrom('table_contacts').where('table_id', '=', tableId).execute();
      await trx.deleteFrom('tables').where('id', '=', tableId).execute();
    });
  }
}