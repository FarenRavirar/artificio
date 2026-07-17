/**
 * Learning-store determinístico (Spec 052 / D087).
 *
 * Correções humanas (Fase G) viram cache `campo + token normalizado → valor`.
 * No parse de baixa confiança, este store é consultado ANTES da IA: cache hit
 * resolve o campo sem gastar token de IA; só cache miss cai pro provider (DeepSeek).
 *
 * Camadas (do mais barato pro mais caro):
 *   parser determinístico → lookupFieldLearning (custo zero token) → IA (DeepSeek)
 *
 * Escopo: regra é por guild; lookup tenta guild-specific e cai pra global
 * (guild_id NULL). Guardas: `active` (desliga regra ruim), `rejections` (valor
 * aprendido re-corrigido), `applied_count`/`last_applied_at` (uso/poda).
 */
import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';
import { db } from '../db';
import type { Database } from '../db/types';

/** Campos elegíveis ao aprendizado de LABEL (espelha o FIELD_MAP de aiSuggestions).
 * Usado por `label_alias` (learningRules.ts) — aprende "rótulo → campo", não
 * "valor → valor", então é seguro incluir rules_notes aqui. */
export const LEARNABLE_FIELDS = [
  'title',
  'system_name',
  'day_of_week',
  'start_time',
  'slots_total',
  'slots_open',
  'price_type',
  'price_value',
  'contact_url',
  'description',
  'rules_notes',
] as const;

export type LearnableField = (typeof LEARNABLE_FIELDS)[number];

/**
 * Achado Codex (PR #173): rules_notes é texto livre por natureza (regras de
 * cada comunidade não se repetem entre mesas) — incluí-lo na mesma lista
 * usada por `lookupFieldLearning`/`recordFieldLearning` (mecanismo
 * `key_type='value'`, token de entrada→valor de saída reaproveitável entre
 * anúncios) criaria regra "regras da mesa X → aplica na mesa Y", que não faz
 * sentido nenhum. Lista separada, sem rules_notes, só pro mecanismo de
 * valor — LEARNABLE_FIELDS continua servindo label_alias (aprender rótulo,
 * não valor).
 */
const VALUE_LEARNABLE_FIELDS = LEARNABLE_FIELDS.filter((field) => field !== 'rules_notes');

/** Tipo de chave: 'value' (token = valor de entrada) hoje; 'label' = futuro (DEB-052-02). */
export type FieldLearningKeyType = 'value' | 'label';

const VALUE_LEARNABLE_SET = new Set<string>(VALUE_LEARNABLE_FIELDS);

/** Normaliza um valor em token estável de busca (NFD, sem acento, minúsculo, espaços colapsados). */
export function normalizeToken(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const raw = typeof value === 'string' ? value : String(value);
  const token = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  return token.length > 0 ? token : null;
}

/** Entrada de consulta: campo + valor cru (do parser) a ser normalizado. */
export interface FieldLookupQuery {
  field: string;
  value: unknown;
}

/** Resultado de cache hit. */
export interface FieldLearningHit {
  field: string;
  value: unknown;
}

/**
 * Consulta o store (token-zero de IA) para os campos fornecidos. Prefere regra
 * do `guildId` e cai pra global (guild_id NULL). Só regras `active`. Em hit,
 * incrementa `applied_count`/`last_applied_at` (best-effort). Erro de DB → vazio.
 */
export async function lookupFieldLearning(
  queries: FieldLookupQuery[],
  guildId: string | null = null,
  keyType: FieldLearningKeyType = 'value',
  conn: Kysely<Database> = db,
): Promise<FieldLearningHit[]> {
  const keyed = queries
    .map((q) => ({ field: q.field, token: normalizeToken(q.value) }))
    .filter((q): q is { field: string; token: string } => q.token !== null && VALUE_LEARNABLE_SET.has(q.field));
  if (keyed.length === 0) return [];

  try {
    const hits: FieldLearningHit[] = [];
    for (const { field, token } of keyed) {
      let query = conn
        .selectFrom('discord_field_learning')
        .select(['id', 'output_value'])
        .where('field', '=', field)
        .where('input_token', '=', token)
        .where('key_type', '=', keyType)
        .where('active', '=', true);

      query = guildId
        ? query.where((eb) => eb.or([eb('guild_id', '=', guildId), eb('guild_id', 'is', null)]))
        : query.where('guild_id', 'is', null);

      // Prefere regra específica do guild (guild_id não-nulo) sobre a global.
      const row = await query
        .orderBy(sql`guild_id IS NULL`)
        .limit(1)
        .executeTakeFirst();

      if (row) {
        hits.push({ field, value: row.output_value });
        // best-effort: marca uso (não bloqueia o parse se falhar)
        await conn
          .updateTable('discord_field_learning')
          .set({ applied_count: sql`applied_count + 1`, last_applied_at: sql`NOW()` })
          .where('id', '=', row.id)
          .execute()
          .catch(() => {});
      }
    }
    return hits;
  } catch (err) {
    console.error('[lookupFieldLearning]', err instanceof Error ? err.message : 'unknown error');
    return [];
  }
}

/** Uma correção a memorizar: campo, valor cru de entrada, valor correto. */
export interface FieldLearningEntry {
  field: string;
  inputValue: unknown;
  outputValue: unknown;
}

/**
 * Grava/atualiza correções no store (upsert por field+token+guild+key_type).
 * Reforço: `hits + 1`. Se o valor aprendido mudou (regra anterior estava errada
 * e foi re-corrigida), incrementa `rejections`. Reativa a regra (`active=true`).
 * Aceita transação para participar do commit da correção. Nunca lança.
 */
export async function recordFieldLearning(
  entries: FieldLearningEntry[],
  guildId: string | null,
  userId: string | null,
  conn: Kysely<Database> | Transaction<Database> = db,
  keyType: FieldLearningKeyType = 'value',
): Promise<void> {
  for (const entry of entries) {
    if (!VALUE_LEARNABLE_SET.has(entry.field)) continue;
    const token = normalizeToken(entry.inputValue);
    if (token === null) continue; // sem token de entrada (campo faltante) — futuro: key_type 'label'
    if (entry.outputValue === null || entry.outputValue === undefined || entry.outputValue === '') continue;

    const outJson = JSON.stringify(entry.outputValue);
    try {
      await conn
        .insertInto('discord_field_learning')
        .values({
          field: entry.field,
          input_token: token,
          output_value: outJson,
          guild_id: guildId,
          key_type: keyType,
          last_corrected_by: userId,
        })
        .onConflict((oc) =>
          oc.columns(['field', 'input_token', 'guild_id', 'key_type']).doUpdateSet({
            // regra anterior diferente = foi re-corrigida → conta rejeição
            rejections: sql`CASE WHEN discord_field_learning.output_value IS DISTINCT FROM ${outJson}::jsonb THEN discord_field_learning.rejections + 1 ELSE discord_field_learning.rejections END`,
            output_value: outJson,
            hits: sql`discord_field_learning.hits + 1`,
            active: true,
            last_corrected_by: userId,
            updated_at: sql`NOW()`,
          }),
        )
        .execute();
    } catch (err) {
      console.error('[recordFieldLearning]', err instanceof Error ? err.message : 'unknown error');
    }
  }
}
