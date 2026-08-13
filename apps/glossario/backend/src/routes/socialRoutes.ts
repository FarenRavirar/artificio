import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { betaModerationGuard, betaWriteGuard } from '../middlewares/betaWriteGuard.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';
import { upsertVote } from '../controllers/voteController.js';
import { getCommentsByTerm, createComment, deleteComment } from '../controllers/commentController.js';

const router = Router();

// Votos (exige login). Sob `/terms/:id` junto com os comentários: o `:id` aqui
// sempre foi id de termo, e deixá-lo na raiz do router voltaria a competir com
// os segmentos literais introduzidos abaixo.
router.post('/terms/:id/vote', authMiddleware, refreshUserRole, betaWriteGuard, upsertVote);

// Comentários
// `/terms/:id/comments` (coleção sob o termo) e `/comment/:id` (recurso
// individual) usam segmentos literais distintos de propósito: antes eram
// `/:id/comments` e `/comments/:id`, que o Express desempatava pela ordem de
// registro mas o contrato OpenAPI não — `no-ambiguous-paths` apontava o par, e
// qualquer consumidor sem o desempate do Express (gerador de cliente, proxy que
// roteia por path) podia casar o caminho errado (D-API-AMBIGUOUS-PATHS).
router.get('/terms/:id/comments', getCommentsByTerm); // Público
router.post('/terms/:id/comments', authMiddleware, refreshUserRole, betaWriteGuard, createComment); // Logado
// `betaModerationGuard` só aqui: é a única rota deste arquivo que é ação de
// moderação, não de contribuição. Vote e createComment seguem com o guard comum
// — moderador global não ganha passe livre para contribuir em beta.
router.delete('/comment/:id', authMiddleware, refreshUserRole, betaModerationGuard, deleteComment); // Logado (dono, admin ou moderador global)

export default router;
