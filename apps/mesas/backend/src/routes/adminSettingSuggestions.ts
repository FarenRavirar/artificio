import { Router, Request, Response } from 'express';
import { db } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Todas as rotas exigem role admin
router.use(requireAdmin);

/**
 * GET /api/v1/admin/setting-suggestions
 * Lista todas as sugestões de estilos cadastradas
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const suggestions = await db
      .selectFrom('setting_style_suggestions')
      .selectAll()
      .orderBy('setting_name', 'asc')
      .execute();

    return res.json({ suggestions });
  } catch (error) {
    console.error('Erro ao listar sugestões:', error);
    return res.status(500).json({ error: 'Erro ao listar sugestões' });
  }
});

/**
 * POST /api/v1/admin/setting-suggestions
 * Cria nova sugestão de estilos para um cenário
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { setting_name, suggested_styles } = req.body;

    // CORREÇÃO DT-02: Validar array vazio e conteúdo
    if (!setting_name || typeof setting_name !== 'string' || setting_name.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Campo setting_name é obrigatório e deve ser uma string não vazia' 
      });
    }

    if (!suggested_styles || !Array.isArray(suggested_styles) || suggested_styles.length === 0) {
      return res.status(400).json({ 
        error: 'Campo suggested_styles é obrigatório e deve ser um array não vazio' 
      });
    }

    // CORREÇÃO DT-02: Validar que todos os itens do array são strings não vazias
    const validStyles = suggested_styles.filter(
      (style) => typeof style === 'string' && style.trim().length > 0
    );

    if (validStyles.length === 0) {
      return res.status(400).json({ 
        error: 'O array suggested_styles deve conter ao menos uma string válida' 
      });
    }

    const newSuggestion = await db
      .insertInto('setting_style_suggestions')
      .values({
        setting_name: setting_name.trim(),
        suggested_styles: validStyles,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return res.status(201).json({ suggestion: newSuggestion });
  } catch (error: unknown) {
    console.error('Erro ao criar sugestão:', error);

    // CORREÇÃO DT-03: Tratamento específico para constraint unique violation
    const dbError = error as { code?: string; constraint?: string };
    if (dbError.code === '23505' && dbError.constraint === 'setting_style_suggestions_setting_name_key') {
      return res.status(409).json({ 
        error: 'Já existe uma sugestão cadastrada para este cenário. Use PUT para atualizar.' 
      });
    }

    return res.status(500).json({ error: 'Erro ao criar sugestão' });
  }
});

/**
 * PUT /api/v1/admin/setting-suggestions/:id
 * Atualiza sugestão existente
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { setting_name, suggested_styles } = req.body;

    // CORREÇÃO DT-02: Validar array vazio e conteúdo
    if (!setting_name || typeof setting_name !== 'string' || setting_name.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Campo setting_name é obrigatório e deve ser uma string não vazia' 
      });
    }

    if (!suggested_styles || !Array.isArray(suggested_styles) || suggested_styles.length === 0) {
      return res.status(400).json({ 
        error: 'Campo suggested_styles é obrigatório e deve ser um array não vazio' 
      });
    }

    // CORREÇÃO DT-02: Validar que todos os itens do array são strings não vazias
    const validStyles = suggested_styles.filter(
      (style) => typeof style === 'string' && style.trim().length > 0
    );

    if (validStyles.length === 0) {
      return res.status(400).json({ 
        error: 'O array suggested_styles deve conter ao menos uma string válida' 
      });
    }

    const updated = await db
      .updateTable('setting_style_suggestions')
      .set({
        setting_name: setting_name.trim(),
        suggested_styles: validStyles,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      return res.status(404).json({ error: 'Sugestão não encontrada' });
    }

    return res.json({ suggestion: updated });
  } catch (error: unknown) {
    console.error('Erro ao atualizar sugestão:', error);

    // CORREÇÃO DT-03: Tratamento específico para constraint unique violation
    const dbError = error as { code?: string; constraint?: string };
    if (dbError.code === '23505' && dbError.constraint === 'setting_style_suggestions_setting_name_key') {
      return res.status(409).json({ 
        error: 'Já existe outra sugestão cadastrada com este nome de cenário.' 
      });
    }

    return res.status(500).json({ error: 'Erro ao atualizar sugestão' });
  }
});

/**
 * DELETE /api/v1/admin/setting-suggestions/:id
 * Remove sugestão
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await db
      .deleteFrom('setting_style_suggestions')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!deleted) {
      return res.status(404).json({ error: 'Sugestão não encontrada' });
    }

    return res.json({ message: 'Sugestão removida com sucesso', suggestion: deleted });
  } catch (error) {
    console.error('Erro ao remover sugestão:', error);
    return res.status(500).json({ error: 'Erro ao remover sugestão' });
  }
});

export default router;
