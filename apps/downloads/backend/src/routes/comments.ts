import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { readRateLimiter } from '../middleware/rateLimit';
import { sanitizeUserMarkdown } from '@artificio/content-editor/sanitize';

const router = Router();

/**
 * T5.7 (spec 090) — `download_comment` virou **somente leitura**.
 *
 * ## O que mudou e por quê
 *
 * A conversa passou a viver no `accounts.` (Fase 5): a criação acontece em
 * `POST /api/v1/community/conversation`, que valida o assunto pelo guard e
 * escreve no registro central. Esta rota perdeu o `POST` — não por
 * desativação preguiçosa, mas porque duas origens de escrita para o mesmo
 * conteúdo produzem divergência que ninguém reconcilia depois: comentário novo
 * aqui não apareceria na árvore, no ranking, na moderação nem na notificação.
 *
 * ## Por que a tabela NÃO é apagada
 *
 * T5.7 é explícita: retenção até o rollback e a reconciliação estarem
 * concluídos; exclusão é ação posterior, nominal e com backup próprio.
 * "Apagar tabela não é rollback — é perda de dado com outro nome" (T8.8).
 *
 * Medição de 2026-08-15: `download_comment` tem **0 linhas em produção** e 2 em
 * beta (exercício manual de 2026-08-11, corpo `asdfasdfasd`). O `GET` continua
 * servindo o que existir, para que nada suma da tela antes da decisão de
 * expurgo.
 */

/**
 * Leitura do acervo legado. Mantida para rollback e para não perder o que já
 * está gravado; a conversa viva é `GET /api/v1/community/conversation`.
 *
 * O limiter passou a ser o de leitura pelo mesmo motivo de T5.3b: consultar
 * lista pública não pode consumir orçamento de escrita.
 */
router.get('/:materialId', readRateLimiter, async (req: Request, res: Response) => {
  const comments = await db
    .selectFrom('download_comment')
    .select(['id', 'material_id', 'user_id', 'body', 'removed_at', 'created_at'])
    .where('material_id', '=', req.params.materialId)
    .orderBy('created_at', 'asc')
    .execute();

  return res.json(comments.map((comment) => ({
    ...comment,
    body: comment.removed_at ? null : sanitizeUserMarkdown(comment.body),
    removed_by_moderation: Boolean(comment.removed_at),
  })));
});

/**
 * `410 Gone`, e não `404`/`405`: o recurso existiu e foi retirado de propósito,
 * que é exatamente o que o código significa. `404` faria parecer erro de rota e
 * mandaria quem integrou procurar bug no caminho; `410` diz que a mudança é
 * definitiva e aponta o substituto.
 *
 * Cliente antigo em cache que ainda tente publicar recebe recusa explícita, não
 * um sucesso silencioso numa tabela que ninguém mais lê.
 */
router.post('/', (_req: Request, res: Response) => {
  return res.status(410).json({
    error: 'comments_moved',
    detail: 'Comentários agora são criados em POST /api/v1/community/conversation.',
  });
});

export default router;
