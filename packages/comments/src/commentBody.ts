import {
  markdownToPlainText,
  sanitizeUserMarkdown,
} from '@artificio/content-editor/sanitize';
import {
  findCommentLinkViolation,
  type CommentLinkViolation,
} from '@artificio/content-editor/comment-links';

/**
 * T2.5 — validação do corpo do comentário (requisito 10; decisões 24, 25, 30).
 *
 * ## Por que isto vive no pacote compartilhado
 *
 * `contrato-http-v1.md` §3 invariantes 3–5 valem igual na criação e na edição, e
 * `spec.md` 8 manda o cliente usar a **mesma** política do backend — o frontend
 * para erro imediato, o backend como autoridade final. Duas implementações
 * divergiriam no dia em que uma mudasse: o usuário veria o editor aceitar um
 * corpo que a API recusa, sem entender por quê.
 *
 * A Fase 2 **não cria parser, sanitizador nem renderizador paralelo** (decisão
 * 24). Tudo aqui delega a `@artificio/content-editor`; o que esta função
 * acrescenta é a **ordem** em que as regras rodam e o formato do erro.
 *
 * ## A ordem é a regra, não detalhe de implementação
 *
 * `contrato-http-v1.md` §3 item 5 é explícito: o limite de 10.000 é checado
 * **antes** da varredura de links. O `MAX_SCAN_LENGTH` do pacote de links é
 * 12.000 — mais frouxo. Com a ordem certa, `input_too_large` fica inalcançável
 * por esta rota, porque corpo acima de 10.000 já saiu com `body_too_long`. Se
 * essa regra aparecer em produção, é sinal de que a ordem foi invertida, não de
 * que o usuário mandou algo exótico.
 */

/** `spec.md` §Referência opaca — vale para a entrada e para a saída canônica. */
export const COMMENT_BODY_MAX_LENGTH = 10_000;

export type CommentBodyRejectionCode =
  /** Entrada original ou Markdown canônico acima de 10.000 (decisão 25). */
  | 'body_too_long'
  /** `markdownToPlainText` do resultado é vazio (decisão 30). */
  | 'body_empty'
  /** Link reconhecido cujo destino viola a política única (decisão 29). */
  | 'INVALID_COMMENT_LINK';

export type CommentBodyValidation =
  | { ok: true; bodyMarkdown: string }
  | {
      ok: false;
      code: CommentBodyRejectionCode;
      /** Preenchido só em `INVALID_COMMENT_LINK`: regra e posição, nunca o destino. */
      violation?: CommentLinkViolation;
    };

/**
 * Valida e canonicaliza o corpo de um comentário novo ou editado.
 *
 * Devolve o Markdown canônico a persistir — **nunca HTML montado** (decisão 24:
 * a API entrega Markdown, e cada consumidor renderiza pelo pipeline
 * compartilhado, cuja saída já passa por DOMPurify).
 *
 * Rejeição é sempre da operação inteira. Truncar um corpo longo ou remover o
 * link hostil e salvar o resto publicaria, sob o nome do autor, um texto que ele
 * não escreveu — que é pior do que recusar (decisões 25 e 29).
 */
export function validateCommentBody(input: string): CommentBodyValidation {
  // 1. Limite na entrada ORIGINAL, antes de qualquer parsing (decisão 25).
  //
  // Checar só depois da canonicalização deixaria o servidor fazer o trabalho de
  // parsing sobre um corpo arbitrariamente grande antes de descobrir que ia
  // recusar — o atacante paga um POST e o servidor paga o parse.
  if (input.length > COMMENT_BODY_MAX_LENGTH) {
    return { ok: false, code: 'body_too_long' };
  }

  const bodyMarkdown = sanitizeUserMarkdown(input);

  // 2. Limite de novo, agora no Markdown canônico. Não é redundante: a
  // canonicalização pode crescer o texto (escape de caractere, normalização de
  // referência), e o que vai ao banco é este valor — o `CHECK` de
  // `community_comment_version` recusaria a linha, e a falha apareceria como
  // erro de banco em vez de `422` com motivo.
  if (bodyMarkdown.length > COMMENT_BODY_MAX_LENGTH) {
    return { ok: false, code: 'body_too_long' };
  }

  // 3. Conteúdo visível (decisão 30). Espaço, HTML integralmente removido pela
  // sanitização, separador temático isolado ou marcador sem texto sanitizam para
  // vazio — e um comentário sem texto ocupa posição na árvore, gera notificação
  // e não diz nada a ninguém.
  if (markdownToPlainText(bodyMarkdown).trim().length === 0) {
    return { ok: false, code: 'body_empty' };
  }

  // 4. Links, por último, sobre o corpo já canônico e já dentro do limite
  // (ordem obrigatória de §3 item 5). Varrer o original deixaria passar um
  // destino que só aparece depois da canonicalização.
  const violation = findCommentLinkViolation(bodyMarkdown);
  if (violation) {
    return { ok: false, code: 'INVALID_COMMENT_LINK', violation };
  }

  return { ok: true, bodyMarkdown };
}
