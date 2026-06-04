import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'kysely';

const router = Router();

/**
 * GET /api/v1/settings/suggest-styles?setting=<nome>
 * Retorna estilos sugeridos para um cenário específico (busca fuzzy)
 */
router.get('/suggest-styles', async (req: Request, res: Response) => {
  try {
    const { setting } = req.query;

    // CORREÇÃO DT-01: Validar se o parâmetro setting está presente e não vazio
    if (!setting || typeof setting !== 'string' || setting.trim().length === 0) {
      return res.status(400).json({ error: 'Query parameter "setting" é obrigatório' });
    }

    const safeSetting = setting.trim();

    // CORREÇÃO DT-01: Validar comprimento mínimo para evitar buscas muito genéricas
    if (safeSetting.length < 2) {
      return res.json({ suggestions: [] });
    }

    // CORREÇÃO DT-04: Usar DISTINCT ON para evitar duplicatas por setting_name
    const suggestions = await db
      .selectFrom('setting_style_suggestions')
      .distinctOn('setting_name')
      .select(['setting_name', 'suggested_styles'])
      .where((eb) => eb(sql`similarity(setting_name, ${safeSetting})`, '>=', sql`0.3`))
      .orderBy('setting_name')
      .orderBy(sql`similarity(setting_name, ${safeSetting})`, 'desc')
      .limit(5)
      .execute();

    return res.json({ suggestions });
  } catch (error) {
    console.error('Erro ao buscar sugestões de estilos:', error);
    return res.status(500).json({ error: 'Erro ao buscar sugestões de estilos' });
  }
});

export default router;
