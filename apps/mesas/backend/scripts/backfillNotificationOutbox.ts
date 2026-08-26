/**
 * T7.4b (spec 096) — backfill do histórico de `notifications` para o outbox.
 *
 * Lê as notificações que o mesas gravou na tabela própria e as enfileira em
 * `mesas_notification_outbox`, preservando o `created_at` original como
 * `occurred_at` — sem isso o sino do usuário reordenaria o histórico inteiro
 * pela hora do backfill.
 *
 * **Não escreve no `accounts.` diretamente**: enfileira, e a entrega normal
 * (sweep ou disparo) faz o POST. Assim o backfill herda de graça a idempotência
 * por `event_id`, o retry e o registro de erro — rodar duas vezes não duplica
 * aviso, porque o `event_id` é derivado do id da notificação (v5-like: o mesmo
 * id de origem sempre gera o mesmo `event_id`).
 *
 * Medido em 2026-08-25 (produção): 70 notificações, 62 não lidas —
 * 41 `suggestion_rejected`, 28 `suggestion_approved`, 1 `system`. Dessas, 69 têm
 * destinatário com id central resolvível; 1 cai no `google_id` legado de 21
 * dígitos e é PULADA com registro, não silenciosamente.
 *
 * Uso (dry-run é o default — nada é gravado sem `--apply`):
 *   tsx scripts/backfillNotificationOutbox.ts
 *   tsx scripts/backfillNotificationOutbox.ts --apply
 */
import { createHash } from 'node:crypto';
import { db } from '../src/db/index.js';

/** `notifications.type` → `event_type` do registro central. */
const EVENT_TYPE: Record<string, string> = {
  suggestion_approved: 'mesas.suggestion.approved',
  suggestion_rejected: 'mesas.suggestion.rejected',
  system: 'mesas.system.notice',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `event_id` DERIVADO do id da notificação, nunca aleatório.
 *
 * É o que torna o backfill re-executável: o UNIQUE `event_id` do accounts
 * (`migration_006:471`) transforma a segunda execução em no-op, em vez de
 * duplicar 70 avisos no sino de quem já os recebeu.
 */
function deterministicEventId(notificationId: string): string {
  const hash = createHash('sha256').update(`mesas:notification:${notificationId}`).digest('hex');
  // Formata como UUID v4-shaped: o ingest valida `z.string().uuid()`.
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

/** Espelha o CHECK da migration_163 e o do ingest. */
function isValidCanonicalPath(value: string): boolean {
  return (
    value.length >= 1
    && value.length <= 1024
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !value.includes('://')
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  const rows = await db
    .selectFrom('notifications as n')
    .innerJoin('users as u', 'u.id', 'n.user_id')
    .select([
      'n.id', 'n.user_id', 'n.type', 'n.title', 'n.message',
      'n.action_url', 'n.metadata', 'n.read', 'n.created_at',
      'u.google_id',
    ])
    .orderBy('n.created_at', 'asc')
    .execute();

  let enfileirados = 0;
  const pulados: Array<{ id: string; motivo: string }> = [];

  for (const row of rows) {
    const eventType = EVENT_TYPE[row.type as string];
    if (!eventType) {
      pulados.push({ id: row.id, motivo: `type desconhecido: ${String(row.type)}` });
      continue;
    }

    const centralId = row.google_id;
    if (typeof centralId !== 'string' || !UUID_RE.test(centralId)) {
      pulados.push({ id: row.id, motivo: `destinatário ${row.user_id} sem id central em UUID` });
      continue;
    }

    // `action_url` é a origem do `canonical_path`. Nulo ou degenerado cai no
    // painel — o aviso continua chegando, só sem destino específico.
    const rawPath = typeof row.action_url === 'string' ? row.action_url : '';
    const canonicalPath = isValidCanonicalPath(rawPath) ? rawPath : '/gestao';

    if (!apply) {
      enfileirados++;
      continue;
    }

    await db
      .insertInto('mesas_notification_outbox')
      .values({
        event_id: deterministicEventId(row.id),
        event_type: eventType,
        event_version: 1,
        subject_type: 'legacy_notification',
        subject_id: row.id,
        canonical_path: canonicalPath,
        snapshot: JSON.stringify({
          legacy_type: row.type,
          title: row.title,
          message: row.message,
          backfilled: true,
          // Preserva o estado de leitura: quem já leu no sino antigo não deve
          // reencontrar o aviso como não lido.
          already_read: row.read === true,
          ...asRecord(row.metadata),
        }),
        recipients: JSON.stringify([centralId]),
        // Hora do FATO, não do backfill.
        created_at: row.created_at,
      })
      .onConflict((oc) => oc.column('event_id').doNothing())
      .execute();
    enfileirados++;
  }

  console.log(`[backfill] lidas: ${rows.length}`);
  console.log(`[backfill] ${apply ? 'enfileiradas' : 'seriam enfileiradas'}: ${enfileirados}`);
  console.log(`[backfill] puladas: ${pulados.length}`);
  for (const p of pulados) console.log(`  - ${p.id}: ${p.motivo}`);
  if (!apply) console.log('[backfill] DRY-RUN — nada foi gravado. Rode com --apply para valer.');

  await db.destroy();
}

main().catch((error: unknown) => {
  console.error('[backfill] falhou:', error);
  process.exitCode = 1;
});
