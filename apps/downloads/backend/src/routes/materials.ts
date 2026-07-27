import { Router, type Request, type Response } from 'express';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import {
  getCatalogMaterialTypeById,
  loadCatalogMaterialTypes,
  loadCatalogSystemsFlat,
  matchTaxonomyIdsByName,
  type FlatCatalogSystem,
} from '../services/catalogClient';
import {
  loadPopularityScores,
  loadRatingAggregates,
  loadRatingOrder,
  loadTrendingOrder,
  registerMaterialView,
} from '../services/materialMetrics';

const router = Router();

const MAX_PAGE_SIZE = 60;
const DEFAULT_PAGE_SIZE = 20;

// Spec 087 (T1B.4) — 'rating' e 'trending' entram como sort formal, nao so
// como prateleira fixa da home: a mesma metrica central serve a vitrine e o
// dropdown de ordenacao do modo resultado (decisao 5 do mantenedor).
const SORT_OPTIONS = ['relevance', 'recent', 'popular', 'name', 'rating', 'trending'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const listMaterialsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  system_id: z.string().trim().optional(),
  edition_id: z.string().trim().optional(),
  // Nome do query param fica retrocompatível; valor agora é ID Central.
  material_type: z.string().uuid().optional(),
  access_kind: z.enum(['external_link', 'managed_upload']).optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

// Facetas do MVP (073/spec.md T4.3): apenas as colunas ja existentes em
// download_material (070) entram aqui. Genero/idioma/formato/licenca/barreiras
// vivem em download_material_metadata — ficam para quando a UI de filtro
// exigir o join (nao ha coluna de "popularidade" real ainda; 'popular'
// aproxima por download_count agregado quando existir metrica, spec 074).

const patchMaterialSchema = z.object({
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  external_url: z.url().trim().nullable().optional(),
});

// Campos publicos da ficha; exclui storage_provider/storage_key (achado
// chatgpt-codex-connector P2 — vazamento de detalhes internos de storage).
const PUBLIC_MATERIAL_FIELDS = [
  'download_material.id',
  'download_material.slug',
  'download_material.title',
  'download_material.summary',
  'download_material.description',
  'download_material.material_type',
  'download_material.material_type_id',
  'download_material.access_kind',
  'download_material.external_url',
  'download_material.system_id',
  'download_material.edition_id',
  'download_material.creator_id',
  'download_material.editorial_state',
  'download_material.created_at',
  'download_material.updated_at',
] as const;

const CARD_METADATA_FIELDS = [
  'download_material_metadata.cover_image_url',
  'download_material_metadata.credits',
  // Spec 088 (requisito 31) — editora e AUTORIA sao campos distintos e o card
  // exibe os dois, publicante primeiro. `publisher_name` ja existia na tabela
  // e na rota de metadados (ficha), mas nao era projetado aqui, entao o card
  // nao tinha como exibi-lo. Aditivo: nenhum consumidor perde campo.
  'download_material_metadata.publisher_name',
  'download_material_metadata.scenario',
] as const;

const createMaterialSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  material_type_id: z.string().uuid(),
});

const FACETS_CACHE_TTL_MS = 30 * 1000;
let facetsCache: { data: MaterialFacetsResponse; expiresAt: number } | null = null;

interface FacetCount {
  id: string;
  count: number;
}

interface MaterialTypeFacet extends FacetCount {
  slug: string;
  name: string;
}

interface MaterialFacetsResponse {
  material_types: MaterialTypeFacet[];
  systems: FacetCount[];
  editions: FacetCount[];
}

