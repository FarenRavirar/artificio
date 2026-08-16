import { randomUUID } from "node:crypto";
import type { Kysely, Transaction } from "kysely";
import { z } from "zod";
import type { Database } from "../db.js";

/**
 * T5.1b/T5.2/T5.2c (spec 090) — importador one-shot do acervo legado,
 * **pertencente ao `accounts.`**.
 *
 * ## Por que o importador mora aqui, e não no módulo de origem
 *
 * Requisito 23: o módulo não escreve no banco do `accounts.` A transferência é
 * export read-only lá (`downloads/backend/src/scripts/exportLegacyComments.ts`)
 * e este importador aqui. Nenhuma migration do `downloads` toca o banco central.
 *
 * ## Idempotência: rodar duas vezes dá o mesmo resultado
 *
 * O UNIQUE `uq_community_comment_legacy (legacy_source, legacy_id) WHERE
 * legacy_source IS NOT NULL` (verificado no banco, 2026-08-15) é o que sustenta
 * a garantia. A estratégia é **inserir e tratar o conflito**, nunca
 * `SELECT`-antes-de-`INSERT` — o check-before-transaction que `contrato-http-v1.md`
 * §6 nomeia como defeito a não replicar, porque duas execuções concorrentes
 * passariam as duas pelo `SELECT` vazio.
 *
 * ## Ordem de inserção forçada pelo schema
 *
 * `community_comment.current_version_id` é `NOT NULL` e aponta para
 * `community_comment_version`, que aponta de volta para o comentário — ciclo.
 * O FK `community_comment_current_version_fk` é **DEFERRABLE INITIALLY
 * DEFERRED**, então geram-se os dois UUIDs na aplicação, insere-se o comentário,
 * depois a versão, e o FK valida no `COMMIT`. Mesmo caminho de
 * `communityCommentWrite.ts:39-45`.
 *
 * ## O que este importador NÃO faz
 *
 * Não converte notificação (T5.2b: os cinco `kind` continuam locais, com corpo
 * congelado, e `download_notification` tinha 0 linhas nos dois realms). Não
 * apaga nada na origem (T5.7: a tabela local vira read-only e é retida). Não
 * decide cutover.
 */

/** Espelha `LegacyCommentExport` do exportador do `downloads`. */
const legacyCommentSchema = z.object({
  legacy_source: z.string().min(1).max(32),
  legacy_id: z.string().min(1).max(255),
  subject_type: z.string().min(1).max(64),
  subject_id: z.string().min(1).max(255),
  canonical_path: z.string().min(1).max(1024),
  author_user_id: z.uuid(),
  /**
   * Corpo **já sanitizado na origem**, com a política declarada.
   *
   * A sanitização acontece no exportador, e não aqui, por uma razão de
   * dependência: `sanitizeUserMarkdown` vive em `@artificio/content-editor`,
   * que **não** é dependência do `accounts.` — e o `plan.md` registra em
   * detalhe (E016/E017, o SSO fora por 5h em 2026-08-08) o custo de arrastar
   * pacote novo para a imagem do app sagrado. O exportador do `downloads` já
   * tem a dependência.
   *
   * O requisito 10 pede sanitização "uma vez na entrada, com
   * política/versionamento"; quem sanitiza declara o que usou, e o par
   * viaja junto do corpo até o banco.
   */
  content_html: z.string().min(1),
  sanitizer_policy: z.string().min(1).max(128),
  sanitizer_version: z.number().int().positive(),
  removed_at: z.string().nullable(),
  removed_reason: z.string().nullable(),
  created_at: z.string(),
});

export const legacyExportSchema = z.object({
  source_app: z.enum(["downloads", "site", "mesas"]),
  exported_at: z.string(),
  count: z.number().int().nonnegative(),
  comments: z.array(legacyCommentSchema),
});

export type LegacyExportPayload = z.infer<typeof legacyExportSchema>;

export interface ImportDivergence {
  legacy_id: string;
  reason: string;
}

export interface ImportReport {
  /** Contagem declarada pela origem, conferida contra o que chegou. */
  declared: number;
  received: number;
  inserted: number;
  /** Já existia por `(legacy_source, legacy_id)` — reexecução, não erro. */
  skipped: number;
  /**
   * Lista **explícita** de divergências (T5.2c). "Item a item sem critério não
   * valida nada": o relatório sai vazio ou cada linha tem causa registrada.
   */
  divergences: ImportDivergence[];
}

/**
 * Importa um lote dentro de uma transação por comentário.
 *
 * Transação por item, e não uma única para o lote inteiro: um comentário com
 * assunto inválido não pode derrubar os outros, e o relatório precisa dizer
 * **qual** falhou. O UNIQUE garante que reprocessar o lote todo é seguro.
 */
