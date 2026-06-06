// Cliente WP REST — READ-ONLY (só GET; WP intocável, D004/D045). Paginação por X-WP-TotalPages.
const BASE = process.env.WP_BASE || "https://artificiorpg.com/wp-json/wp/v2";

export interface WpTerm {
  id: number;
  taxonomy: string;
  slug: string;
  name: string;
}

async function getPage(path: string, page: number): Promise<{ data: unknown[]; totalPages: number; total: number }> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE}/${path}${sep}per_page=100&page=${page}`);
  if (res.status === 400) return { data: [], totalPages: 0, total: 0 }; // page fora de range
  if (!res.ok) throw new Error(`WP ${path} p${page}: ${res.status} ${res.statusText}`);
  return {
    data: (await res.json()) as unknown[],
    totalPages: Number(res.headers.get("x-wp-totalpages") || 1),
    total: Number(res.headers.get("x-wp-total") || 0),
  };
}

/** Busca todos os itens de um endpoint, paginando. Gentil (sequencial). */
export async function fetchAll<T = Record<string, unknown>>(path: string): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const { data, totalPages: tp } = await getPage(path, page);
    if (!data.length) break;
    out.push(...(data as T[]));
    totalPages = tp;
    page += 1;
  } while (page <= totalPages);
  return out;
}

/** Total declarado pelo WP (X-WP-Total) p/ checagem de paridade. */
export async function countOf(path: string): Promise<number> {
  const { total } = await getPage(path, 1);
  return total;
}
