import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { requireAdmin } from '../../middleware/auth.js';

/**
 * Revisão dos mapeamentos de role/emoji do Discord (spec 099).
 *
 * O parser observa e propõe; aqui o mantenedor confirma. Vínculo inferido só
 * entra no parse depois de passar por `PATCH /:id` — dado errado no draft é
 * pior que dado ausente, porque ninguém revisa o que já parece certo.
 */
const router = Router();

const listSchema = z.object({
  guild_id: z.string().optional(),
  // 'pendentes' é o default: é a fila de trabalho. 'todos' serve para auditar
  // o que já foi decidido.
  escopo: z.enum(['pendentes', 'confirmados', 'todos']).optional().default('pendentes'),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const updateSchema = z
  .object({
    kind: z.enum(['system', 'style', 'setting', 'era', 'letter']).optional(),
    target_system_id: z.string().uuid().nullable().optional(),
    target_text: z.string().trim().min(1).max(200).nullable().optional(),
    /** `false` devolve o vínculo para a fila (desfaz confirmação anterior). */
    confirmar: z.boolean().optional().default(true),
  })
  // O CHECK da migration exige coerência entre tipo e alvo; validar aqui devolve
  // 400 legível em vez de deixar o Postgres recusar com erro de constraint.
  .refine((v) => !(v.kind === 'system' && v.target_text != null), {
    message: 'kind=system usa target_system_id, não target_text.',
  })
  .refine((v) => !(v.kind && v.kind !== 'system' && v.target_system_id != null), {
    message: 'Só kind=system aceita target_system_id.',
  });

// ─── GET /role-mappings — fila de revisão ────────────────────────────────────
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros inválidos.', details: z.flattenError(parsed.error) });
  }

  try {
    let query = db
      .selectFrom('discord_role_mappings as m')
      .leftJoin('systems as s', 's.id', 'm.target_system_id')
      .select([
        'm.id', 'm.guild_id', 'm.discord_id', 'm.source_type', 'm.kind',
        'm.target_system_id', 'm.target_text', 'm.source', 'm.occurrences',
        'm.confirmed_at', 'm.last_seen_text', 'm.last_seen_at',
        's.name as target_system_name',
      ])
      // Mais frequente primeiro: medido, 4 roles concentram 89 das ocorrências
      // em 2 servidores, então o topo da lista resolve quase tudo.
      .orderBy('m.occurrences', 'desc')
      .limit(parsed.data.limit);

    if (parsed.data.guild_id) query = query.where('m.guild_id', '=', parsed.data.guild_id);
    if (parsed.data.escopo === 'pendentes') query = query.where('m.confirmed_at', 'is', null);
    if (parsed.data.escopo === 'confirmados') query = query.where('m.confirmed_at', 'is not', null);

    const data = await query.execute();
    return res.json({ data });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/role-mappings]', error);
    return res.status(500).json({ error: 'Erro ao listar mapeamentos.' });
  }
});

// ─── PATCH /role-mappings/:id — confirmar ou corrigir ────────────────────────
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: z.flattenError(parsed.error) });
  }

  const { kind, target_system_id, target_text, confirmar } = parsed.data;
  // `req.user.userId` — o mesmo campo que as rotas irmãs usam (`drafts.ts:248`,
  // `duplicates.ts:132`). O cast local para `.id` que estava aqui não existia no
  // contrato do middleware, então `adminId` era SEMPRE null e toda confirmação perdia o
  // autor em `confirmed_by`, esvaziando a trilha de auditoria que a migration criou.
  // Achado do Codex (P2).
  const adminId = req.user?.userId ?? null;

  try {
    // Valida o estado FINAL (linha atual + patch), não só o patch.
    //
    // O `refine` do schema só enxerga os campos enviados, então trocar um mapeamento de
    // estilo para `kind: 'system'` sem limpar o `target_text` que já estava lá passava a
    // validação e só quebrava no CHECK do Postgres — devolvendo 500 opaco onde o certo é
    // um 400 que diz o que fazer. Achado do CodeRabbit.
    const atual = await db
      .selectFrom('discord_role_mappings')
      .select(['kind', 'target_system_id', 'target_text'])
      .where('id', '=', req.params.id)
      .executeTakeFirst();

    if (!atual) return res.status(404).json({ error: 'Mapeamento não encontrado.' });

    const finalKind = kind ?? atual.kind;
    const finalSystemId = target_system_id !== undefined ? target_system_id : atual.target_system_id;
    const finalText = target_text !== undefined ? target_text : atual.target_text;

    if (finalKind === 'system' && finalText != null) {
      return res.status(400).json({
        error: 'kind=system exige target_system_id e target_text nulo. Envie target_text: null.',
      });
    }
    if (finalKind !== 'system' && finalSystemId != null) {
      return res.status(400).json({
        error: 'Só kind=system aceita target_system_id. Envie target_system_id: null.',
      });
    }

    const [linha] = await db
      .updateTable('discord_role_mappings')
      .set({
        ...(kind !== undefined ? { kind } : {}),
        ...(target_system_id !== undefined ? { target_system_id } : {}),
        ...(target_text !== undefined ? { target_text } : {}),
        // Confirmação manual promove a origem: a partir daqui uma observação
        // nova do parser não sobrescreve mais o `kind` (ver `roleMappings.ts`).
        source: 'manual',
        confirmed_at: confirmar ? new Date() : null,
        confirmed_by: confirmar ? adminId : null,
        updated_at: new Date(),
      })
      .where('id', '=', req.params.id)
      .returningAll()
      .execute();

    if (!linha) return res.status(404).json({ error: 'Mapeamento não encontrado.' });
    return res.json({ data: linha });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord/role-mappings/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar mapeamento.' });
  }
});

// ─── DELETE /role-mappings/:id ───────────────────────────────────────────────
// Apagar não é o mesmo que rejeitar: o id volta a ser desconhecido e o parser
// pode reobservá-lo no próximo anúncio. Serve para limpar palpite errado.
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const apagados = await db
      .deleteFrom('discord_role_mappings')
      .where('id', '=', req.params.id)
      .returning(['id'])
      .execute();

    if (apagados.length === 0) return res.status(404).json({ error: 'Mapeamento não encontrado.' });
    return res.json({ data: { deleted: apagados.length } });
  } catch (error: unknown) {
    console.error('[DELETE /admin/discord/role-mappings/:id]', error);
    return res.status(500).json({ error: 'Erro ao apagar mapeamento.' });
  }
});

export default router;
