import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Request, Response } from "express";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import { enqueueOutboxEvent, processOutboxPending } from "./notificationOutbox.js";
import {
  requireServiceCredential,
  type ServiceAuthenticatedRequest,
} from "./requireServiceCredential.js";
import {
  communityRateLimit,
  createRateLimitStore,
  type CommunityRateLimitStore,
} from "./communityRateLimit.js";

// ============================================================================
// T3.13 — `POST /internal/v1/notifications/events` (requisito 13a-i)
//
// Rota que faz `downloads` e `mesas` deixarem de ser fonte própria e virarem
// **produtores** do par consolidado. Sem ela, "parar de gravar em tabela
// própria" (spec.md:244, 24e em :320) não tem para onde apontar.
//
// O desenho segue o que 13c-i (spec.md:248) já decidiu: o evento entra
// transacional junto do outbox, o fan-out roda fora. A diferença para
// `communityCommentWrite.ts` é só a origem — lá o produtor é o próprio
// `accounts.`, aqui é outro módulo — e é por isso que `event_id` existe como
// coluna separada de `id` desde migration_006 (ver comentário em
// `communityCommentWrite.ts:496-501`): é a chave de idempotência **do
// produtor**, e só agora passa a ter produtor externo de verdade.
// ============================================================================

/**
 * Corpo da ingestão. `strict()` recusa campo extra pelo mesmo motivo do voto
 * em `communityCommentRoutes.ts`: campo desconhecido ignorado em silêncio faz
 * o chamador acreditar que mandou algo que o servidor nunca leu.
 *
 * O que **não** entra no corpo: `realm` e `source_app`. Eles vêm da credencial
 * resolvida pelo guard, nunca do payload — mesma regra que
 * `requireServiceCredential.ts:16-18` fixa para todos os handlers. Aceitar do
 * corpo permitiria a credencial de `beta` gravar evento marcado `prod`.
 */
const ingestSchema = z
  .object({
    /**
     * Idempotência do produtor (`spec.md` 13c). O módulo gera e repete em
     * retry; o UNIQUE `(realm, source_app, event_id)` de migration_006:471
     * transforma reenvio em no-op em vez de notificação duplicada.
     */
    event_id: z.string().uuid(),
    event_type: z.string().min(1).max(64),
    event_version: z.number().int().positive(),
    subject_type: z.string().min(1).max(64),
    subject_id: z.string().min(1).max(255),
    /**
     * Path relativo validado pelo CHECK de migration_006:480-486. Validar aqui
     * também para devolver 400 legível em vez de 500 de constraint — os paths
     * legados do `mesas` são montados por interpolação sem validação
     * (`gmPanel.ts:575`, `systemSuggestionsAdmin.ts:396`) e há casos
     * degenerados conhecidos com fallback vazio.
     */
    canonical_path: z
      .string()
      .min(1)
      .max(1024)
      .refine((value) => value.startsWith("/"), { message: "deve começar com /" })
      .refine((value) => !value.startsWith("//"), { message: "não pode começar com //" })
      .refine((value) => !value.includes("\\"), { message: "não pode conter barra invertida" })
      .refine((value) => !value.includes("://"), { message: "não pode conter esquema absoluto" }),
    /** Estruturado, nunca mensagem pronta (`spec.md` 13b). */
    snapshot: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()).optional(),
    /**
     * Destinatários resolvidos pelo módulo produtor. O `accounts.` não sabe
     * quem é dono de um material (`plan.md:115-116`), então quem chama informa.
     */
    recipients: z.array(z.string().uuid()).min(1).max(100),
    /**
     * Momento real do fato no módulo de origem. Opcional: ausente vira `now()`.
     * É exatamente o caso que 19b (`spec.md:282`) previu ao exigir índice por
     * `occurred_at` do evento em vez de `created_at` do recibo — evento externo
     * com `occurred_at` retroativo faz as duas ordens divergirem.
     */
    occurred_at: z.string().datetime().optional(),
    /**
     * Marca o recibo como JÁ LIDO no fan-out, em vez do `read_at: null` padrão.
     *
     * Existe só para MIGRAÇÃO DE HISTÓRICO (achado de review, PR #289, Codex
     * P2). O caso concreto: a spec 096 removeu as rotas `/api/v1/notifications`
     * do `mesas`, e o `NotificationBell` passou a ler exclusivamente daqui —
     * então avisos que o usuário já tinha lido na tabela antiga ficariam sem
     * nenhum caminho de leitura. Sem este campo, migrá-los os faria reaparecer
     * como não lidos, inflando o contador do sino de quem já os despachou.
     *
     * NÃO é para uso corrente: evento novo nasce não lido por definição, e
     * produtor que mandar isto num fluxo normal está descrevendo um fato que não
     * aconteceu. Opcional e ausente por padrão, então nenhum produtor atual
     * muda de comportamento (o `downloads` não manda).
     *
     * A listagem já devolve recibo lido (`notificationData.ts` seleciona
     * `read_at` sem filtrar; só `unread-count` filtra), então o aviso migrado
     * aparece no histórico sem contar como pendente — que é o comportamento
     * correto.
     */
    read_at: z.string().datetime().optional(),
  })
  .strict();

