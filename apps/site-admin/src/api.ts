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
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface PostListItem {
  id: number; slug: string; title: string; status: string;
  published_at: string | null; updated_at: string | null;
}
export interface PageListItem { id: number; slug: string; title: string; status: string; updated_at: string | null; }
export interface Term { id: number; kind: "category" | "tag"; slug: string; name: string; parent_id: number | null; count: number; }
export interface SaveResult { id: number; slug: string; rebuild?: { started: boolean; busy?: boolean }; }
export interface MediaItem {
  id: number; source: string; url: string; mime: string | null;
  size_bytes: number | null; width: number | null; height: number | null;
  alt: string | null; caption: string | null; title: string | null; created_at: string | null;
}
export interface MediaUploadResult { id: number; url: string; source: string; mime: string; width: number | null; height: number | null; }

export interface FeedbackItem {
  id: number; kind: "bug" | "suggestion"; title: string; description: string;
  reporter_id: string | null; reporter_role: string | null; contact_email: string | null;
  page_url: string | null; route_path: string | null; environment: string | null; viewport: string | null;
  console_errors: unknown[]; network_errors: unknown[];
  screenshot_url: string | null; status: string; admin_notes: string | null;
  archived_at: string | null; created_at: string;
}

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

  // ---- Mídia (T18/T19) ----
  listMedia: (q = "", type = "", limit = 60, offset = 0) =>
    req<{ items: MediaItem[]; total: number }>(`/media?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}&limit=${limit}&offset=${offset}`),
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
    req<{ items: FeedbackItem[] }>(`/feedback?archived=${archived}${status ? `&status=${status}` : ""}${kind ? `&kind=${kind}` : ""}`).then((r) => r.items),
  updateFeedback: (id: number, patch: { status?: string; admin_notes?: string | null; archived?: boolean }) =>
    req<{ item: FeedbackItem }>(`/feedback/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteFeedback: (id: number) => req<{ ok: boolean }>(`/feedback/${id}`, { method: "DELETE" }),

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
