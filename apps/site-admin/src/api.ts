// Cliente da API de autoria. Cookie SSO (artificio_session) vai junto (same-origin/credentials).
const BASE = "/api/admin/v1";

// Origem do SSO p/ refresh de sessão (override por env em dev).
const ACCOUNTS_ORIGIN =
  (import.meta as unknown as { env?: { VITE_ACCOUNTS_URL?: string } }).env?.VITE_ACCOUNTS_URL ||
  "https://accounts.artificiorpg.com";

// Refresh single-flight: troca o cookie de refresh (7d) por novo access (15m) no accounts.
// Mantém o login persistente — ao tomar 401, tenta refresh e repete a request.
let refreshInFlight: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${ACCOUNTS_ORIGIN}/api/auth/refresh`, { credentials: "include" })
      .then((r) => r.ok).catch(() => false);
  }
  try { return await refreshInFlight; } finally { refreshInFlight = null; }
}

async function authFetch(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 401) return res;
  return (await refreshSession()) ? fetch(url, init) : res;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 401) throw new Error("Sessão expirada — entre novamente.");
  if (res.status === 403) throw new Error("Sem permissão (precisa ser admin).");
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (res.status === 204) return undefined as T;
  // JSON malformado vira erro nomeado, não `SyntaxError: Unexpected token` cru na tela.
  //
  // O cast de `T` continua sendo promessa, não garantia: quem consome payload de forma
  // estrutural (lista, envelope, campo que decide UI) valida acima — ver `reqItems`,
  // `listMedia`, `getCatalogSnapshot` e `slugCheck`. O critério dessas validações é
  // **o que o render percorre** (identidade, campo usado em `key`/rota/`switch`/`.map`),
  // não schema completo: isso cobre o crash e o dado silenciosamente errado sem virar um
  // segundo modelo de tipos para manter em sincronia com o backend.
  try {
    return (await res.json()) as T;
  } catch {
    throw new TypeError("Resposta do servidor não é JSON válido.");
  }
}

// `ContentId`: as colunas `id` são BIGINT (001_init.sql) e o parser default do `pg` as
// devolve como STRING. Declarar `number` era mentira de tipo — o valor em produção é
// `"18623"` —, e foi ela que produziu o validador quebrado abaixo. O id só é usado como
// `key` de lista e como segmento de URL, e ambos aceitam as duas formas; o que não se
// pode é fazer aritmética com ele.
export type ContentId = number | string;

export interface PostListItem {
  id: ContentId; slug: string; title: string; status: string;
  published_at: string | null; updated_at: string | null;
}
export interface PageListItem { id: ContentId; slug: string; title: string; status: string; updated_at: string | null; }
export interface Term { id: ContentId; kind: "category" | "tag"; slug: string; name: string; parent_id: ContentId | null; count: number; }
export interface SaveResult { id: ContentId; slug: string; rebuild?: { started: boolean; busy?: boolean }; }
export interface MediaItem {
  id: number; source: string; url: string; mime: string | null;
  size_bytes: number | null; width: number | null; height: number | null;
  alt: string | null; caption: string | null; title: string | null; created_at: string | null;
}
export interface MediaUploadResult { id: number; url: string; source: string; mime: string; width: number | null; height: number | null; }

export interface FeedbackItem {
  id: ContentId; kind: "bug" | "suggestion"; title: string; description: string;
  reporter_id: string | null; reporter_role: string | null; contact_email: string | null;
  page_url: string | null; route_path: string | null; environment: string | null; viewport: string | null;
  console_errors: unknown[]; network_errors: unknown[];
  screenshot_url: string | null; status: string; admin_notes: string | null;
  archived_at: string | null; created_at: string;
}

export interface CatalogAlias {
  id: number; node_id: string; alias: string; locale: string | null; kind: string;
}
export type CatalogNodeStatus = "draft" | "pending" | "active" | "rejected" | "merged";
export interface CatalogNode {
  id: string; parent_id: string | null; node_type: "system" | "edition" | "variant";
  canonical_slug: string; path_slug: string; name: string; name_pt: string | null;
  description: string | null; official_website_url: string | null; logo_media_id: string | null;
  status: CatalogNodeStatus; merged_into_id: string | null; version: number;
  created_by: string | null; updated_by: string | null; created_at: string; updated_at: string;
  aliases: CatalogAlias[]; children: CatalogNode[];
}
export interface CatalogSnapshot {
  catalog_version: number; generated_at: string; checksum: string; nodes_count: number; tree: CatalogNode[];
}
export interface CatalogNodeInput {
  parent_id?: string | null; node_type: CatalogNode["node_type"]; canonical_slug?: string;
  name: string; name_pt?: string | null; description?: string | null;
  official_website_url?: string | null; logo_media_id?: string | null; status?: CatalogNodeStatus; aliases?: string[];
}

export interface PostFull {
  id?: ContentId; title: string; slug: string; excerpt: string; content_html: string;
  block_doc: unknown | null; status: string; published_at: string | null;
  featured_url: string | null; seo_title: string | null; seo_description: string | null;
  canonical: string | null; og_title: string | null; og_description: string | null;
  og_image: string | null; twitter_card: string; noindex: boolean; cats: ContentId[]; tags: ContentId[];
}
export interface PageFull {
  id?: ContentId; title: string; slug: string; excerpt: string; content_html: string;
  block_doc: unknown | null; status: string; seo_title: string | null; seo_description: string | null;
  canonical: string | null; og_title: string | null; og_description: string | null; og_image: string | null; noindex: boolean;
}

// Monta a query encodando TODO parâmetro e descartando vazio. Existe porque
// `status`/`type`/`kind` iam crus ao lado de um `q` já protegido, e um valor com
// `&`/`#` injetava parâmetro na query (achado do Sonar, corrigido em 2026-08-14);
// a função também elimina os template literals aninhados que a primeira correção
// tinha deixado (segundo achado, mesma data).
function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

