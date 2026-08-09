import { createHash, randomUUID } from "node:crypto";
import type { Kysely, Selectable, Transaction } from "kysely";
import { z } from "zod";
import { validateCommentBody } from "@artificio/comments";
import type { Database } from "./db.js";

/**
 * T2.7 + T2.7b — edição e auto-retirada pelo autor
 * (`contrato-http-v1.md` §4; decisões 17, 18, 20, 22, 41, 46).
 *
 * ## As duas operações moram juntas porque compartilham o invariante caro
 *
 * Edição e retirada são as únicas escritas que **mudam um comentário que já
 * existe**, e as duas param no mesmo lugar: só o autor pode, ninguém mais, e a
 * verificação de autoria tem que acontecer dentro da transação, sobre a linha
 * travada. Separá-las em dois arquivos duplicaria essa checagem — e é
 * exatamente o tipo de código que se duplica hoje e diverge em seis meses.
 *
 * ## O que a moderação nunca faz, e por que isso é estrutural
 *
 * Decisão 22: moderação **não reescreve fala alheia**. Aqui isso não é uma regra
 * a lembrar — é a ausência de um caminho. Não existe função neste arquivo que
 * grave `body_markdown` sem ter provado que o ator é o autor; a retirada por
 * moderador (§5, T2.20+) escreve `visibility_state`, `removed_*` e auditoria, e
 * jamais toca o corpo. Se um dia alguém precisar de "editar como moderador", vai
 * ter que escrever uma função nova, e a revisão vai ver.
 *
 * ## O que o banco garante e o que não garante
 *
 * Medido em produção (`pg_trigger` de `artificio_auth`, 2026-08-09):
 * `community_comment` **não tem trigger nenhum** — nem guard de `UPDATE`, nem
 * exigência de auditoria atômica, nem recusa de `DELETE`. As cinco tabelas
 * cobertas por `require_community_terminal_audit` são
 * `community_moderation_case`, `community_comment_report`,
 * `community_comment_version_approval`, `community_comment_appeal` e
 * `community_restriction`. Consequência direta: a atomicidade
 * estado+auditoria da retirada é sustentada **por este código**, não pelo
 * schema. Por isso as duas escritas vivem na mesma transação e não existe
 * caminho de retirada que não insira a linha de auditoria.
 *
 * O que o banco garante: `community_comment_removal_check` recusa estado
 * removido sem `removed_at`, `removed_by_actor_id` e `removed_reason` não-vazio,
 * e para `author_removed` exige `removed_by_actor_id = community_actor_id` — o
 * banco não deixa uma auto-retirada mentir sobre quem retirou.
 * `community_comment_version_guard_update` recusa reescrita de versão existente,
 * e `community_comment_version_reject_delete` recusa apagá-la.
 */

/** `contrato-http-v1.md` §6 — mesma retenção da criação. */
const IDEMPOTENCY_RETENTION_HOURS = 24;

/**
 * Motivo canônico da auto-retirada.
 *
 * `DELETE /internal/v1/comments/:id` (§4) **não tem corpo**, mas
 * `community_comment_removal_check` exige `removed_reason` não-vazio em
 * `author_removed`. Inventar um campo de motivo no `DELETE` contrariaria o
 * contrato; gravar string vazia esbarraria no `CHECK`. O valor fixo diz a
 * verdade — foi o autor, por vontade própria, sem motivo declarado — e mantém a
 * auditoria legível para quem for ler a fila de moderação depois.
 */
export const AUTHOR_REMOVAL_REASON = "Retirado pelo próprio autor";

/** Ações registradas em `community_moderation_audit.action`. */
const AUDIT_ACTION_AUTHOR_REMOVED = "comment.author_removed";

export type LifecycleRejectionCode =
  /** Alvo inexistente, ou de outro `realm`/`source_app` da credencial. */
  | "comment_not_found"
  /** Ator autenticado não é o autor (§4: terceiro recebe `403`). */
  | "forbidden_not_author"
  /** Comentário importado não é editável nem retirável (decisão 6). */
  | "legacy_immutable"
  /** Já retirado: a retirada do autor é irreversível para ele (decisão 17). */
  | "comment_removed"
  | "body_too_long"
  | "body_empty"
  | "INVALID_COMMENT_LINK"
  | "idempotency_key_reuse";

