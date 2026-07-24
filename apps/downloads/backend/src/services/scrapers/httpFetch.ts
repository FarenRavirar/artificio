import { fetch as undiciFetch } from 'undici';

// Fase 3 (spec 084) — fetch simples (Modo 1) compartilhado pelos adapters.
// Diferente de linkChecker.ts (que valida URL arbitraria enviada por
// usuario, com pinning de IP contra SSRF): aqui a URL sempre vem de dominio
// fixo conhecido do proprio adapter (itch.io, rpggratis.wordpress.com etc.),
// nunca de input externo — risco de SSRF nao se aplica da mesma forma.
const FETCH_TIMEOUT_MS = 15_000;
// User-Agent de browser real — sem isso, itch.io e outras fontes retornam
// 403 mesmo em paginas publicas sem anti-bot ativo (confirmado via teste
// direto durante esta implementacao: requests sem UA de browser falham,
// mesma URL com UA completo funciona).
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface SimpleFetchResult {
  html: string;
  status: number;
}

export async function fetchSimple(url: string): Promise<SimpleFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await undiciFetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
    });
    const html = await response.text();
    return { html, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}

// Indica se a resposta sugere bloqueio anti-bot (403/challenge Cloudflare) —
// adapters usam isso pra decidir se escalonam pro Modo 2a/2b.
export function looksBlocked(result: SimpleFetchResult): boolean {
  return result.status === 403 || result.status === 429;
}
