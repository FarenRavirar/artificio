// Achado do mantenedor (sessão 26-07-13_2): OG preview nunca aparecia no
// WhatsApp/Facebook porque o scrape do Graph API só roda quando alguém dispara
// manualmente no Sharing Debugger — nunca de forma proativa. Este client
// dispara esse scrape automaticamente quando a mesa é publicada ou tem a
// imagem/banner alterada, sem exigir ação manual do mestre/mantenedor.
//
// Credenciais (META_APP_ID/META_APP_SECRET) são opcionais em runtime: se
// ausentes, o scrape é pulado com log — nunca bloqueia publish/edit de mesa.

const GRAPH_API_URL = 'https://graph.facebook.com/';
const SCRAPE_TIMEOUT_MS = 8_000;

function getAppToken(): string | null {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return null;
  return `${appId}|${appSecret}`;
}

/** Dispara o scrape do Graph API para a URL pública informada. Retorna se deu
 * certo (achado CodeRabbit PR #157: o script de backfill precisa saber se o
 * scrape falhou, em vez de contar como concluído com sucesso). Nos 4 hooks de
 * publish/edit de mesa o retorno é ignorado de propósito — fire-and-forget,
 * falha de rede/credencial nunca deve derrubar esse fluxo. */
export async function triggerMetaScrape(url: string): Promise<boolean> {
  const appToken = getAppToken();
  if (!appToken) {
    console.warn('[metaScrapeClient] META_APP_ID/META_APP_SECRET ausentes — scrape pulado para', url);
    return false;
  }

  const params = new URLSearchParams({ id: url, scrape: 'true', access_token: appToken });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  try {
    const response = await fetch(`${GRAPH_API_URL}?${params.toString()}`, {
      method: 'POST',
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.error(`[metaScrapeClient] scrape falhou (${response.status}) para ${url}:`, body);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[metaScrapeClient] erro ao disparar scrape para ${url}:`, error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mesas.artificiorpg.com';

/** Dispara o scrape só quando o status realmente transiciona pra `active`
 * (1ª publicação ou republicação após outro status) — evita chamar o Graph
 * API à toa em updates que não mudam o status de publicação. Centraliza a
 * regra usada pelos 3 pontos que publicam mesa (POST /gm/tables,
 * PATCH /gm/tables/:id/status, PUT /admin/tables/:id — achado Codex PR #157). */
export function triggerMetaScrapeOnPublish(
  slug: string,
  newStatus: string,
  previousStatus: string | null,
): void {
  if (newStatus !== 'active' || previousStatus === 'active') return;
  void triggerMetaScrape(`${SITE_URL}/mesas/${slug}`);
}
