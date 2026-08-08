import { createHash, randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import {
  placeComment,
  resolveNotificationRecipients,
  validateCommentBody,
  type CommentSubjectScope,
  type ParentComment,
} from "@artificio/comments";
import type { Database } from "./db.js";

/**
 * T2.6c — criação e resposta, com evento e recibos **na mesma transação**
 * (decisões 1, 12c, 13c).
 *
 * ## A regra que organiza o arquivo inteiro
 *
 * `spec.md` 13c: "comentário, evento e recibo nascem na mesma transação. Falha
 * reverte o conjunto." Não é preferência de estilo — é a correção explícita do
 * defeito do `downloads`, onde a emissão de notificação é best-effort
 * (`moderation.ts:138-147`, `reports.ts:195`: `try/catch` com `console.error`) e
 * o material é rejeitado sem o autor ficar sabendo (requisito 24d). Aqui, se o
 * recibo falha, o comentário não existe.
 *
 * Consequência prática: **nenhum `try/catch` engole erro** dentro da transação.
 * Um `catch` que registrasse e seguisse recriaria exatamente o bug que a spec
 * manda corrigir.
 *
 * ## Ordem de inserção, e por que ela é forçada pelo schema
 *
 * `community_comment.current_version_id` é `NOT NULL` e aponta para
 * `community_comment_version`, que por sua vez aponta para o comentário — ciclo.
 * O schema resolve com `community_comment_current_version_fk` **DEFERRABLE
 * INITIALLY DEFERRED** (verificado no banco), então a ordem é: gerar os dois
 * UUIDs na aplicação, inserir o comentário, inserir a versão, e o FK valida no
 * `COMMIT`. Gerar o id no banco (`uuid_generate_v4()`) obrigaria dois
 * `RETURNING` e um `UPDATE` extra.
 *
 * ## Idempotência
 *
 * `contrato-http-v1.md` §6: repetição com mesmo payload devolve a resposta
 * original; com payload diferente, `409`/`idempotency_key_reuse`. O registro é
 * `community_idempotency_key` (migration 008), e a estratégia é **inserir
 * primeiro** e tratar a violação de unicidade — nunca `SELECT` antes de `INSERT`,
 * que é o check-before-transaction que §6 nomeia como defeito a não replicar.
 */

/** `contrato-http-v1.md` §6 — retenção de 24 horas. */
const IDEMPOTENCY_RETENTION_HOURS = 24;

/** Versão do formato de `snapshot`. Formato novo incrementa; nunca reinterpreta o antigo. */
const COMMENT_EVENT_VERSION = 1;

const EVENT_TYPE_ROOT = "comment.created";
const EVENT_TYPE_REPLY = "comment.replied";

export interface CreateCommentInput extends CommentSubjectScope {
  /** Derivados da credencial, nunca do payload (`spec.md` 6a). */
  canonicalPath: string;
  /** Afirmado pelo backend do domínio (§8). `null` é legítimo (15a, 15b). */
  ownerUserId: string | null;
  parentId: string | null;
  bodyMarkdown: string;
  actingUserId: string;
  idempotencyKey: string;
}

export type WriteRejectionCode =
  | "parent_not_found"
  | "subject_not_found"
  | "depth_exceeded"
  | "parent_not_accepting_replies"
  | "body_too_long"
  | "body_empty"
  | "INVALID_COMMENT_LINK"
  | "sanctioned"
  | "idempotency_key_reuse";

export interface CreatedComment {
  id: string;
  parent_id: string | null;
  root_id: string;
  depth: number;
  body_markdown: string;
  /**
   * ISO 8601, **string**, não `Date`.
   *
   * A criação recebe `Date` do driver; a repetição idempotente recebe o mesmo
   * campo de volta de `response_body` (`jsonb`), onde ele foi serializado como
   * string. Deixar o tipo como `Date` fazia o mesmo endpoint devolver dois tipos
   * de runtime diferentes conforme fosse a primeira chamada ou o replay — e o
   * `res.json()` esconderia a divergência, porque serializa os dois igual. Quem
   * consome `result.comment.created_at` em código, não em JSON, quebraria só no
   * replay.
   */
  created_at: string;
}

/**
 * Rejeição esperada dentro da transação.
 *
 * Precisa ser **exceção**, não retorno: retornar normalmente faz o Kysely
 * **commitar** a transação, e a linha de `community_idempotency_key` já inserida
 * no passo 1 ficaria gravada para um pedido que falhou. A chave queimaria por 24
 * horas, e o cliente que corrigisse o payload e reenviasse com a mesma chave
 * receberia `409` em vez de criar o comentário.
 */
class CommentWriteRejection extends Error {
  constructor(
    readonly code: WriteRejectionCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "CommentWriteRejection";
  }
}

export type CreateCommentResult =
  | { ok: true; comment: CreatedComment; replayed: boolean }
  | { ok: false; code: WriteRejectionCode; status: number };

/**
 * Hash do payload que define "mesmo pedido" para a idempotência.
 *
 * Inclui o assunto e o pai porque a mesma chave reaproveitada para outro alvo é
 * reuso, não repetição. Não inclui `canonical_path` nem `owner_user_id`: os dois
 * são afirmação do backend do domínio sobre o alvo, e podem mudar entre duas
 * tentativas legítimas do mesmo pedido (post movido de rota, dono vinculado no
 * intervalo) sem que o usuário tenha pedido coisa diferente.
 */
function hashRequest(input: CreateCommentInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.subject_type,
        input.subject_id,
        input.parentId,
        input.bodyMarkdown,
        input.actingUserId,
      ]),
    )
    .digest("hex");
}

