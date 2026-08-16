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
  /**
   * Autoria da origem, nas **duas formas que os módulos têm** (T6.2).
   *
   * O `downloads` guarda `user_id` do SSO e nenhum nome — o nome se resolve
   * consultando `users` no `accounts.` O `site` é o inverso: `comments`
   * (`001_init.sql:66-73`) guarda `author_name` como texto solto e **não tem
   * coluna de conta**. A tabela comparativa do levantamento já registrava os
   * dois estágios (`spec.md:22`), e o requisito 9 fixa que o legado do `site`
   * entra com "`user_id` nulo, `legacy_author_name`, autoria não verificada".
   *
   * Por isso os dois campos são opcionais **e** ligados por um `refine` abaixo:
   * pelo menos um precisa vir, senão não há como nomear o autor legado e o
   * `CHECK` do banco (`legacy_author_name` NOT NULL na metade legada) recusaria
   * a linha só na hora do `INSERT`, sem dizer qual comentário.
   *
   * Nenhum dos dois vincula conta: `community_actor_id` é NULO em todo legado
   * (`community_comment_body_kind_check`). `author_user_id` serve **só** para
   * descobrir o nome de quem tem conta.
   */
  author_user_id: z.uuid().nullish(),
  author_name: z.string().trim().min(1).max(255).nullish(),
  /**
   * `legacy_id` do pai, quando a origem tem thread (T6.2).
   *
   * Não é `parent_id` do destino: o UUID do pai no `accounts.` só existe depois
   * de ele ser inserido, e a origem não o conhece. O importador resolve o mapa
   * `legacy_id → UUID` durante o lote e ordena pai antes de filho.
   *
   * O `downloads` era lista plana e omite o campo. O `site` tem `parent_id`
   * **sem FK** (`spec.md:151`), então pai órfão e ciclo são possíveis na origem
   * e são detectados aqui, não confiados ao banco.
   */
  parent_legacy_id: z.string().min(1).max(255).nullish(),
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
  /**
   * Timestamps validados como ISO-8601, e não como `string` livre.
   *
   * `new Date("qualquer coisa")` devolve `Invalid Date` sem lançar, e o
   * `INSERT` só falharia lá no driver — ou pior, gravaria data errada quando a
   * string é *parseável* mas não é o que a origem quis dizer. Validar na borda
   * transforma um erro silencioso de dado em recusa explícita com o
   * `legacy_id` no relatório de divergências.
   */
  /**
   * Retirada herdada. `nullish` e não `nullable`: `site.comments` **não tem**
   * coluna de remoção (`001_init.sql:66-73`), então o exportador de lá omite o
   * campo em vez de fabricar `null` para uma coluna que não existe. O efeito é
   * o mesmo — sem `removed_at` não há tombstone —, mas a ausência descreve a
   * origem com honestidade.
   */
  removed_at: z.iso.datetime({ offset: true }).nullish(),
  removed_reason: z.string().nullish(),
  created_at: z.iso.datetime({ offset: true }),
}).refine(
  (comment) => Boolean(comment.author_user_id) || Boolean(comment.author_name),
  {
    // Sem nenhuma das duas formas de autoria, `legacy_author_name` sairia nulo
    // e o `CHECK` da metade legada recusaria a linha lá no `INSERT` — erro do
    // driver, sem dizer qual comentário. Aqui a recusa carrega o `legacy_id`.
    message: "author_user_id ou author_name é obrigatório",
    path: ["author_name"],
  },
);

export const legacyExportSchema = z.object({
  source_app: z.enum(["downloads", "site", "mesas"]),
  exported_at: z.iso.datetime({ offset: true }),
  count: z.number().int().nonnegative(),
  comments: z.array(legacyCommentSchema),
});

export type LegacyExportPayload = z.infer<typeof legacyExportSchema>;

/**
 * Sinaliza "já estava importado" **abortando a transação**.
 *
 * Não é erro, e não entra em `divergences`: é o caminho normal da segunda
 * execução. Existe como exceção porque o rollback é justamente o efeito
 * desejado — ele desfaz o ator de remoção e o `updated_at` do assunto que a
 * tentativa precisou escrever antes de descobrir o conflito.
 */
