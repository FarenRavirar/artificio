// Cliente da API de autoria. Cookie SSO (artificio_session) vai junto (same-origin/credentials).
const BASE = "/api/admin/v1";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (res.status === 401) throw new Error("Sessão expirada — entre novamente.");
  if (res.status === 403) throw new Error("Sem permissão (precisa ser admin).");
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface PostListItem {
  id: number; slug: string; title: string; status: string;
  published_at: string | null; updated_at: string | null;
}
export interface PageListItem { id: number; slug: string; title: string; status: string; updated_at: string | null; }
export interface Term { id: number; kind: "category" | "tag"; slug: string; name: string; parent_id: number | null; count: number; }
export interface SaveResult { id: number; slug: string; rebuild?: { started: boolean; busy?: boolean }; }

export interface PostFull {
  id?: number; title: string; slug: string; excerpt: string; content_html: string;
  block_doc: unknown | null; status: string; published_at: string | null;
  featured_url: string | null; seo_title: string | null; seo_description: string | null;
  canonical: string | null; og_title: string | null; og_description: string | null;
  og_image: string | null; twitter_card: string; noindex: boolean; cats: number[]; tags: number[];
}
export interface PageFull {
  id?: number; title: string; slug: string; excerpt: string; content_html: string;
  block_doc: unknown | null; status: string; seo_title: string | null; seo_description: string | null;
  canonical: string | null; og_title: string | null; og_description: string | null; og_image: string | null; noindex: boolean;
}

export const api = {
  listPosts: (q = "", status = "") =>
    req<{ items: PostListItem[] }>(`/posts?q=${encodeURIComponent(q)}${status ? `&status=${status}` : ""}`).then((r) => r.items),
  getPost: (id: number) => req<PostFull>(`/posts/${id}`),
  createPost: (body: Partial<PostFull>) => req<SaveResult>(`/posts`, { method: "POST", body: JSON.stringify(body) }),
  updatePost: (id: number, body: Partial<PostFull>) => req<SaveResult>(`/posts/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setPostStatus: (id: number, status: string) =>
    req<{ ok: boolean; rebuild?: { started: boolean; busy?: boolean } }>(`/posts/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  deletePost: (id: number) => req<{ ok: boolean }>(`/posts/${id}`, { method: "DELETE" }),

  listPages: (q = "", status = "") =>
    req<{ items: PageListItem[] }>(`/pages?q=${encodeURIComponent(q)}${status ? `&status=${status}` : ""}`).then((r) => r.items),
  getPage: (id: number) => req<PageFull>(`/pages/${id}`),
  createPage: (body: Partial<PageFull>) => req<SaveResult>(`/pages`, { method: "POST", body: JSON.stringify(body) }),
  updatePage: (id: number, body: Partial<PageFull>) => req<SaveResult>(`/pages/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  setPageStatus: (id: number, status: string) =>
    req<{ ok: boolean; rebuild?: { started: boolean; busy?: boolean } }>(`/pages/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  deletePage: (id: number) => req<{ ok: boolean }>(`/pages/${id}`, { method: "DELETE" }),

  listTerms: (kind?: "category" | "tag") => req<{ items: Term[] }>(`/taxonomies${kind ? `?kind=${kind}` : ""}`).then((r) => r.items),
  createTerm: (kind: "category" | "tag", name: string, parent_id?: number | null) =>
    req<Term>(`/taxonomies`, { method: "POST", body: JSON.stringify({ kind, name, parent_id }) }),

  slugCheck: (type: "post" | "page", title: string, id?: number) =>
    req<{ slug: string; available: boolean; suggestion: string }>(`/slug-check?type=${type}&title=${encodeURIComponent(title)}${id ? `&id=${id}` : ""}`),

  rebuild: () => req<{ started: boolean }>(`/rebuild`, { method: "POST" }),

  // Preview stateless: renderiza o buffer atual (não persiste, não publica). Retorna HTML.
  previewHtml: async (body: { type: "post" | "page"; title: string; status: string; content_html: string }): Promise<string> => {
    const res = await fetch(`${BASE}/preview`, {
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