/**
 * Ator comunitário do usuário, criado sob demanda.
 *
 * O ator é opaco e separado da conta (`spec.md` 7a): é ele que sobrevive à
 * exclusão da conta preservando conversa e score. Quem comenta pela primeira vez
 * ainda não tem ator — criá-lo aqui, dentro da transação, evita um estado em que
 * o comentário existe sem autor resolvível.
 */
async function resolveOrCreateActor(
  trx: Transaction<Database>,
  userId: string,
): Promise<string> {
  const existing = await trx
    .selectFrom("community_actor_account_link")
    .select("actor_id")
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (existing) return existing.actor_id;

  // `defaultValues()`, não `values({})`. A tabela só tem colunas com default
  // (`id` e `created_at`), e o objeto vazio compila para
  // `INSERT INTO community_actor () VALUES ()` — sintaxe que o PostgreSQL
  // recusa com `syntax error at or near ")"`. O tipo do Kysely aceita `{}`, e o
  // erro só aparece no banco: os testes de rota param antes da transação, e o
  // script de medição escreve o ator por SQL direto, então nenhum dos dois
  // exercitava esta linha. Achado no primeiro smoke real (2026-08-08).
  const actor = await trx
    .insertInto("community_actor")
    .defaultValues()
    .returning("id")
    .executeTakeFirstOrThrow();

  await trx
    .insertInto("community_actor_account_link")
    .values({ actor_id: actor.id, user_id: userId })
    .execute();

  return actor.id;
}

/**
 * Sanção `commenting` ativa bloqueia a escrita (decisão 48, **falha fechada**).
 *
 * "Ativa" é `starts_at <= agora`, sem `lifted_at`, e ou sem `expires_at` ou com
 * `expires_at` no futuro. Uma sanção levantada ou vencida não bloqueia — mas
 * continua no histórico, que é o que permite auditar.
 */
async function hasActiveSanction(
  trx: Transaction<Database>,
  realm: string,
  sourceApp: string,
  actorId: string,
): Promise<boolean> {
  const now = new Date();
  const row = await trx
    .selectFrom("community_restriction")
    .select("id")
    .where("realm", "=", realm)
    .where("source_app", "=", sourceApp)
    .where("actor_id", "=", actorId)
    .where("scope", "=", "commenting")
    .where("lifted_at", "is", null)
    .where("starts_at", "<=", now)
    .where((eb) =>
      eb.or([eb("expires_at", "is", null), eb("expires_at", ">", now)]),
    )
    .executeTakeFirst();

  return row !== undefined;
}