// Campos editaveis por publicador; toda mudanca grava download_material_version
// por campo (D111 item 7 — historico desde o primeiro commit, incl. link).
const EDITABLE_FIELDS = [
  'title',
  'summary',
  'description',
  'external_url',
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

// T4.3 (spec 073) — listagem publica com busca/filtro/ordenacao/paginacao.
// Contrato de URL: q, system_id, edition_id, material_type, access_kind,
// sort, page, page_size. So material publicado aparece aqui (criterio de
// aceite 7 da 073).
router.get('/', async (req: Request, res: Response) => {
  const parsed = listMaterialsQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros de busca inválidos.', details: z.treeifyError(parsed.error) });
  }

  const { q, system_id: systemId, edition_id: editionId, material_type: materialType, access_kind: accessKind } = parsed.data;
  const sort: SortOption = parsed.data.sort ?? 'recent';
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.page_size ?? DEFAULT_PAGE_SIZE;

  let baseQuery = db
    .selectFrom('download_material')
    .where('editorial_state', '=', 'published');

  if (systemId) baseQuery = baseQuery.where('system_id', '=', systemId);
  if (editionId) baseQuery = baseQuery.where('edition_id', '=', editionId);
  if (materialType) baseQuery = baseQuery.where('material_type_id', '=', materialType);
  if (accessKind) baseQuery = baseQuery.where('access_kind', '=', accessKind);
  if (q) {
    // Spec 087 (achado de review PR #214, Codex P2): a busca prometia "título,
    // autor ou sistema" no placeholder mas so cobria title/summary, entao
    // procurar por autor ou sistema voltava vazio. Cobertura ampliada pros 4
    // campos que o card de fato exibe.
    //
    // Autor sai de download_creator (tabela local, ilike direto). Sistema NAO:
    // a taxonomia vive no Catalogo Central e chega por HTTP
    // (services/catalogClient.ts), sem tabela local pra join — por isso o nome
    // do sistema e resolvido em memoria sobre o snapshot ja cacheado (TTL 60s,
    // o mesmo que a listagem consome pra montar taxonomy_chain) e vira filtro
    // por ID. Sem chamada extra de rede no caminho da busca.
    const matchedTaxonomyIds = await matchTaxonomyIdsByName(q);

    baseQuery = baseQuery.where((eb) => {
      const clauses = [
        eb('download_material.title', 'ilike', `%${q}%`),
        eb('download_material.summary', 'ilike', `%${q}%`),
        // Espelha o OR de creator_id do GET /:slug (spec 084): material de
        // scraper grava creator_id = download_creator.id, material humano grava
        // o user_id do SSO. Sem os dois lados, busca por autor perderia
        // metade do acervo.
        eb.exists(
          eb.selectFrom('download_creator')
            .select('download_creator.id')
            .where('download_creator.display_name', 'ilike', `%${q}%`)
            .where((inner) => inner.or([
              inner('download_creator.user_id', '=', inner.ref('download_material.creator_id')),
              inner('download_creator.id', '=', inner.ref('download_material.creator_id')),
            ])),
        ),
      ];

      if (matchedTaxonomyIds.length > 0) {
        clauses.push(
          eb('download_material.system_id', 'in', matchedTaxonomyIds),
          eb('download_material.edition_id', 'in', matchedTaxonomyIds),
        );
      }

      return eb.or(clauses);
    });
  }

  // Spec 087 (T1B.3/T1B.4) — 'trending' e 'rating' ordenam por metrica
  // calculada (Bayesian average), nao por coluna do banco, entao a ordem tem
  // que ser resolvida sobre o CATALOGO INTEIRO antes de paginar: ordenar so a
  // pagina atual daria ordem incoerente entre paginas.
  //
  // Para 'trending' o corte de elegibilidade (download_count >= 1 na janela)
  // ja vem aplicado na lista de IDs — material so-visualizado nao esta la, e
  // por isso desaparece da ordenacao em vez de ir pro fim dela (Requisito 15).
  let rankedIds: string[] | null = null;
  if (sort === 'trending') {
    rankedIds = await loadTrendingOrder();
  } else if (sort === 'rating') {
    rankedIds = await loadRatingOrder();
  }

  if (rankedIds !== null) {
    if (rankedIds.length === 0) {
      return res.json({
        items: [],
        page,
        page_size: pageSize,
        total: 0,
        total_pages: 1,
      });
    }
    baseQuery = baseQuery.where('download_material.id', 'in', rankedIds);
  }

  const { count } = await baseQuery
    .select(({ fn }) => [fn.countAll<number>().as('count')])
    .executeTakeFirstOrThrow();

  // Fase 5: metadata e opcional. leftJoin preserva material publicado antigo
  // sem linha metadata; innerJoin faria esse material desaparecer do catálogo.
  let resultsQuery = baseQuery
    .leftJoin('download_material_metadata', 'download_material_metadata.material_id', 'download_material.id')
    .select([...PUBLIC_MATERIAL_FIELDS, ...CARD_METADATA_FIELDS]);

  if (sort === 'popular') {
    resultsQuery = resultsQuery
      .leftJoin(
        db
          .selectFrom('download_metric_daily')
          .select(['material_id', ({ fn }) => fn.sum<number>('download_count').as('total_downloads')])
          .groupBy('material_id')
          .as('material_downloads'),
        (join) => join.onRef('material_downloads.material_id', '=', 'download_material.id'),
      )
      .orderBy(sql`coalesce(material_downloads.total_downloads, 0)`, 'desc')
      .orderBy('download_material.created_at', 'desc');
  } else if (sort === 'name') {
    resultsQuery = resultsQuery.orderBy('download_material.title', 'asc');
  } else if (rankedIds !== null) {
    // Ordem ja decidida pelo Bayesian average. `array_position` reproduz a
    // sequencia da lista ranqueada dentro do SQL, preservando a paginacao
    // normal (limit/offset) sem trazer o catalogo inteiro pra memoria.
    //
    // Review PR #214 (CodeRabbit) sugeriu trocar por `unnest(...) WITH
    // ORDINALITY`, que evita a varredura linear do array por linha. A troca e
    // legitima em SQL, mas NAO entrou aqui: esta suite roda 100% sobre mock de
    // Kysely, entao a forma nova passaria no teste sem nunca ter sido
    // executada contra Postgres. Trocar SQL que roda em producao por SQL nao
    // exercitado, por ganho teorico num ranking que hoje e pequeno, e risco
    // sem retorno. Reavaliar quando houver teste de integracao com banco real
    // ou quando o ranking crescer a ponto do custo aparecer em medicao.
    resultsQuery = resultsQuery.orderBy(
      sql`array_position(${sql.val(rankedIds)}::uuid[], download_material.id)`,
    );
  } else {
    // 'relevance' sem busca textual de rank equivale a 'recent' (MVP —
    // ranking real de relevancia fica para quando houver motor de busca).
    resultsQuery = resultsQuery.orderBy('download_material.created_at', 'desc');
  }

  const materials = await resultsQuery
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .execute();

  // Requisito 14 — a listagem passa a expor as metricas de curadoria. Duas
  // consultas agregadas por pagina (nao uma por card), no mesmo espirito do
  // enriquecimento de taxonomia logo abaixo.
  const pageIds = materials.map((material) => material.id);
  const [ratings, popularity, enriched] = await Promise.all([
    loadRatingAggregates(pageIds),
    loadPopularityScores(pageIds),
    enrichMaterialsWithTaxonomy(materials),
  ]);

  const items = enriched.map((material) => {
    const rating = ratings.get(material.id);
    return {
      ...material,
      // Sem avaliacao nenhuma: `null`, nunca 0 — o card precisa distinguir
      // "ninguem avaliou" de "avaliaram mal" (Requisito 15).
      avg_rating: rating?.avgRating ?? null,
      rating_count: rating?.ratingCount ?? 0,
      // `null` = nao elegivel (zero download na janela). E o sinal que o
      // frontend usa pra nunca incluir o material em "Mais visitados".
      popularity_score: popularity.get(material.id) ?? null,
    };
  });

  return res.json({
    items,
    page,
    page_size: pageSize,
    total: Number(count),
    total_pages: Math.max(1, Math.ceil(Number(count) / pageSize)),
  });
});

