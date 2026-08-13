import { Router } from 'express';
import { catalogHealth, listSystems, createSystem, updateSystem, deleteSystem, listEditions, createEdition, updateEdition, deleteEdition } from '../controllers/systemController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import { betaWriteGuard } from '../middlewares/betaWriteGuard.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

// `catalog-health`, não `health`: `/health` competia com `/:id` (hoje só
// `PUT`/`DELETE`, por isso o Redocly ainda não reclamava — mas o primeiro
// `GET /:id` adicionado transformaria isto no mesmo aviso que
// D-API-AMBIGUOUS-PATHS acabou de fechar). O `/health` do processo continua em
// `index.ts`; este aqui sempre foi a saúde do catálogo.
router.get('/catalog-health', catalogHealth);
router.get('/', listSystems);
router.post('/', authMiddleware, refreshUserRole, betaWriteGuard, createSystem); // Membros sugerem (pendente)
router.put('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, updateSystem);
router.delete('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, deleteSystem);

// Editions. A coleção fica sob o sistema (`/system/:systemId/editions`) e o
// recurso individual sob `/edition/:id`, com segmentos literais distintos: antes
// eram `/:systemId/editions` e `/editions/:id`, par que o `no-ambiguous-paths`
// apontava — o Express resolvia pela ordem de registro, o contrato OpenAPI não
// (D-API-AMBIGUOUS-PATHS).
router.get('/system/:systemId/editions', listEditions);
router.post('/system/:systemId/editions', authMiddleware, refreshUserRole, betaWriteGuard, createEdition); // Membros sugerem (pendente)
router.put('/edition/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, updateEdition);
router.delete('/edition/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, deleteEdition);

export default router;