export interface EditCommentInput {
  realm: string;
  sourceApp: string;
  commentId: string;
  bodyMarkdown: string;
  actingUserId: string;
  idempotencyKey: string;
}

export interface RemoveCommentInput {
  realm: string;
  sourceApp: string;
  commentId: string;
  actingUserId: string;
}

/** Espelha o objeto devolvido pelo `PATCH` (§4: `200` com o comentário atual). */
export interface EditedComment {
  id: string;
  parent_id: string | null;
  root_id: string;
  depth: number;
  body_markdown: string;
  created_at: string;
  edited_at: string | null;
}

/**
 * Normalizador de `response_body` no replay.
 *
 * O campo é `jsonb`: sai do banco como `unknown` e só vira `EditedComment`
 * depois de passar por aqui. `created_at`/`edited_at` são `string` e não
 * `z.date()` porque foram serializados na gravação — é o mesmo motivo de
 * `EditedComment` guardar ISO string em vez de `Date`.
 */
const editedCommentSchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  root_id: z.uuid(),
  depth: z.number().int(),
  body_markdown: z.string(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
});

export type EditCommentResult =
  | { ok: true; comment: EditedComment; replayed: boolean }
  | { ok: false; code: LifecycleRejectionCode; status: number };

export type RemoveCommentResult =
  | { ok: true }
  | { ok: false; code: LifecycleRejectionCode; status: number };

/**
 * Rejeição esperada, lançada para forçar `ROLLBACK`.
 *
 * Mesma razão de `CommentWriteRejection` em `communityCommentWrite.ts`: retornar
 * normalmente faria o Kysely commitar, e a chave de idempotência já reservada
 * ficaria queimada por 24 horas para um pedido que falhou.
 */
class LifecycleRejection extends Error {
  constructor(
    readonly code: LifecycleRejectionCode,
    readonly status: number,
  ) {
    super(code);
    this.name = "LifecycleRejection";
  }
}

/**
 * Estado de visibilidade, na união do schema.
 *
 * `string` solto deixaria `=== "author_removed"` compilar mesmo com typo, e o
 * ramo simplesmente nunca rodaria — tombstone editável sem erro nenhum
 * (achado de review do CodeRabbit, PR #250).
 */
type VisibilityState = Selectable<Database["community_comment"]>["visibility_state"];

/** Linha do comentário sob trava, com o que as duas operações precisam decidir. */
interface LockedComment {
  id: string;
  parent_id: string | null;
  root_id: string;
  depth: number;
  body_markdown: string | null;
  community_actor_id: string | null;
  visibility_state: VisibilityState;
  legacy_source: string | null;
  created_at: Date;
  edited_at: Date | null;
}

/**
 * Carrega o comentário sob `FOR UPDATE` e prova que o ator autenticado é o autor.
 *
 * `FOR UPDATE` e não `FOR SHARE`: as duas operações **escrevem** nesta linha. Sem
 * a trava, duas edições concorrentes do mesmo autor (duas abas, duplo clique)
 * poderiam inserir duas versões e deixar `current_version_id` apontando para a
 * perdedora — o corpo exibido divergindo do histórico, sem erro nenhum.
 *
 * `realm` e `source_app` entram no `WHERE` porque vêm da credencial: uma
 * credencial de beta não alcança linha de produção, e a resposta é `404`
 * uniforme — não `403`, que confirmaria a existência do id no outro realm
 * (`contrato-http-v1.md` §13).
 */
async function lockAuthoredComment(
  trx: Transaction<Database>,
  input: { realm: string; sourceApp: string; commentId: string; actingUserId: string },
): Promise<LockedComment> {
  const comment = await trx
    .selectFrom("community_comment")
    .select([
      "id",
      "parent_id",
      "root_id",
      "depth",
      "body_markdown",
      "community_actor_id",
      "visibility_state",
      "legacy_source",
      "created_at",
      "edited_at",
    ])
    .where("id", "=", input.commentId)
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .forUpdate()
    .executeTakeFirst();

  if (!comment) {
    throw new LifecycleRejection("comment_not_found", 404);
  }

  // Legado antes de autoria: comentário importado tem `community_actor_id`
  // nulo, então a checagem de autor sozinha já o recusaria — mas com
  // `forbidden_not_author`, que é a mensagem errada. Ninguém é autor de um
  // legado; o motivo real é que ele é imutável (decisão 6).
  if (comment.legacy_source !== null) {
    throw new LifecycleRejection("legacy_immutable", 403);
  }

  const actorId = await resolveActorId(trx, input.actingUserId);

  // Ator ausente é `403`, não `404`: o comentário existe, quem pede é que não é
  // o dono. Usuário que nunca participou da comunidade não tem ator, e cai aqui
  // — corretamente, porque ele não é autor de nada.
  if (actorId === null || comment.community_actor_id !== actorId) {
    throw new LifecycleRejection("forbidden_not_author", 403);
  }

  return comment;
}