export async function importLegacyComments(
  db: Kysely<Database>,
  payload: unknown,
  options: { realm: "beta" | "prod" },
): Promise<ImportReport> {
  const parsed = legacyExportSchema.safeParse(payload);
  if (!parsed.success) {
    throw new TypeError(`export fora do contrato: ${parsed.error.message}`);
  }

  const { comments, count, source_app } = parsed.data;
  const report: ImportReport = {
    declared: count,
    received: comments.length,
    inserted: 0,
    skipped: 0,
    divergences: [],
  };

  // Guarda de contagem, antes de qualquer escrita: origem que declara 12 e
  // entrega 9 significa export truncado, e importar assim mesmo produziria uma
  // migração silenciosamente parcial — o pior resultado possível, porque passa
  // por sucesso.
  if (count !== comments.length) {
    throw new RangeError(
      `export inconsistente: declarou ${count} comentário(s) e trouxe ${comments.length}`,
    );
  }

  for (const comment of comments) {
    try {
      const outcome = await db.transaction().execute(
        (trx) => insertLegacyComment(trx, comment, options.realm, source_app),
      );
      if (outcome === "inserted") report.inserted += 1;
      else report.skipped += 1;
    } catch (error: unknown) {
      report.divergences.push({
        legacy_id: comment.legacy_id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return report;
}

async function insertLegacyComment(
  trx: Transaction<Database>,
  comment: z.infer<typeof legacyCommentSchema>,
  realm: "beta" | "prod",
  sourceApp: string,
): Promise<"inserted" | "skipped"> {
  // Assunto sob demanda, igual à escrita viva: nada no sistema cria a linha
  // antes do primeiro comentário, e `ranking_revision` vive nela.
  // `ranking_revision` fica fora do `SET` — pertence ao voto, não ao import.
  const subject = await trx
    .insertInto("community_comment_subject")
    .values({
      realm,
      source_app: sourceApp,
      subject_type: comment.subject_type,
      subject_id: comment.subject_id,
      canonical_path: comment.canonical_path,
      // O dono não vem do export: o legado não o afirmava, e inventá-lo aqui
      // criaria destinatário de notificação que nunca existiu. A escrita viva
      // reafirma `owner_user_id` no primeiro comentário novo do assunto.
      owner_user_id: null,
    })
    .onConflict((oc) =>
      oc
        .columns(["realm", "source_app", "subject_type", "subject_id"])
        .doUpdateSet({ updated_at: new Date() }),
    )
    .returning(["ranking_revision"])
    .executeTakeFirstOrThrow();

  // O `user_id` da origem serve para **nomear** o autor legado, não para
  // vinculá-lo: o vínculo é justamente o que o requisito 9 nega ("autoria não
  // verificada"). Conta inexistente não é divergência — o comentário entra com
  // o rótulo neutro, como qualquer legado sem conta viva por trás.
  const author = await trx
    .selectFrom("users")
    .select(["name"])
    .where("id", "=", comment.author_user_id)
    .executeTakeFirst();
  const authorName = author?.name ?? null;

  const commentId = randomUUID();
  const versionId = randomUUID();
  const createdAt = new Date(comment.created_at);
  const removedAt = comment.removed_at ? new Date(comment.removed_at) : null;

  /**
   * Ator que assina a remoção herdada.
   *
   * `community_comment_removal_check` exige `removed_by_actor_id IS NOT NULL`
   * para `moderator_removed`, e a origem **não guarda quem removeu**:
   * `download_comment` tem `removed_at` e `removed_reason`, mas nenhum
   * `removed_by` (verificado em `db/types.ts` e em `routes/reports.ts:323-327`).
   *
   * Descartar o comentário não é opção: 24b manda preservar "estado removido e
   * lido" na validação linha a linha, o requisito 12a diz que tombstone
   * "preserva posição e descendentes", e a spec fixa que "comentário e
   * tombstone são retidos sem prazo" (`spec.md:451`). Importar como visível
   * seria pior ainda — republicaria fala que a moderação derrubou.
   *
   * A saída vem do próprio desenho: `community_actor` tem apenas `id` e
   * `created_at`, **sem vínculo obrigatório com `users`** — o `plan.md:174-175`
   * separa o ator da linha autenticável justamente para que ele sobreviva à
   * exclusão da conta. Um ator sem `community_actor_account_link` é estado
   * normal do sistema, não gambiarra: é o que resta de toda conta excluída.
   * Aqui ele representa "a moderação do módulo de origem", cuja identidade
   * nominal nunca existiu no `accounts.`
   */
  let removedByActorId: string | null = null;
  if (removedAt) {
    const actor = await trx
      .insertInto("community_actor")
      .values({ id: randomUUID() })
      .returning(["id"])
      .executeTakeFirstOrThrow();
    removedByActorId = actor.id;
  }

  const inserted = await trx
    .insertInto("community_comment")
    .values({
      id: commentId,
      realm,
      source_app: sourceApp,
      subject_type: comment.subject_type,
      subject_id: comment.subject_id,
      // **Ator NULO, e isto é o schema falando, não escolha do import.**
      // `community_comment_body_kind_check` (verificado no banco) admite só dois
      // formatos: nativo (`community_actor_id` + `body_markdown`, todo
      // `legacy_*` nulo) **ou** legado (todos os seis `legacy_*` preenchidos,
      // `community_actor_id` NULO e `body_markdown` NULO). Não existe híbrido.
      //
      // A primeira versão deste import ligava o comentário legado a um ator
      // resolvido pelo `user_id` da origem, e o `CHECK` recusou — corretamente:
      // o requisito 9 manda importar legado com "`user_id` nulo,
      // `legacy_author_name` e autoria **não verificada**". Vincular a conta
      // afirmaria uma autoria que a importação não tem como provar, e daria ao
      // comentário antigo voto, edição e badge que o requisito nega.
      community_actor_id: null,
      parent_id: null,
      // Legado do `downloads` é lista plana: não havia resposta, então todo
      // comentário é raiz e `root_id = id`, como
      // `community_comment_root_shape_check` exige para `depth = 0`.
      root_id: commentId,
      depth: 0,
      // Corpo do legado vive em `legacy_content_html`, e `body_markdown` fica
      // nulo — a outra metade do `community_comment_body_kind_check`. O
      // requisito 10 fecha o desenho: "o HTML legado continua em campo próprio,
      // sanitizado uma vez na entrada com política/versionamento e protegido de
      // novo na saída sem regravar o banco".
      body_markdown: null,
      legacy_content_html: comment.content_html,
      legacy_sanitizer_policy: comment.sanitizer_policy,
      legacy_sanitizer_version: comment.sanitizer_version,
      current_version_id: versionId,
      created_revision: subject.ranking_revision,
      // Estado de moderação preservado: comentário retirado na origem continua
      // retirado no destino, senão o import republicaria fala que a moderação
      // tinha derrubado.
      //
      // `moderator_removed` e não um "removed" genérico — o enum interno
      // distingue quem retirou (o payload público colapsa os dois em `removed`,
      // `communityCommentRead.ts:154-156`). No `downloads` legado a retirada só
      // acontecia por denúncia acatada (`routes/reports.ts:323-327`); não havia
      // auto-retirada pelo autor, então a origem é sempre moderação.
      visibility_state: removedAt ? "moderator_removed" : "visible",
      edited_at: null,
      removed_at: removedAt,
      removed_by_actor_id: removedByActorId,
      // O `CHECK` exige motivo não-vazio junto do estado removido. A origem
      // grava um texto padrão ao acatar denúncia (`routes/reports.ts:326`), mas
      // pode vir nulo em linha antiga — o fallback diz a verdade sobre a
      // proveniência em vez de inventar um motivo que ninguém escreveu.
      removed_reason: removedAt
        ? (comment.removed_reason?.trim() || "Removido pela moderação antes da migração.")
        : null,
      legacy_source: comment.legacy_source,
      legacy_id: comment.legacy_id,
      // Nome resolvido **aqui**, não exportado pela origem: o `downloads` não
      // guarda nome de usuário (a identidade vem do SSO, e a busca em
      // `db/types.ts` por `display_name`/`name` de usuário devolveu zero), e o
      // `accounts.` é dono de `users`. Conta já excluída cai no rótulo neutro,
      // que é o mesmo que o payload público mostra para conta apagada
      // (`contrato-http-v1.md` §2) — inventar um nome ali seria pior que a
      // ausência dele.
      legacy_author_name: authorName ?? "Conta excluída",
      created_at: createdAt,
    })
    // O conflito é o caminho normal da SEGUNDA execução, não um erro: inserir
    // primeiro e tratar a violação é o que torna o import idempotente sem
    // `SELECT` prévio.
    .onConflict((oc) => oc.doNothing())
    .returning(["id"])
    .executeTakeFirst();

  if (!inserted) return "skipped";

  await trx
    .insertInto("community_comment_version")
    .values({
      id: versionId,
      realm,
      source_app: sourceApp,
      comment_id: commentId,
      // Mesma regra do comentário, agora em
      // `community_comment_version_body_check`: ator nulo (autoria não
      // verificada) e o corpo em `legacy_content_html`, nunca nos dois campos.
      authored_by_actor_id: null,
      body_markdown: null,
      legacy_content_html: comment.content_html,
      created_at: createdAt,
      redacted_at: null,
      redacted_by_actor_id: null,
      redaction_reason: null,
    })
    .execute();

  return "inserted";
}
