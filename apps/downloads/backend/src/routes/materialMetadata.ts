import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import type { JSONColumnType } from '../db/types';

const router = Router();

// T2.2/DEB-072-01 — escrita de taxonomia condicional/opcional
// (download_material_metadata, já existente desde 070). T1.4/DEB-072-02 —
// validação cruzada: edição (`vtt_platform`... não, "edição" aqui é a
// edição de sistema/regra, não a de texto) só faz sentido quando o material
// já tem system_id — se não tem sistema, não pode ter tag de plataforma VTT
// específica de sistema (regra mínima; mais regras entram quando o
// formulário real da spec 074 expuser outros campos condicionais).
const upsertMetadataSchema = z.object({
  scenario: z.string().trim().max(100).nullable().optional(),
  genre: z.string().trim().max(100).nullable().optional(),
  language: z.string().trim().max(20).nullable().optional(),
  file_format: z.string().trim().max(30).nullable().optional(),
  vtt_platform: z.string().trim().max(60).nullable().optional(),
  access_barriers: z.array(z.string()).optional(),
  license_kind: z.string().trim().max(60).nullable().optional(),
  license_url: z.url().trim().nullable().optional(),
  credits: z.string().trim().nullable().optional(),
  publisher_name: z.string().trim().max(120).nullable().optional(),
  cover_image_url: z.url().trim().nullable().optional(),
  target_audience: z.string().trim().max(60).nullable().optional(),
  age_rating: z.string().trim().max(20).nullable().optional(),
  content_warnings: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

// Leitura publica so para material ja aprovado — draft/rejected/withdrawn
// nao vazam metadados a quem nao tem permissao de ver o proprio material
// (mesmo padrao de acesso de materials.ts GET /:slug).
router.get('/:materialId', async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .select('editorial_state')
    .where('id', '=', req.params.materialId)
    .executeTakeFirst();

  if (!material || material.editorial_state !== 'published') {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const metadata = await db
    .selectFrom('download_material_metadata')
    .selectAll()
    .where('material_id', '=', req.params.materialId)
    .executeTakeFirst();

  if (!metadata) {
    return res.status(404).json({ error: 'Metadados não encontrados.' });
  }

  return res.json(metadata);
});

router.put('/:materialId', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .select(['id', 'creator_id', 'system_id'])
    .where('id', '=', req.params.materialId)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const isOwner = material.creator_id === req.user!.userId;
  const canEditAny = req.user!.role === 'moderator' || req.user!.role === 'admin';
  if (!isOwner && !canEditAny) {
    return res.status(403).json({ error: 'Você não tem permissão para editar os metadados deste material.' });
  }

  const parsed = upsertMetadataSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  // T1.4 — validação cruzada: vtt_platform (plataforma de mesa virtual
  // ligada a um sistema específico) exige que o material já tenha sistema
  // associado; sem isso o campo fica ambíguo/órfão.
  if (parsed.data.vtt_platform && !material.system_id) {
    return res.status(400).json({ error: 'Campo "vtt_platform" exige que o material já tenha um sistema (system_id) associado.' });
  }

  const patch = parsed.data;
  // Insert usa default null/[] pra linha nova; update so toca as chaves que
  // vieram no body — PUT parcial (ex.: so publisher_name) nao pode apagar
  // cover_image_url/scenario/etc. salvos por outra tela (achado de review,
  // ver PR #190).
  const bodyKeys = new Set(Object.keys(req.body ?? {}));

  const commonFields = {
    scenario: patch.scenario ?? null,
    genre: patch.genre ?? null,
    language: patch.language ?? null,
    file_format: patch.file_format ?? null,
    vtt_platform: patch.vtt_platform ?? null,
    license_kind: patch.license_kind ?? null,
    license_url: patch.license_url ?? null,
    credits: patch.credits ?? null,
    publisher_name: patch.publisher_name ?? null,
    cover_image_url: patch.cover_image_url ?? null,
    target_audience: patch.target_audience ?? null,
    age_rating: patch.age_rating ?? null,
  };
  // Kysely tipa colunas JSONB como Generated<ColumnType<T[], T[]|undefined, T[]>>,
  // mas insert/onConflict.doUpdateSet esperam formas ligeiramente distintas
  // desse tipo — array JS puro (driver pg serializa pra jsonb automaticamente),
  // asserção pontual evita duplicar os literais para cada contexto.
  const jsonFields = {
    access_barriers: (patch.access_barriers ?? []) as unknown as JSONColumnType<string[]>,
    content_warnings: (patch.content_warnings ?? []) as unknown as JSONColumnType<string[]>,
    tags: (patch.tags ?? []) as unknown as JSONColumnType<string[]>,
  };

  const updateFields = Object.fromEntries(
    Object.entries({ ...commonFields, ...jsonFields }).filter(([key]) => bodyKeys.has(key)),
  );

  const updated = await db
    .insertInto('download_material_metadata')
    .values({ material_id: material.id, ...commonFields, ...jsonFields })
    .onConflict((oc) => oc.column('material_id').doUpdateSet({
      ...updateFields,
      updated_at: new Date(),
    }))
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.json(updated);
});

export default router;