// Proxy público do vocabulário Central. Frontend não precisa conhecer host do
// Site; Downloads continua validando a mesma fonte canônica no POST.
router.get('/types', async (_req: Request, res: Response) => {
  try {
    // Achado real (review PR #205, Codex): o proxy confiava que todo item
    // remoto era selecionável. Filtrar aqui mantém tipos pending/rejeitados
    // fora do formulário mesmo se o contrato Central ampliar a resposta.
    const items = (await loadCatalogMaterialTypes()).filter((item) => item.status === 'active');
    res.json({ items });
  } catch (error) {
    console.error('[materials] material types unavailable', error);
    res.status(503).json({ error: 'Catálogo de tipos de material indisponível.' });
  }
});

// T8.1 (spec 086, Fase 8) — proxy público do catálogo de sistema/edição/
// variante Central, mesmo padrão de /types acima: frontend não precisa
// conhecer host do Site nem tratar CORS cross-origin, e reusa o cache de
// loadCatalogSystemsFlat (60s TTL, services/catalogClient.ts) já usado pelo
// backend. Sidebar de filtro (CatalogFilterSidebar) usa isto pra exibir
// nome/hierarquia legível, não só o id cru que /facets devolve.
router.get('/catalog-systems', async (_req: Request, res: Response) => {
  try {
    const nodes = await loadCatalogSystemsFlat();
    res.json({
      items: nodes.map((node) => ({
        id: node.id,
        name: node.name_pt ?? node.name,
        slug: node.slug,
        node_type: node.node_type,
        parent_id: node.parent_id,
      })),
    });
  } catch (error) {
    console.error('[materials] catalog systems unavailable', error);
    res.status(503).json({ error: 'Catálogo de sistemas indisponível.' });
  }
});

