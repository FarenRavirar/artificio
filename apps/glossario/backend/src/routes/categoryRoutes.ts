import { Router } from 'express';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { authMiddleware, adminMiddleware } from '../middlewares/authMiddleware.js';
import { betaWriteGuard } from '../middlewares/betaWriteGuard.js';
import { refreshUserRole } from '../middlewares/refreshUserRole.js';

const router = Router();

router.get('/', listCategories);
router.post('/', authMiddleware, refreshUserRole, betaWriteGuard, createCategory);  // Membros podem sugerir (ficam pendentes)
router.put('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, updateCategory);
router.delete('/:id', authMiddleware, refreshUserRole, betaWriteGuard, adminMiddleware, deleteCategory);

export default router;
