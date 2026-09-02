// Purga o cache da borda (Cloudflare) depois que o SSG novo está no disco.
//
// Por que isto existe (incidente medido em 2026-09-02, 1ª publicação pós-WordPress):
// o mantenedor publicou um artigo, o painel disse "Publicado. (rebuild disparado)",
// e nada apareceu no site. Nada tinha falhado: o post estava `publish` no banco, o
// `posts.json` foi reexportado, o Astro rebuildou e o symlink `dist` apontava para o
// build novo — tudo às 14:54. O que o visitante recebia vinha da borda:
//
//     GET /blog/  ->  cf-cache-status: HIT, last-modified: 28 Aug, Age: 1417
//     GET /blog/?cb=<aleatório>  ->  MISS, e o artigo aparecia
//
// A regra "Cache Everything — HTML" da zona guarda HTML por 7200s em `override_origin`,
// então o `Cache-Control` da origem não tem voz nenhuma: enquanto o TTL não expira, a
// borda serve a listagem antiga e o artigo fica invisível por até 2 horas. O post em si
// respondia 200 só porque a URL era nova e nunca tinha entrado no cache — o que torna o
// sintoma pior, não melhor: a página existe, mas nenhum leitor chega nela pela listagem.
//
// Rebuild sem purga é meio deploy. A publicação só termina quando a borda esquece o HTML
// velho, e é isso que este módulo faz.
//
// PURGA SELETIVA, não `purge_everything`: a mesma zona serve os outros subdomínios do
// portal e os assets com TTL de 31 dias ("Assets estáticos — TTL longo"). Derrubar tudo
// a cada publicação jogaria fora cache alheio e transformaria uma publicação de blog num
// evento de origem para o portal inteiro.
//
// A purga é ASSÍNCRONA e a zona tem Tiered Caching ligado (medido em 2026-09-02): a API
// responde `success: true` na hora, mas a invalidação leva alguns segundos para alcançar
// as camadas. Medir logo depois do 200 engana — na primeira verificação o `Age` ainda
// subia e a página seguia HIT, o que faz a purga parecer quebrada quando ela funcionou.
// Por isso o job reporta `ok` com base na resposta da API, e não numa releitura imediata
// do site: uma verificação apressada produziria falso negativo a cada publicação.

const API = "https://api.cloudflare.com/client/v4";

export interface PurgeResult {
  attempted: boolean;
  ok?: boolean;
  purged?: number;
  /** Motivo de não ter tentado, ou o erro. Some no caminho feliz. */
  reason?: string;
}

/**
 * O que purgar. `prefixes` e não `files`: medido em 2026-09-02, purgar por URL exata
 * invalidou `/blog/` mas NÃO a home, mesmo com a API respondendo `success: true` para as
 * duas — a home só cedeu à purga por prefixo. Não vale apostar a publicação numa forma
 * que já falhou em metade dos casos medidos.
 *
 * O prefixo do host cobre todo o HTML do site numa chamada só, e ainda alcança o que a
 * lista de URLs nunca alcançaria: os arquivos de categoria e tag do post novo, a
 * paginação, o sitemap e o feed. Os assets versionados (`/_astro/*`, com hash no nome)
 * entram no lote, mas isso é inofensivo — nome com hash muda quando o conteúdo muda, e
 * um MISS neles apenas os rebusca uma vez.
 *
 * Continua NÃO sendo `purge_everything`: a zona serve os outros subdomínios do portal
 * (`accounts.`, `mesas.`, `glossario.`…), e derrubar tudo a cada publicação de blog
 * jogaria fora cache alheio.
 */
function prefixosDoSite(base: string): string[] {
  const host = base.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  // `www` é hostname próprio na regra de cache da zona e tem entradas próprias no cache.
  return host.startsWith("www.") ? [`${host}/`] : [`${host}/`, `www.${host}/`];
}

/**
 * Purga o HTML da borda. Silenciosa por design quando não há credencial: em dev e em
 * qualquer ambiente sem Cloudflare na frente não há o que purgar, e um erro ali faria
 * o rebuild local parecer quebrado sem nada estar.
 */
export async function purgeCache(): Promise<PurgeResult> {
  const token = process.env.CLOUDFLARE_PURGE_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const base = (process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");

  if (!token || !zone) return { attempted: false, reason: "sem CLOUDFLARE_PURGE_TOKEN/ZONE_ID" };
  if (!base) return { attempted: false, reason: "sem PUBLIC_SITE_URL" };

  const prefixes = prefixosDoSite(base);

  try {
    const resp = await fetch(`${API}/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) {
      const corpo = await resp.text().catch(() => "");
      return { attempted: true, ok: false, reason: `HTTP ${resp.status} ${corpo.slice(0, 200)}` };
    }
    return { attempted: true, ok: true, purged: prefixes.length };
  } catch (e) {
    // Falha de purga NÃO é falha de rebuild: o conteúdo novo está no disco e a borda
    // expira sozinha em 2h. O job precisa reportar isso em vez de fingir sucesso —
    // sem o aviso, o mantenedor volta a olhar um site velho sem saber por quê.
    return { attempted: true, ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
