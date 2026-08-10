import { createHash, randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import {
  placeComment,
  resolveNotificationRecipients,
  validateCommentBody,
  type CommentSubjectScope,
  type ParentComment,
} from "@artificio/comments";
import type { Database } from "./db.js";
import { resolveOrCreateActor, resolveUserIdOfActor } from "./communityActor.js";
import {
  claimIdempotencyKey,
  replayIdempotentResponse,
  storeIdempotentResponse,
} from "./communityIdempotency.js";

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

/**
 * Namespace da chave de idempotência.
 *
 * Os literais `comment.create` e `comment.reply` são **escolha de
 * implementação**, não valores fixados pelo contrato — busca negativa: `rg
 * "comment.create|comment.reply"` em `contrato-http-v1.md` devolve zero. O que
 * o contrato fixa (§6) é que a chave identifica uma operação; o par
 * `(operation, idempotency_key)` entra na unicidade, e separar criação de
 * resposta é o que impede um retry de resposta colidir com uma criação que usou
 * a mesma chave.
 *
 * Trocar estes literais migra chaves vivas: uma requisição em voo com a chave
 * gravada sob o nome antigo deixaria de encontrá-la e criaria comentário
 * duplicado.
 */
function operationOf(input: CreateCommentInput): string {
  return input.parentId ? "comment.reply" : "comment.create";
}

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
  // `subject_not_found` **não** está aqui: o assunto é criado sob demanda no
  // passo 2, e a recusa do alvo acontece antes, na rota, ao ler
  // `subject_authorization` (§8). Manter o código aqui daria a impressão de que
  // a transação ainda pode recusar o assunto.
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
 * Normalizador de `response_body` no replay.
 *
 * O campo é `jsonb`: sai do banco como `unknown` e só vira `CreatedComment`
 * depois daqui. `created_at` é `string` pelo motivo descrito no campo acima.
 */
const createdCommentSchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  root_id: z.uuid(),
  depth: z.number().int(),
  body_markdown: z.string(),
  created_at: z.string(),
});

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

// `resolveOrCreateActor` e `resolveUserIdOfActor` vêm de `communityActor.ts`.
//
// A criação aqui é incondicional, ao contrário do voto e da denúncia, que
// resolvem antes das recusas e só criam depois delas. O motivo é estrutural:
// `spec.md` 7a diz que o ator comunitário não é a linha autenticável da conta, e
// `community_comment.community_actor_id` referencia `community_actor` — sem ator
// o comentário não pode existir com autor resolvível. Não há recusa posterior
// nesta função que torne o ator descartável, então adiar a criação só produziria
// uma ida extra ao banco.

/**
 * Publicador afirmado pelo domínio, reduzido a `null` quando a conta não existe
 * mais em `users`.
 *
 * `community_comment_subject.owner_user_id` tem FK para `users(id)`. O guard do
 * módulo afirma o dono a partir da **tabela dele** — que pode estar apontando
 * para uma conta já excluída no `accounts.`, porque a exclusão não propaga para
 * o domínio. Inserir o id direto abortaria a transação inteira por
 * `foreign_key_violation` e o comentário morreria por causa da afirmação stale
 * de um terceiro.
 *
 * Reduzir a `null` é o comportamento correto, não uma tolerância: sem conta viva
 * não há badge de autor do conteúdo nem destinatário de recibo, que é exatamente
 * o caso já previsto em 15a/15b ("não inventa destinatário").
 */
