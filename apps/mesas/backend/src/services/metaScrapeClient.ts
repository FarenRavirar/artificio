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

/** Dispara o scrape do Graph API para a URL pública informada. Fire-and-forget
 * por design: falha de rede/credencial ausente nunca deve derrubar o fluxo de
 * publish/edit de mesa que chamou isto. */
export async function triggerMetaScrape(url: string): Promise<void> {
  const appToken = getAppToken();
  if (!appToken) {
    console.warn('[metaScrapeClient] META_APP_ID/META_APP_SECRET ausentes — scrape pulado para', url);
    return;
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
    }
  } catch (error) {
    console.error(`[metaScrapeClient] erro ao disparar scrape para ${url}:`, error);
  } finally {
    clearTimeout(timeout);
  }
}
