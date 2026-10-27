import { createHash } from 'node:crypto';
import { sql } from 'kysely';
import { db } from '../db/index.js';
import { logActivity } from './activityLogger.js';
import { notifyAdmins } from './adminNotifications.js';

/**
 * Spec 106 R19. Erro de cliente chega ao proprio servidor, sem depender de a
 * pessoa abrir o widget de feedback (foi assim que o `redfallen` ficou 13 dias
 * bloqueado sem ninguem saber). Tabela propria no banco do `mesas`: o repasse de
 * stack e `user_id` a terceiro e o que o veto de dados (D12) impede.
 *
 * O endpoint e publico e o `fingerprint` sai de texto do cliente, entao ha tetos
 * contra abuso: fingerprints novos por hora, avisos ao admin por hora e linhas na
 * tabela. Excedente so soma `occurrences` numa linha que ja existe.
 */
export const LIMITS = {
  message: 500,
  stack: 4000,
  componentStack: 4000,
  userAgent: 200,
  routePattern: 200,
  path: 300,
  build: 64,
} as const;

/** Tetos globais. `shortcut:` valores fixos, sem env; revisar se o trafego real pedir. */
export const CEILINGS = {
  newFingerprintsPerHour: 60,
  adminAlertsPerHour: 10,
  maxRows: 5000,
  retentionDays: 90,
} as const;

export interface ClientErrorInput {
  message: string;
  stack: string;
  componentStack: string;
  routePattern: string;
  path: string;
  userAgent: string;
  build: string;
}

const clip = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');

/** Corpo externo → entrada truncada. Nada de header, cookie, IP ou query string. */
export function parseClientErrorBody(body: unknown): ClientErrorInput | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const message = clip(b.message, LIMITS.message).trim();
  if (!message) return null;
  return {
    message,
    stack: clip(b.stack, LIMITS.stack),
    componentStack: clip(b.componentStack, LIMITS.componentStack),
    routePattern: clip(b.routePattern, LIMITS.routePattern),
    // Sem `?` e sem `#`: a query pode carregar token, e-mail, termo de busca.
    path: clip(b.path, LIMITS.path).split(/[?#]/)[0],
    userAgent: clip(b.userAgent, LIMITS.userAgent),
    build: clip(b.build, LIMITS.build),
  };
}

/** Mesma rota + mesma mensagem + mesmo componente = mesmo erro. */
export function clientErrorFingerprint(input: Pick<ClientErrorInput, 'routePattern' | 'message' | 'componentStack'>): string {
  const firstLine = input.componentStack.split('\n').find((l) => l.trim()) ?? '';
  return createHash('sha256')
    .update(`${input.routePattern}\u0000${input.message}\u0000${firstLine.trim()}`)
    .digest('hex')
    .slice(0, 32);
}

export type RecordOutcome = 'created' | 'incremented' | 'throttled';

/** Chave do `pg_advisory_xact_lock` que serializa os tetos; qualquer inteiro fixo serve. */
const QUOTA_LOCK_KEY = 106_019;

/**
 * Upsert por fingerprint. `created` so na primeira ocorrencia; so ela avisa o
 * admin, dentro do teto de avisos por hora (o aviso excedente nao se perde: a
 * linha existe e o painel mostra).
 *
 * Contagem de teto + INSERT numa transacao sob `pg_advisory_xact_lock`: sem a
 * trava, requisicoes simultaneas com fingerprints distintos liam a mesma contagem
 * e passavam juntas do teto (achado de review, PR #342). A trava e curta e o
 * endpoint tem rate limit; o aviso ao admin sai DEPOIS do commit.
 */
export async function recordClientError(input: ClientErrorInput, userId: string | null): Promise<RecordOutcome> {
  const fingerprint = clientErrorFingerprint(input);

  const result = await db.transaction().execute(async (trx) => {
    await trx.selectNoFrom(sql`pg_advisory_xact_lock(${QUOTA_LOCK_KEY})`.as('lock')).execute();

    const existing = await trx.selectFrom('client_errors').select('id').where('fingerprint', '=', fingerprint).executeTakeFirst();

    if (!existing) {
      const [{ recentes }, { total }] = await Promise.all([
        trx
          .selectFrom('client_errors')
          .select(sql<number>`count(*)::int`.as('recentes'))
          .where('first_seen', '>', sql<Date>`now() - interval '1 hour'`)
          .executeTakeFirstOrThrow(),
        trx.selectFrom('client_errors').select(sql<number>`count(*)::int`.as('total')).executeTakeFirstOrThrow(),
      ]);
      if (recentes >= CEILINGS.newFingerprintsPerHour || total >= CEILINGS.maxRows) {
        return { outcome: 'throttled' as const, alertId: null };
      }
    }

    const row = await trx
      .insertInto('client_errors')
      .values({
        fingerprint,
        user_id: userId,
        route_pattern: input.routePattern,
        path: input.path,
        message: input.message,
        stack: input.stack,
        component_stack: input.componentStack,
        user_agent: input.userAgent,
        build: input.build,
      })
      .onConflict((oc) =>
        oc.column('fingerprint').doUpdateSet({
          occurrences: sql`client_errors.occurrences + 1`,
          last_seen: sql`now()`,
        }),
      )
      .returning(['id', sql<boolean>`(xmax = 0)`.as('inserted')])
      .executeTakeFirstOrThrow();

    if (!row.inserted) return { outcome: 'incremented' as const, alertId: null };

    // Teto de avisos contado e gravado sob a mesma trava: o registro entra na
    // contagem da proxima requisicao mesmo se a notificacao falhar.
    const { avisos } = await trx
      .selectFrom('activity_log')
      .select(sql<number>`count(*)::int`.as('avisos'))
      .where('action', '=', 'client_error.first_seen')
      .where('created_at', '>', sql<Date>`now() - interval '1 hour'`)
      .executeTakeFirstOrThrow();
    if (avisos >= CEILINGS.adminAlertsPerHour) return { outcome: 'created' as const, alertId: null };

    await logActivity(
      {
        actorId: null,
        action: 'client_error.first_seen',
        entityType: 'client_error',
        entityId: row.id,
        summary: `Erro de cliente em ${input.routePattern || input.path || '(sem rota)'}: ${input.message.slice(0, 120)}`,
        metadata: { route_pattern: input.routePattern, build: input.build },
      },
      trx,
    );
    return { outcome: 'created' as const, alertId: row.id };
  });

  if (result.alertId) {
    await notifyAdmins({
      type: 'client_error',
      title: 'Erro no navegador de um usuário',
      message: `${input.message.slice(0, 160)} (${input.routePattern || input.path || 'sem rota'})`,
      // A listagem so existe nesta aba; '/gestao' redireciona para a visao geral.
      action_url: '/gestao/sistema?tab=client-errors',
      metadata: { client_error_id: result.alertId },
    });
  }
  return result.outcome;
}

/** Retencao (cron): apaga o que nao reincide ha `retentionDays`. */
export async function purgeOldClientErrors(): Promise<number> {
  const res = await db
    .deleteFrom('client_errors')
    .where('last_seen', '<', sql<Date>`now() - (${CEILINGS.retentionDays} * interval '1 day')`)
    .executeTakeFirst();
  return Number(res.numDeletedRows ?? 0);
}