// Normalizador de envelope `{ items: [...] }`, aplicado na fronteira da API porque
// `req<T>` faz cast cru do JSON e o tipo é promessa, não garantia (AGENTS.md: todo dado
// de API é `unknown` até passar por normalizador tipado).
//
// Envelope inválido vira ERRO, nunca lista vazia: `[]` silencioso faz a tela dizer
// "Nenhum post" e o autor lê falha de contrato como conteúdo apagado (achado Codex P2
// na #267). A mensagem nomeia o recurso para o erro que aparece na tela ser acionável.
//
// `isValidItem` valida cada entrada, não só o array: `items: [null]` passava na checagem
// de array e quebrava no render (`p.id` como `key`, `p.status` no `switch` de `actionsFor`),
// ou pior, gerava linha com link para `/posts/undefined` (achado Codex na #267).
async function reqItems<T>(path: string, recurso: string, isValidItem: (item: unknown) => boolean): Promise<T[]> {
  const r = await req<unknown>(path);
  const items = (r as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || !items.every(isValidItem)) {
    // `TypeError` e não `Error`: a falha é de tipo/forma do payload, não de negócio
    // (Sonar: `new Error()` é genérico demais para checagem de tipo).
    throw new TypeError(`Resposta inesperada do servidor ao listar ${recurso}.`);
  }
  return items as T[];
}

// Validadores de item, por recurso. Checam a identidade (`id`, usada como `key` e em rota)
// e os campos que o render consome de forma estrutural — não é validação de schema
// completo, e sim a garantia de que a lista pode ser percorrida sem quebrar.
//
// `id` aceita number OU string de dígitos porque a coluna é `BIGINT` (001_init.sql) e o
// parser default do `pg` devolve BIGINT como STRING — `{"id":"18623"}` na resposta real de
// produção. Exigir `typeof id === "number"` fazia `every()` reprovar TODO item e a tela
// morrer em "Resposta inesperada do servidor ao listar posts" (medido 2026-08-28), com
// o admin inteiro inacessível: posts, páginas, taxonomias e feedback compartilham este
// validador. Mesmo defeito de `avg_rating` (NUMERIC → string) no mesas, mesma raiz:
// tipo declarado no cliente não descreve o que o driver entrega.
// `isSafeInteger` e não `isFinite`: `isFinite(12.5)` é `true`, então um id fracionário
// passava e viraria `/posts/12.5` na rota. Acima de 2^53 o number já perdeu precisão na
// origem — nesse caso o valor correto só existe na forma string, aceita abaixo.
const hasNumericId = (item: unknown): item is { id: ContentId } => {
  if (!item || typeof item !== "object") return false;
  const id = (item as { id?: unknown }).id;
  if (typeof id === "number") return Number.isSafeInteger(id);
  return typeof id === "string" && /^\d+$/.test(id);
};

const isContentListItem = (item: unknown): boolean =>
  hasNumericId(item) && typeof (item as { status?: unknown }).status === "string";

// `kind` separa categoria de tag num `filter`, e feedback usa `kind` no badge: entrada com
// `kind` inválido sumiria das duas listas sem erro, parecendo taxonomia apagada.
const isKindedItem = (item: unknown): boolean =>
  hasNumericId(item) && typeof (item as { kind?: unknown }).kind === "string";

