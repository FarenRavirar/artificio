/**
 * T2.4 — integridade de thread (requisito 8; decisões 3, 23).
 *
 * ## O que esta função é, e o que ela não é
 *
 * Ela decide **se um pai aceita a resposta** e **qual `(root_id, depth)` a linha
 * nova recebe**. Não escreve nada: quem abre a transação é o handler, e é lá que
 * a decisão precisa acontecer — `contrato-http-v1.md` §3 diz "invariantes na
 * mesma transação", porque validar antes de abrir a transação deixa janela para
 * o pai ser removido entre a checagem e o `INSERT`.
 *
 * Separar assim é o que torna as regras testáveis sem PostgreSQL: a busca do pai
 * é do handler (um `SELECT ... FOR SHARE` dentro da transação), a decisão é aqui.
 *
 * ## Por que duplicar o que o banco já garante
 *
 * O schema já tem `community_comment_depth_check` (`depth BETWEEN 0 AND 4`),
 * `community_comment_root_shape_check` e as FKs compostas
 * `community_comment_parent_subject_fk` / `_root_subject_fk`, que carregam
 * `(realm, source_app, subject_type, subject_id)` na chave — cross-subject e
 * cross-realm são **impossíveis por construção**, não por validação lembrada.
 *
 * Isto aqui não substitui nada disso: existe para o usuário receber
 * `422 depth_exceeded` em vez de um erro de constraint que o handler teria de
 * adivinhar. O banco continua sendo a autoridade; violá-lo deve ser impossível,
 * e esta função garante que a tentativa nem chegue lá.
 *
 * ## Resposta a legado é ACEITA (decisão 23)
 *
 * A versão anterior desta task recusava. O grilling reverteu: comentário
 * importado é imutável, sem voto e marcado como antigo, mas **pode ser pai** —
 * "antigo descreve proveniência, não congela a conversa". Não há checagem de
 * `legacy_*` aqui de propósito; o que impede voto e edição em legado é outra
 * task, e replicar a regra neste ponto criaria uma segunda fonte de verdade.
 */

/** Teto de profundidade: raiz é 0, resposta mais funda é 4 (cinco níveis visuais). */
export const MAX_COMMENT_DEPTH = 4;

/**
 * Estados em que um comentário **não** aceita resposta nova.
 *
 * Tombstone (`author_removed`/`moderator_removed`) preserva posição e filhos já
 * existentes, mas não recebe filho novo: a fala foi retirada, e pendurar resposta
 * nela produziria conversa sobre um texto que ninguém mais lê.
 * `pending_review_hidden` está sob decisão de moderação — aceitar resposta seria
 * deixar a thread crescer sob conteúdo que pode ser removido em seguida.
 */
const STATES_THAT_REFUSE_REPLIES = new Set([
  'author_removed',
  'moderator_removed',
  'pending_review_hidden',
]);

/** Identidade do assunto. Os quatro campos entram na chave desde a 006 (`spec.md` 5a). */
export interface CommentSubjectScope {
  realm: string;
  source_app: string;
  subject_type: string;
  subject_id: string;
}

/** O pai, como o `SELECT` da transação o entrega. */
export interface ParentComment extends CommentSubjectScope {
  id: string;
  root_id: string;
  depth: number;
  visibility_state: string;
}

export type ThreadRejectionCode =
  /** Pai em outro assunto, app ou realm — nunca revela qual (evita sondagem). */
  | 'parent_not_found'
  /** `depth` resultante passaria de 4. */
  | 'depth_exceeded'
  /** Pai retirado ou sob moderação. */
  | 'parent_not_accepting_replies';

export type ThreadPlacement =
  | { ok: true; parent_id: string | null; root_id: string | null; depth: number }
  | { ok: false; code: ThreadRejectionCode };

/**
 * Decide a posição estrutural de um comentário novo.
 *
 * `parent` ausente = comentário raiz. Devolve `root_id: null` porque a raiz só
 * conhece o próprio `id` **depois** do `INSERT` — `community_comment_root_shape_check`
 * exige `root_id = id` quando `depth = 0`, e é o handler que fecha isso na
 * mesma transação (`INSERT ... RETURNING id` seguido de `UPDATE`, ou `id` gerado
 * na aplicação). Devolver o `id` daqui exigiria gerar UUID nesta função, o que
 * a tornaria não determinística e impossível de testar por igualdade.
 *
 * `subject` é sempre o **derivado da credencial**, nunca o do payload
 * (`spec.md` 6a: `realm`/`source_app` vêm da credencial; o handler rejeita com
 * `400` quem tentar declará-los).
 */
export function placeComment(
  subject: CommentSubjectScope,
  parent: ParentComment | null,
): ThreadPlacement {
  if (!parent) {
    return { ok: true, parent_id: null, root_id: null, depth: 0 };
  }

  // Pai de outro assunto/app/realm é tratado como **inexistente**, não como
  // "proibido": distinguir os dois casos diria ao chamador que aquele id existe
  // em algum lugar, o que é sondagem de identificador entre realms.
  // `contrato-http-v1.md` §3 lista `404` para pai inexistente, e é o mesmo código
  // que o handler devolve aqui.
  const sameSubject =
    parent.realm === subject.realm &&
    parent.source_app === subject.source_app &&
    parent.subject_type === subject.subject_type &&
    parent.subject_id === subject.subject_id;

  if (!sameSubject) {
    return { ok: false, code: 'parent_not_found' };
  }

  if (STATES_THAT_REFUSE_REPLIES.has(parent.visibility_state)) {
    return { ok: false, code: 'parent_not_accepting_replies' };
  }

  const depth = parent.depth + 1;
  if (depth > MAX_COMMENT_DEPTH) {
    return { ok: false, code: 'depth_exceeded' };
  }

  // `root_id` vem do pai, nunca do cliente (`contrato-http-v1.md` §3: "`root_id` e
  // `depth` são calculados, nunca aceitos"). Aceitá-lo permitiria pendurar uma
  // resposta na árvore de outro comentário, quebrando a leitura em árvore sem
  // violar nenhuma FK.
  return { ok: true, parent_id: parent.id, root_id: parent.root_id, depth };
}
