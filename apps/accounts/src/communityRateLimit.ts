import type { NextFunction, Request, Response } from "express";
import {
  resolveRateLimitKeys,
  serializeRateLimitKey,
  type CommentRateBucket,
} from "@artificio/comments";
import type { ServiceAuthenticatedRequest } from "./requireServiceCredential.js";
import type { Kysely } from "kysely";
import type { Database } from "./db.js";
import {
  COMMUNITY_NEW_ACCOUNT_WRITE_LIMIT,
  isCommunityNewAccountPolicyEnabled,
  readCommunityAccountStatus,
} from "./communityNewAccount.js";

/**
 * T2.10 — buckets independentes da camada `accounts.`
 * (`spec.md` 12b; decisões 50, 54; `contrato-http-v1.md` §14).
 *
 * ## O problema que isto corrige, medido antes de escrever
 *
 * `app.ts:201` registra **um** `rateLimit` global de 200 requisições por 15
 * minutos, sem `keyGenerator`, **antes** de `cookieParser`, `csrfProtection`,
 * `express.json` e `cors`. Ele cobre a aplicação inteira: `/login`, `/me`,
 * `/refresh` e as cinco rotas de comentário já entregues dividem o mesmo
 * orçamento. Uma thread ativa consome a cota de login do próprio usuário — é
 * exatamente o que 12b proíbe ("nenhum consome cota de login, `/me` ou
 * refresh").
 *
 * ## O regime de chaveamento, medido em produção (2026-08-09)
 *
 * Três `GET https://accounts.artificiorpg.com/health` da estação do mantenedor
 * devolveram `ratelimit-remaining` 199 → 198 → 197; o mesmo `GET` disparado da
 * VM, com IP de saída distinto, devolveu **199**. Contadores independentes por
 * origem, logo `X-Forwarded-For` chega e é honrado: `cloudflared` é
 * `172.18.0.23` e `accounts-api` é `172.18.0.17`, ambos dentro do
 * `172.18.0.0/16` de `TRUSTED_PROXY_CIDR`. O cenário ruim — cota única para o
 * SSO inteiro — está descartado.
 *
 * Isso **não** torna o IP utilizável aqui: a decisão 54 diz que IP bruto não é
 * propagado ao `accounts.` como dado do comentário, e `resolveRateLimitKeys`
 * recusa a combinação. A medição serviu para dimensionar, não para mudar a
 * chave.
 *
 * ## Duas dimensões, duas chaves, nunca uma composta
 *
 * Usuário e credencial são contadas **separadamente** (§14). Uma chave composta
 * `usuário+credencial` faria o mesmo usuário ganhar orçamento novo a cada
 * `source_app`, e um módulo com bug consumiria a cota de todos os usuários dele
 * sem estourar nada. Separadas, o abuso individual para no bucket do usuário e o
 * módulo descontrolado para no da credencial — sem derrubar o SSO.
 *
 * ## O que não se replica do `downloads`
 *
 * `apps/downloads/backend/src/middleware/rateLimit.ts` chaveia só por IP e
 * responde `message` em texto plano. NAT vira bloqueio coletivo, e o corpo foge
 * do formato único de erro. Aqui a chave carrega identidade e o `429` sai no
 * formato do §13, sem dizer qual bucket estourou.
 */

/** Janela única para todos os buckets. Valor operacional, não contrato (§14). */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Orçamento por bucket e dimensão, em requisições por janela.
 *
 * Os números são **configuração operacional** (§14) e refletem custo e
 * frequência legítima, não simetria: um usuário lê muito mais do que escreve, e
 * vota muito mais do que comenta (é a razão pela qual a decisão 11 exige bucket
 * próprio para voto em vez de reaproveitar o de escrita).
 *
 * O orçamento da **credencial** é maior por ordem de grandeza porque ele conta o
 * módulo inteiro — todos os usuários do `downloads` somados —, enquanto o do
 * usuário conta uma pessoa. Igualar os dois faria o bucket da credencial disparar
 * com tráfego normal e derrubar o app inteiro.
 */
const BUDGETS: Record<CommentRateBucket, { user: number; credential: number }> = {
  read: { user: 300, credential: 6000 },
  write: { user: 30, credential: 600 },
  edit: { user: 30, credential: 600 },
  // Voto é mutação barata e de alta frequência legítima — quem lê uma thread
  // longa vota em vários comentários na mesma sessão (decisão 11).
  vote: { user: 120, credential: 2400 },
  // Denúncia legítima é rara; volume alto do mesmo ator é o próprio sinal de
  // abuso que a decisão 33 quer conter.
  report: { user: 20, credential: 400 },
  // Recurso é uma vez por decisão terminal (decisão 47). O orçamento existe
  // contra automação, não contra uso normal.
  appeal: { user: 10, credential: 200 },
};

interface Counter {
  count: number;
  resetAt: number;
}

/**
 * Armazenamento em memória, com TTL — nunca persistido (decisão 54).
 *
 * Em memória e não no banco porque a chave carrega identidade e o contrato diz
 * que ela existe **somente pelo TTL do bucket**. Gravar em tabela criaria um
 * registro de atividade por usuário que nenhuma decisão autorizou, e que teria
 * de entrar no fluxo de exclusão de conta (decisão 53).
 *
 * Consequência aceita e explícita: reiniciar o processo zera os contadores, e
 * duas réplicas contam separado. Para o volume atual do projeto isso é adequado;
 * quando deixar de ser, a troca é do armazenamento, não do desenho das chaves.
 */
class MemoryCounterStore {
  private readonly counters = new Map<string, Counter>();
  private lastSweep = 0;