/** Ator do usuário autenticado, ou `null` se ele nunca participou. */
async function resolveActorId(
  trx: Transaction<Database>,
  userId: string,
): Promise<string | null> {
  const row = await trx
    .selectFrom("community_actor_account_link")
    .select("actor_id")
    .where("user_id", "=", userId)
    .executeTakeFirst();

  return row?.actor_id ?? null;
}

/**
 * Hash do payload que define "mesmo pedido" na edição.
 *
 * Inclui o alvo: a mesma chave usada para editar outro comentário é reuso, não
 * repetição.
 */
function hashEditRequest(input: EditCommentInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify([input.commentId, input.bodyMarkdown, input.actingUserId]),
    )
    .digest("hex");
}

function toPublic(
  comment: Pick<LockedComment, "id" | "parent_id" | "root_id" | "depth" | "created_at">,
  bodyMarkdown: string,
  editedAt: Date | null,
): EditedComment {
  return {
    id: comment.id,
    parent_id: comment.parent_id,
    root_id: comment.root_id,
    depth: comment.depth,
    body_markdown: bodyMarkdown,
    // ISO string e não `Date`, pelo mesmo motivo de `CreatedComment`: este
    // objeto vai para `response_body` (`jsonb`) e volta como string no replay.
    // Guardar `Date` faria a primeira chamada e a repetição devolverem tipos de
    // runtime diferentes para o mesmo campo.
    created_at: comment.created_at.toISOString(),
    edited_at: editedAt ? editedAt.toISOString() : null,
  };
}

/**
 * `PATCH /internal/v1/comments/:id` — o autor troca o próprio corpo (§4).
 *
 * ## O que **não** muda, e por que a lista importa
 *
 * Pai, assunto, autoria e `created_at` são imutáveis. Não é uma restrição
 * defensiva: mover um comentário de pai reescreveria a conversa de terceiros que
 * já responderam, e mudar `created_at` reordenaria a árvore de quem já leu.
 * Nenhum dos dois é oferecido pelo contrato, e nenhum é aceito aqui.
 *
 * ## Votos sobrevivem à edição (decisão 18)
 *
 * Nada nesta função toca `community_comment_vote`,
 * `community_comment_score_version` ou `ranking_revision`. É deliberado e é o
 * ponto mais contraintuitivo da task: trocar o corpo depois de receber votos é
 * bait-and-switch em potencial, e a defesa escolhida foi **o marcador público de
 * edição mais o histórico completo para a moderação**, não zerar a reação de
 * terceiros. Zerar puniria o autor que corrige uma vírgula e não impediria o
 * mal-intencionado, que edita antes de o primeiro voto chegar.
 *
 * ## Edição idêntica é no-op
 *
 * `200` com o comentário atual, **sem versão nova e sem mexer em `edited_at`**.
 * Criar versão para um corpo idêntico encheria o histórico de moderação de ruído
 * e faria a interface exibir "editado" para quem não editou nada.
 */
