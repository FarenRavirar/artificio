import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { POSTGRES_INTEGER_MAX } from '../db/types';
import { toJsonColumnValue } from '../db/jsonColumn';
import { sanitizeRichHtml } from '../services/sanitizeRichHtml';
import { normalizeCreditNames, normalizePublisherKey } from '../services/facetNormalization';
import { persistExternalCover, storeCoverFromPublicUrl } from '../services/coverStorage';
import {
  markdownToPlainText,
  sanitizeNullableUserMarkdown,
  sanitizeUserMarkdown,
} from '@artificio/content-editor/sanitize';

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
  authors: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  artists: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
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
  description_markdown: z.string().max(50_000).nullable().optional().transform((value) => (
    value === null || value === undefined ? value : sanitizeUserMarkdown(value)
  )),
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
  return res.json({
    ...metadata,
    description_html: metadata.description_html ? sanitizeRichHtml(metadata.description_html) : null,
    description_markdown: sanitizeNullableUserMarkdown(metadata.description_markdown),
  });
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
  const authors = normalizeCreditNames(patch.authors ?? []);
  const artists = normalizeCreditNames(patch.artists ?? []);
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
    authors: authors.labels,
    author_keys: authors.keys,
    artists: artists.labels,
    artist_keys: artists.keys,
    publisher_name: patch.publisher_name ?? null,
    publisher_key: patch.publisher_name ? normalizePublisherKey(patch.publisher_name) : null,
    target_audience: patch.target_audience ?? null,
    age_rating: patch.age_rating ?? null,
    file_size_text: patch.file_size_text ?? null,
    page_count: patch.page_count ?? null,
    creation_method: patch.creation_method ?? null,
    source_category: patch.source_category ?? null,
    // Legado preservado somente para rollback da migration 034; novas
    // escritas nunca persistem HTML rico.
    description_html: null,
    description_markdown: patch.description_markdown ?? null,
  };
  // Achado real (smoke visual pós-deploy da spec 086, 2026-07-26): a premissa
  // anterior deste comentário ("driver pg serializa pra jsonb automaticamente")
  // estava errada. `node-postgres` sem type hint explícito serializa array JS
  // como array literal do Postgres (`{}` pra vazio), não como JSON — e `{}` é
  // sintaxe JSON válida para "objeto vazio", não "array vazio". Resultado: PUT
  // gravava `tags`/`source_filters` como `{}` no banco, e o GET seguinte
  // quebrava o parse Zod do frontend (`expected array, code: invalid_type`).
  // Confirmado em produção (beta): 3 linhas reais gravadas como object antes
  // do fix, 93 linhas anteriores (via scraperIngest.ts, mesmo padrão bugado)
  // como array — só não estourava porque a maioria nunca passou por um PUT
  // deste endpoint depois de escrita. Fix: `JSON.stringify` explícito antes
  // de entregar ao Kysely, forçando o parâmetro a chegar como texto JSON —
  // scraperIngest.ts tem o mesmo bug e precisa do mesmo fix (ver TODO lá).
  const jsonFields = {
    access_barriers: toJsonColumnValue(patch.access_barriers ?? []),
    content_warnings: toJsonColumnValue(patch.content_warnings ?? []),
    tags: toJsonColumnValue(patch.tags ?? []),
    source_filters: toJsonColumnValue(patch.source_filters ?? []),
  };

  const updateFields = Object.fromEntries(
    Object.entries({ ...commonFields, ...jsonFields }).filter(([key]) => bodyKeys.has(key)),
  );
  if (bodyKeys.has('publisher_name')) updateFields.publisher_key = commonFields.publisher_key;
  if (bodyKeys.has('authors')) {
    updateFields.authors = commonFields.authors;
    updateFields.author_keys = commonFields.author_keys;
  }
  if (bodyKeys.has('artists')) {
    updateFields.artists = commonFields.artists;
    updateFields.artist_keys = commonFields.artist_keys;
  }

  const updated = await db.transaction().execute(async (trx) => {
    const metadata = await trx
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

    if (bodyKeys.has('description_markdown')) {
      const plainDescription = patch.description_markdown
        ? markdownToPlainText(patch.description_markdown, 50_000)
        : null;
      const summary = patch.description_markdown
        ? markdownToPlainText(patch.description_markdown, 320)
        : null;

      await trx
        .updateTable('download_material')
        .set({ description: plainDescription, summary, updated_at: new Date() })
        .where('id', '=', material.id)
        .executeTakeFirst();
    }

    return metadata;
  });

  // Achado real (review PR #228, Sonar): resposta da capa isolada para manter
  // o handler principal abaixo do teto de complexidade, sem mudar o 422.
  return respondAfterCoverUpdate(
    res,
    material.id,
    bodyKeys.has('cover_image_url'),
    patch.cover_image_url,
    updated,
  );
});

async function respondAfterCoverUpdate(
  res: Response,
  materialId: string,
  coverRequested: boolean,
  coverImageUrl: string | null | undefined,
  updated: unknown,
): Promise<Response> {
  if (!coverRequested) return res.json(updated);

  // Achado de review PR #228: metadados comuns precisam confirmar primeiro.
  // Se esta escrita falhar, nenhuma troca Cloudinary já terá sido commitada.
  try {
    if (coverImageUrl) await storeCoverFromPublicUrl(materialId, coverImageUrl);
    else await persistExternalCover(materialId, null);
  } catch (error) {
    return res.status(422).json({ error: error instanceof Error ? error.message : 'Falha ao atualizar capa.' });
  }

  const metadataWithCover = await db
    .selectFrom('download_material_metadata')
    .selectAll()
    .where('material_id', '=', materialId)
    .executeTakeFirstOrThrow();
  return res.json(metadataWithCover);
}

export default router;