// Deve ficar antes de /:slug: Express interpretaria "facets" como slug.
// Retorna só valores que têm material publicado: sidebar não oferece filtro
// sem resultado (Nielsen) e o catálogo não vaza rascunho/retirado.
router.get('/facets', async (_req: Request, res: Response) => {
  if (facetsCache && facetsCache.expiresAt > Date.now()) {
    res.json(facetsCache.data);
    return;
  }

  try {
    const [materialTypeRows, systemRows, editionRows, centralTypes] = await Promise.all([
      db.selectFrom('download_material')
        .select(['material_type_id', ({ fn }) => fn.countAll<number>().as('count')])
        .where('editorial_state', '=', 'published')
        .groupBy('material_type_id')
        .orderBy('count', 'desc')
        .execute(),
      db.selectFrom('download_material')
        .select(['system_id', ({ fn }) => fn.countAll<number>().as('count')])
        .where('editorial_state', '=', 'published')
        .where('system_id', 'is not', null)
        .groupBy('system_id')
        .orderBy('count', 'desc')
        .execute(),
      db.selectFrom('download_material')
        .select(['edition_id', ({ fn }) => fn.countAll<number>().as('count')])
        .where('editorial_state', '=', 'published')
        .where('edition_id', 'is not', null)
        .groupBy('edition_id')
        .orderBy('count', 'desc')
        .execute(),
      loadCatalogMaterialTypes(),
    ]);

    const centralById = new Map(centralTypes.map((item) => [item.id, item]));
    const data: MaterialFacetsResponse = {
      material_types: materialTypeRows.flatMap((row) => {
        const type = centralById.get(row.material_type_id);
        return type ? [{ id: type.id, slug: type.slug, name: type.name, count: Number(row.count) }] : [];
      }),
      systems: systemRows.flatMap((row) => row.system_id ? [{ id: row.system_id, count: Number(row.count) }] : []),
      editions: editionRows.flatMap((row) => row.edition_id ? [{ id: row.edition_id, count: Number(row.count) }] : []),
    };
    facetsCache = { data, expiresAt: Date.now() + FACETS_CACHE_TTL_MS };
    res.json(data);
  } catch (error) {
    console.error('[materials] facets unavailable', error);
    res.status(503).json({ error: 'Facetas indisponíveis.' });
  }
});

// T1.2 (spec 074) — "Meus materiais": todos os estados editoriais do proprio
// autor (draft/in_review/published/rejected/withdrawn), nao so published.
// Rota fixa "/mine" precisa vir antes de "/:slug" (Express casaria "mine"
// como slug senao).
router.get('/mine', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const materials = await db
    .selectFrom('download_material')
    .select(PUBLIC_MATERIAL_FIELDS)
    .where('creator_id', '=', req.user!.userId)
    .orderBy('updated_at', 'desc')
    .execute();

  return res.json(materials);
});