export async function editComment(
  db: Kysely<Database>,
  input: EditCommentInput,
): Promise<EditCommentResult> {
  // Validação de corpo antes da transação: é pura e não toca banco. A ordem
  // interna (limite antes da varredura de links) é contrato e vive no pacote.
  const body = validateCommentBody(input.bodyMarkdown);
  if (!body.ok) {
    return { ok: false, code: body.code, status: 422 };
  }

  const requestHash = hashEditRequest(input);

  try {
    return await db.transaction().execute(async (trx) => {
      const expiresAt = new Date(
        Date.now() + IDEMPOTENCY_RETENTION_HOURS * 60 * 60 * 1000,
      );

      // Idempotência primeiro. Um `SELECT` antes do `INSERT` deixaria janela
      // para dois pedidos idênticos passarem juntos, e capturar a violação
      // mataria a transação (`25P02`), transformando repetição legítima em
      // `500`.
      //
      // `DO UPDATE ... WHERE expires_at <= now()` e não `DO NOTHING`: a chave
      // **vencida** é retomada aqui, atomicamente, em vez de cair no replay.
      // `migration_008` documenta uma "varredura periódica" de vencidos que
      // nunca foi escrita (`rg "community_idempotency_key"` em `apps packages
      // scripts` não acha nenhum `DELETE`, medido em 2026-08-09), então sem esta
      // retomada a chave ficaria bloqueada **para sempre** depois das 24h — e o
      // contrato §6 diz o contrário. Achado de review do Codex (P2, PR #250).
      //
      // A condição no `WHERE` é o que mantém a segurança: dentro da janela o
      // `UPDATE` não acontece, zero linhas voltam, e o fluxo cai no replay como
      // antes. Só a linha morta é reivindicada.
      const claimed = await trx
        .insertInto("community_idempotency_key")
        .values({
          realm: input.realm,
          source_app: input.sourceApp,
          idempotency_key: input.idempotencyKey,
          operation: "comment.edit",
          acting_user_id: input.actingUserId,
          request_hash: requestHash,
          response_status: 200,
          response_body: {},
          expires_at: expiresAt,
        })
        .onConflict((oc) =>
          oc
            .columns(["realm", "source_app", "operation", "idempotency_key"])
            .doUpdateSet({
              acting_user_id: input.actingUserId,
              request_hash: requestHash,
              response_status: 200,
              response_body: {},
              created_at: new Date(),
              expires_at: expiresAt,
            })
            // `created_at` também é reescrito: `community_idempotency_key_window`
            // exige `expires_at > created_at`, e manter o `created_at` antigo
            // com janela nova passa hoje mas quebra se a retenção mudar.
            .where("community_idempotency_key.expires_at", "<=", new Date()),
        )
        .returning("id")
        .executeTakeFirst();

      if (!claimed) {
        return await replayEditOrConflict(trx, input, requestHash);
      }

      const comment = await lockAuthoredComment(trx, {
        realm: input.realm,
        sourceApp: input.sourceApp,
        commentId: input.commentId,
        actingUserId: input.actingUserId,
      });

      // Retirado não volta a ser editável: a auto-retirada é irreversível para o
      // autor (decisão 17), e deixar editar o corpo de um tombstone ressuscitaria
      // conteúdo que o próprio autor decidiu tirar do ar.
      //
      // `pending_review_hidden` **não** entra aqui: decisão 41 diz explicitamente
      // que ele continua editável e que a edição não o revela. Quem está sob
      // revisão precisa poder corrigir o que foi denunciado.
      if (
        comment.visibility_state === "author_removed" ||
        comment.visibility_state === "moderator_removed"
      ) {
        throw new LifecycleRejection("comment_removed", 403);
      }

      // No-op: corpo canônico idêntico ao atual. A comparação é sobre
      // `body.bodyMarkdown` (já canonicalizado por `validateCommentBody`), não
      // sobre a entrada crua — senão trocar apenas espaçamento que a
      // canonicalização normaliza criaria versão nova sem diferença de conteúdo.
      if (comment.body_markdown === body.bodyMarkdown) {
        const unchanged = toPublic(comment, body.bodyMarkdown, comment.edited_at);
        await storeEditResponse(trx, input, unchanged);
        return { ok: true as const, comment: unchanged, replayed: false };
      }

      // Versão nova **antes** do `UPDATE` do ponteiro: o FK
      // `community_comment_current_version_fk` é DEFERRABLE, então a ordem não é
      // imposta pelo banco — mas inserir primeiro deixa o código legível na
      // direção em que a coisa acontece, e o commit valida os dois juntos.
      const versionId = randomUUID();
      const editedAt = new Date();

      await trx
        .insertInto("community_comment_version")
        .values({
          id: versionId,
          realm: input.realm,
          source_app: input.sourceApp,
          comment_id: comment.id,
          // Autor da versão é o próprio autor do comentário — já provado por
          // `lockAuthoredComment`. É o que permite auditar depois que uma versão
          // não foi escrita por moderador nenhum (decisão 22).
          authored_by_actor_id: comment.community_actor_id,
          body_markdown: body.bodyMarkdown,
          legacy_content_html: null,
          redacted_at: null,
          redacted_by_actor_id: null,
          redaction_reason: null,
        })
        .execute();

      await trx
        .updateTable("community_comment")
        .set({
          body_markdown: body.bodyMarkdown,
          current_version_id: versionId,
          edited_at: editedAt,
        })
        // `visibility_state` fora do `SET` de propósito: editar não revela
        // comentário sob revisão (decisão 41) nem restaura tombstone.
        .where("id", "=", comment.id)
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .execute();

      // Nenhum `notification_event` aqui, e a ausência é o requisito: edição
      // **não** gera notificação (decisão 20). Avisar a cada correção de
      // digitação treinaria o usuário a ignorar o sino, que é o que torna a
      // notificação de resposta inútil.

      const edited = toPublic(comment, body.bodyMarkdown, editedAt);
      await storeEditResponse(trx, input, edited);
      return { ok: true as const, comment: edited, replayed: false };
    });
  } catch (error) {
    if (error instanceof LifecycleRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}

/** Grava a resposta real na chave, para a repetição devolver corpo idêntico. */
async function storeEditResponse(
  trx: Transaction<Database>,
  input: EditCommentInput,
  comment: EditedComment,
): Promise<void> {
  await trx
    .updateTable("community_idempotency_key")
    .set({ response_body: comment })
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("operation", "=", "comment.edit")
    .where("idempotency_key", "=", input.idempotencyKey)
    .execute();
}

/** Chave já usada: repetição idêntica devolve a original; payload diferente é `409`. */
async function replayEditOrConflict(
  trx: Transaction<Database>,
  input: EditCommentInput,
  requestHash: string,
): Promise<EditCommentResult> {
  const existing = await trx
    .selectFrom("community_idempotency_key")
    .select(["request_hash", "response_body", "expires_at"])
    .where("realm", "=", input.realm)
    .where("source_app", "=", input.sourceApp)
    .where("operation", "=", "comment.edit")
    .where("idempotency_key", "=", input.idempotencyKey)
    .executeTakeFirst();

  // Registro vencido não é repetição: passadas as 24h a chave está livre. Hoje
  // este ramo é inalcançável pelo caminho normal — o `ON CONFLICT` condicionado
  // retoma a linha vencida antes de chegar aqui —, mas continua como defesa:
  // uma linha escrita por script operacional ou por versão anterior do handler
  // não pode virar replay de uma edição de ontem.
  if (!existing || existing.expires_at <= new Date()) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  if (existing.request_hash !== requestHash) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  // `response_body` é `jsonb` **lido do banco**, portanto `unknown` até passar
  // por normalizador (`AGENTS.md` §Regras Gerais de Código). O `as EditedComment`
  // que estava aqui afirmava a forma sem verificar, e o valor vai direto para
  // `res.json()` — uma linha gravada por versão anterior do handler seria servida
  // ao consumidor como se estivesse tipada. Achado de review do CodeRabbit
  // (PR #250).
  //
  // Forma desconhecida vira `409` e não `500`: a linha existe e é inutilizável,
  // que é exatamente o que `idempotency_key_reuse` significa para o chamador.
  const stored = editedCommentSchema.safeParse(existing.response_body);
  if (!stored.success) {
    return { ok: false, code: "idempotency_key_reuse", status: 409 };
  }

  return { ok: true, comment: stored.data, replayed: true };
}

/**
 * `DELETE /internal/v1/comments/:id` — auto-retirada por tombstone (§4).
 *
 * ## Nunca `DELETE` físico, e o motivo é estrutural
 *
 * Apagar a linha quebraria os filhos: `community_comment_parent_subject_fk`
 * aponta para ela, e as respostas de terceiros perderiam o pai — ou seriam
 * apagadas junto, o que é pior: o autor de um comentário passaria a poder apagar
 * a fala de outras pessoas. O tombstone preserva posição e descendentes
 * (decisão 3); o que some é o corpo e o score, e isso acontece na **leitura**
 * (`communityCommentRead.ts`, `toTreeRow`), que já anula os dois para qualquer
 * estado diferente de `visible`.
 *
 * O corpo permanece na linha e em `community_comment_version` de propósito: é
 * evidência de denúncia (T2.19 fixa `reported_version_id`), e a retirada do
 * autor **não encerra a moderação** (decisão 46) — apagar o texto aqui destruiria
 * a prova do caso que segue aberto.
 *
 * ## Sem `Idempotency-Key`, e isso é seguro
 *
 * §4 não a exige para o `DELETE`, ao contrário do `PATCH`. A operação é
 * naturalmente idempotente em efeito — o segundo `DELETE` encontra o comentário
 * já em `author_removed` e recusa com `403`/`comment_removed`, sem criar segundo
 * tombstone nem segunda linha de auditoria.
 *
 * ## Irreversível para o autor
 *
 * Não existe rota de "desfazer" aqui; só `moderator`/`admin` restaura (§5).
 * Deixar o autor alternar visibilidade transformaria o tombstone em um botão de
 * esconder e reexibir conforme a reação da conversa.
 */
export async function removeCommentByAuthor(
  db: Kysely<Database>,
  input: RemoveCommentInput,
): Promise<RemoveCommentResult> {
  try {
    return await db.transaction().execute(async (trx) => {
      const comment = await lockAuthoredComment(trx, input);

      // Já retirado — por ele mesmo ou por moderador — não vira tombstone de
      // novo. Repetir sobrescreveria `removed_at` e o ator da retirada original,
      // e um autor conseguiria carimbar o próprio nome sobre uma remoção de
      // moderação.
      if (
        comment.visibility_state === "author_removed" ||
        comment.visibility_state === "moderator_removed"
      ) {
        throw new LifecycleRejection("comment_removed", 403);
      }

      const removedAt = new Date();

      await trx
        .updateTable("community_comment")
        .set({
          visibility_state: "author_removed",
          removed_at: removedAt,
          // `community_comment_removal_check` exige
          // `removed_by_actor_id = community_actor_id` neste estado: o banco não
          // aceita uma auto-retirada que aponte para outro ator.
          removed_by_actor_id: comment.community_actor_id,
          removed_reason: AUTHOR_REMOVAL_REASON,
        })
        // `body_markdown` **fora** do `SET`: o corpo fica na linha e some só na
        // leitura. Ver o bloco de evidência acima.
        .where("id", "=", comment.id)
        .where("realm", "=", input.realm)
        .where("source_app", "=", input.sourceApp)
        .execute();

      // Auditoria na MESMA transação, e sem trigger que a exija.
      //
      // As cinco tabelas cobertas por `require_community_terminal_audit` não
      // incluem `community_comment` — medido em `pg_trigger` de produção em
      // 2026-08-09, onde a tabela aparece com zero triggers. Ou seja: se este
      // `insert` sair daqui, a retirada continua funcionando e a trilha some sem
      // nenhum erro. É o tipo de regressão que passa em revisão e só aparece
      // quando alguém precisa auditar. O teste correspondente afirma a presença
      // da linha, não só o estado do comentário.
      await trx
        .insertInto("community_moderation_audit")
        .values({
          realm: input.realm,
          source_app: input.sourceApp,
          actor_id: comment.community_actor_id,
          action: AUDIT_ACTION_AUTHOR_REMOVED,
          target_type: "community_comment",
          target_id: comment.id,
          reason: AUTHOR_REMOVAL_REASON,
          metadata: {
            // Estado anterior explícito: sem ele, ler a trilha não distingue
            // retirada de comentário visível da de um já oculto por denúncia
            // (decisão 46 — a retirada não fecha o caso, então a distinção
            // importa para quem revisa).
            previous_visibility_state: comment.visibility_state,
            removed_at: removedAt.toISOString(),
          },
        })
        .execute();

      // Nenhuma notificação: quem retira a própria fala não avisa ninguém, e o
      // caso de moderação eventualmente aberto segue seu próprio fluxo (T2.21).

      return { ok: true as const };
    });
  } catch (error) {
    if (error instanceof LifecycleRejection) {
      return { ok: false, code: error.code, status: error.status };
    }
    throw error;
  }
}
