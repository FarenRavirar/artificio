import { Router, type Request, type Response } from "express";
import type { Kysely } from "kysely";
import { z } from "zod";
import {
  COMMENT_SORTS,
  MAX_BYTES_PER_READ,
  MAX_COMMENTS_PER_READ,
  SUBJECT_ID_MAX_LENGTH,
  SUBJECT_TYPE_MAX_LENGTH,
  SUBJECT_TYPE_MESSAGE,
  SUBJECT_TYPE_PATTERN,
  assembleTree,
  issueTreeCursor,
  subjectAuthorizationSchema,
  verifyTreeCursor,
  type CommentSort,
  type CommentSubjectAuthorization,
} from "@artificio/comments";
import type { Database } from "./db.js";
import { readCommentTree, type PublicComment } from "./communityCommentRead.js";
import { createComment } from "./communityCommentWrite.js";
import { editComment, removeCommentByAuthor } from "./communityCommentLifecycle.js";
import { castVote } from "./communityCommentVote.js";
import { requireServiceCredential, type ServiceAuthenticatedRequest } from "./requireServiceCredential.js";
import {
  communityRateLimit,
  createRateLimitStore,
  type CommunityRateLimitStore,
} from "./communityRateLimit.js";

/**
 * T2.3 — `GET /internal/v1/comments` (`contrato-http-v1.md` §2).
 *
 * ## O que esta rota é, e o que não é
 *
 * Superfície **interna**: só o backend do módulo consumidor chama, com
 * credencial de serviço. O navegador nunca chega aqui (`contrato-http-v1.md`
 * §1) — a fachada de cada app é que fala com o usuário. Por isso `realm` e
 * `source_app` **não são query params**: saem da credencial. Aceitá-los do
 * cliente deixaria uma credencial de beta ler produção, que é o furo que a
 * migration 007 fechou.
 *
 * ## Cursor e revisão
 *
 * A primeira leitura fixa `snapshot_revision` e devolve `more` com cursores
 * assinados carregando aquela revisão. Toda expansão navega **dentro** dela.
 * Cursor recusado — adulterado, expirado ou de outra consulta — vira
 * `400`/`invalid_cursor`, nunca uma posição aproximada: aproximar é como se
 * duplica ou se perde comentário sem ninguém notar.
 */

/**
 * Fator de sobrebusca sobre o teto.
 *
 * A query precisa trazer **mais** que o teto para que `assembleTree` saiba que
 * existe resto e emita `more` com contagem. Buscar exatamente 1.000 devolveria
 * uma árvore cheia indistinguível de uma que acabou — e o cliente pararia de
 * paginar achando que viu tudo.
 *
 * O excedente é limitado de propósito: o teto existe porque o `accounts.`
 * sustenta o SSO (decisão 3), e uma sobrebusca generosa reintroduziria pela
 * consulta o consumo de memória que o cap corta na resposta.
 */
const FETCH_OVERSHOOT = 1.2;

const querySchema = z.object({
  // Mesmo padrão da escrita, vindo do pacote canônico
  // (`SUBJECT_TYPE_PATTERN`) em vez de repetido aqui. A leitura validava só o
  // comprimento, então `?subject_type=post` — sem o ponto que
  // `migration_006:118` exige — devolvia `200` com árvore vazia: o assunto não
  // existia, e o consumidor lia isso como "ainda sem comentários" em vez de
  // "campo malformado". Medido no smoke de produção em 2026-08-08.
  subject_type: z
    .string()
    .min(1)
    .max(SUBJECT_TYPE_MAX_LENGTH)
    .regex(SUBJECT_TYPE_PATTERN, SUBJECT_TYPE_MESSAGE),
  subject_id: z.string().min(1).max(SUBJECT_ID_MAX_LENGTH),
  sort: z.enum(COMMENT_SORTS).default("best"),
  cursor: z.string().min(1).max(4096).optional(),
});

interface ErrorBody {
  error: { code: string; correlation_id: string | null };
}

/**
 * `contrato-http-v1.md` §13 — formato único de erro, sem detalhe de existência
 * nem de autorização. `X-Correlation-Id` é ecoado quando o chamador o envia
 * (§1.1); sem ele o campo vem nulo em vez de um id inventado, que só poluiria o
 * log de quem correlaciona.
 */