// T2.3/criterio de aceite 2 e 3 (spec 074) — historico completo por campo,
// so para o proprio autor ou moderador/admin (serie completa nao vaza para
// usuario comum; ficha publica mostra so "atualizado em X").
router.get('/:id/history', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .select(['id', 'creator_id'])
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const isOwner = material.creator_id === req.user!.userId;
  const canViewAny = req.user!.role === 'moderator' || req.user!.role === 'admin';

  if (!isOwner && !canViewAny) {
    return res.status(403).json({ error: 'Você não tem permissão para ver o histórico deste material.' });
  }

  const history = await db
    .selectFrom('download_material_version')
    .selectAll()
    .where('material_id', '=', req.params.id)
    .orderBy('changed_at', 'desc')
    .execute();

  return res.json(history);
});

// T2.1 — leitura publica de ficha, sem sessao. Fluxo completo de descoberta
// (busca/filtro/facetas) fica na spec 073; aqui so a leitura por slug.
router.get('/:slug', async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    // Spec 084 — material de origem scraper grava creator_id = download_creator.id
    // (ator de sistema, sem user_id/SSO real); material humano continua
    // gravando creator_id = user_id do SSO. OR cobre os 2 casos no mesmo JOIN
    // sem mudar o contrato do fluxo humano ja existente.
    .leftJoin('download_creator', (join) =>
      join.on((eb) => eb.or([
        eb('download_creator.user_id', '=', eb.ref('download_material.creator_id')),
        eb('download_creator.id', '=', eb.ref('download_material.creator_id')),
      ])),
    )
    // Achado real (review PR #208, Codex P1): ficha nao devolvia cover_image_url
    // (so a listagem fazia esse join); mesmo leftJoin + CARD_METADATA_FIELDS
    // da listagem, replicado aqui.
    .leftJoin('download_material_metadata', 'download_material_metadata.material_id', 'download_material.id')
    .select([...PUBLIC_MATERIAL_FIELDS, ...CARD_METADATA_FIELDS, 'download_creator.slug as creator_slug'])
    .where('download_material.slug', '=', req.params.slug)
    .where('download_material.editorial_state', '=', 'published')
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  // Spec 087 (T1B.1, Requisito 13) — fecha o debito de `view_count`: a coluna
  // existe desde a migration_008 (spec 070) mas nenhuma rota jamais a
  // incrementou, entao o painel admin de metricas sempre mostrou 0 views.
  //
  // Aqui e o lugar certo: ficha publica, sem exigir login (visualizacao e
  // anonima por natureza, diferente de download, que exige conta por D111
  // item 7). Dedup por (origem, material, dia) vive em registerMaterialView;
  // a chamada e fail-soft de proposito — metrica nunca derruba a ficha.
  //
  // Sem `await` (achado de review PR #214, CodeRabbit): sao dois writes que o
  // leitor da ficha nao precisa esperar. registerMaterialView ja engole o
  // proprio erro internamente; o .catch aqui e a rede de seguranca contra
  // unhandled rejection caso isso mude.
  void registerMaterialView(material.id, req).catch((error: unknown) => {
    console.error('[materials] falha ao registrar view', error);
  });

  // DEB-073-02 — destino opaco desacoplado do slug (download_destination,
  // migration_014). Get-or-create: primeiro acesso publico a ficha cria o
  // destino, se ainda nao existir; id sobrevive a troca futura de slug.
  const destination = await db
    .selectFrom('download_destination')
    .select('id')
    .where('material_id', '=', material.id)
    .executeTakeFirst()
    ?? await db
      .insertInto('download_destination')
      .values({ material_id: material.id })
      .onConflict((oc) => oc.column('material_id').doNothing())
      .returning('id')
      .executeTakeFirst()
    ?? await db
      .selectFrom('download_destination')
      .select('id')
      .where('material_id', '=', material.id)
      .executeTakeFirstOrThrow();

  // T-relacionados (spec 075) — nome legivel de sistema/edicao/variante pra
  // ficha linkar ao catalogo filtrado; fail-soft (nao derruba a ficha se
  // catalogo central estiver fora do ar). Achado real (review PR #208,
  // Codex P2): resolucao direta por getCatalogNodeById tratava edition_id
  // apontando pra uma variante como se fosse a propria edicao (variant_name
  // nunca saia no payload); reusa enrichMaterialsWithTaxonomy (mesma logica
  // de cadeia usada na listagem) pra devolver a cadeia completa.
  const [enriched] = await enrichMaterialsWithTaxonomy([material]);

  return res.json({
    ...enriched,
    destination_id: destination.id,
  });
});

