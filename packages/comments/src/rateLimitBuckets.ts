/**
 * T2.10 — buckets de rate limit, compartilhados pelas duas camadas
 * (`spec.md` 12b, 27e; decisões 50 e 54; `contrato-http-v1.md` §14).
 *
 * ## Por que a definição mora aqui, e não no `accounts.`
 *
 * O contrato §14 dá às duas camadas **os mesmos seis buckets** — o que muda é a
 * chave, não a lista. Se cada lado declarasse a própria enumeração, a fachada
 * poderia proteger `voto` enquanto o `accounts.` só conhecesse `escrita`, e a
 * divergência apareceria como abuso passando por uma camada só. Aqui a lista é
 * uma união fechada: um bucket novo entra em um lugar e as duas camadas param de
 * compilar até tratá-lo.
 *
 * ## O que este módulo NÃO faz
 *
 * Não conta requisição, não guarda estado e não conhece `express`. Ele responde
 * duas perguntas puras — "qual bucket esta ação usa?" e "qual a chave?" — porque
 * é o que as duas camadas compartilham; o armazenamento é de cada uma
 * (`express-rate-limit` em memória no `accounts.`, o que a fachada escolher).
 *
 * ## A regra que o `downloads` não cumpre, e que não se replica
 *
 * `apps/downloads/backend/src/middleware/rateLimit.ts` chaveia **só por IP** e
 * devolve `message` em texto plano. Duas consequências: NAT vira bloqueio
 * coletivo (uma escola inteira sai por um IP), e a resposta foge do formato
 * único de erro (§13). Aqui a chave sempre carrega identidade, e o corpo do
 * `429` é montado pelo handler no formato do contrato.
 */

/**
 * As seis ações com orçamento próprio (§14).
 *
 * `authentication` **não** está na lista de propósito: é o bucket que já existe
 * no `accounts.` e que 12b manda **não** compartilhar. Deixá-lo fora daqui é o
 * que impede alguém de "reaproveitar" a cota de login para comentário sem
 * perceber — não há valor a passar.
 */
export const COMMENT_RATE_BUCKETS = [
  'read',
  'write',
  'edit',
  'vote',
  'report',
  'appeal',
] as const;

export type CommentRateBucket = (typeof COMMENT_RATE_BUCKETS)[number];

/**
 * Camada que aplica o limite.
 *
 * `facade` é o backend do módulo consumidor, que fala com o navegador e conhece
 * o IP real. `accounts` é a superfície interna, que **nunca** vê IP (decisão 54)
 * e chaveia por usuário e credencial.
 */
export type RateLimitLayer = 'facade' | 'accounts';

/**
 * Identidade disponível para compor a chave.
 *
 * `ip` é opcional **e** deve ficar ausente na camada `accounts` — não é
 * displicência de tipo, é a regra 54: IP bruto não é propagado ao `accounts.`
 * como dado do comentário. `buildRateLimitKey` recusa a combinação.
 */
export interface RateLimitIdentity {
  /** `users.id` de quem age. `null` em leitura pública sem sessão. */
  userId: string | null;
  /** `source_app` da credencial de serviço. Só na camada `accounts`. */
  sourceApp?: string;
  /** IP real já validado pelo ingress. Só na camada `facade`. */
  ip?: string;
}

/**
 * Chave de um bucket, na forma que o armazenamento usa.
 *
 * Uma chave por (camada, bucket, identidade). **Não existe chave composta
 * IP+usuário** (§14): compor os dois num identificador só faria o usuário
 * legítimo atrás de NAT herdar o consumo do vizinho, e um atacante trocar de IP
 * para zerar o próprio contador. As duas dimensões viram **chaves separadas**, e
 * `resolveRateLimitKeys` devolve as duas para que ambas precisem liberar.
 */
export interface RateLimitKey {
  layer: RateLimitLayer;
  bucket: CommentRateBucket;
  /** Dimensão da chave — o que a torna distinta de outra do mesmo bucket. */
  dimension: 'user' | 'ip' | 'credential';
  value: string;
}

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitConfigurationError';
  }
}

/**
 * Todas as chaves que precisam liberar para a ação passar.
 *
 * "Todos os buckets aplicáveis precisam permitir a operação" (§14) é implementado
 * devolvendo **uma lista**: quem chama consulta cada uma e recusa no primeiro
 * estouro. Devolver uma chave só transformaria a regra em "algum bucket permite",
 * que é o oposto.
 *
 * Leitura pública sem sessão (`userId: null`) na fachada é chaveada só por IP —
 * é o único caso em que não há identidade melhor, e recusar a leitura por falta
 * de conta contradiria o produto (a conversa é pública).
 */
export function resolveRateLimitKeys(
  layer: RateLimitLayer,
  bucket: CommentRateBucket,
  identity: RateLimitIdentity,
): RateLimitKey[] {
  if (layer === 'accounts') {
    // Decisão 54, verificada e não presumida: IP não chega ao `accounts.`. Se um
    // chamador passar mesmo assim, é erro de configuração — falhar aqui é o que
    // impede o IP de virar chave persistida por engano.
    if (identity.ip !== undefined) {
      throw new RateLimitConfigurationError(
        'IP não é propagado ao accounts. (decisão 54): use a camada facade',
      );
    }
    if (!identity.sourceApp) {
      throw new RateLimitConfigurationError(
        'camada accounts exige sourceApp da credencial de serviço',
      );
    }

    const keys: RateLimitKey[] = [
      { layer, bucket, dimension: 'credential', value: identity.sourceApp },
    ];
    // Usuário ausente na camada interna significa leitura sem `X-Acting-User-Id`,
    // que o contrato permite (§2: o header é opcional na leitura). A credencial
    // sozinha continua limitando — um módulo com bug não derruba o SSO.
    if (identity.userId !== null) {
      keys.push({ layer, bucket, dimension: 'user', value: identity.userId });
    }
    return keys;
  }

  if (identity.sourceApp !== undefined) {
    throw new RateLimitConfigurationError(
      'camada facade não usa credencial de serviço: ela fala com o navegador',
    );
  }
  if (!identity.ip) {
    throw new RateLimitConfigurationError('camada facade exige IP real validado');
  }

  const keys: RateLimitKey[] = [{ layer, bucket, dimension: 'ip', value: identity.ip }];
  if (identity.userId !== null) {
    keys.push({ layer, bucket, dimension: 'user', value: identity.userId });
  }
  return keys;
}

/**
 * Serializa a chave para o armazenamento.
 *
 * A camada entra no prefixo porque o mesmo `source_app` existe em beta e em
 * produção com credenciais distintas, e o mesmo usuário aparece nas duas
 * camadas: sem o prefixo, o consumo da fachada abateria o orçamento interno.
 *
 * O valor é usado como está, sem hash: esta chave vive **em memória, pelo TTL do
 * bucket** (decisão 54), e nunca é persistida, logada ou auditada. Hashear daria
 * a impressão de que ela pode ser guardada — pode não.
 */
export function serializeRateLimitKey(key: RateLimitKey): string {
  return `${key.layer}:${key.bucket}:${key.dimension}:${key.value}`;
}