function fail(req: Request, res: Response, status: number, code: string): void {
  const header = req.headers["x-correlation-id"];
  const correlationId = typeof header === "string" && header.length <= 128 ? header : null;

  const body: ErrorBody = { error: { code, correlation_id: correlationId } };
  res.status(status).json(body);
}

/**
 * Resolve o ator comunitário do usuário que está lendo.
 *
 * `X-Acting-User-Id` traz o `users.id`; `my_vote` é por **ator**, não por conta
 * (`migration_006`: o vínculo ator↔conta é a única estrutura que os liga, e
 * apagá-lo não apaga voto). Usuário sem ator ainda não participou da comunidade
 * — não é erro, só não tem voto a exibir.
 */
async function resolveActingActorId(
  db: Kysely<Database>,
  actingUserId: string | undefined,
): Promise<string | null> {
  if (!actingUserId) return null;

  const row = await db
    .selectFrom("community_actor_account_link")
    .select("actor_id")
    .where("user_id", "=", actingUserId)
    .executeTakeFirst();

  return row?.actor_id ?? null;
}

function readActingUserId(req: Request): string | undefined {
  const header = req.headers["x-acting-user-id"];
  if (typeof header !== "string") return undefined;

  // UUID malformado não vira 400: o header é opcional e seu único efeito é
  // `my_vote`. Recusar a leitura inteira por causa dele transformaria um
  // problema de enfeite em indisponibilidade da conversa.
  return z.uuid().safeParse(header).success ? header : undefined;
}

export function createCommunityCommentRoutes(
  db: Kysely<Database>,
  cursorSecret: string,
  // T2.17-T2.26 — o roteador de moderação divide o mesmo store. Os buckets são
  // por identidade e por bucket, não por roteador: dois contadores separados
  // dariam ao mesmo usuário orçamento dobrado de leitura só por trocar de rota.
  sharedStore?: CommunityRateLimitStore,
): Router {
  const router = Router();

  // T2.10 — contadores por instância de router, nunca globais de módulo: duas
  // instâncias de `createApp` no mesmo processo não podem dividir orçamento sem
  // que o desenho diga que dividem.
  const rateLimitStore = sharedStore ?? createRateLimitStore();

  // Cada rota declara o próprio bucket (`contrato-http-v1.md` §14). O limiter
  // vem **depois** do guard de credencial, porque a chave da credencial sai da
  // identidade que ele resolve: limitar antes de autenticar deixaria um chamador
  // sem credencial gastar o orçamento de um `source_app` legítimo só por
  // declarar o header.
  router.get(
    "/internal/v1/comments",
    requireServiceCredential(db, { scope: "comment.read" }),
    communityRateLimit(rateLimitStore, "read"),
    (req, res, next) => {
      void handleReadTree(db, cursorSecret, req, res).catch(next);
    },
  );

  // T2.6c — criação e resposta (`contrato-http-v1.md` §3). Duas rotas, um
  // handler: a única diferença é de onde vem o pai (`:id` na URL contra `null`),
  // e o contrato define os mesmos invariantes, corpo e erros para as duas.
  router.post(
    "/internal/v1/comments",
    requireServiceCredential(db, { scope: "comment.write" }),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleCreateComment(db, req, res, null).catch(next);
    },
  );

  router.post(
    "/internal/v1/comments/:id/replies",
    requireServiceCredential(db, { scope: "comment.write" }),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleCreateComment(db, req, res, req.params.id).catch(next);
    },
  );

  // T2.7/T2.7b — edição e auto-retirada pelo autor (`contrato-http-v1.md` §4).
  // Mesmo escopo da criação, e não um `comment.edit` novo: §4 fixa
  // `comment.write` para as duas. A autorização que importa aqui não é de
  // escopo — é de **autoria**, e ela é verificada dentro da transação, sobre a
  // linha travada, porque escopo de credencial diz o que o app pode fazer, nunca
  // quem é o dono da fala.
  // Bucket `edit` nas duas, e não `write`: §14 dá orçamento próprio à edição, e
  // a auto-retirada é ação do autor sobre comentário que já existe — mesmo
  // perfil de uso, mesmo risco. Compartilhar com `write` faria quem corrige
  // vários comentários seguidos perder o orçamento de comentar.
  router.patch(
    "/internal/v1/comments/:id",
    requireServiceCredential(db, { scope: "comment.write" }),
    communityRateLimit(rateLimitStore, "edit"),
    (req, res, next) => {
      void handleEditComment(db, req, res).catch(next);
    },
  );

  router.delete(
    "/internal/v1/comments/:id",
    requireServiceCredential(db, { scope: "comment.write" }),
    communityRateLimit(rateLimitStore, "edit"),
    (req, res, next) => {
      void handleRemoveComment(db, req, res).catch(next);
    },
  );

  // T2.12-T2.14 — voto (`contrato-http-v1.md` §7). Escopo `vote.write`, separado
  // de `comment.write`: um módulo pode expor leitura e voto sem poder criar
  // comentário, e a credencial é que decide.
  //
  // `PUT` e não `POST` porque o corpo descreve **estado absoluto**, não uma
  // ação: reenviar o mesmo valor é no-op por construção, que é o que dispensa
  // `Idempotency-Key` (§6, decisão 12).
  router.put(
    "/internal/v1/comments/:id/vote",
    requireServiceCredential(db, { scope: "vote.write" }),
    communityRateLimit(rateLimitStore, "vote"),
    (req, res, next) => {
      void handleVote(db, req, res).catch(next);
    },
  );

  return router;
}