class SkipComment extends Error {
  constructor() {
    super("comentário já importado");
    this.name = "SkipComment";
  }
}

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

  // Pai antes de filho, e órfão/ciclo fora — a origem do `site` tem
  // `parent_id` sem FK, e a spec manda detectar antes da cópia (`spec.md:151`).
  const { ordered, unresolved } = orderByParent(comments);
  for (const comment of unresolved) {
    report.divergences.push({
      legacy_id: comment.legacy_id,
      reason: `pai não resolvido (órfão ou ciclo): parent_legacy_id=${comment.parent_legacy_id}`,
    });
  }

  /** `legacy_id` → coordenadas, para o filho referenciar o pai do mesmo lote. */
  const colocacoes = new Map<string, ParentPlacement>();

  for (const comment of ordered) {
    const paiLegacyId = comment.parent_legacy_id;
    // Pai importado numa execução ANTERIOR não está no mapa deste lote: na
    // reexecução ele cai em `SkipComment` e nunca é colocado ali. Sem esta
    // consulta, o filho seria inserido como raiz — silenciosamente achatando a
    // árvore justamente no caminho que roda mais vezes.
    let parent = paiLegacyId ? colocacoes.get(paiLegacyId) ?? null : null;
    if (paiLegacyId && !parent) {
      const existente = await db
        .selectFrom("community_comment")
        .select(["id", "root_id", "depth"])
        // `comment.legacy_source` e NÃO `source_app`: o UNIQUE que sustenta a
        // idempotência é `(legacy_source, legacy_id)`, e é `legacy_source` que
        // a linha grava (`:448`). Os dois quase sempre coincidem, mas o schema
        // os mantém separados de propósito — `source_app` é o módulo que
        // exporta, `legacy_source` é a origem histórica do dado. Filtrar pelo
        // campo errado devolve nenhum pai e achata a árvore em silêncio.
        .where("legacy_source", "=", comment.legacy_source)
        .where("legacy_id", "=", paiLegacyId)
        .executeTakeFirst();
      if (existente) {
        parent = { id: existente.id, rootId: existente.root_id, depth: existente.depth };
      } else {
        // `orderByParent` garantiu que o pai está no lote; se ele não foi
        // inserido nem existe no banco, foi ele que falhou. Importar o filho
        // como raiz mentiria sobre a estrutura.
        report.divergences.push({
          legacy_id: comment.legacy_id,
          reason: `pai ${paiLegacyId} não foi importado; filho não vira raiz`,
        });
        continue;
      }
    }

    try {
      const colocacao = await db.transaction().execute(
        (trx) => insertLegacyComment(trx, comment, options.realm, source_app, parent),
      );
      colocacoes.set(comment.legacy_id, colocacao);
      report.inserted += 1;
    } catch (error: unknown) {
      // `SkipComment` é o rollback deliberado da reexecução, não falha: conta
      // como pulado e não polui o relatório de divergências. O filho ainda
      // encontra o pai — pela consulta acima, que lê o que já está no banco.
      if (error instanceof SkipComment) {
        report.skipped += 1;
        continue;
      }
      report.divergences.push({
        legacy_id: comment.legacy_id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return report;
}

/**
 * Coordenadas do pai já importado, resolvidas pelo mapa do lote.
 *
 * `root_id` e `depth` são **estruturais** (`spec.md:103`) e o
 * `community_comment_root_shape_check` os valida: raiz tem `root_id = id` e
 * `depth = 0`; resposta herda o `root_id` do pai e soma 1 na profundidade.
 * Recalcular isso a partir do banco a cada filho custaria uma consulta por
 * comentário para reconstruir o que o lote acabou de escrever.
 */
interface ParentPlacement {
  readonly id: string;
  readonly rootId: string;
  readonly depth: number;
}

async function insertLegacyComment(
  trx: Transaction<Database>,
  comment: z.infer<typeof legacyCommentSchema>,
  realm: "beta" | "prod",
  sourceApp: string,
  parent: ParentPlacement | null = null,
): Promise<ParentPlacement> {
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
  //
  // Duas vias, porque os módulos guardam autoria de formas diferentes
  // (`spec.md:22`): o `site` já traz o nome literal e **não consulta `users`**
  // — não há conta a procurar, e uma busca por `undefined` acharia linha
  // arbitrária ou nenhuma. O `downloads` traz o id e resolve o nome aqui.
  const authorName = comment.author_name
    ?? (comment.author_user_id
      ? (await trx
        .selectFrom("users")
        .select(["name"])
        .where("id", "=", comment.author_user_id)
        .executeTakeFirst())?.name ?? null
      : null);

  const commentId = randomUUID();
  const versionId = randomUUID();
  const createdAt = new Date(comment.created_at);
  const removedAt = comment.removed_at ? new Date(comment.removed_at) : null;

  /**
   * Coordenadas na árvore, calculadas UMA vez e usadas tanto no `INSERT` quanto
   * no retorno — o mapa do lote precisa dizer exatamente o que foi gravado.
   *
   * `community_comment_root_shape_check` exige `root_id = id` e `depth = 0` na
   * raiz; resposta herda o `root_id` do pai e soma 1.
   */
  const colocacao: ParentPlacement = {
    id: commentId,
    rootId: parent?.rootId ?? commentId,
    depth: parent ? parent.depth + 1 : 0,
  };

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
   *
   * **A FK não é DEFERRABLE** (só `current_version_id` é), então o ator precisa
   * existir *antes* do `INSERT` do comentário — e é isso que torna o skip
   * perigoso: com `onConflict doNothing`, a segunda execução pula o comentário
   * mas mantém a transação viva até o `COMMIT`, e o ator recém-criado fica
   * órfão. Cada reexecução do import deixaria mais um, para sempre. A saída é
   * abortar a transação no skip (`SkipComment`, abaixo): o conflito é o caminho
   * NORMAL da reexecução e não pode custar escrita nenhuma.
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
      // Hierarquia preservada quando a origem tem thread (T6.2).
      //
      // O legado do `downloads` é lista plana — sem `parent_legacy_id`, `parent`
      // chega nulo e o comentário é raiz, como antes. O do `site` tem
      // `parent_id` (`spec.md:22`), e ali `root_id`/`depth` herdam do pai:
      // `community_comment_root_shape_check` exige `root_id = id` só para
      // `depth = 0`, e resposta soma 1 sobre a profundidade do pai.
      //
      // Achatar tudo em raiz seria pior que perder formatação: transformaria
      // resposta em comentário solto, e o requisito 12a ("tombstone preserva
      // posição e descendentes") deixaria de fazer sentido no acervo migrado.
      parent_id: parent?.id ?? null,
      root_id: colocacao.rootId,
      depth: colocacao.depth,
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

  // Conflito = já importado. Abortar a transação é o que desfaz o ator de
  // remoção criado acima e o `updated_at` tocado no assunto — sem isso, "pulou"
  // ainda seria uma escrita, e a idempotência valeria só para o comentário, não
  // para o estado do banco.
  if (!inserted) throw new SkipComment();

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

  // Devolve as coordenadas para o mapa do lote: é o que permite o filho
  // referenciar o pai sem consultar o banco de novo. É o MESMO objeto usado no
  // `INSERT` acima — calcular duas vezes deixaria o mapa do lote divergir do
  // que está gravado se alguém editasse só um dos lados.
  return colocacao;
}

/**
 * Ordena o lote para que todo pai seja inserido antes dos filhos, e reporta o
 * que não tem lugar na árvore.
 *
 * `site.comments.parent_id` **não tem FK** (`spec.md:151`), então a origem pode
 * conter pai órfão (aponta para id inexistente) e ciclo (A→B→A). A spec manda
 * detectá-los "antes da cópia" — o banco central não os pegaria da forma útil:
 * a FK recusaria o órfão com erro de driver, e o ciclo simplesmente nunca
 * inseriria, sem dizer quais linhas.
 *
 * O algoritmo é Kahn: emite quem já tem o pai resolvido, repete até não sair
 * mais nada. O que sobra é exatamente o conjunto de órfãos e ciclos, e vai para
 * `divergences` com a causa — nunca importado como raiz, porque promover
 * resposta a comentário solto inventaria uma conversa que não existiu.
 */
export function orderByParent<T extends { legacy_id: string; parent_legacy_id?: string | null }>(
  comments: readonly T[],
): { ordered: T[]; unresolved: T[] } {
  const presentes = new Set(comments.map((comment) => comment.legacy_id));
  const resolvidos = new Set<string>();
  const ordered: T[] = [];

  // Uma passada só, separando órfão (pai fora do lote — não adianta esperar as
  // rodadas) do resto. `includes` em array dentro de laço seria O(n²): com 25
  // comentários não pesa, mas o mesmo código atende qualquer lote futuro.
  const foraDoLote: T[] = [];
  let pendentes: T[] = [];
  for (const comment of comments) {
    const pai = comment.parent_legacy_id;
    if (pai && !presentes.has(pai)) foraDoLote.push(comment);
    else pendentes.push(comment);
  }

  let avancou = true;
  while (avancou && pendentes.length > 0) {
    const restantes: T[] = [];
    const emitidos: string[] = [];
    for (const comment of pendentes) {
      if (!comment.parent_legacy_id || resolvidos.has(comment.parent_legacy_id)) {
        ordered.push(comment);
        // Só entra em `resolvidos` no fim da RODADA: marcar durante o laço
        // deixaria um filho enxergar o pai emitido na mesma passada e sair
        // fora de ordem quando a entrada já vem ordenada por acaso.
        emitidos.push(comment.legacy_id);
      } else {
        restantes.push(comment);
      }
    }
    avancou = emitidos.length > 0;
    for (const id of emitidos) resolvidos.add(id);
    pendentes = restantes;
  }

  // O que restou em `pendentes` está em ciclo; `foraDoLote` são os órfãos.
  return { ordered, unresolved: [...foraDoLote, ...pendentes] };
}