async function handleIngestEvent(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const identity = (req as ServiceAuthenticatedRequest).serviceCredential;
  if (!identity) {
    // Defesa em profundidade: o guard já garantiu isso. Sem o early return, um
    // erro de ordem de middleware gravaria evento sem origem.
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  // `read_at` exige escopo próprio (achado de review, PR #289, CodeRabbit).
  //
  // A checagem vem ANTES do parse do corpo, e devolve 403 em vez de 400: o
  // problema não é a forma do payload, é a credencial não ter a capacidade. Um
  // 400 aqui diria ao chamador que o campo está malformado, quando ele está
  // correto e apenas não é permitido para quem pediu.
  if (
    req.body !== null
    && typeof req.body === "object"
    && "read_at" in (req.body as Record<string, unknown>)
    && !identity.scopes.includes("notification.migrate")
  ) {
    res.status(403).json({ error: "forbidden_scope" });
    return;
  }

  const parsed = ingestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const input = parsed.data;

  const eventRowId = await db.transaction().execute(async (trx) => {
    // Idempotência pelo próprio banco, não por check-then-insert.
    //
    // A forma anterior consultava `notification_event` e só então inseria. Duas
    // entregas simultâneas do mesmo `event_id` — o caso normal quando o sweep
    // periódico do produtor roda junto do disparo pós-commit — passavam as duas
    // pela consulta antes de qualquer INSERT commitar: uma inseria, a outra
    // batia no UNIQUE e devolvia 500 num retry legítimo, que é exatamente o que
    // `event_id` existe para tornar inofensivo.
    //
    // `ON CONFLICT DO NOTHING` fecha a janela: o índice único decide, não o
    // intervalo entre SELECT e INSERT. O conflito é em `event_id` sozinho —
    // `migration_006:471` declara `event_id UUID NOT NULL UNIQUE`, e não uma
    // única composta com `realm`/`source_app` (essa é a do recibo, `:514`).
    const rowId = randomUUID();
    const inserted = await trx
      .insertInto("notification_event")
      .values({
        id: rowId,
        event_id: input.event_id,
        realm: identity.realm,
        source_app: identity.sourceApp,
        event_type: input.event_type,
        event_version: input.event_version,
        subject_type: input.subject_type,
        subject_id: input.subject_id,
        // Ator vem nulo: o produtor externo informa destinatário, não autor
        // comunitário. `actor_id` referencia `community_actor`, que só existe
        // para fala — um moderador do `downloads` não tem linha lá.
        actor_id: null,
        canonical_path: input.canonical_path,
        snapshot: input.snapshot,
        metadata: input.metadata ?? null,
        ...(input.occurred_at ? { occurred_at: new Date(input.occurred_at) } : {}),
        // Viaja pelo EVENTO, e não pelo outbox: o fan-out já lê a linha do
        // evento (`notificationOutbox.ts:58`), então não precisa de coluna nova
        // na fila nem de mudança em `enqueueOutboxEvent`.
        read_at: input.read_at ? new Date(input.read_at) : null,
      })
      .onConflict((oc) => oc.column("event_id").doNothing())
      .executeTakeFirst();

    if (Number(inserted.numInsertedOrUpdatedRows) === 0) {
      // Reenvio: o evento já existe. Devolve o `id` real dele — nunca o `rowId`
      // recém-gerado, que não corresponde a nenhuma linha. Enfileirar de novo
      // aqui duplicaria a entrega do mesmo evento.
      const existing = await trx
        .selectFrom("notification_event")
        .select(["id"])
        .where("event_id", "=", input.event_id)
        .executeTakeFirstOrThrow();

      return existing.id;
    }

    // Outbox na MESMA transação: rollback elimina os dois juntos. É o que
    // impede o evento de existir sem entrega e a entrega sem evento. Só roda
    // quando o INSERT de fato criou linha.
    await enqueueOutboxEvent(trx, {
      realm: identity.realm,
      sourceApp: identity.sourceApp,
      eventRowId: rowId,
      recipients: input.recipients,
    });

    return rowId;
  });

  // Fan-out fora da transação, fire-and-forget: é a metade de 13c-i que impede
  // a ação de mérito do módulo chamador de travar esperando entrega. Falha
  // aqui não perde nada — o sweep periódico (`setInterval` no boot) recolhe a
  // entrada pendente.
  void processOutboxPending(db).catch((error: unknown) => {
    console.warn("[notificationIngest] falha no fan-out pós-commit:", error);
  });

  // 202 e não 201: o recibo do destinatário ainda não existe neste ponto, e
  // dizer 201 sugeriria entrega concluída. O que está garantido é a durabilidade
  // do evento, não a entrega.
  res.status(202).json({ event_row_id: eventRowId });
}

export function createNotificationIngestRouter(
  db: Kysely<Database>,
  sharedStore?: CommunityRateLimitStore,
): Router {
  const router = Router();
  const rateLimitStore = sharedStore ?? createRateLimitStore();

  router.post(
    "/internal/v1/notifications/events",
    requireServiceCredential(db, { scope: "notification.write" }),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleIngestEvent(db, req, res).catch(next);
    },
  );

  return router;
}
