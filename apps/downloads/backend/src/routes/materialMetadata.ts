import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { POSTGRES_INTEGER_MAX, type JSONColumnType } from '../db/types';
import { sanitizeRichHtml } from '../services/sanitizeRichHtml';

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
  // D119 (regra petrea, migration 022): so 'pt' e aceito. Unico valor
  // possivel hoje, entao formulario/PUT nao expoe escolha real — default
  // automatico evita 400 desnecessario quando o campo vem ausente/null.
  language: z.literal('pt').nullable().optional(),
  file_format: z.string().trim().max(30).nullable().optional(),
  vtt_platform: z.string().trim().max(60).nullable().optional(),
  access_barriers: z.array(z.string()).optional(),
  license_kind: z.string().trim().max(60).nullable().optional(),
  license_url: z.url().trim().nullable().optional(),
  credits: z.string().trim().nullable().optional(),
  publisher_name: z.string().trim().max(120).nullable().optional(),
  cover_image_url: z.url({ protocol: /^https?$/ }).trim().nullable().optional(),
  target_audience: z.string().trim().max(60).nullable().optional(),
  age_rating: z.string().trim().max(20).nullable().optional(),
  content_warnings: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  file_size_text: z.string().trim().max(50).nullable().optional(),
  page_count: z.number().int().nonnegative().max(POSTGRES_INTEGER_MAX).nullable().optional(),
  creation_method: z.string().trim().max(100).nullable().optional(),
  source_category: z.string().trim().max(200).nullable().optional(),
  source_filters: z.array(z.object({
    facet: z.string().trim().min(1).max(100),
    path: z.array(z.string().trim().min(1).max(200)).min(1),
  })).optional(),
  // HTML rico pode vir do editor da Fase 9 ou de PUT administrativo: ambos
  // cruzam a mesma fronteira de segurança antes de chegar ao banco.
  description_html: z.string().nullable().optional().transform((value) => (value === null || value === undefined ? value : sanitizeRichHtml(value))),
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

  // Spec 086: dado rico de banco/importação também é hostil. Sanitizar na
  // leitura impede XSS armazenado se outro writer ignorar a fronteira de PUT.
  // Achado real (review PR #203, Codex, P2): importação/migration/SQL pode
  // contornar o PUT. Re-sanitiza a leitura na fronteira de renderização.
  return res.json({ ...metadata, description_html: metadata.description_html ? sanitizeRichHtml(metadata.description_html) : null });
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
    language: 'pt' as const,
    file_format: patch.file_format ?? null,
    vtt_platform: patch.vtt_platform ?? null,
    license_kind: patch.license_kind ?? null,
    license_url: patch.license_url ?? null,
    credits: patch.credits ?? null,
    publisher_name: patch.publisher_name ?? null,
    cover_image_url: patch.cover_image_url ?? null,
    target_audience: patch.target_audience ?? null,
    age_rating: patch.age_rating ?? null,
    file_size_text: patch.file_size_text ?? null,
    page_count: patch.page_count ?? null,
    creation_method: patch.creation_method ?? null,
    source_category: patch.source_category ?? null,
    description_html: patch.description_html ?? null,
  };
  // Kysely tipa colunas JSONB como Generated<ColumnType<T[], T[]|undefined, T[]>>,
  // mas insert/onConflict.doUpdateSet esperam formas ligeiramente distintas
  // desse tipo — array JS puro (driver pg serializa pra jsonb automaticamente),
  // asserção pontual evita duplicar os literais para cada contexto.
  const jsonFields = {
    access_barriers: (patch.access_barriers ?? []) as unknown as JSONColumnType<string[]>,
    content_warnings: (patch.content_warnings ?? []) as unknown as JSONColumnType<string[]>,
    tags: (patch.tags ?? []) as unknown as JSONColumnType<string[]>,
    source_filters: (patch.source_filters ?? []) as unknown as JSONColumnType<Array<{ facet: string; path: string[] }>>,
  };

  const updateFields = Object.fromEntries(
    Object.entries({ ...commonFields, ...jsonFields }).filter(([key]) => bodyKeys.has(key)),
  );

  const updated = await db
    .insertInto('download_material_metadata')
    .values({ material_id: material.id, ...commonFields, ...jsonFields })
    .onConflict((oc) => oc.column('material_id').doUpdateSet({
      ...updateFields,
      // Achado de review PR #193 (codeRabbit): D119 e regra petrea — mesmo
      // em PUT parcial que nao envia "language" no body, forca 'pt' no
      // UPDATE (nao so no INSERT), nunca deixa linha existente divergir.
      language: 'pt',
      updated_at: new Date(),
    }))
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.json(updated);
});

export default router;