// Valida a forma estrutural de um nó do catálogo, descendo na árvore. Checa só o que o
// render percorre (`aliases`/`children`, que são arrays obrigatórios no contrato) — não é
// validação de schema completo, e sim a garantia de que `toUiNode` pode mapear sem
// fallback silencioso escondendo contrato quebrado.
function isCatalogNode(node: unknown): boolean {
  const n = node as { id?: unknown; aliases?: unknown; children?: unknown } | null;
  return (
    !!n && typeof n === "object" &&
    // `id` é a key do nó na árvore e o alvo de seleção/edição.
    typeof n.id === "string" &&
    // Cada alias é mapeado por `toUiNode` (`alias.alias`), então entrada inválida no array
    // quebraria o render — validar só o array não basta (achado Codex na #267).
    Array.isArray(n.aliases) &&
    n.aliases.every((a) => !!a && typeof a === "object" && typeof (a as { alias?: unknown }).alias === "string") &&
    Array.isArray(n.children) &&
    n.children.every(isCatalogNode)
  );
}

export const api = {
  listPosts: (q = "", status = "") =>
    reqItems<PostListItem>(`/posts${qs({ q, status })}`, "posts", isContentListItem),
  getPost: (id: ContentId) => req<PostFull>(`/posts/${id}`),
  createPost: (body: Partial<PostFull>) => req<SaveResult>(`/posts`, { method: "POST", body: JSON.stringify(body) }),
  updatePost: (id: ContentId, body: Partial<PostFull>) => req<SaveResult>(`/posts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setPostStatus: (id: ContentId, status: string) =>
    req<{ ok: boolean; rebuild?: { started: boolean; busy?: boolean } }>(`/posts/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  deletePost: (id: ContentId) => req<{ ok: boolean }>(`/posts/${id}`, { method: "DELETE" }),

  listPages: (q = "", status = "") =>
    reqItems<PageListItem>(`/pages${qs({ q, status })}`, "páginas", isContentListItem),
  getPage: (id: ContentId) => req<PageFull>(`/pages/${id}`),
  createPage: (body: Partial<PageFull>) => req<SaveResult>(`/pages`, { method: "POST", body: JSON.stringify(body) }),
  updatePage: (id: ContentId, body: Partial<PageFull>) => req<SaveResult>(`/pages/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setPageStatus: (id: ContentId, status: string) =>
    req<{ ok: boolean; rebuild?: { started: boolean; busy?: boolean } }>(`/pages/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  deletePage: (id: ContentId) => req<{ ok: boolean }>(`/pages/${id}`, { method: "DELETE" }),

  listTerms: (kind?: "category" | "tag") => reqItems<Term>(`/taxonomies${qs({ kind })}`, "categorias e tags", isKindedItem),
  createTerm: (kind: "category" | "tag", name: string, parent_id?: ContentId | null) =>
    req<Term>(`/taxonomies`, { method: "POST", body: JSON.stringify({ kind, name, parent_id }) }),

  // Normaliza na fronteira: `req` faz cast cru do JSON, e `available` decide se o aviso de
  // colisão de slug aparece.
  //
  // `available` é `boolean | "unknown"`, nunca um default otimista: assumir `true` em
  // resposta inválida (version skew, contrato quebrado) apagaria o aviso de colisão, o
  // autor salvaria confiante e o servidor trocaria o slug por baixo via `uniqueSlug` —
  // que é precisamente o que R3a [P0] da spec 011 proíbe ("não pode alterar silenciosamente
  // o slug digitado pelo editor sem feedback"). Achado Codex P2 na #267.
  //
  // Também não lança: este endpoint roda a cada digitação com debounce, e derrubar a tela
  // em erro a cada tecla seria pior que sinalizar incerteza. Quem decide como exibir
  // "desconhecido" é o PostEditor.
  slugCheck: async (type: "post" | "page", title: string, id?: number): Promise<{ slug: string; available: boolean | "unknown"; suggestion: string }> => {
    const r = await req<unknown>(`/slug-check${qs({ type, title, id })}`);
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      slug: typeof o.slug === "string" ? o.slug : "",
      available: typeof o.available === "boolean" ? o.available : "unknown",
      suggestion: typeof o.suggestion === "string" ? o.suggestion : "",
    };
  },

  rebuild: () => req<{ started: boolean }>(`/rebuild`, { method: "POST" }),

  // ---- Mídia (T18/T19) ----
  // `limit`/`offset` são numéricos e vão sempre: `qs` só descarta `undefined` e
  // string vazia, então `offset=0` sobrevive (descartá-lo zeraria a paginação).
  // Envelope próprio (items + total), normalizado aqui pelo mesmo motivo do `reqItems`:
  // `total` não-numérico renderizaria "NaN item(ns)" no rodapé do grid.
  listMedia: async (q = "", type = "", limit = 60, offset = 0): Promise<{ items: MediaItem[]; total: number }> => {
    const r = await req<unknown>(`/media${qs({ q, type, limit, offset })}`);
    const o = (r ?? {}) as { items?: unknown; total?: unknown };
    // Valida cada item, não só o array: o grid usa `id` como key e `url` no `src` da
    // <img>, e `isImage` chama `.startsWith()` sobre `mime` (achado Codex na #267).
    const isMediaItem = (m: unknown): boolean =>
      hasNumericId(m) && typeof (m as { url?: unknown }).url === "string";
    if (!Array.isArray(o.items) || !o.items.every(isMediaItem) || typeof o.total !== "number") {
      throw new TypeError("Resposta inesperada do servidor ao listar mídia.");
    }
    return { items: o.items as MediaItem[], total: o.total };
  },
  uploadMedia: async (file: File, meta?: { alt?: string; title?: string; caption?: string }): Promise<MediaUploadResult> => {
    const fd = new FormData();
    fd.append("file", file);
    if (meta?.alt) fd.append("alt", meta.alt);
    if (meta?.title) fd.append("title", meta.title);
    if (meta?.caption) fd.append("caption", meta.caption);
    // sem Content-Type manual: o browser define o boundary do multipart.
    const res = await authFetch(`${BASE}/media`, { method: "POST", credentials: "include", body: fd });
    if (res.status === 401) throw new Error("Sessão expirada — entre novamente.");
    if (res.status === 403) throw new Error("Sem permissão (precisa ser admin).");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string; detail?: string }).detail || (body as { error?: string }).error || `${res.status}`);
    }
    return res.json() as Promise<MediaUploadResult>;
  },
  updateMedia: (id: number, meta: { alt?: string | null; caption?: string | null; title?: string | null }) =>
    req<{ ok: boolean }>(`/media/${id}`, { method: "PUT", body: JSON.stringify(meta) }),
  deleteMedia: (id: number) => req<{ ok: boolean }>(`/media/${id}`, { method: "DELETE" }),

  // ---- Feedback (Spec 021) ----
  listFeedback: (status = "", kind = "", archived = "false") =>
    reqItems<FeedbackItem>(`/feedback${qs({ archived, status, kind })}`, "feedback", isKindedItem),
  updateFeedback: (id: ContentId, patch: { status?: string; admin_notes?: string | null; archived?: boolean }) =>
    req<{ item: FeedbackItem }>(`/feedback/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteFeedback: (id: ContentId) => req<{ ok: boolean }>(`/feedback/${id}`, { method: "DELETE" }),

  // ---- Catálogo canônico de sistemas (Spec 062) ----
  // `tree` validado aqui, não no componente: assim vale para a carga inicial e para o
  // refresh pós-save, sem repetir a guarda em cada chamada.
  //
  // A checagem é recursiva de propósito: `CatalogNode.children`/`aliases` são arrays
  // obrigatórios no contrato (nó folha vem `[]`, não ausente), então validar só a raiz
  // deixaria um nó aninhado inválido virar subárvore vazia silenciosa — o autor veria um
  // sistema sem edições e leria como conteúdo apagado (achado Codex P2 na #267).
  getCatalogSnapshot: async (): Promise<CatalogSnapshot> => {
    const r = await req<unknown>(`/catalog/snapshot`);
    const tree = (r as { tree?: unknown } | null)?.tree;
    if (!Array.isArray(tree) || !tree.every(isCatalogNode)) {
      throw new TypeError("Resposta inesperada do servidor ao carregar o catálogo.");
    }
    return r as CatalogSnapshot;
  },
  createCatalogNode: (body: CatalogNodeInput) =>
    req<CatalogNode>(`/catalog/nodes`, { method: "POST", body: JSON.stringify(body) }),
  updateCatalogNode: (id: string, body: Partial<CatalogNodeInput>) =>
    req<CatalogNode>(`/catalog/nodes/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  // Preview stateless: renderiza o buffer atual (não persiste, não publica). Retorna HTML.
  previewHtml: async (body: { type: "post" | "page"; title: string; status: string; content_html: string }): Promise<string> => {
    const res = await authFetch(`${BASE}/preview`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.status === 401) throw new Error("Sessão expirada — entre novamente.");
    if (res.status === 403) throw new Error("Sem permissão (precisa ser admin).");
    if (!res.ok) throw new Error(`${res.status}`);
    return res.text();
  },
};

/** Abre HTML de preview numa nova aba via blob (sem persistir nada). */
export function openPreview(html: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
