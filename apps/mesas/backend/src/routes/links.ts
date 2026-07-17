import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as linkService from '../services/linkService.js';

const router = Router();

/**
 * GET /api/v1/profile/links
 * Lista todos os links do usuário logado
 */
router.get('/links', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const links = await linkService.getUserLinks(userId);
    
    res.json({
      success: true,
      data: links,
    });
  } catch (error: unknown) {
    console.error('Error fetching user links:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar links',
    });
  }
});

/**
 * POST /api/v1/profile/links
 * Cria um novo link para o usuário logado
 */
router.post('/links', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL é obrigatória',
      });
    }
    
    const link = await linkService.createUserLink(userId, { url });
    
    res.status(201).json({
      success: true,
      data: link,
    });
  } catch (error: unknown) {
    console.error('Error creating user link:', error);

    const message = error instanceof Error ? error.message : undefined;

    if (message === 'URL inválida') {
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    if (message === 'Limite de 10 links atingido') {
      return res.status(400).json({
        success: false,
        error: message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao criar link',
    });
  }
});

/**
 * DELETE /api/v1/profile/links/:id
 * Remove um link do usuário logado
 */
router.delete('/links/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    
    await linkService.deleteUserLink(userId, id);
    
    res.json({
      success: true,
      message: 'Link removido com sucesso',
    });
  } catch (error: unknown) {
    console.error('Error deleting user link:', error);

    const message = error instanceof Error ? error.message : undefined;

    if (message === 'Link não encontrado') {
      return res.status(404).json({
        success: false,
        error: message,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao remover link',
    });
  }
});

/**
 * PATCH /api/v1/profile/links/reorder
 * Atualiza a ordem dos links
 */
router.patch('/links/reorder', authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { linkIds } = req.body;
    
    if (!Array.isArray(linkIds)) {
      return res.status(400).json({
        success: false,
        error: 'linkIds deve ser um array',
      });
    }
    
    await linkService.updateLinksOrder(userId, linkIds);
    
    res.json({
      success: true,
      message: 'Ordem atualizada com sucesso',
    });
  } catch (error: unknown) {
    console.error('Error reordering links:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao reordenar links',
    });
  }
});

export default router;
