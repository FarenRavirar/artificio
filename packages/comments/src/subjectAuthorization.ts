import { z } from 'zod';

/**
 * T2.2 — contrato `CommentSubjectAuthorization` (requisito 6a, decisão 2).
 *
 * ## Por que este contrato existe
 *
 * O `accounts.` recebe `(realm, source_app, subject_type, subject_id)` e **não
 * consulta tabela de domínio nenhuma** — ele não sabe o que é um material de
 * RPG, um post de blog ou uma mesa. Isso é o que permite três apps consumirem o
 * mesmo serviço.
 *
 * O preço é que referência opaca **não substitui autorização por objeto**. Se a
 * escrita viesse do navegador, o atacante inventaria assunto inexistente, dono
 * e badge — o `accounts.` não teria como saber (OWASP IDOR). Quem sabe é o
 * backend do módulo, e é ele que responde às cinco perguntas deste contrato
 * antes de chamar.
 *
 * A afirmação só é confiável porque chega por **credencial de serviço**
 * (`X-Service-Token`), não por sessão de navegador. `realm` e `source_app` nem
 * aparecem aqui: são derivados da credencial no `accounts.`, nunca do payload.
 *
 * ## O que este módulo é e o que não é
 *
 * É o **contrato** e a **suíte de conformidade** — o vocabulário comum e o
 * conjunto de casos que toda implementação precisa passar. O guard concreto de
 * cada app (a consulta que descobre se aquele material existe e está visível)
 * é escrito na fase de adoção daquele app, contra a sua própria tabela.
 */

/** Limites de `spec.md` §Referência opaca, URL e corpo. */
export const SUBJECT_TYPE_MAX_LENGTH = 64;
export const SUBJECT_ID_MAX_LENGTH = 255;
export const CANONICAL_PATH_MAX_LENGTH = 1024;

/**
 * Motivo pelo qual o assunto não aceita comentário. Existe para o backend do
 * módulo distinguir os casos ao montar a resposta ao usuário — **não** para o
 * `accounts.` receber: a API interna colapsa todos em `404` uniforme, senão a
 * própria recusa vira oráculo de existência.
 */
export type SubjectRefusalReason =
  | 'not_found'
  | 'not_visible'
  | 'not_commentable';

/**
 * `canonical_path` — caminho de volta ao conteúdo, **nunca URL inteira**
 * (requisito 5b). A origem é resolvida no servidor por `(realm, source_app)`
 * allowlisted; aceitar URL pronta abriria phishing e open redirect.
 *
 * As recusas cobrem o que transformaria um caminho em destino arbitrário:
 * scheme, host, barra invertida (que o Windows e alguns parsers tratam como
 * separador) e credencial embutida.
 */
export const canonicalPathSchema = z
  .string()
  .min(1)
  .max(CANONICAL_PATH_MAX_LENGTH)
  .refine((value) => value.startsWith('/'), {
    message: 'canonical_path precisa começar por "/"',
  })
  .refine((value) => !value.startsWith('//'), {
    // `//host/rota` é URL protocol-relative: o browser resolve contra outro
    // host mantendo o esquema. Passa no teste de "começa com /" e mesmo assim
    // sai do domínio.
    message: 'canonical_path não pode ser protocol-relative',
  })
  .refine((value) => !/^[a-z][a-z0-9+.-]*:/i.test(value), {
    message: 'canonical_path não pode conter esquema',
  })
  .refine((value) => !value.includes('\\'), {
    message: 'canonical_path não pode conter barra invertida',
  })
  .refine((value) => !value.includes('@'), {
    message: 'canonical_path não pode conter credencial',
  })
  .refine(
    (value) => {
      // Caractere de controle é recusado de propósito: uma quebra de linha num
      // caminho que depois entra em header de redirect ou em linha de log
      // permite response splitting e forja de entrada de log.
      //
      // A checagem é por code point, não por regex: `no-control-regex` acusaria
      // a classe literal, e silenciar a regra com um `disable` esconderia
      // justamente o tipo de coisa que ela existe para sinalizar noutros
      // lugares. Sem regex, não há o que silenciar.
      for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code <= 0x1f || code === 0x7f) return false;
      }
      return true;
    },
    { message: 'canonical_path não pode conter caractere de controle' },
  );