/**
 * Corpo do voto (§7): `{ value: -1 | 0 | 1 }`, e nada mais.
 *
 * `strict()` recusa qualquer outro campo. Sem ele, um cliente que mandasse
 * `{ value: 1, comment_id: "outro" }` teria o campo extra ignorado em silêncio e
 * acharia ter votado onde não votou.
 *
 * `z.literal` nos três valores em vez de `z.number().int().min(-1).max(1)`: o
 * segundo aceitaria `1.0` vindo de JSON e, pior, aceitaria `-0`. A união fecha o
 * conjunto exatamente como o contrato o define.
 */
const voteBodySchema = z
  .object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) })
  .strict();

async function handleVote(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = (req as ServiceAuthenticatedRequest).serviceCredential;
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  // `X-Acting-User-Id` é obrigatório (§7): o voto pertence a uma conta, e sem
  // ela não há chave em `community_comment_vote`. Diferente da leitura, onde o
  // header é opcional e só afeta `my_vote`.
  const actingUserId = readActingAuthor(req, res);
  if (actingUserId === null) return;

  const commentId = readCommentId(req, res);
  if (!commentId) return;

  const body = voteBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await castVote(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    commentId,
    actingUserId,
    value: body.data.value,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  // `200` também no no-op (§7): o cliente recebe o estado atual e não precisa
  // distinguir "mudou" de "já estava assim" — as duas respostas descrevem a
  // mesma realidade.
  res.status(200).json(result.tally);
}

/**
 * Corpo do `PATCH` (§4).
 *
 * **Só `body_markdown`.** `strict()` faz de qualquer outro campo um `400`: quem
 * tentar mandar `parent_id`, `subject_id` ou `created_at` recebe recusa
 * explícita em vez de ver o campo ignorado em silêncio e achar que a mudança
 * valeu. É a mesma escolha de §3, e aqui ela protege os imutáveis da task.
 */
const editBodySchema = z.object({ body_markdown: z.string().min(1) }).strict();

/**
 * Headers obrigatórios das escritas de ciclo de vida.
 *
 * `null` sinaliza que a resposta de erro já foi enviada — o chamador só retorna.
 *
 * Duas funções e não uma com `requireIdempotencyKey: boolean`: a versão com flag
 * devolvia `idempotencyKey: ""` no ramo do `DELETE`, e uma inversão da flag faria
 * **toda edição reservar a chave vazia** — duas edições distintas colidindo na
 * mesma linha, sem erro de tipo e sem teste que pegasse. Agora quem precisa da
 * chave chama a função que a devolve, e quem não precisa não tem como recebê-la
 * vazia (achado de review do CodeRabbit, PR #250).
 */
function readActingAuthor(req: Request, res: Response): string | null {
  const actingUserId = req.headers["x-acting-user-id"];
  if (typeof actingUserId !== "string" || !z.uuid().safeParse(actingUserId).success) {
    // Aqui o header é a **identidade do autor**, não enfeite como na leitura:
    // sem ele não há como provar autoria, e adivinhar seria conceder edição a
    // qualquer um que tenha a credencial de serviço.
    fail(req, res, 400, "invalid_acting_user");
    return null;
  }
  return actingUserId;
}

/**
 * Autor + `Idempotency-Key`, para as escritas que a exigem (§4/§6).
 *
 * O `DELETE` não passa por aqui: o efeito dele já é idempotente por construção,
 * porque a segunda chamada encontra o tombstone e recusa.
 */
function readAuthorAndKey(
  req: Request,
  res: Response,
): { actingUserId: string; idempotencyKey: string } | null {
  const actingUserId = readActingAuthor(req, res);
  if (actingUserId === null) return null;

  const idempotencyKey = req.headers["idempotency-key"];
  if (typeof idempotencyKey !== "string" || !/^[\x20-\x7E]{8,128}$/.test(idempotencyKey)) {
    fail(req, res, 400, "invalid_idempotency_key");
    return null;
  }

  return { actingUserId, idempotencyKey };
}

/**
 * `:id` malformado vira `404`, nunca `400`.
 *
 * Mesma razão do pai em §3: distinguir "id inválido" de "id inexistente" diria
 * ao chamador qual formato de id o sistema usa, e o contrato colapsa os dois
 * (§13).
 */
function readCommentId(req: Request, res: Response): string | null {
  const id = req.params.id;
  if (!z.uuid().safeParse(id).success) {
    fail(req, res, 404, "comment_not_found");
    return null;
  }
  return id;
}

async function handleEditComment(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = (req as ServiceAuthenticatedRequest).serviceCredential;
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const headers = readAuthorAndKey(req, res);
  if (!headers) return;

  const commentId = readCommentId(req, res);
  if (!commentId) return;

  const body = editBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await editComment(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    commentId,
    bodyMarkdown: body.data.body_markdown,
    actingUserId: headers.actingUserId,
    idempotencyKey: headers.idempotencyKey,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  // `200` e não `201`: o comentário já existia. Vale igual para a edição real,
  // para o no-op e para a repetição idempotente — os três devolvem o estado
  // atual, e §4 não pede que o cliente distinga qual dos três aconteceu.
  res.status(200).json(result.comment);
}

async function handleRemoveComment(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = (req as ServiceAuthenticatedRequest).serviceCredential;
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const actingUserId = readActingAuthor(req, res);
  if (actingUserId === null) return;

  const commentId = readCommentId(req, res);
  if (!commentId) return;

  const result = await removeCommentByAuthor(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    commentId,
    actingUserId,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  // `204` sem corpo (§4). Devolver o comentário em tombstone seria pior que
  // inútil: o cliente recarrega a árvore, que é onde o placeholder e a
  // preservação dos filhos aparecem.
  res.status(204).end();
}

/**
 * Afirmação do backend do domínio sobre o alvo (`contrato-http-v1.md` §8).
 *
 * **Chega em `snake_case` e é convertida uma única vez aqui**, porque §8 fixa as
 * duas grafias: o wire segue o resto da API, o tipo segue o resto do TypeScript,
 * e `subjectAuthorizationSchema` **não** aceita as duas — aceitar deixaria um
 * campo passar despercebido se a conversão falhasse.
 *
 * Os três booleanos são `z.boolean()` e não `literal(true)` **de propósito**.
 * Quem exige `true` é `subjectAuthorizationSchema`, logo abaixo: assim
 * `exists: false` é um corpo *bem formado* que resulta em `404` uniforme (§13),
 * e não em `400`/`invalid_body`. A diferença importa porque `400` denunciaria
 * "seu payload está errado" para um alvo que apenas não existe — o oráculo de
 * existência que o `404` uniforme fecha.
 */
const subjectAuthorizationBodySchema = z
  .object({
    exists: z.boolean(),
    visible: z.boolean(),
    commentable: z.boolean(),
    owner_user_id: z.uuid().nullable(),
    canonical_path: z.string(),
  })
  .strict();

/**
 * Corpo de criação/resposta (`contrato-http-v1.md` §3).
 *
 * `realm` e `source_app` **não estão aqui** de propósito: derivam da credencial,
 * e §3 manda rejeitar com `400` quem tentar declará-los. `root_id` e `depth`
 * também não — são calculados, nunca aceitos.
 */
const createBodySchema = z
  .object({
    subject_type: z
      .string()
      .min(1)
      .max(SUBJECT_TYPE_MAX_LENGTH)
      // Ponto obrigatório: `migration_006:118` tem
      // `CHECK (subject_type LIKE '%.%')`. Sem esta validação o valor morria
      // como erro de constraint, sem motivo legível (achado de T2.6c). O padrão
      // vem do pacote canônico — quando estava escrito à mão aqui, a rota de
      // leitura ficou com uma versão mais frouxa e as duas divergiram.
      .regex(SUBJECT_TYPE_PATTERN, SUBJECT_TYPE_MESSAGE),
    subject_id: z.string().min(1).max(SUBJECT_ID_MAX_LENGTH),
    canonical_path: z.string().min(1).max(1024),
    body_markdown: z.string().min(1),
    subject_owner_user_id: z.uuid().nullish(),
    // §3 lista o campo no corpo e §8 o define. Ele é **obrigatório**: é a única
    // coisa que diz ao `accounts.` que o alvo existe, está visível e aceita
    // comentário. O `accounts.` não conhece material, post nem mesa — sem esta
    // afirmação ele estaria escrevendo contra referência opaca, que é o IDOR que
    // `plan.md` §Referência opaca descreve. Faltava no handler até 2026-08-09:
    // o corpo era `strict()` sem o campo, então o consumidor que seguisse o
    // contrato levava `400`.
    subject_authorization: subjectAuthorizationBodySchema,
  })
  // `strict` é o que implementa "rejeitar payload que declara realm/source_app"
  // (§3, `spec.md` 6a): campo desconhecido vira `400` em vez de ser ignorado em
  // silêncio — ignorar deixaria o chamador achar que o valor foi aceito.
  .strict();

/**
 * Resultado da leitura da afirmação do domínio.
 *
 * Três saídas, e não duas, porque `400` e `404` dizem coisas diferentes ao
 * consumidor: `"inconsistent"` é payload malformado (culpa do chamador),
 * `null` é alvo que o próprio domínio recusou (§13, `404` uniforme).
 */
type SubjectAuthorizationOutcome = CommentSubjectAuthorization | null | "inconsistent";

/**
 * Converte e revalida `subject_authorization` (§8).
 *
 * Revalidar depois do schema do corpo não é redundância: `subjectAuthorization-
 * Schema` exige `literal(true)` nos três booleanos e passa `canonical_path` pelo
 * `canonicalPathSchema` (que recusa esquema, `//host`, barra invertida,
 * credencial embutida e caractere de controle). É a mesma trava que
 * `normalizeGuardResult` aplica no lado do consumidor — aqui ela existe porque o
 * `accounts.` trata a afirmação como `unknown` mesmo vindo por credencial de
 * serviço: um guard com bug do outro lado viraria escrita em assunto
 * inexistente.
 *
 * `canonical_path` e `subject_owner_user_id` continuam no corpo por §3, mas a
 * autoridade é a autorização. Divergência entre os dois é `400`: escolher um em
 * silêncio faria o chamador achar que mandou o valor que valeu.
 */
function readSubjectAuthorization(
  body: z.infer<typeof createBodySchema>,
): SubjectAuthorizationOutcome {
  const claim = body.subject_authorization;

  // Recusa do domínio vem **primeiro**, antes de qualquer comparação de forma:
  // um alvo inexistente cujo `canonical_path` também esteja torto continua sendo
  // `404`, senão o `400` revelaria que o caminho chegou a ser examinado — o
  // oráculo de existência que o `404` uniforme de §13 fecha.
  //
  // A ordem estava invertida até 2026-08-09 (achado de review do CodeRabbit,
  // PR #250): as duas comparações abaixo rodavam antes desta linha, e o
  // comentário afirmava o contrário do que o código fazia. Consequência real:
  // `exists: false` com `canonical_path` divergente devolvia `400` em vez do
  // `404` uniforme, e a diferença de status já é o oráculo.
  if (!claim.exists || !claim.visible || !claim.commentable) return null;

  if (claim.canonical_path !== body.canonical_path) return "inconsistent";
  if (
    body.subject_owner_user_id !== undefined &&
    body.subject_owner_user_id !== claim.owner_user_id
  ) {
    return "inconsistent";
  }

  const parsed = subjectAuthorizationSchema.safeParse({
    exists: claim.exists,
    visible: claim.visible,
    commentable: claim.commentable,
    ownerUserId: claim.owner_user_id,
    canonicalPath: claim.canonical_path,
  });

  return parsed.success ? parsed.data : "inconsistent";
}

/**
 * Handler único de `POST /comments` e `POST /comments/:id/replies`.
 *
 * A ordem das checagens segue o contrato: credencial (guard), headers
 * obrigatórios, corpo, e só então a transação. Validar o corpo antes de abrir
 * transação evita pagar `BEGIN` por um pedido que já se sabe inválido.
 */
async function handleCreateComment(
  db: Kysely<Database>,
  req: Request,
  res: Response,
  parentId: string | null,
): Promise<void> {
  const credential = (req as ServiceAuthenticatedRequest).serviceCredential;
  if (!credential) {
    // Defensivo: o guard já barrou. Sem isto, um erro de montagem de rota
    // silenciosamente escreveria com `realm` indefinido.
    fail(req, res, 401, "unauthorized");
    return;
  }

  // §3: as duas escritas exigem `Idempotency-Key` e `X-Acting-User-Id`. Ausência
  // é `400`, não `422`: o pedido não chega a ser avaliado.
  const idempotencyKey = req.headers["idempotency-key"];
  if (typeof idempotencyKey !== "string" || !/^[\x20-\x7E]{8,128}$/.test(idempotencyKey)) {
    fail(req, res, 400, "invalid_idempotency_key");
    return;
  }

  const actingUserId = req.headers["x-acting-user-id"];
  if (typeof actingUserId !== "string" || !z.uuid().safeParse(actingUserId).success) {
    // Diferente da leitura, onde o header é opcional e só afeta `my_vote`: aqui
    // ele é a autoria do comentário. Sem ele não há o que escrever.
    fail(req, res, 400, "invalid_acting_user");
    return;
  }

  const body = createBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  if (parentId !== null && !z.uuid().safeParse(parentId).success) {
    // `:id` malformado é `404`, não `400`: o contrato não distingue "id inválido"
    // de "id inexistente" (§3), e distinguir diria ao chamador qual formato de id
    // o sistema usa.
    fail(req, res, 404, "parent_not_found");
    return;
  }

  const authorization = readSubjectAuthorization(body.data);
  if (authorization === "inconsistent") {
    fail(req, res, 400, "invalid_body");
    return;
  }
  if (authorization === null) {
    // Alvo inexistente, invisível ou fechado a comentário colapsam num `404`
    // uniforme (§13): a própria recusa distinguindo os casos viraria oráculo de
    // existência, que é o que `SubjectRefusalReason` documenta como "não é para
    // o `accounts.` receber".
    fail(req, res, 404, "subject_not_found");
    return;
  }

  const result = await createComment(db, {
    realm: credential.realm,
    source_app: credential.sourceApp,
    subject_type: body.data.subject_type,
    subject_id: body.data.subject_id,
    // O caminho e o dono saem da **autorização**, não dos campos soltos do
    // corpo: §8 diz que quem afirma é o backend do domínio, e é esse objeto que
    // carrega a afirmação. Os campos soltos permanecem aceitos por compatibili-
    // dade com §3, mas só como cópia — divergência vira `400` acima, nunca
    // escolha silenciosa de qual dos dois vale.
    canonicalPath: authorization.canonicalPath,
    ownerUserId: authorization.ownerUserId,
    parentId,
    bodyMarkdown: body.data.body_markdown,
    actingUserId,
    idempotencyKey,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  // Repetição idêntica devolve a resposta original com o mesmo status (§6): o
  // cliente que reenviou por timeout precisa ver `201` e o mesmo corpo, não um
  // `200` que o faria achar que houve dois comentários.
  res.status(201).json(result.comment);
}

/** Posição de onde a leitura retoma. Tudo nulo na primeira página. */
interface NavigationStart {
  snapshotRevision?: number;
  branchId: string | null;
  after: string | null;
}

/**
 * Traduz o cursor recebido na posição de retomada.
 *
 * `null` sinaliza cursor recusado — o chamador responde `400`/`invalid_cursor`.
 * Os quatro motivos de recusa colapsam num só código: distingui-los diria ao
 * chamador se a assinatura bateu, um oráculo para calibrar forjatura.
 */
function resolveNavigationStart(
  cursor: string | undefined,
  cursorSecret: string,
  expected: { subject_type: string; subject_id: string; sort: CommentSort },
): NavigationStart | null {
  if (cursor === undefined) return { branchId: null, after: null };

  const verified = verifyTreeCursor(cursor, cursorSecret, expected);
  if (!verified.ok) return null;

  return {
    snapshotRevision: verified.payload.snapshot_revision,
    branchId: verified.payload.branch_id,
    after: verified.payload.after,
  };
}

/** Resposta de assunto que nunca recebeu comentário. */
function emptyTree(res: Response): void {
  // Árvore vazia e revisão 0, não 404 — "ninguém comentou" não é "não existe".
  res.set("Cache-Control", "private, no-store");
  res.json({
    state: "fresh",
    snapshot_revision: 0,
    comments: [],
    more: [],
    truncated: false,
  });
}

/** Monta os nós `more`, cada um com o cursor assinado da própria continuação. */
function buildMoreNodes(
  assembledMore: readonly { parent_id: string | null; count: number; after: string }[],
  cursorSecret: string,
  query: { subjectType: string; subjectId: string; sort: CommentSort; revision: number },
) {
  return assembledMore.map((node) => ({
    parent_id: node.parent_id,
    count: node.count,
    cursor: issueTreeCursor(
      {
        subject_type: query.subjectType,
        subject_id: query.subjectId,
        sort: query.sort,
        snapshot_revision: query.revision,
        branch_id: node.parent_id,
        after: node.after,
        limit: MAX_COMMENTS_PER_READ,
      },
      cursorSecret,
    ),
  }));
}

async function handleReadTree(
  db: Kysely<Database>,
  cursorSecret: string,
  req: Request,
  res: Response,
): Promise<void> {
  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    fail(req, res, 400, "invalid_query");
    return;
  }

  const { subject_type: subjectType, subject_id: subjectId, sort, cursor } = parsedQuery.data;

  // Derivado da credencial, nunca do request (`contrato-http-v1.md` §1.1). O
  // guard já garantiu a presença; o non-null seria uma aposta, então falha
  // explícita.
  const credential = (req as ServiceAuthenticatedRequest).serviceCredential;
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const start = resolveNavigationStart(cursor, cursorSecret, {
    subject_type: subjectType,
    subject_id: subjectId,
    sort,
  });

  if (start === null) {
    fail(req, res, 400, "invalid_cursor");
    return;
  }

  const { snapshotRevision, branchId, after } = start;
  const actingActorId = await resolveActingActorId(db, readActingUserId(req));

  const { snapshotRevision: revision, rows } = await readCommentTree(
    db,
    {
      subject: {
        realm: credential.realm,
        sourceApp: credential.sourceApp,
        subjectType,
        subjectId,
      },
      sort,
      snapshotRevision,
      actingActorId,
      after,
      branchId,
    },
    Math.ceil(MAX_COMMENTS_PER_READ * FETCH_OVERSHOOT),
  );

  if (revision === null) {
    emptyTree(res);
    return;
  }

  // Sem recorte em memória: a query já veio posicionada pelo cursor e escopada
  // ao ramo (achado de review, PR #245 — o filtro em memória sobre um `LIMIT`
  // fixo devolvia página vazia em árvore maior que o limite de busca).
  const assembled = assembleTree({
    rows: rows.map((row) => ({
      id: row.id,
      parent_id: row.parent_id,
      depth: row.depth,
      size_bytes: row.size_bytes,
      sort_key: row.sort_key,
    })),
    sort,
    maxComments: MAX_COMMENTS_PER_READ,
    maxBytes: MAX_BYTES_PER_READ,
  });

  const byId = new Map(rows.map((row) => [row.id, row.comment]));
  const comments = assembled.included
    .map((id) => byId.get(id))
    .filter((comment): comment is PublicComment => comment !== undefined);

  const more = buildMoreNodes(assembled.more, cursorSecret, {
    subjectType,
    subjectId,
    sort,
    revision,
  });

  // UGC nunca entra em cache compartilhado: o payload carrega `my_vote`, que é
  // por leitor, e conteúdo que a moderação pode retirar a qualquer momento.
  res.set("Cache-Control", "private, no-store");
  res.json({
    state: "fresh",
    snapshot_revision: revision,
    comments,
    more,
    truncated: assembled.truncated,
  });
}

/*
 * `selectNavigationWindow` foi removida na correção do review da PR #245.
 *
 * Ela recortava a janela do cursor em memória, sobre o resultado de um `LIMIT`
 * fixo. Dois defeitos que só apareciam em árvore grande: a segunda página
 * recortava o mesmo bloco de ~1.200 linhas já servido (devolvendo vazio sem
 * erro), e a comparação `sort_key > after` avançava na direção errada em
 * `best`, `top` e `new`, que ordenam `DESC`.
 *
 * O cursor agora é aplicado no `WHERE` da própria query, sobre a posição total
 * derivada de `sort_path` — ver `communityCommentRead.ts`.
 */
