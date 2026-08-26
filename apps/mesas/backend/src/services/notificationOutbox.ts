import { randomUUID } from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import { db } from '../db/index.js';
import type { Database } from '../db/types.js';

// ============================================================================
// T7.4b (spec 096) — enfileiramento de notificação no outbox local
//
// O mesas para de gravar em `notifications` e passa a ser PRODUTOR do par
// consolidado do `accounts.`, exatamente como a T4.0k decidiu em 2026-08-24 e
// como o `downloads` já faz desde a spec 090.
//
// Este módulo só ENFILEIRA — dentro da transação da ação de mérito, quando há
// uma. A entrega HTTP vive em `notificationOutboxDelivery.ts` e roda fora de
// qualquer transação. Essa separação é o ponto todo: era ela que faltava, e sem
// ela os 7 INSERTs dentro de `trx` (`systemSuggestionsAdmin.ts`) faziam uma
// falha de notificação reverter a aprovação da sugestão.
// ============================================================================

/**
 * Vocabulário de evento do mesas. Prefixado pelo módulo para não colidir com
 * `comment.*`/`moderation.*` do registro central do `accounts.`.
 *
 * Deriva do que o mesas já emitia em `notifications.type`: os três tipos de
 * usuário (`suggestion_approved`, `suggestion_rejected`, `system`) e os cinco
 * do feed do admin (`AdminNotificationType`).
 */
export type MesasEventType =
  | 'mesas.suggestion.approved'
  | 'mesas.suggestion.rejected'
  | 'mesas.system.notice'
  | 'mesas.admin.system_suggestion'
  | 'mesas.admin.scenario_suggestion'
  | 'mesas.admin.table_published'
  | 'mesas.admin.member_joined'
  | 'mesas.admin.dev_feedback';

/**
 * Traduz `mesas.users.id` (id LOCAL) para o id que o `accounts.` entende.
 *
 * **Medido em 2026-08-25, e é a razão de esta função existir:** dos 88 usuários
 * do mesas, ZERO têm `id` igual ao id central — mandar o id local faria o INSERT
 * do recibo bater na FK `recipient_user_id REFERENCES users(id)` do accounts
 * (`migration_006:508`), aviso por aviso.
 *
 * O campo que carrega o id central é `users.google_id`, como
 * `community/accountsProxy.ts:39-47` já documentava para a fachada de
 * comentários. Mas ele NÃO é uniforme: 74 dos 88 guardam o UUID do accounts, e
 * 14 (contas de abr–jun/2026, anteriores à convenção atual) guardam o
 * `google_sub` cru de 21 dígitos — desses, só 8 existem no accounts.
 *
 * Por isso o filtro por formato, e não um `?? id`: `google_sub` de 21 dígitos
 * não passa no `z.array(z.string().uuid())` do ingest e derrubaria o lote
 * inteiro com um `400` genérico — exatamente o incidente de 2026-08-18 que o
 * AGENTS.md registra (o mesas mandou `google_id` de 21 dígitos onde o pacote
 * exigia `z.uuid()`, e o sintoma apareceu sete camadas depois).
 *
 * Destinatário que não resolve é OMITIDO, com log: melhor um aviso a menos e
 * rastreável do que o lote inteiro rejeitado. A limpeza dos 14 registros é
 * escrita em produção e corre por fora.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveAccountsUserIds(
  localUserIds: string[],
  executor: Kysely<Database> | Transaction<Database> = db,
): Promise<string[]> {
  if (localUserIds.length === 0) return [];

  const rows = await executor
    .selectFrom('users')
    .select(['id', 'google_id'])
    .where('id', 'in', localUserIds)
    .execute();

  const resolved: string[] = [];
  for (const row of rows) {
    const centralId = row.google_id;
    if (typeof centralId === 'string' && UUID_RE.test(centralId)) {
      resolved.push(centralId);
      continue;
    }
    console.warn(
      `[notificationOutbox] destinatário ${row.id} sem id central em formato UUID (google_id legado) — aviso omitido.`,
    );
  }
  return resolved;
}

export interface EnqueueNotificationInput {
  eventType: MesasEventType;
  subjectType: string;
  subjectId: string;
  /** Path relativo — validado aqui e pelo CHECK da migration_163. */
  canonicalPath: string;
  /**
   * Estruturado, nunca mensagem pronta. `title`/`message` do formato legado
   * entram aqui como campos do snapshot: o `accounts.` monta o texto final.
   */
  snapshot: Record<string, unknown>;
  /**
   * `mesas.users.id` dos destinatários — id LOCAL. A tradução para o id central
   * acontece aqui dentro (`resolveAccountsUserIds`), de propósito: deixá-la a
   * cargo de cada chamador seria pedir que 12 pontos de emissão lembrassem de um
   * detalhe cujo esquecimento não quebra compilação nem teste, só falha em
   * produção na FK do accounts.
   */
  recipients: string[];
}

/**
 * Espelha o CHECK de `canonical_path` da migration_163 e o do ingest do
 * `accounts.`. Validar na origem transforma path inválido em erro visível no
 * teste, em vez de 400 silencioso no sweep — depois de a ação já ter commitado,
 * quando não há mais o que fazer além de registrar o erro.
 *
 * O ingest do `accounts.` documenta que os paths legados do mesas são montados
 * por interpolação sem validação e que há casos degenerados com fallback vazio
 * (`notificationIngestRoutes.ts:58-61`) — por isso a checagem existe dos dois
 * lados.
 */
export function isValidCanonicalPath(value: string): boolean {
  return (
    value.length >= 1
    && value.length <= 1024
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !value.includes('://')
  );
}

/**
 * Enfileira um evento para entrega ao `accounts.`.
 *
 * Passe `trx` sempre que houver transação em curso: é o que garante que o aviso
 * não se perca se o processo cair entre o commit e o envio, e que ele NÃO seja
 * emitido se a ação de mérito for revertida.
 *
 * Destinatário vazio é no-op silencioso e não erro: `notifyAdmins` já tratava
 * "nenhum admin" assim (`adminNotifications.ts:35`), e nada há a notificar.
 */
export async function enqueueNotification(
  input: EnqueueNotificationInput,
  executor: Kysely<Database> | Transaction<Database> = db,
): Promise<string | null> {
  // ANTES de qualquer early return por destinatário (achado real, review PR
  // #289, inline): validar depois tornava o defeito INTERMITENTE — chamador com
  // path quebrado cujos destinatários caíssem todos no formato legado saía
  // `null` em silêncio, e o erro só aparecia quando outro usuário recebesse o
  // mesmo aviso. Path é propriedade do chamador, não do destinatário.
  if (!isValidCanonicalPath(input.canonicalPath)) {
    throw new Error(`canonical_path inválido: ${input.canonicalPath.slice(0, 120)}`);
  }

  const localIds = input.recipients.filter(
    (id) => typeof id === 'string' && id.trim().length > 0,
  );
  if (localIds.length === 0) return null;

  const recipients = await resolveAccountsUserIds(localIds, executor);
  // Todos os destinatários caíram no formato legado. Nada a enfileirar — e o
  // `resolveAccountsUserIds` já registrou cada um no log.
  if (recipients.length === 0) return null;

  const eventId = randomUUID();
  await executor
    .insertInto('mesas_notification_outbox')
    .values({
      event_id: eventId,
      event_type: input.eventType,
      event_version: 1,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      canonical_path: input.canonicalPath,
      snapshot: JSON.stringify(input.snapshot),
      recipients: JSON.stringify(recipients),
    })
    .execute();

  return eventId;
}
