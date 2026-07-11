import { Response } from 'express';
import type { PoolClient } from 'pg';
import { db } from '../config/database';
import { sanitizeTermFields } from '../utils/sanitizeText';
import { slugify } from '../utils/slugify';
import { randomUUID } from 'crypto';
import { notifyTermOwnerOnModeration } from '../services/notificationService';
import { fetchUserRoleFromDb } from '../utils/userRole';
import { getCatalogNameMap } from '../services/catalogClient';
import type { AuthedRequest } from '../types/express';

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface ImportRow {
  name_en:        string;
  name_pt:        string;
  system_name?:   string;
  category_name?: string;
  subcategory_name?: string;
  nucleus?:       'oficial' | 'sugestao' | 'artificio';
  book_reference?: string;
  page_reference?: string;
  additional_info?: string;
  // Origem opcional do termo importado (sistema x cenário); usado só por
  // resolveImportCategoryType para escolher a raiz correta de categorias.
  source_type?: string;
}

type ImportAction = 'insert' | 'update_own' | 'duplicate' | 'override';

interface ImportResult {
  action:   ImportAction;
  name_en:  string;
  name_pt:  string;
  term_id?: string;         // Preenchido em update_own
  changed_fields?: string[]; // Preenchido em update_own
  override_author?: string | null; // Preenchido em override
}

// ---------------------------------------------------------------------------
// Helpers de lookup por nome
// ---------------------------------------------------------------------------

// Linha crua de public.terms retornada por EXISTING_TERM_QUERY (join com users).
type ExistingTermRow = {
  id: string;
  added_by: string | null;
  name_pt: string;
  nucleus: string;
  status: string;
  book_reference: string | null;
  page_reference: string | null;
  additional_info: string | null;
  category_id: string | null;
  system_id: string | null;
  added_by_name: string | null;
} & Record<string, unknown>;

type QueryExecutor = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
};

const resolveImportCategoryType = (row: Partial<ImportRow>): 'sistema' | 'cenario' => {
  const normalized = String(row?.source_type ?? '').trim().toLowerCase();
  return normalized === 'cenario' ? 'cenario' : 'sistema';
};

async function resolveSystemId(name: string | undefined, _executor: QueryExecutor = db): Promise<string | null> {
  if (!name) return null;
  const normalized = name.trim().toLowerCase();
  const names = await getCatalogNameMap();
  for (const [id, catalogName] of names) {
    if (catalogName.trim().toLowerCase() === normalized) return id;
  }
  return null;
}