  /** Incrementa e devolve `true` se a requisição cabe no orçamento. */
  hit(key: string, limit: number, now: number): boolean {
    this.sweep(now);

    const current = this.counters.get(key);
    if (!current || current.resetAt <= now) {
      this.counters.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    // Incrementa **mesmo estourando**: sem isso, quem já passou do teto
    // continuaria batendo sem custo e a janela nunca refletiria a rajada.
    current.count += 1;
    return current.count <= limit;
  }

  /**
   * Remove contadores vencidos.
   *
   * Necessário porque o `Map` cresceria com o número de identidades distintas
   * vistas desde o boot, não com o de identidades ativas — um vazamento lento
   * que só apareceria em produção, semanas depois. A varredura é amortizada: uma
   * por janela, não por requisição.
   */
  private sweep(now: number): void {
    if (now - this.lastSweep < WINDOW_MS) return;
    this.lastSweep = now;
    for (const [key, counter] of this.counters) {
      if (counter.resetAt <= now) this.counters.delete(key);
    }
  }

  /** Só para teste: zera o estado entre casos. */
  reset(): void {
    this.counters.clear();
    this.lastSweep = 0;
  }
}

/**
 * Store por instância de app, criado em `createCommunityCommentRoutes`.
 *
 * **Não** é um singleton de módulo. Um contador global sobreviveria entre
 * instâncias de `createApp`, e foi exatamente o que aconteceu ao escrever isto:
 * doze testes de outros arquivos passaram a receber `429`, porque compartilhavam
 * o contador do mesmo usuário fictício com o arquivo que exercita o limite.
 *
 * O sintoma foi em teste, mas o defeito não é de teste: duas instâncias de app
 * no mesmo processo — o que qualquer harness ou servidor multi-tenant pode
 * fazer — dividiriam orçamento sem nada no desenho dizendo que dividem.
 */
export function createRateLimitStore(): MemoryCounterStore {
  return new MemoryCounterStore();
}

export type CommunityRateLimitStore = MemoryCounterStore;

/**
 * `X-Acting-User-Id` como identidade do bucket.
 *
 * Header malformado vira `null` em vez de `400`: quem valida o formato é o
 * handler, e recusar aqui trocaria a mensagem de erro correta por uma de limite.
 * Sem usuário, a credencial ainda limita.
 */
function readActingUserId(req: Request): string | null {
  const header = req.headers["x-acting-user-id"];
  return typeof header === "string" && header.length > 0 && header.length <= 64
    ? header
    : null;
}

/**
 * Guard de bucket. Aplicado **depois** de `requireServiceCredential`, porque a
 * chave da credencial vem da identidade que ele resolve.
 *
 * A ordem importa em segurança: limitar antes de autenticar deixaria um chamador
 * sem credencial consumir o orçamento de um `source_app` legítimo só por
 * declarar o header.
 */
export function communityRateLimit(
  store: CommunityRateLimitStore,
  bucket: CommentRateBucket,
  options?: { classifyNewAccountWith?: Kysely<Database> },
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const credential = (req as ServiceAuthenticatedRequest).serviceCredential;
    if (!credential) {
      // Chegar aqui sem credencial significa erro de montagem de rota: este
      // middleware roda **depois** de `requireServiceCredential`, que responde
      // `401`/`403` sem chamar `next()`. Recusar em vez de seguir — deixar
      // passar entregaria a rota sem bucket **e** sem autenticação, que é pior
      // que negar (achado de review, PR #251).
      //
      // A proteção da tentativa não autenticada não é feita aqui: é o limiter
      // pré-auth por IP de `app.ts`, que roda antes do Argon2.
      res.status(401).json({ error: { code: "unauthorized", correlation_id: null } });
      return;
    }

    const actingUserId = readActingUserId(req);
    const credentialRealm = credential.realm;
    const keys = resolveRateLimitKeys("accounts", bucket, {
      userId: actingUserId,
      sourceApp: credential.sourceApp,
    });

    void applyRateLimit().catch(next);

    async function applyRateLimit(): Promise<void> {
      const accountStatus =
        bucket === "write" &&
        isCommunityNewAccountPolicyEnabled(credentialRealm) &&
        options?.classifyNewAccountWith &&
        actingUserId
          ? await readCommunityAccountStatus(options.classifyNewAccountWith, actingUserId)
          : null;

      const now = Date.now();
      const budget = BUDGETS[bucket];

    // **Todas** as chaves são consultadas, e todas precisam liberar (§14). O
    // laço não sai no primeiro `false`: parar cedo deixaria a segunda dimensão
    // sem contabilizar a requisição, e um atacante que estoura de propósito o
    // bucket do usuário congelaria o contador da credencial.
      let allowed = true;
      for (const key of keys) {
        const limit =
          key.dimension === "user" && accountStatus?.isNew
            ? COMMUNITY_NEW_ACCOUNT_WRITE_LIMIT
            : key.dimension === "user"
              ? budget.user
              : budget.credential;
        if (!store.hit(serializeRateLimitKey(key), limit, now)) {
          allowed = false;
        }
      }

      if (allowed) {
        next();
        return;
      }

    // Formato único de erro (§13), **sem** dizer qual bucket disparou, quanto
    // resta ou qual dimensão estourou (decisão 50): esses números diriam ao
    // atacante como calibrar a próxima rajada, e revelariam se outro usuário do
    // mesmo módulo está ativo.
    //
    // Sem `RateLimit-*` nem `Retry-After` pelo mesmo motivo — são exatamente o
    // saldo que a decisão manda não revelar.
      const header = req.headers["x-correlation-id"];
      const correlationId =
        typeof header === "string" && header.length <= 128 ? header : null;

      res.status(429).json({ error: { code: "rate_limited", correlation_id: correlationId } });
    }
  };
}