/**
 * A afirmação do backend do módulo sobre o alvo.
 *
 * `ownerUserId` nulo é caso **legítimo e comum**, não erro: post do blog do
 * `site` não tem conta vinculada (`posts` não tem `author_user_id`) e mesa
 * órfã do `mesas` também não. Nesses casos não se inventa destinatário — o
 * comentário raiz simplesmente não notifica ninguém, e responder a um
 * comentário continua notificando quem escreveu o pai (requisitos 15a, 15b).
 */
export const subjectAuthorizationSchema = z.object({
  exists: z.literal(true),
  visible: z.literal(true),
  commentable: z.literal(true),
  ownerUserId: z.uuid().nullable(),
  canonicalPath: canonicalPathSchema,
});

export type CommentSubjectAuthorization = z.infer<
  typeof subjectAuthorizationSchema
>;

/**
 * Identidade do assunto. `realm` e `source_app` ficam **de fora de propósito**:
 * o `accounts.` os deriva da credencial de serviço, e aceitá-los aqui abriria
 * a porta para uma credencial de beta escrever em produção.
 */
export const subjectRefSchema = z.object({
  subjectType: z
    .string()
    .min(1)
    .max(SUBJECT_TYPE_MAX_LENGTH)
    .regex(
      /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/,
      'subject_type é namespaced em minúsculas, separado por ponto',
    ),
  subjectId: z.string().min(1).max(SUBJECT_ID_MAX_LENGTH),
});

export type CommentSubjectRef = z.infer<typeof subjectRefSchema>;

/**
 * Resultado do guard de um app. União discriminada em vez de
 * `CommentSubjectAuthorization | null` para que a recusa carregue o motivo sem
 * que ele possa ser confundido com autorização concedida.
 */
export type SubjectAuthorizationResult =
  | { authorized: true; authorization: CommentSubjectAuthorization }
  | { authorized: false; reason: SubjectRefusalReason };

/**
 * O guard que cada backend consumidor implementa contra a própria tabela.
 *
 * `actingUserId` entra porque visibilidade pode depender de quem pergunta —
 * mesa de grupo fechado, material em rascunho. Um guard que ignore o ator
 * responde igual para todo mundo, o que é exatamente o vazamento que a suíte
 * de conformidade testa.
 */
export type CommentSubjectGuard = (
  subject: CommentSubjectRef,
  actingUserId: string,
) => Promise<SubjectAuthorizationResult>;

export const authorize = (
  authorization: CommentSubjectAuthorization,
): SubjectAuthorizationResult => ({ authorized: true, authorization });

export const refuse = (
  reason: SubjectRefusalReason,
): SubjectAuthorizationResult => ({ authorized: false, reason });

/**
 * Normaliza a resposta de um guard antes de ela virar payload.
 *
 * Regra pétrea de normalização: o retorno de um guard escrito noutro app é
 * `unknown` até passar por schema. Um guard que devolva
 * `{ authorized: true, authorization: { exists: false } }` — por bug, não por
 * malícia — viraria escrita autorizada em assunto inexistente se ninguém
 * revalidasse. Aqui ele vira recusa.
 */
export function normalizeGuardResult(
  value: unknown,
): SubjectAuthorizationResult {
  if (typeof value !== 'object' || value === null) return refuse('not_found');

  const candidate = value as { authorized?: unknown; authorization?: unknown };
  if (candidate.authorized !== true) {
    const reason = (value as { reason?: unknown }).reason;
    return refuse(
      reason === 'not_visible' || reason === 'not_commentable'
        ? reason
        : 'not_found',
    );
  }

  const parsed = subjectAuthorizationSchema.safeParse(candidate.authorization);
  return parsed.success ? authorize(parsed.data) : refuse('not_found');
}
