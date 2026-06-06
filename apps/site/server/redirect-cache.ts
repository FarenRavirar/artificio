// Cache em memória da tabela `redirects` (spec 011). Compartilhado entre o middleware (server.ts)
// e a API (admin-api recarrega imediatamente após gravar um 301, evitando janela de 30s).
import { listRedirects } from "../db/repo/redirects.js";

const map = new Map<string, { to: string; code: number }>();

export async function reloadRedirects(): Promise<void> {
  try {
    const rows = await listRedirects();
    map.clear();
    for (const r of rows) map.set(r.from_path, { to: r.to_path, code: r.code || 301 });
  } catch { /* DB indisponível: mantém o que tem, tenta de novo no próximo tick */ }
}

export function lookupRedirect(path: string): { to: string; code: number } | undefined {
  return map.get(path);
}