// T2.2 — criacao autenticada. Estado editorial sempre nasce 'draft'; fila de
// moderacao completa fica na spec 072.
router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = createMaterialSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'slug, title e material_type_id são obrigatórios.', details: z.treeifyError(parsed.error) });
  }

  let materialType;
  try {
    materialType = await getCatalogMaterialTypeById(parsed.data.material_type_id);
    // Achado real (review PR #205, Codex): existência não basta; um tipo pode
    // ficar pending/rejeitado entre a carga do formulário e o POST.
    if (!materialType || materialType.status !== 'active') {
      return res.status(400).json({ error: 'Tipo de material inexistente ou inativo.' });
    }
  } catch (error) {
    // Falha Central é indisponibilidade (503), não payload inválido (400).
    console.error('[materials] material type validation unavailable', error);
    return res.status(503).json({ error: 'Catálogo de tipos de material indisponível.' });
  }

  const created = await db
    .insertInto('download_material')
    .values({
      slug: parsed.data.slug,
      title: parsed.data.title,
      material_type_id: materialType.id,
      material_type: materialType.name,
      creator_id: req.user!.userId,
      editorial_state: 'draft',
      access_kind: 'external_link',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

interface MaterialWithTaxonomyIds {
  system_id: string | null;
  edition_id: string | null;
}

function taxonomyChainFor(material: MaterialWithTaxonomyIds, nodes: FlatCatalogSystem[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  // Achado real (review PR #205, Sonar, Major): ternário aninhado escondia a
  // precedência edition → system. Fluxo explícito mantém a regra legível.
  let leaf: FlatCatalogSystem | undefined;
  if (material.edition_id) {
    leaf = byId.get(material.edition_id);
  } else if (material.system_id) {
    leaf = byId.get(material.system_id);
  }
  if (!leaf) return [];

  const chain: FlatCatalogSystem[] = [];
  const visited = new Set<string>();
  let current: FlatCatalogSystem | undefined = leaf;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return chain;
}

async function enrichMaterialsWithTaxonomy<T extends MaterialWithTaxonomyIds>(materials: T[]) {
  if (!materials.some((material) => material.system_id || material.edition_id)) {
    return materials.map((material) => ({ ...material, taxonomy_chain: [] }));
  }

  try {
    // Uma leitura Central por página (cache TTL em catalogClient), nunca uma
    // chamada por card. A árvore achatada resolve toda cadeia em memória.
    const nodes = await loadCatalogSystemsFlat();
    return materials.map((material) => {
      const chain = taxonomyChainFor(material, nodes);
      return {
        ...material,
        taxonomy_chain: chain.map(({ id, name, name_pt, node_type, path_slug }) => ({ id, name, name_pt, node_type, path_slug })),
        system_name: chain.find((node) => node.node_type === 'system')?.name ?? null,
        edition_name: chain.find((node) => node.node_type === 'edition')?.name ?? null,
        variant_name: chain.find((node) => node.node_type === 'variant')?.name ?? null,
        system_path_slug: chain.at(-1)?.path_slug ?? null,
      };
    });
  } catch (error) {
    // Catálogo público continua útil durante falha transitória do Central;
    // IDs seguem no payload e nomes podem reaparecer na próxima leitura.
    // Achado real (review PR #205, Codex): o fallback devolvia shape menor que
    // o sucesso. Nulos explícitos mantêm contrato estável durante a falha.
    console.error('[materials] taxonomy enrichment unavailable', error);
    return materials.map((material) => ({
      ...material,
      taxonomy_chain: [],
      system_name: null,
      edition_name: null,
      variant_name: null,
      system_path_slug: null,
    }));
  }
}

// T2.2 + Ownership (T3.2) — publicador so edita o proprio material; moderador
// e admin editam qualquer um (autorizacao fina fica na spec 072).
router.patch('/:id', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
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

  const parsed = patchMaterialSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const patch = parsed.data;
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