async function resolveCategoryId(
  categoryName: string | undefined,
  subcategoryName: string | undefined,
  categoryType: 'sistema' | 'cenario',
  allowCreate: boolean,
  executor: QueryExecutor = db,
): Promise<string | null> {
  const normalizedCategory = String(categoryName ?? '').trim();
  let normalizedSubcategory = String(subcategoryName ?? '').trim();

  if (!normalizedCategory && !normalizedSubcategory) return null;

  if (
    normalizedCategory &&
    normalizedSubcategory &&
    normalizedCategory.toLowerCase() === normalizedSubcategory.toLowerCase()
  ) {
    normalizedSubcategory = '';
  }

  // Se veio apenas subcategoria, tratamos como categoria principal para evitar
  // criar nó duplicado "X > X".
  if (!normalizedCategory && normalizedSubcategory) {
    return resolveCategoryId(normalizedSubcategory, undefined, categoryType, allowCreate, executor);
  }

  const canonicalRootSlug = categoryType === 'sistema' ? 'sistema' : 'cenario';
  const rootCanonical = await executor.query(
    `SELECT id
       FROM public.categories
      WHERE type = $1
        AND parent_id IS NULL
        AND LOWER(slug) = LOWER($2)
      LIMIT 1`,
    [categoryType, canonicalRootSlug]
  );

  const rootFallback = await executor.query(
    `SELECT id
       FROM public.categories
      WHERE type = $1
        AND parent_id IS NULL
      ORDER BY position ASC, created_at ASC
      LIMIT 1`,
    [categoryType]
  );

  const rawRootId: unknown = rootCanonical.rows[0]?.id ?? rootFallback.rows[0]?.id ?? null;
  const rootId = typeof rawRootId === 'string' || typeof rawRootId === 'number' ? String(rawRootId) : null;
  if (!rootId) return null;

  const findByName = async (name: string, parentId: string): Promise<string | null> => {
    const found = await executor.query(
      `SELECT id
         FROM public.categories
        WHERE type = $1
          AND parent_id = $2
          AND LOWER(name) = LOWER($3)
        LIMIT 1`,
      [categoryType, parentId, name]
    );
    const rawId: unknown = found.rows[0]?.id ?? null;
    return typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : null;
  };

  const findOrCreateByName = async (name: string, parentId: string): Promise<string | null> => {
    const existingId = await findByName(name, parentId);
    if (existingId) return existingId;
    if (!allowCreate) return null;

    const safeSlug = slugify(name) || 'categoria';
    const inserted = await executor.query(
      `INSERT INTO public.categories (name, slug, type, parent_id, position)
       VALUES ($1, $2, $3, $4, 0)
       ON CONFLICT (parent_id, slug)
       DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name, safeSlug, categoryType, parentId]
    );
    const rawId: unknown = inserted.rows[0]?.id ?? null;
    return typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : null;
  };

  const parentName = normalizedCategory || normalizedSubcategory;
  const parentId = parentName ? await findOrCreateByName(parentName, rootId) : null;
  if (!parentId) return null;

  if (!normalizedSubcategory) return parentId;

  const childId = await findOrCreateByName(normalizedSubcategory, parentId);
  return childId ?? parentId;
}

// ---------------------------------------------------------------------------
// Campos que são rastreados no term_history
// ---------------------------------------------------------------------------

const TRACKED_FIELDS = [
  'name_pt',
  'nucleus',
  'book_reference',
  'page_reference',
  'additional_info',
  'category_id',
  'status',
] as const;

type ImportNucleus = 'oficial' | 'sugestao' | 'artificio';
type AdminImportNucleus = 'oficial' | 'artificio';

let hasAuditLogTable: boolean | null = null;

const parseAdminImportNucleus = (value: unknown): AdminImportNucleus => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'artificio' || normalized === 'informal') return 'artificio';
  return 'oficial';
};

const canWriteAuditLog = async (executor: QueryExecutor): Promise<boolean> => {
  if (hasAuditLogTable !== null) {
    return hasAuditLogTable;
  }
  const check = await executor.query(`SELECT to_regclass('public.audit_log') AS reg`);
  hasAuditLogTable = Boolean(check.rows[0]?.reg);
  return hasAuditLogTable;
};

const registerAuditOverrideIfAvailable = async (
  executor: QueryExecutor,
  payload: {
    termId: string;
    actorId: string;
    actorRole: string;
    previous: Record<string, unknown>;
    next: Record<string, unknown>;
    originalAuthorId: string | null;
    batchId: string;
  }
): Promise<void> => {
  if (!(await canWriteAuditLog(executor))) {
    return;
  }

  await executor.query(
    `INSERT INTO public.audit_log
      (environment, action, entity_type, entity_id, actor_id, actor_role, prev_state, next_state, meta)
     VALUES
      ($1, 'term.override', 'term', $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [
      process.env.APP_ENV === 'beta' ? 'beta' : 'prod',
      payload.termId,
      payload.actorId,
      payload.actorRole,
      JSON.stringify(payload.previous),
      JSON.stringify(payload.next),
      JSON.stringify({
        original_author_id: payload.originalAuthorId,
        batch_id: payload.batchId,
      }),
    ]
  );
};

const EXISTING_TERM_QUERY = `
  SELECT t.id,
         t.added_by,
         t.name_pt,
         t.nucleus,
         t.status,
         t.book_reference,
         t.page_reference,
         t.additional_info,
         t.category_id,
         t.system_id,
         u.full_name AS added_by_name
    FROM public.terms t
    LEFT JOIN public.users u ON u.id = t.added_by
   WHERE LOWER(name_en) = LOWER($1)
     AND ($2::uuid IS NULL OR system_id = $2)
   ORDER BY
     CASE t.nucleus
       WHEN 'oficial' THEN 5
       WHEN 'artificio' THEN 4
       WHEN 'sugestao' THEN 1
       ELSE 0
     END DESC,
     CASE t.status
       WHEN 'verificado' THEN 4
       WHEN 'aprovado' THEN 3
       WHEN 'pendente' THEN 2
       WHEN 'rejeitado' THEN 1
       ELSE 0
     END DESC,
     CASE t.source_type
       WHEN 'sistema' THEN 3
       WHEN 'cenario' THEN 2
       WHEN 'tabela' THEN 1
       ELSE 0
     END DESC,
     t.updated_at DESC NULLS LAST,
     t.created_at DESC NULLS LAST,
     t.id ASC
   LIMIT 1
`;

// ---------------------------------------------------------------------------
// Achado Sonar (PR #145): importTerms tinha complexidade cognitiva 121 (fluxo
// dry-run + fluxo apply, cada um com resolucao de system/category, diff de
// campos e 3 ramos de acao, tudo num unico handler). Helpers abaixo extraem
// a logica repetida entre os dois fluxos sem alterar nenhum comportamento —
// mesmas queries, mesma ordem, mesmos valores.
// ---------------------------------------------------------------------------

type HistoryEntry = { field: string; old: string | null; next: string | null };

// Achado Sonar (PR #145): String(valor) sobre unknown produz '[object Object]'
// quando valor e' objeto/array — mesmo guard ja usado no restante do arquivo
// (rawId/rawRootId/candidates.status) pra so serializar string/number reais.
function stringifyTrackedValue(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function computeHistoryEntries(found: ExistingTermRow, candidates: Record<string, unknown>): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const field of TRACKED_FIELDS) {
    const oldVal = found[field] ?? null;
    const newVal = candidates[field] ?? null;
    const strOld = stringifyTrackedValue(oldVal);
    const strNew = stringifyTrackedValue(newVal);
    if (strOld !== strNew) {
      entries.push({ field, old: strOld, next: strNew });
    }
  }
  return entries;
}

async function resolveRowSystemId(
  systemCache: Map<string, string | null>,
  systemName: string | undefined,
  client: QueryExecutor,
): Promise<string | null> {
  const systemKey = (systemName ?? '').trim().toLowerCase();
  let systemId = systemCache.get(systemKey);
  if (systemId === undefined) {
    systemId = await resolveSystemId(systemName, client);
    systemCache.set(systemKey, systemId);
  }
  return systemId;
}

async function resolveRowCategoryId(
  categoryCache: Map<string, string | null>,
  rawRow: ImportRow,
  categoryType: 'sistema' | 'cenario',
  isAdmin: boolean,
  allowCreate: boolean,
  client: QueryExecutor,
): Promise<string | null> {
  const categoryKey = [
    (rawRow.category_name ?? '').trim().toLowerCase(),
    (rawRow.subcategory_name ?? '').trim().toLowerCase(),
    categoryType,
    isAdmin ? 'admin' : 'member',
  ].join('::');
  let categoryId = categoryCache.get(categoryKey);
  if (categoryId === undefined) {
    categoryId = await resolveCategoryId(rawRow.category_name, rawRow.subcategory_name, categoryType, allowCreate, client);
    categoryCache.set(categoryKey, categoryId);
  }
  return categoryId;
}

async function findExistingTerm(
  client: QueryExecutor,
  existingCache: Map<string, ExistingTermRow | null>,
  nameEn: string,
  systemId: string | null,
): Promise<ExistingTermRow | null> {
  const existingKey = `${nameEn.trim().toLowerCase()}::${systemId ?? 'null'}`;
  let found = existingCache.get(existingKey);
  if (found === undefined) {
    const existing = await client.query(EXISTING_TERM_QUERY, [nameEn, systemId]);
    found = (existing.rows[0] as ExistingTermRow | undefined) ?? null;
    existingCache.set(existingKey, found);
  }
  return found;
}

type DryRunCaches = {
  systemCache: Map<string, string | null>;
  categoryCache: Map<string, string | null>;
  existingCache: Map<string, ExistingTermRow | null>;
};

async function previewImportRow(
  rawRow: ImportRow,
  client: PoolClient,
  caches: DryRunCaches,
  userId: string,
  isAdmin: boolean,
  adminChosenNucleus: AdminImportNucleus,
): Promise<ImportResult | null> {
  const row = sanitizeTermFields({
    name_en: rawRow.name_en,
    name_pt: rawRow.name_pt,
    book_reference: rawRow.book_reference,
    page_reference: rawRow.page_reference,
    additional_info: rawRow.additional_info,
  });

  if (!row.name_en?.trim() || !row.name_pt?.trim()) return null;

  const nucleus: ImportNucleus = isAdmin ? adminChosenNucleus : 'sugestao';
  const systemId = await resolveRowSystemId(caches.systemCache, rawRow.system_name, client);
  const found = await findExistingTerm(client, caches.existingCache, row.name_en, systemId);

  if (!found) {
    return { action: 'insert', name_en: row.name_en, name_pt: row.name_pt };
  }

  if (found.added_by === userId) {
    const categoryType = resolveImportCategoryType(rawRow);
    const categoryId = await resolveRowCategoryId(caches.categoryCache, rawRow, categoryType, isAdmin, false, client);

    const candidates: Record<string, unknown> = {
      name_pt: row.name_pt,
      nucleus,
      book_reference: row.book_reference ?? null,
      page_reference: row.page_reference ?? null,
      additional_info: row.additional_info ?? null,
      category_id: categoryId,
      status: isAdmin ? 'verificado' : found.status,
    };

    const changedFields = TRACKED_FIELDS.filter((field) => {
      const oldVal = found[field] == null ? null : String(found[field]);
      const newVal = candidates[field] == null ? null : String(candidates[field]);
      return oldVal !== newVal;
    });

    return {
      action: 'update_own',
      name_en: row.name_en,
      name_pt: row.name_pt,
      term_id: found.id,
      changed_fields: changedFields,
    };
  }

  if (isAdmin) {
    return {
      action: 'override',
      name_en: row.name_en,
      name_pt: row.name_pt,
      term_id: found.id,
      override_author: found.added_by_name ?? found.added_by ?? null,
    };
  }

  return { action: 'duplicate', name_en: row.name_en, name_pt: row.name_pt };
}

type ApplyCaches = {
  systemCache: Map<string, string | null>;
  categoryCache: Map<string, string | null>;
};

type ApplyRowContext = {
  client: PoolClient;
  caches: ApplyCaches;
  userId: string;
  userRole: 'admin' | 'member';
  isAdmin: boolean;
  adminChosenNucleus: AdminImportNucleus;
  insertStatus: string;
  batchId: string;
};

type SanitizedImportRow = ReturnType<typeof sanitizeTermFields>;

async function insertNewImportRow(
  client: PoolClient,
  row: SanitizedImportRow,
  nucleus: ImportNucleus,
  insertStatus: string,
  systemId: string | null,
  categoryId: string | null,
  userId: string,
  action: 'insert' | 'duplicate',
): Promise<ImportResult> {
  await client.query(
    `INSERT INTO public.terms
       (name_en, name_pt, nucleus, status, source_type,
        system_id, category_id, book_reference, page_reference,
        additional_info, added_by)
     VALUES ($1,$2,$3,$4,'tabela',$5,$6,$7,$8,$9,$10)`,
    [
      row.name_en, row.name_pt, nucleus,
      insertStatus,
      systemId, categoryId,
      row.book_reference ?? null,
      row.page_reference ?? null,
      row.additional_info ?? null,
      userId,
    ]
  );
  return { action, name_en: row.name_en!, name_pt: row.name_pt! };
}

async function applyTermUpdate(
  client: PoolClient,
  userId: string,
  found: ExistingTermRow,
  candidates: Record<string, unknown>,
  historyEntries: HistoryEntry[],
): Promise<void> {
  if (historyEntries.length === 0) return;

  await client.query(
    `UPDATE public.terms
        SET name_pt = $1,
            nucleus = $2,
            book_reference = $3,
            page_reference = $4,
            additional_info = $5,
            category_id = $6,
            status = $7
      WHERE id = $8`,
    [
      candidates.name_pt,
      candidates.nucleus,
      candidates.book_reference,
      candidates.page_reference,
      candidates.additional_info,
      candidates.category_id,
      candidates.status,
      found.id,
    ]
  );

  // Gravar term_history (uma linha por campo alterado)
  for (const entry of historyEntries) {
    await client.query(
      `INSERT INTO public.term_history (term_id, changed_by, field, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      [found.id, userId, entry.field, entry.old, entry.next]
    );
  }
}

async function applyOwnUpdateImportRow(
  client: PoolClient,
  userId: string,
  isAdmin: boolean,
  row: SanitizedImportRow,
  nucleus: ImportNucleus,
  categoryId: string | null,
  found: ExistingTermRow,
): Promise<ImportResult> {
  const candidates: Record<string, unknown> = {
    name_pt: row.name_pt,
    nucleus,
    book_reference: row.book_reference ?? null,
    page_reference: row.page_reference ?? null,
    additional_info: row.additional_info ?? null,
    category_id: categoryId,
    status: isAdmin ? 'verificado' : found.status,
  };

  const historyEntries = computeHistoryEntries(found, candidates);
  await applyTermUpdate(client, userId, found, candidates, historyEntries);

  return {
    action: 'update_own',
    name_en: row.name_en!,
    name_pt: row.name_pt!,
    term_id: found.id,
    changed_fields: historyEntries.map((e) => e.field),
  };
}

async function applyAdminOverrideImportRow(
  client: PoolClient,
  userId: string,
  userRole: 'admin' | 'member',
  row: SanitizedImportRow,
  nucleus: ImportNucleus,
  insertStatus: string,
  categoryId: string | null,
  found: ExistingTermRow,
  batchId: string,
): Promise<ImportResult> {
  const candidates: Record<string, unknown> = {
    name_pt: row.name_pt,
    nucleus,
    book_reference: row.book_reference ?? null,
    page_reference: row.page_reference ?? null,
    additional_info: row.additional_info ?? null,
    category_id: categoryId,
    status: insertStatus,
  };

  const historyEntries = computeHistoryEntries(found, candidates);

  await registerAuditOverrideIfAvailable(client, {
    termId: found.id,
    actorId: userId,
    actorRole: userRole,
    previous: {
      name_pt: found.name_pt,
      nucleus: found.nucleus,
      book_reference: found.book_reference,
      page_reference: found.page_reference,
      additional_info: found.additional_info,
      category_id: found.category_id,
      status: found.status,
    },
    next: {
      name_pt: candidates.name_pt,
      nucleus: candidates.nucleus,
      book_reference: candidates.book_reference,
      page_reference: candidates.page_reference,
      additional_info: candidates.additional_info,
      category_id: candidates.category_id,
      status: candidates.status,
    },
    originalAuthorId: found.added_by ?? null,
    batchId,
  });

  await applyTermUpdate(client, userId, found, candidates, historyEntries);

  try {
    await notifyTermOwnerOnModeration(
      {
        termId: found.id,
        actorId: userId,
        status: stringifyTrackedValue(candidates.status),
        eventType: 'term.updated',
      },
      client
    );
  } catch (notifyError) {
    console.error('[notifications] Falha ao gerar notificação de override por import:', notifyError);
  }

  return {
    action: 'override',
    name_en: row.name_en!,
    name_pt: row.name_pt!,
    term_id: found.id,
    changed_fields: historyEntries.map((entry) => entry.field),
    override_author: found.added_by_name ?? found.added_by ?? null,
  };
}

async function applyImportRow(rawRow: ImportRow, ctx: ApplyRowContext): Promise<ImportResult | null> {
  const { client, caches, userId, userRole, isAdmin, adminChosenNucleus, insertStatus, batchId } = ctx;

  const row = sanitizeTermFields({
    name_en: rawRow.name_en,
    name_pt: rawRow.name_pt,
    book_reference: rawRow.book_reference,
    page_reference: rawRow.page_reference,
    additional_info: rawRow.additional_info,
  });

  if (!row.name_en?.trim() || !row.name_pt?.trim()) {
    // Linha inválida — pular silenciosamente (não abortar lote)
    return null;
  }

  const nucleus: ImportNucleus = isAdmin ? adminChosenNucleus : 'sugestao';
  const systemId = await resolveRowSystemId(caches.systemCache, rawRow.system_name, client);
  const categoryType = resolveImportCategoryType(rawRow);
  const categoryId = await resolveRowCategoryId(caches.categoryCache, rawRow, categoryType, isAdmin, isAdmin, client);

  const existing = await client.query(EXISTING_TERM_QUERY, [row.name_en, systemId]);

  // ----- Caso A: Não existe → INSERT como pendente -----
  if (existing.rows.length === 0) {
    return insertNewImportRow(client, row, nucleus, insertStatus, systemId, categoryId, userId, 'insert');
  }

  const found = existing.rows[0] as ExistingTermRow;

  // ----- Caso B: Existe e é do mesmo usuário → UPDATE + term_history -----
  if (found.added_by === userId) {
    return applyOwnUpdateImportRow(client, userId, isAdmin, row, nucleus, categoryId, found);
  }

  // ----- Caso C: Existe e é de outro usuário, admin faz override -----
  if (isAdmin) {
    return applyAdminOverrideImportRow(client, userId, userRole, row, nucleus, insertStatus, categoryId, found, batchId);
  }

  // ----- Caso C: Existe e é de outro usuário → INSERT como sugestão pendente -----
  return insertNewImportRow(client, row, nucleus, insertStatus, systemId, categoryId, userId, 'duplicate');
}

// ---------------------------------------------------------------------------
// POST /api/terms/import
// Body: { terms: ImportRow[] }
// ---------------------------------------------------------------------------

export const importTerms = async (req: AuthedRequest, res: Response) => {
  const userId = req?.user?.id;

  if (!userId || typeof userId !== 'string') {
    return res.status(401).json({ message: 'Usuário não autenticado.' });
  }

  let userRole: 'admin' | 'member';
  try {
    const roleFromDb = await fetchUserRoleFromDb(userId);
    if (!roleFromDb) {
      return res.status(401).json({ message: 'Usuário não encontrado.' });
    }
    userRole = roleFromDb;
  } catch (err) {
    console.error('[importTerms] Erro ao revalidar role no banco:', err);
    return res.status(503).json({ message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
  }

  const isAdmin = userRole === 'admin';
  const batchId = randomUUID();

  const rows: ImportRow[] = req.body?.terms;
  const dryRun: boolean   = req.body?.dry_run === true;
  const adminChosenNucleus: AdminImportNucleus = parseAdminImportNucleus(req.body?.import_nucleus);
  const insertStatus = isAdmin ? 'verificado' : 'pendente';

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'Nenhum termo enviado para importação.' });
  }

  if (rows.length > 2000) {
    return res.status(400).json({ message: 'Máximo de 2000 termos por importação.' });
  }

  // ---------------------------------------------------------------------------
  // Modo dry_run: classifica cada termo SEM gravar no banco
  // ---------------------------------------------------------------------------
  if (dryRun) {
    let client: PoolClient | undefined;

    try {
      client = await db.pool.connect();
    } catch (err) {
      console.error('Erro ao conectar ao pool de banco (dry_run):', err);
      return res.status(503).json({ message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
    }

    try {
      const previewResults: ImportResult[] = [];
      const caches: DryRunCaches = {
        systemCache: new Map<string, string | null>(),
        categoryCache: new Map<string, string | null>(),
        existingCache: new Map<string, ExistingTermRow | null>(),
      };

      for (const rawRow of rows) {
        const previewResult = await previewImportRow(rawRow, client, caches, userId, isAdmin, adminChosenNucleus);
        if (previewResult) previewResults.push(previewResult);
      }

      const summary = {
        total:      previewResults.length,
        inserted:   previewResults.filter(r => r.action === 'insert').length,
        updated:    previewResults.filter(r => r.action === 'update_own').length,
        overrides:  previewResults.filter(r => r.action === 'override').length,
        duplicates: previewResults.filter(r => r.action === 'duplicate').length,
      };

      return res.status(200).json({ summary, results: previewResults, dry_run: true });
    } catch (err) {
      console.error('Erro na pré-visualização da importação:', err);
      return res.status(500).json({ message: 'Erro ao gerar pré-visualização da importação.' });
    } finally {
      client?.release();
    }
  }

  const results: ImportResult[] = [];

  // Processar cada termo dentro de uma transaction única
  let client: PoolClient | undefined;

  try {
    client = await db.pool.connect();
  } catch (err) {
    console.error('Erro ao conectar ao pool de banco:', err);
    return res.status(503).json({ message: 'Serviço temporariamente indisponível. Tente novamente em instantes.' });
  }

  const caches: ApplyCaches = {
    systemCache: new Map<string, string | null>(),
    categoryCache: new Map<string, string | null>(),
  };

  try {
    await client.query('BEGIN');

    for (const rawRow of rows) {
      const result = await applyImportRow(rawRow, {
        client, caches, userId, userRole, isAdmin, adminChosenNucleus, insertStatus, batchId,
      });
      if (result) results.push(result);
    }

    await client.query('COMMIT');

    const summary = {
      total:      results.length,
      inserted:   results.filter(r => r.action === 'insert').length,
      updated:    results.filter(r => r.action === 'update_own').length,
      overrides:  results.filter(r => r.action === 'override').length,
      duplicates: results.filter(r => r.action === 'duplicate').length,
    };

    return res.status(200).json({ summary, results });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // noop: rollback de melhor esforço
    }
    console.error('Erro na importação em massa:', err);
    return res.status(500).json({ message: 'Erro interno durante a importação. Nenhum dado foi alterado.' });
  } finally {
    if (client) client.release();
  }
};
