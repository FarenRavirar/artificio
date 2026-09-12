// Cache em memória da tabela `redirects` (spec 011). Compartilhado entre o middleware (server.ts)
// e a API (admin-api recarrega imediatamente após gravar um 301, evitando janela de 30s).
import { listRedirects } from "../db/repo/redirects.js";

const map = new Map<string, { to: string; code: number }>();

// Chave canônica do mapa: sempre SEM barra final (exceto a raiz). O `from_path` gravado pode
// vir nas duas formas (o WP emitia com barra; backlink externo costuma perder a barra), e
// `Map.get` é igualdade estrita — sem isso, `/noticias/x` cairia em 404 com `/noticias/x/`
// na tabela, justamente a forma que a spec 102 F2 quer recuperar.
function canonicalKey(path: string): string {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export async function reloadRedirects(): Promise<void> {
  try {
    const rows = await listRedirects();
    const next = new Map<string, { to: string; code: number }>();
    for (const r of rows) {
      const key = canonicalKey(r.from_path);
      const entry = { to: r.to_path, code: r.code || 301 };
      const existing = next.get(key);
      // `/legacy` e `/legacy/` colapsam na mesma chave. Se as duas linhas apontarem para
      // destinos diferentes, a última venceria em silêncio e uma das URLs passaria a redirecionar
      // para o lugar errado sem nenhum sinal. Não descartamos a recarga inteira — isso derrubaria
      // os outros redirects válidos por causa de uma linha ruim — mas a primeira linha (ordenada
      // por `from_path`) vence de forma determinística e o conflito fica registrado.
      if (existing && (existing.to !== entry.to || existing.code !== entry.code)) {
        console.warn(
          `[redirect-cache] conflito na chave "${key}": mantendo ${existing.code} -> ${existing.to}, ` +
          `ignorando ${entry.code} -> ${entry.to} (from_path "${r.from_path}")`,
        );
        continue;
      }
      next.set(key, entry);
    }
    // Troca atômica: o middleware nunca enxerga o mapa parcialmente preenchido.
    map.clear();
    for (const [k, v] of next) map.set(k, v);
  } catch { /* DB indisponível: mantém o que tem, tenta de novo no próximo tick */ }
}

export function lookupRedirect(path: string): { to: string; code: number } | undefined {
  return map.get(canonicalKey(path));
}

// Preserva a query string da requisição no destino do 301. `req.path` a descarta, então sem
// isso `/noticias/x/?utm_source=fb` chegaria ao destino sem UTM e a atribuição de campanha
// sumiria do GA4 em todo o tráfego legado (spec 102 F2 / T2.1, defeito 2). Chave já presente
// no `to_path` vence a da origem — o destino é editorial, a origem é o que o visitante trouxe.
export function withOriginalQuery(to: string, originalUrl: string): string {
  const q = originalUrl.indexOf("?");
  if (q === -1) return to;
  const incoming = originalUrl.slice(q + 1);
  if (!incoming) return to;

  const hashAt = to.indexOf("#");
  const hash = hashAt === -1 ? "" : to.slice(hashAt);
  const toNoHash = hashAt === -1 ? to : to.slice(0, hashAt);

  const toQueryAt = toNoHash.indexOf("?");
  const toPath = toQueryAt === -1 ? toNoHash : toNoHash.slice(0, toQueryAt);
  const params = new URLSearchParams(toQueryAt === -1 ? "" : toNoHash.slice(toQueryAt + 1));

  // Snapshot das chaves do destino ANTES do laço: `params.has` passaria a ser true depois do
  // primeiro valor anexado, e uma query repetida na origem (`?tag=a&tag=b`) perderia tudo a
  // partir do segundo valor.
  const destinationKeys = new Set(params.keys());
  for (const [key, value] of new URLSearchParams(incoming)) {
    if (!destinationKeys.has(key)) params.append(key, value);
  }

  const merged = params.toString();
  return merged ? `${toPath}?${merged}${hash}` : `${toPath}${hash}`;
}