/**
 * Contas que não podem receber recibo (`spec.md` 15c).
 *
 * Conta removida some de `users`; o `LEFT JOIN` implícito aqui é uma consulta
 * simples: quem **não** aparece na busca é inelegível. Fazer o contrário —
 * assumir elegível e deixar a FK falhar — abortaria a transação inteira e
 * perderia o comentário por causa de um destinatário.
 */
async function findIneligibleRecipients(
  trx: Transaction<Database>,
  candidates: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(candidates)];
  if (unique.length === 0) return [];

  const found = await trx
    .selectFrom("users")
    .select("id")
    .where("id", "in", unique)
    .execute();

  const eligible = new Set(found.map((row) => row.id));
  return unique.filter((id) => !eligible.has(id));
}

export async function createComment(
  db: Kysely<Database>,
  input: CreateCommentInput,
): Promise<CreateCommentResult> {
  // Validação de corpo ANTES da transação: é pura, não toca banco, e recusar
  // aqui evita abrir transação para um pedido que já se sabe inválido. A ordem
  // interna (limite antes da varredura de links) é contrato, e vive em
  // `validateCommentBody` (`contrato-http-v1.md` §3 item 5).
  const body = validateCommentBody(input.bodyMarkdown);
  if (!body.ok) {
    return { ok: false, code: body.code, status: 422 };
  }

  const requestHash = hashRequest(input);

  // O `catch` aqui converte **apenas** `CommentWriteRejection` — a rejeição
  // esperada, lançada de dentro da transação para forçar o `ROLLBACK` da chave de
  // idempotência já inserida. Qualquer outro erro é relançado: engolir para
  // registrar e seguir recriaria o defeito best-effort do `downloads`
  // (requisito 24d), e a reversão inteira é o que 13c exige.
  try {
    return await db.transaction().execute(async (trx) => {
      // 1. Idempotência primeiro: insere e deixa a unicidade decidir. Um `SELECT`
      // antes do `INSERT` deixaria janela para dois pedidos idênticos passarem
      // juntos — o check-before-transaction que §6 manda não replicar.
      const expiresAt = new Date(
        Date.now() + IDEMPOTENCY_RETENTION_HOURS * 60 * 60 * 1000,
      );

      // `ON CONFLICT DO NOTHING` em vez de capturar a violação de unicidade: no
      // PostgreSQL, um erro dentro da transação **aborta a transação inteira**, e
      // todo comando seguinte falha com `25P02 current transaction is aborted`.
      // Capturar a exceção e consultar em seguida — que é o que esta função fazia
      // — rodaria `replayOrConflict` numa transação já morta, transformando a
      // repetição legítima (que deve devolver a resposta original) num erro 500.
      //
      // `DO NOTHING` não levanta erro: devolve zero linhas quando a chave já
      // existe. A transação segue viva, e a consulta de replay funciona.
      const claimed = await trx
        .insertInto("community_idempotency_key")
        .values({
          realm: input.realm,
          source_app: input.source_app,
          idempotency_key: input.idempotencyKey,
          operation: input.parentId ? "comment.reply" : "comment.create",
          acting_user_id: input.actingUserId,
          request_hash: requestHash,
          // A resposta real é gravada no fim, quando o comentário existe.
          response_status: 201,
          response_body: {},
          expires_at: expiresAt,
        })
        .onConflict((oc) => oc.doNothing())
        .returning("id")
        .executeTakeFirst();

      if (!claimed) {
        return await replayOrConflict(trx, input, requestHash);
      }

      // 2. Assunto precisa existir: é ele que carrega `ranking_revision`, e o FK
      // `community_comment_subject_fk` exigiria a linha de qualquer forma.
      // Buscar aqui dá `404` com motivo em vez de erro de constraint.
      const subject = await trx
        .selectFrom("community_comment_subject")
        .select(["ranking_revision", "owner_user_id"])
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.source_app)
        .where("subject_type", "=", input.subject_type)
        .where("subject_id", "=", input.subject_id)
        .executeTakeFirst();

      if (!subject) {
        throw new CommentWriteRejection("subject_not_found", 404);
      }

      const actorId = await resolveOrCreateActor(trx, input.actingUserId);

      if (await hasActiveSanction(trx, input.realm, input.source_app, actorId)) {
        throw new CommentWriteRejection("sanctioned", 403);
      }

      // 3. Pai sob `FOR SHARE`: trava a linha contra remoção concorrente até o
      // commit. Sem isso, o pai pode virar tombstone entre a checagem e o
      // `INSERT`, e a resposta nasce pendurada em fala retirada — a corrida que
      // `contrato-http-v1.md` §3 fecha ao exigir os invariantes "na mesma
      // transação".
      // `parentRow` carrega `community_actor_id` para resolver o destinatário;
      // `placeComment` recebe só os campos da regra estrutural. Manter os dois
      // separados evita que a lógica de thread passe a depender de autoria.
      let parentRow:
        | (ParentComment & { community_actor_id: string | null })
        | null = null;
      if (input.parentId) {
        const row = await trx
          .selectFrom("community_comment")
          .select([
            "id",
            "realm",
            "source_app",
            "subject_type",
            "subject_id",
            "root_id",
            "depth",
            "visibility_state",
            "community_actor_id",
          ])
          .where("id", "=", input.parentId)
          .forShare()
          .executeTakeFirst();

        if (!row) {
          throw new CommentWriteRejection("parent_not_found", 404);
        }
        parentRow = row;
      }
      const parent: ParentComment | null = parentRow;

      const placement = placeComment(input, parent);
      if (!placement.ok) {
        throw new CommentWriteRejection(
          placement.code,
          placement.code === "parent_not_found" ? 404 : 422,
        );
      }

      // 4. Comentário e versão. Ids gerados aqui porque o FK circular é
      // DEFERRABLE: os dois `INSERT` convivem e o banco valida no commit.
      const commentId = randomUUID();
      const versionId = randomUUID();

      const comment = await trx
        .insertInto("community_comment")
        .values({
          id: commentId,
          realm: input.realm,
          source_app: input.source_app,
          subject_type: input.subject_type,
          subject_id: input.subject_id,
          community_actor_id: actorId,
          parent_id: placement.parent_id,
          // Raiz é o próprio id: `community_comment_root_shape_check` exige
          // `root_id = id` quando `depth = 0`, e `placeComment` devolve `null`
          // justamente porque o id só existe aqui.
          root_id: placement.root_id ?? commentId,
          depth: placement.depth,
          body_markdown: body.bodyMarkdown,
          legacy_content_html: null,
          current_version_id: versionId,
          created_revision: subject.ranking_revision,
          edited_at: null,
          legacy_source: null,
          legacy_id: null,
          legacy_author_name: null,
        })
        .returning(["id", "parent_id", "root_id", "depth", "created_at"])
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("community_comment_version")
        .values({
          id: versionId,
          realm: input.realm,
          source_app: input.source_app,
          comment_id: commentId,
          authored_by_actor_id: actorId,
          body_markdown: body.bodyMarkdown,
          legacy_content_html: null,
          redacted_at: null,
          redacted_by_actor_id: null,
          redaction_reason: null,
        })
        .execute();

      // 5. Evento e recibos. `owner_user_id` do assunto é a fonte do publicador
      // — o afirmado pelo payload (§8) já foi usado para criar/atualizar a linha
      // do assunto; reusá-lo aqui deixaria duas fontes divergirem.
      const parentAuthorUserId = parentRow?.community_actor_id
        ? await resolveUserIdOfActor(trx, parentRow.community_actor_id)
        : null;

      const ineligible = await findIneligibleRecipients(trx, [
        subject.owner_user_id,
        parentAuthorUserId,
      ].filter((id): id is string => id !== null));

      const recipients = resolveNotificationRecipients({
        publisherUserId: subject.owner_user_id,
        parentAuthorUserId,
        actingUserId: input.actingUserId,
        ineligibleUserIds: ineligible,
      });

      // Evento nasce mesmo sem destinatário: é a ocorrência, não a entrega
      // (`spec.md` 13a). Sem ele, ligar um canal novo na Fase 3 exigiria migrar
      // dado que nunca foi gravado.
      // Duas colunas distintas, e confundi-las quebra o FK do recibo:
      // `notification_event.id` é a chave da linha, e é para ELA que
      // `notification_receipt_event_fk` aponta — `(realm, source_app, event_id)`
      // referencia `(realm, source_app, id)`. `notification_event.event_id` é a
      // chave de idempotência do produtor (`spec.md` 13c), usada quando o evento
      // vem de outro módulo por outbox. Nesta fase o produtor é o próprio
      // `accounts.`, e os dois valores são gerados aqui.
      const eventRowId = randomUUID();
      const producerEventId = randomUUID();
      await trx
        .insertInto("notification_event")
        .values({
          id: eventRowId,
          event_id: producerEventId,
          realm: input.realm,
          source_app: input.source_app,
          event_type: parent ? EVENT_TYPE_REPLY : EVENT_TYPE_ROOT,
          event_version: COMMENT_EVENT_VERSION,
          subject_type: input.subject_type,
          subject_id: input.subject_id,
          actor_id: actorId,
          canonical_path: input.canonicalPath,
          // Snapshot estruturado, nunca mensagem pronta (`spec.md` 13b): o texto
          // é montado na leitura, então mudar a redação depois não exige migrar
          // dado — e o passado não muda quando o conteúdo vivo muda.
          snapshot: {
            comment_id: commentId,
            parent_comment_id: placement.parent_id,
            root_comment_id: placement.root_id ?? commentId,
            depth: placement.depth,
          },
        })
        .execute();

      if (recipients.length > 0) {
        await trx
          .insertInto("notification_receipt")
          .values(
            recipients.map((recipientUserId: string) => ({
              realm: input.realm,
              source_app: input.source_app,
              event_id: eventRowId,
              recipient_user_id: recipientUserId,
              read_at: null,
            })),
          )
          .execute();
      }

      const created: CreatedComment = {
        id: comment.id,
        parent_id: comment.parent_id,
        root_id: comment.root_id,
        depth: comment.depth,
        body_markdown: body.bodyMarkdown,
        // Serializado aqui, não no `res.json()`: é este objeto que vai para
        // `response_body` (`jsonb`) e volta como string no replay. Guardar `Date`
        // faria a primeira chamada e a repetição devolverem tipos de runtime
        // diferentes para o mesmo campo.
        created_at: comment.created_at.toISOString(),
      };

      // 6. Grava a resposta real na chave de idempotência, para a repetição
      // devolver corpo idêntico e não só o status.
      await trx
        .updateTable("community_idempotency_key")
        .set({ response_body: created })
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.source_app)
        .where("operation", "=", input.parentId ? "comment.reply" : "comment.create")
        .where("idempotency_key", "=", input.idempotencyKey)
        .execute();

      return { ok: true as const, comment: created, replayed: false };
    });
  } catch (error) {
    if (error instanceof CommentWriteRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}

/** `users.id` por trás de um ator, ou `null` se o vínculo já foi desfeito (7b). */
async function resolveUserIdOfActor(
  trx: Transaction<Database>,
  actorId: string,
): Promise<string | null> {
  const row = await trx
    .selectFrom("community_actor_account_link")
    .select("user_id")
    .where("actor_id", "=", actorId)
    .executeTakeFirst();

  return row?.user_id ?? null;
}

/**
 * Chave já usada: repetição idêntica devolve a resposta original; payload
 * diferente é `409` (`contrato-http-v1.md` §6).
 *
 * O registro vencido não é lido como repetição — passadas as 24h de retenção, a
 * chave está livre. Sem essa checagem, uma chave reaproveitada meses depois
 * devolveria um comentário antigo em vez de criar o novo.
 */
async function replayOrConflict(
  trx: Transaction<Database>,
  input: CreateCommentInput,
  requestHash: string,
): Promise<CreateCommentResult> {
  const existing = await trx
    .selectFrom("community_idempotency_key")
    .select(["request_hash", "response_body", "expires_at"])
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.source_app)
    .where("operation", "=", input.parentId ? "comment.reply" : "comment.create")
    .where("idempotency_key", "=", input.idempotencyKey)
    .executeTakeFirst();

  if (!existing || existing.expires_at <= new Date()) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  if (existing.request_hash !== requestHash) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  return {
    ok: true,
    comment: existing.response_body as CreatedComment,
    replayed: true,
  };
}