async function resolveLivePublisher(
  trx: Transaction<Database>,
  ownerUserId: string | null,
): Promise<string | null> {
  if (ownerUserId === null) return null;

  const row = await trx
    .selectFrom("users")
    .select("id")
    .where("id", "=", ownerUserId)
    .executeTakeFirst();

  return row?.id ?? null;
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
      //
      // `claimIdempotencyKey` usa `ON CONFLICT` em vez de capturar a violação de
      // unicidade, e a diferença é crítica aqui: no PostgreSQL um erro dentro da
      // transação **aborta a transação inteira**, e todo comando seguinte falha
      // com `25P02 current transaction is aborted`. Capturar a exceção e
      // consultar em seguida — que é o que esta função fazia — rodaria
      // `replayOrConflict` numa transação já morta, transformando a repetição
      // legítima num erro 500. `ON CONFLICT` não levanta erro: devolve zero
      // linhas quando não age, a transação segue viva, e o replay funciona.
      const claimed = await claimIdempotencyKey(trx, {
        realm: input.realm,
        sourceApp: input.source_app,
        idempotencyKey: input.idempotencyKey,
        operation: operationOf(input),
        actingUserId: input.actingUserId,
        requestHash,
        // A resposta real é gravada no fim, quando o comentário existe.
        responseStatus: 201,
      });

      if (!claimed) {
        return await replayOrConflict(trx, input, requestHash);
      }

      // 2. Assunto: **criado sob demanda**, não exigido pré-existente.
      //
      // A linha carrega `ranking_revision` e é alvo do FK
      // `community_comment_subject_fk`, mas nada no sistema a cria antes do
      // primeiro comentário — não existe rota de "registrar assunto", e nem
      // deveria: quem afirma que o alvo existe é o guard do módulo (§8), e o
      // `accounts.` não conhece o domínio para inventariá-lo por conta própria.
      // Enquanto isto era um `SELECT`-ou-`404`, o **primeiro** comentário de
      // qualquer assunto falhava; a única linha em produção tinha sido inserida
      // à mão durante o smoke de 2026-08-08, o que escondeu o defeito.
      //
      // `canonical_path` e `owner_user_id` são reafirmados a cada escrita porque
      // são estado do domínio, não do comentário: post movido de rota ou dono
      // vinculado depois precisam valer para o badge (T2.6) e para o recibo do
      // publicador (15c). `ranking_revision` **não** entra no `SET` — ele é do
      // assunto e pertence ao voto (T2.13).
      const publisherUserId = await resolveLivePublisher(trx, input.ownerUserId);

      const subject = await trx
        .insertInto("community_comment_subject")
        .values({
          realm: input.realm,
          source_app: input.source_app,
          subject_type: input.subject_type,
          subject_id: input.subject_id,
          canonical_path: input.canonicalPath,
          owner_user_id: publisherUserId,
        })
        .onConflict((oc) =>
          oc
            .columns(["realm", "source_app", "subject_type", "subject_id"])
            .doUpdateSet({
              canonical_path: input.canonicalPath,
              owner_user_id: publisherUserId,
              updated_at: new Date(),
            }),
        )
        // `doUpdateSet` e não `doNothing`: `DO NOTHING` não devolve linha no
        // conflito, e `ranking_revision` seria `undefined` justamente no caso
        // comum (assunto que já tem comentário).
        .returning(["ranking_revision", "owner_user_id"])
        .executeTakeFirstOrThrow();

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
      await storeIdempotentResponse(trx, keyLookup(input), created);

      return { ok: true as const, comment: created, replayed: false };
    });
  } catch (error) {
    if (error instanceof CommentWriteRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}

function keyLookup(input: CreateCommentInput) {
  return {
    realm: input.realm,
    sourceApp: input.source_app,
    idempotencyKey: input.idempotencyKey,
    operation: operationOf(input),
    actingUserId: input.actingUserId,
  };
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
  const stored = await replayIdempotentResponse(
    trx,
    keyLookup(input),
    requestHash,
    createdCommentSchema,
  );

  // `null` cobre os três casos que §6 colapsa em `idempotency_key_reuse`:
  // registro ausente/vencido, payload diferente na mesma chave, e corpo com
  // forma desconhecida — este último era um `as CreatedComment` que afirmava a
  // forma sem verificar, servindo `jsonb` cru ao consumidor (achado do
  // CodeRabbit, PR #250).
  if (!stored) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  return { ok: true, comment: stored, replayed: true };
}
