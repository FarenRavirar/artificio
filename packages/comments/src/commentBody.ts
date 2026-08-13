import {
  markdownToPlainText,
  sanitizeUserMarkdown,
} from '@artificio/content-editor/sanitize';
import {
  MAX_SCAN_LENGTH,
  demoteCommentImages,
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
 * **antes** da varredura de links, para o servidor não pagar o parse de um corpo
 * que já ia recusar.
 *
 * O contrato afirma que isso torna `input_too_large` inalcançável, porque o
 * `MAX_SCAN_LENGTH` do pacote de links é 12.000 — mais frouxo que 10.000.
 * **Medido em 2026-08-07: a afirmação vale para texto ASCII e falha fora do
 * BMP.** As duas contagens medem coisas diferentes: o limite do comentário conta
 * pontos de código (para casar com `LENGTH()` do PostgreSQL), e o teto de
 * varredura conta unidades UTF-16 (porque protege contra o custo real da regex,
 * que é proporcional a elas). 10.000 emoji são 10.000 pontos de código — dentro
 * do limite — e 20.000 unidades UTF-16 — acima do teto de varredura. O corpo
 * passava na primeira checagem e morria na segunda com a regra errada.
 *
 * Por isso a validação recusa **antes** o que a varredura não conseguiria
 * examinar, com o código que descreve o problema de verdade (`body_too_long`, e
 * não uma violação de link que não existe). `MAX_SCAN_LENGTH` continua sendo
 * responsabilidade do pacote de links; aqui só espelhamos o teto para não
 * entregar a ele o que ele recusa.
 */

/** `spec.md` §Referência opaca — vale para a entrada e para a saída canônica. */
export const COMMENT_BODY_MAX_LENGTH = 10_000;

/*
 * `MAX_SCAN_LENGTH` vem importado do próprio pacote de links (passou a ser
 * exportado no review da PR #246). A cópia local que existia aqui desatualizaria
 * em silêncio se o teto de lá mudasse.
 *
 * Ele mede **unidades UTF-16**, não pontos de código, porque protege o custo da
 * varredura, que é proporcional a elas. É por isso que a comparação abaixo usa
 * `.length` cru enquanto o limite do comentário usa `countCharacters`: são duas
 * grandezas diferentes, de propósito.
 */

/**
 * Conta **pontos de código**, não unidades UTF-16.
 *
 * `String.length` conta 2 por caractere fora do BMP, então 5.001 emoji davam
 * 10.002 e eram recusados — enquanto o `LENGTH(body_markdown)` do PostgreSQL
 * (`community_comment_version_body_check`) conta 5.001 e aceitaria. Medido no
 * banco de produção: `length('🎲🎲🎲')` devolve `3`.
 *
 * A divergência importa porque a validação existe para **antecipar** o `CHECK`
 * do banco com uma mensagem melhor. Contando diferente, ela recusaria corpo que
 * o banco aceita — e o usuário levaria `body_too_long` num texto dentro do
 * limite anunciado. Achado do review da PR #246 (Codex, P2).
 */
function countCharacters(value: string): number {
  // `Intl.Segmenter` contaria grafemas (👨‍👩‍👧 = 1), divergindo do PostgreSQL na
  // direção oposta. Pontos de código é o que `LENGTH()` conta, e é o que o
  // iterador de string entrega.
  return [...value].length;
}

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
  if (countCharacters(input) > COMMENT_BODY_MAX_LENGTH) {
    return { ok: false, code: 'body_too_long' };
  }

  const bodyMarkdown = sanitizeUserMarkdown(input);

  // 2. Limite de novo, agora no Markdown canônico. Não é redundante: a
  // canonicalização pode crescer o texto (escape de caractere, normalização de
  // referência), e o que vai ao banco é este valor — o `CHECK` de
  // `community_comment_version` recusaria a linha, e a falha apareceria como
  // erro de banco em vez de `422` com motivo.
  if (countCharacters(bodyMarkdown) > COMMENT_BODY_MAX_LENGTH) {
    return { ok: false, code: 'body_too_long' };
  }

  // Corpo dentro do limite por pontos de código mas acima do teto de varredura
  // em unidades UTF-16 (só acontece fora do BMP — emoji, ideogramas raros).
  // Recusar aqui, com `body_too_long`, dá ao usuário o motivo verdadeiro; deixar
  // seguir devolveria `INVALID_COMMENT_LINK` para um corpo sem link nenhum.
  if (bodyMarkdown.length > MAX_SCAN_LENGTH) {
    return { ok: false, code: 'body_too_long' };
  }

  // 3. Links sobre o corpo já sanitizado e dentro do limite. A validação precisa
  // preceder `demoteCommentImages`: essa função assume que cada destino já foi
  // aprovado e não pode receber Markdown hostil diretamente.
  const violation = findCommentLinkViolation(bodyMarkdown);
  if (violation) {
    return { ok: false, code: 'INVALID_COMMENT_LINK', violation };
  }

  // 4. Imagem de comentário é referência clicável, nunca `<img>` (decisão 26).
  // O rebaixamento vem antes da prova de conteúdo visível porque o alt de
  // `![mapa](...)` não é texto visível para `markdownToPlainText`; depois de
  // convertido em link, passa a ser a legenda textual prometida ao autor.
  const canonicalBodyMarkdown = demoteCommentImages(bodyMarkdown);

  // 4b. O rebaixamento CRESCE o texto (`![alt](url)` vira link textual mais
  // longo), então o teto precisa ser reconferido sobre o valor canônico — é ele
  // que vai ao banco. Sem esta segunda checagem, um corpo logo abaixo do limite
  // com imagens passa aqui e estoura o `CHECK` de `community_comment_version`,
  // devolvendo erro de banco em vez do `body_too_long` com motivo (achado de
  // review, PR #259).
  if (countCharacters(canonicalBodyMarkdown) > COMMENT_BODY_MAX_LENGTH) {
    return { ok: false, code: 'body_too_long' };
  }

  // 5. Conteúdo visível (decisão 30). Espaço, HTML integralmente removido pela
  // sanitização, separador temático isolado ou marcador sem texto sanitizam para
  // vazio — e um comentário sem texto ocupa posição na árvore, gera notificação
  // e não diz nada a ninguém.
  if (markdownToPlainText(canonicalBodyMarkdown).trim().length === 0) {
    return { ok: false, code: 'body_empty' };
  }

  return { ok: true, bodyMarkdown: canonicalBodyMarkdown };
}
