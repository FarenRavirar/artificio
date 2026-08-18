import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth, type AuthenticatedRequest } from "@artificio/auth";

import { proxyToAccounts, readCorrelationId } from "./community-api.js";

/**
 * Fachada de moderação de comentário do `site` (achado de review, PR #274).
 *
 * ## Por que faltava, e o que isso causava
 *
 * O `site` montava apenas `/api/v1/community/conversation`
 * (`server.ts:211`) — a conversa e nada mais. Quando a política compartilhada
 * passou a oferecer `moderateRemove`/`moderateRestore` a quem tem papel global
 * de moderação, os botões apareceram nos três apps, mas no blog o
 * `POST /api/v1/community/moderation/comments/:id/removal` caía em `404`: o
 * administrador clicava em "Retirar (moderação)" e recebia "não foi possível
 * concluir a ação", sem nada no log dizendo o porquê.
 *
 * Esconder o botão no `site` era a outra saída, e é a errada: o acervo do blog
 * são 25 comentários importados do WordPress, sem conta por trás — o conteúdo
 * mais provável de precisar de moderação e o único que ninguém pode auto-retirar.
 *
 * ## O que ESTA fachada expõe, e o que deliberadamente não expõe
 *
 * Só **retirada e restauração**. A fila, o log, os casos, as versões, as
 * denúncias e os recursos ficam de fora: o `site` não tem workspace de
 * moderação (`CommunityModerationWorkspace` só é montado no `downloads`), e
 * abrir rota que nenhuma tela consome é superfície de ataque sem contrapartida.
 * Quando o blog ganhar a tela, as rotas entram junto com ela — o molde é
 * `downloads/backend/src/routes/communityModeration.ts`.
 *
 * ## O guard lê `role`, e aqui isso basta
 *
 * Diferente do `mesas`, que rebaixa o `moderator` central para `player` e por
 * isso precisa ler `globalRole` (`mesas/routes/communityModeration.ts:48`), o
 * `site` não tem papel de domínio: a sessão carrega o `role` que veio do
 * `accounts.` sem tradução nenhuma (`packages/auth/src/types.ts:7`). Ler
 * `session.user.role` aqui é ler o papel global.
 */

/**
 * Teto baixo de propósito, e bucket próprio.
 *
 * Retirar e restaurar comentário são operações raras e de alto impacto — 10 por
 * 15 minutos é o mesmo número que `strictRateLimiter` do `mesas` usa para estas
 * mesmas duas rotas. Não compartilha balde com `writeRateLimiter` da conversa
 * (60/15 min): um moderador ativo não pode consumir o orçamento de quem está
 * escrevendo comentário, nem o contrário.
 *
 * **Antes de `requireAuth`, e a ordem não é estética** (CodeQL
 * `js/missing-rate-limiting`, PRs #262 e #268): com a autenticação primeiro,
 * toda requisição paga verificação de JWT antes de qualquer freio, e a rota
 * vira amplificador. Seguro porque o balde chaveia por IP, que existe antes de
 * autenticar.
 */
const moderationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "rate_limited", detail: "Muitas requisições. Tente novamente em alguns minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

function requireCommentModerator(req: Request, res: Response, next: NextFunction): void {
  const role = (req as AuthenticatedRequest).session?.user.role;
  if (role !== "moderator" && role !== "admin") {
    res.status(403).json({
      error: "forbidden",
      correlation_id: readCorrelationId(req.header("x-correlation-id")),
    });
    return;
  }
  next();
}

const moderatorWrite = [moderationRateLimiter, requireAuth, requireCommentModerator];

export function communityModerationApi(): Router {
  const r = Router();

  r.post("/comments/:id/removal", moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
    proxyToAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/removal`, {
      // Moderação é sempre ação de alguém identificado: o `accounts.` resolve o
      // ator moderador a partir deste header e o grava no log de auditoria.
      actingUserId: (req as AuthenticatedRequest).session!.user.id,
      body: { reason: req.body?.reason },
    }).catch(next);
  });

  r.post("/comments/:id/restore", moderatorWrite, (req: Request, res: Response, next: NextFunction) => {
    proxyToAccounts(req, res, `/internal/v1/comments/${encodeURIComponent(req.params.id)}/restore`, {
      actingUserId: (req as AuthenticatedRequest).session!.user.id,
      body: { reason: req.body?.reason },
    }).catch(next);
  });

  return r;
}
