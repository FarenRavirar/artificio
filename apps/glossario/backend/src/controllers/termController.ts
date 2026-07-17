import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { sanitizeTermFields } from '../utils/sanitizeText.js';
import { notifyTermOwnerOnModeration } from '../services/notificationService.js';
import { getCatalogNameMap } from '../services/catalogClient.js';
import type { AuthedRequest } from '../types/express.js';

export const listTerms = async (req: Request, res: Response) => {
  try {
    const { search, system, category } = req.query;
    const rawLimit = Number(req.query.limit ?? 80);
    const rawOffset = Number(req.query.offset ?? 0);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 80;
    const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;
    const normalizedSearch = typeof search === 'string' ? search.trim() : '';

    let query = `
      SELECT t.*,
             t.nucleus as source_tier,
             sc.name as scenario_name,
             CASE
               WHEN cg.id IS NOT NULL THEN cp.name
               WHEN cp.id IS NOT NULL AND cp.parent_id IS NULL THEN c.name
               ELSE c.name
             END as category_name,
             CASE
               WHEN cg.id IS NOT NULL THEN c.name
               ELSE NULL
             END as subcategory_name,
             u.full_name as added_by_name,
             th.last_changed_at,
             COUNT(*) OVER() as total_count
      FROM terms t
      LEFT JOIN scenarios sc ON t.scenario_id = sc.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories cp ON c.parent_id = cp.id
      LEFT JOIN categories cg ON cp.parent_id = cg.id
      LEFT JOIN users u ON t.added_by = u.id
      LEFT JOIN (
        SELECT term_id, MAX(changed_at) AS last_changed_at
        FROM public.term_history
        GROUP BY term_id
      ) th ON th.term_id = t.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (normalizedSearch) {
      params.push(`%${normalizedSearch}%`);
      query += ` AND (t.name_en ILIKE $${params.length} OR t.name_pt ILIKE $${params.length})`;
    }

    if (system) {
      params.push(system);
      query += ` AND t.system_id = $${params.length}`;
    }

    if (category) {
      params.push(category);
      query += ` AND t.category_id = $${params.length}`;
    }

    // Por padrão, não-admins só veem verificados ou suas próprias sugestões
    // Mas para o beta, vamos mostrar tudo que não foi rejeitado
    query += ` AND t.status != 'rejeitado'`;

    if (normalizedSearch) {
      query += ` ORDER BY
        CASE
          WHEN t.name_en ILIKE $1 OR t.name_pt ILIKE $1 THEN 0
          ELSE 1
        END,
        t.name_en ASC,
        t.created_at DESC`;
    } else {
      query += ` ORDER BY t.created_at DESC`;
    }

    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    const totalCount = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const rows = await hydrateCatalogNames(result.rows.map(({ total_count: _total_count, ...row }) => row));
    res.setHeader('X-Total-Count', String(totalCount));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar termos.' });
  }
};

export const createTerm = async (req: AuthedRequest, res: Response) => {
  const raw = req.body;
  const sanitized = sanitizeTermFields(raw);
  const {
    name_en, name_pt, nucleus, source_type,
    system_id, edition_id, scenario_id, category_id,
    book_reference, page_reference, additional_info
  } = { ...raw, ...sanitized };

  try {
    // Validação básica para termo Oficial
    if (nucleus === 'oficial' && (!book_reference || !page_reference)) {
      return res.status(400).json({ message: 'Termos oficiais exigem Livro e Página de referência.' });
    }

    // Se for Admin, já nasce verificado. Se for membro, nasce pendente.
    const status = req.user?.role === 'admin' ? 'verificado' : 'pendente';

    const result = await db.query(
      `INSERT INTO terms (
        name_en, name_pt, nucleus, status, source_type,
        system_id, edition_id, scenario_id, category_id,
        book_reference, page_reference, additional_info, added_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        name_en, name_pt, nucleus, status, source_type,
        system_id, edition_id, scenario_id, category_id,
        book_reference, page_reference, additional_info, req.user?.id
      ]
    );

    const term = result.rows[0];
    res.status(201).json({ ...term, source_tier: term.nucleus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao sugerir termo.' });
  }
};

export const approveTerm = async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  req.body = { ...req.body, ...sanitizeTermFields(req.body) };
  const { nucleus, category_id, status } = req.body; // Permite ao admin corrigir no ato da aprovação

  try {
    const result = await db.query(
      `UPDATE terms
       SET status = $1,
           nucleus = COALESCE($2, nucleus),
           category_id = COALESCE($3, category_id),
           reviewed_by = $4,
           reviewed_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status || 'verificado', nucleus || null, category_id || null, req.user?.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Termo não encontrado.' });
    }

    const term = result.rows[0];
    try {
      await notifyTermOwnerOnModeration({
        termId: term.id,
        actorId: req.user?.id ?? '',
        status: term.status ?? null,
        eventType: 'term.moderated',
      });
    } catch (notifyError) {
      console.error('[notifications] Falha ao gerar notificação de moderação:', notifyError);
    }

    res.json({ ...term, source_tier: term.nucleus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao moderar termo.' });
  }
};

const UPDATE_TERM_ALLOWED_FIELDS = [
  'name_en',
  'name_pt',
  'nucleus',
  'status',
  'source_type',
  'system_id',
  'edition_id',
  'scenario_id',
  'category_id',
  'book_reference',
  'page_reference',
  'additional_info',
] as const;

const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

// Achado Sonar (PR #145): updateTerm tinha complexidade cognitiva 19 (validacao
// de negocio + montagem de UPDATE + hidratacao + notificacao, tudo num bloco).
// Validacao de negocio extraida para reduzir aninhamento no handler.
function validateUpdateTermBusinessRules(
  body: Record<string, unknown>,
  current: Record<string, unknown>,
  hasField: (field: (typeof UPDATE_TERM_ALLOWED_FIELDS)[number]) => boolean,
): string | null {
  const finalNucleus = hasField('nucleus') ? body.nucleus : current.nucleus;
  const finalBookReference = hasField('book_reference') ? body.book_reference : current.book_reference;
  const finalPageReference = hasField('page_reference') ? body.page_reference : current.page_reference;
  const finalSourceType = hasField('source_type') ? body.source_type : current.source_type;
  const finalSystemId = hasField('system_id') ? body.system_id : current.system_id;
  const finalScenarioId = hasField('scenario_id') ? body.scenario_id : current.scenario_id;

  if (finalNucleus === 'oficial' && (!hasText(finalBookReference) || !hasText(finalPageReference))) {
    return 'Termos oficiais exigem Livro e Página de referência.';
  }
  if (finalSourceType === 'sistema' && !finalSystemId) {
    return 'Termos do tipo sistema exigem um sistema vinculado.';
  }
  if (finalSourceType === 'cenario' && !finalScenarioId) {
    return 'Termos do tipo cenário exigem um cenário vinculado.';
  }
  return null;
}

async function hydrateUpdatedTerm(updatedId: string) {
  const hydrated = await db.query(
    `SELECT t.*,
            t.nucleus as source_tier,
            sc.name as scenario_name,
            CASE
              WHEN cg.id IS NOT NULL THEN cp.name
              WHEN cp.id IS NOT NULL AND cp.parent_id IS NULL THEN c.name
              ELSE c.name
            END as category_name,
            CASE
              WHEN cg.id IS NOT NULL THEN c.name
              ELSE NULL
            END as subcategory_name,
            u.full_name as added_by_name
     FROM terms t
     LEFT JOIN scenarios sc ON t.scenario_id = sc.id
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN categories cp ON c.parent_id = cp.id
     LEFT JOIN categories cg ON cp.parent_id = cg.id
     LEFT JOIN users u ON t.added_by = u.id
     WHERE t.id = $1`,
    [updatedId]
  );
  const [updatedTerm] = await hydrateCatalogNames(hydrated.rows);
  return updatedTerm;
}

export const updateTerm = async (req: AuthedRequest, res: Response) => {
  const { id } = req.params;
  req.body = { ...req.body, ...sanitizeTermFields(req.body) };

  const hasField = (field: (typeof UPDATE_TERM_ALLOWED_FIELDS)[number]) =>
    Object.prototype.hasOwnProperty.call(req.body, field);

  try {
    const existing = await db.query('SELECT * FROM terms WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Termo não encontrado.' });
    }

    const businessRuleError = validateUpdateTermBusinessRules(req.body, existing.rows[0], hasField);
    if (businessRuleError) {
      return res.status(400).json({ message: businessRuleError });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of UPDATE_TERM_ALLOWED_FIELDS) {
      if (hasField(field)) {
        values.push(req.body[field]);
        updates.push(`${field} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'Nenhum campo válido foi enviado para atualização.' });
    }

    values.push(id);

    const updateResult = await db.query(
      `UPDATE terms
       SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    const updatedTerm = await hydrateUpdatedTerm(updateResult.rows[0]?.id);
    try {
      await notifyTermOwnerOnModeration({
        termId: updatedTerm.id,
        actorId: req.user?.id ?? '',
        status: updatedTerm.status ?? null,
        eventType: 'term.updated',
      });
    } catch (notifyError) {
      console.error('[notifications] Falha ao gerar notificação de atualização de termo:', notifyError);
    }

    res.json(updatedTerm);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao atualizar termo.' });
  }
};

export const deleteTerm = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM terms WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Termo não encontrado.' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao excluir termo.' });
  }
};

export const getTermHistory = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT th.id,
              th.field,
              th.old_value,
              th.new_value,
              th.changed_at,
              u.full_name AS changed_by_name
       FROM public.term_history th
       LEFT JOIN public.users u ON u.id = th.changed_by
       WHERE th.term_id = $1
       ORDER BY th.changed_at DESC, th.id DESC
       LIMIT 100`,
      [id]
    );

    const groupedMap = new Map<
      string,
      { changed_at: string; changed_by_name: string | null; changes: Array<{ field: string; old_value: string | null; new_value: string | null }> }
    >();

    for (const row of result.rows) {
      const key = String(row.changed_at);
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          changed_at: row.changed_at,
          changed_by_name: row.changed_by_name ?? null,
          changes: [],
        });
      }
      groupedMap.get(key)!.changes.push({
        field: row.field,
        old_value: row.old_value,
        new_value: row.new_value,
      });
    }

    const events = Array.from(groupedMap.values());
    return res.json({
      term_id: id,
      last_changed_at: events[0]?.changed_at ?? null,
      events,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Erro ao carregar histórico do termo.' });
  }
};

// Achado CodeRabbit (PR #145): rows vinha de result.rows (any[] do driver pg)
// sem validacao de shape antes do .map. Array.isArray + checagem de tipo por
// campo evita propagar valor inesperado (ex.: system_id nao-string) ao mapa.
async function hydrateCatalogNames<T extends { system_id?: string | null; edition_id?: string | null }>(rows: T[]): Promise<Array<T & { system_name: string | null; edition_name: string | null }>> {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const names = await getCatalogNameMap();
  return rows.map((row) => ({
    ...row,
    system_name: typeof row.system_id === 'string' ? names.get(row.system_id) ?? null : null,
    edition_name: typeof row.edition_id === 'string' ? names.get(row.edition_id) ?? null : null,
  }));
}
