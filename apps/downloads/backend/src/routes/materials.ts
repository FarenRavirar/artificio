import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Campos editaveis por publicador; toda mudanca grava download_material_version
// por campo (D111 item 7 — historico desde o primeiro commit, incl. link).
const EDITABLE_FIELDS = [
  'title',
  'summary',
  'description',
  'external_url',
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

// T2.1 — leitura publica de ficha, sem sessao. Fluxo completo de descoberta
// (busca/filtro/facetas) fica na spec 073; aqui so a leitura por slug.
router.get('/:slug', async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .selectAll()
    .where('slug', '=', req.params.slug)
    .where('editorial_state', '=', 'published')
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  return res.json(material);
});

// T2.2 — criacao autenticada. Estado editorial sempre nasce 'draft'; fila de
// moderacao completa fica na spec 072.
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { slug, title, material_type: materialType } = req.body ?? {};

  if (typeof slug !== 'string' || typeof title !== 'string' || typeof materialType !== 'string') {
    return res.status(400).json({ error: 'slug, title e material_type são obrigatórios.' });
  }

  const created = await db
    .insertInto('download_material')
    .values({
      slug,
      title,
      material_type: materialType,
      creator_id: req.user!.userId,
      editorial_state: 'draft',
      access_kind: 'external_link',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

// T2.2 + Ownership (T3.2) — publicador so edita o proprio material; moderador
// e admin editam qualquer um (autorizacao fina fica na spec 072).
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const isOwner = material.creator_id === req.user!.userId;
  const canEditAny = req.user!.role === 'moderator' || req.user!.role === 'admin';

  if (!isOwner && !canEditAny) {
    return res.status(403).json({ error: 'Você não tem permissão para editar este material.' });
  }

  const patch = req.body ?? {};
  const changes = EDITABLE_FIELDS.filter((field) => field in patch) as EditableField[];

  if (changes.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo editável enviado.' });
  }

  const updated = await db.transaction().execute(async (trx) => {
    for (const field of changes) {
      const oldValue = material[field];
      const newValue = patch[field];
      if (oldValue === newValue) continue;

      await trx
        .insertInto('download_material_version')
        .values({
          material_id: material.id,
          field_name: field,
          old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
          new_value: newValue !== null && newValue !== undefined ? String(newValue) : null,
          changed_by: req.user!.userId,
        })
        .execute();
    }

    return trx
      .updateTable('download_material')
      .set(Object.fromEntries(changes.map((field) => [field, patch[field]])))
      .set({ updated_at: new Date() })
      .where('id', '=', material.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  });

  return res.json(updated);
});

export default router;
