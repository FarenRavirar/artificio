import { z } from 'zod';

export const materialSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  material_type: z.string(),
  material_type_id: z.uuid().nullable().optional(),
  access_kind: z.enum(['external_link', 'managed_upload']),
  external_url: z.string().nullable(),
  creator_id: z.string(),
  creator_slug: z.string().nullable().optional(),
  destination_id: z.string().optional(),
  system_id: z.string().nullable().optional(),
  edition_id: z.string().nullable().optional(),
  system_name: z.string().nullable().optional(),
  edition_name: z.string().nullable().optional(),
  // Fase 6 (spec 086, T6.1) — metadata rica pro card/ficha: capa real, creditos
  // (autor+artista combinados numa string unica pelo backend — combineCredits
  // em scraperIngest.ts nao separa os dois, achado real registrado como
  // debito de contrato) e cenario/ambientacao do material.
  cover_image_url: z.string().nullable().optional(),
  credits: z.string().nullable().optional(),
  // Spec 088 (requisito 30) — EDITORA, campo distinto de `credits` (autoria).
  // Um nunca serve de fallback do outro: exibir a editora sob rotulo de autor
  // seria a mesma afirmacao falsa que o antigo "Acervo Artificio".
  publisher_name: z.string().nullable().optional(),
  scenario: z.string().nullable().optional(),
  variant_name: z.string().nullable().optional(),
  system_path_slug: z.string().nullable().optional(),
  // Spec 087 (T1B/T3.5) — metricas calculadas pelo backend
  // (services/materialMetrics.ts), nunca colunas cruas: `avg_rating` e a media
  // bayesiana ja ancorada na media do catalogo e `popularity_score` a taxa de
  // conversao download/view ancorada do mesmo jeito. Ambos sao `null` quando
  // nao ha volume — ausencia de dado NUNCA vira 0, senao material sem
  // avaliacao apareceria como "0 estrelas" (Requisito 15). `rating_count` e
  // contagem bruta e e o unico gatilho de exibicao das estrelas.
  avg_rating: z.number().nullable().optional(),
  rating_count: z.number().optional(),
  popularity_score: z.number().nullable().optional(),
  editorial_state: z.enum(['draft', 'in_review', 'published', 'rejected', 'withdrawn']),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Material = z.infer<typeof materialSchema>;

export const materialListResponseSchema = z.object({
  items: z.array(materialSchema),
  page: z.number(),
  page_size: z.number(),
  total: z.number(),
  total_pages: z.number(),
});

export type MaterialListResponse = z.infer<typeof materialListResponseSchema>;

// Spec 087 (T2.6, decisao 5) — `trending` e `rating` sao ordenacoes formais do
// catalogo, nao um modo separado de home: a mesma rota atende vitrine e
// resultado, entao a prateleira "Mais visitados" e o dropdown de ordenacao
// falam exatamente o mesmo contrato de URL. Ordem do array e a ordem exibida
// no dropdown.
export const SORT_OPTIONS = ['relevance', 'recent', 'popular', 'trending', 'rating', 'name'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface MaterialListFilters {
  q?: string;
  system_id?: string;
  edition_id?: string;
  /** ID canônico; nome do query param permanece por compatibilidade de URL. */
  material_type?: string;
  access_kind?: 'external_link' | 'managed_upload';
  sort?: SortOption;
  page?: number;
}
