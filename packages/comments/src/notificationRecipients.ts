/**
 * T2.6c — quem recebe recibo quando um comentário nasce (decisões 1, 12c;
 * requisitos 14, 15, 15a, 15b, 15c, 16).
 *
 * ## Por que isto é uma função pura, separada da transação
 *
 * A regra de destinatário é **produto**, não persistência: "notificação segue
 * interação, não propriedade" (requisito 15, modelo WordPress/Facebook/Twitter).
 * Ela precisa de teste exaustivo — cada combinação de publicador, autor do pai e
 * ator —, e amarrá-la ao `INSERT` obrigaria PostgreSQL para provar uma decisão
 * que não depende de banco nenhum.
 *
 * O que **depende** da transação é o efeito: evento e recibos nascem junto do
 * comentário e falham junto (13c). Isso fica no handler.
 *
 * ## As três regras, e por que cada uma existe
 *
 * 1. **Raiz notifica o publicador; resposta notifica autor do pai E publicador**
 *    (15c). Os requisitos 14 e 15 se sobrepõem numa resposta, e o grilling fixou
 *    o conjunto explicitamente em vez de deixar a implementação decidir.
 * 2. **Destinatários iguais deduplicam para um recibo** (15c). Quem publicou o
 *    conteúdo e respondeu na própria conversa é uma pessoa só; dois recibos
 *    seriam dois sinos para o mesmo fato.
 * 3. **O ator nunca se notifica** (requisito 16), e conta removida ou bloqueada
 *    não recebe (15c).
 *
 * ## `null` não é erro — é o caso comum
 *
 * `owner_user_id` nulo é legítimo e **não inventa destinatário** (15a, 15b):
 * post do blog do `site` não tem conta vinculada (`site.posts` não tem
 * `author_user_id`), e mesa órfã do `mesas` também não. Comentar ali não notifica
 * ninguém; responder a um comentário continua notificando quem escreveu o pai —
 * é o que preserva a conversa mesmo sem dono.
 */

/** Quem pode receber, antes de aplicar exclusões. */
export interface RecipientCandidates {
  /** Publicador do conteúdo, afirmado pelo backend do domínio (§8). `null` é legítimo. */
  publisherUserId: string | null;
  /** Autor do comentário pai. `null` numa raiz, ou em pai legado (sem conta). */
  parentAuthorUserId: string | null;
  /** Quem está comentando. Nunca recebe recibo da própria ação. */
  actingUserId: string;
  /**
   * Contas que não podem receber: removidas, bloqueadas ou sem vínculo ativo.
   * Quem resolve isso é o handler, por consulta — aqui só entra o resultado.
   */
  ineligibleUserIds?: readonly string[];
}

/**
 * Destinatários finais de um comentário novo, já deduplicados.
 *
 * Ordem estável — publicador antes do autor do pai — para o `INSERT` em lote ser
 * determinístico e o teste poder comparar por igualdade. A ordem não tem
 * significado de produto.
 *
 * Devolver lista vazia é resultado normal, não falha: comentar num post sem conta
 * vinculada não notifica ninguém (15a).
 */
export function resolveNotificationRecipients(
  candidates: RecipientCandidates,
): string[] {
  const ineligible = new Set(candidates.ineligibleUserIds ?? []);

  const recipients: string[] = [];
  // `Set` faz a dedupe de 15c: publicador que também escreveu o pai recebe UM
  // recibo. A unicidade `(realm, source_app, event_id, recipient_user_id)` do
  // banco é a segunda barreira, não a primeira — chegar lá com duplicata
  // transformaria uma regra de produto em erro de constraint.
  const seen = new Set<string>();

  for (const candidate of [candidates.publisherUserId, candidates.parentAuthorUserId]) {
    if (!candidate) continue;
    // Requisito 16: o ator não se notifica. Vale para os dois papéis — quem
    // responde ao próprio comentário e quem comenta no próprio conteúdo.
    if (candidate === candidates.actingUserId) continue;
    if (ineligible.has(candidate)) continue;
    if (seen.has(candidate)) continue;

    seen.add(candidate);
    recipients.push(candidate);
  }

  return recipients;
}
