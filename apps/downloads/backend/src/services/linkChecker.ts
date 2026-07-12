import dns from 'node:dns/promises';
import net from 'node:net';

// T5.1/T5.2 (spec 075) — link checker isolado. Mitigacao SSRF (T5.5): nunca
// bate em IP privado/loopback/link-local/metadado de nuvem, mesmo que o
// hostname resolva la depois de passar por DNS (rebinding). So aceita
// http/https; timeout curto; nunca segue redirect pra fora do escopo
// permitido sem revalidar o destino final.

export class UnsafeLinkTargetError extends Error {}

const METADATA_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal']);

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 0) return true; // "this network"
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true; // loopback
    if (normalized.startsWith('fe80:')) return true; // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local
    return false;
  }

  return false;
}

async function assertSafeTarget(hostname: string): Promise<void> {
  if (METADATA_HOSTS.has(hostname.toLowerCase())) {
    throw new UnsafeLinkTargetError(`Host de metadado de nuvem bloqueado: ${hostname}`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeLinkTargetError(`IP privado/reservado bloqueado: ${hostname}`);
    }
    return;
  }

  const resolved = await dns.lookup(hostname, { all: true });
  for (const { address } of resolved) {
    if (isPrivateOrReservedIp(address) || METADATA_HOSTS.has(address)) {
      throw new UnsafeLinkTargetError(`Hostname "${hostname}" resolve para IP privado/reservado/metadado bloqueado.`);
    }
  }
}

export interface LinkCheckResult {
  checkedUrl: string;
  httpStatus: number | null;
  isHealthy: boolean;
  errorDetail: string | null;
}

const CHECK_TIMEOUT_MS = 8000;

// Faz HEAD (fallback GET) contra a URL apos validar que o destino nao e
// privado/loopback/metadado. Nunca segue redirect automaticamente: cada hop
// e revalidado antes de seguir, pra nao virar tunel de SSRF via 3xx.
export async function checkLink(url: string, maxRedirects = 3): Promise<LinkCheckResult> {
  let currentUrl = url;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return { checkedUrl: url, httpStatus: null, isHealthy: false, errorDetail: 'URL inválida.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { checkedUrl: url, httpStatus: null, isHealthy: false, errorDetail: `Protocolo não permitido: ${parsed.protocol}` };
    }

    try {
      await assertSafeTarget(parsed.hostname);
    } catch (error) {
      const detail = error instanceof UnsafeLinkTargetError ? error.message : 'Falha ao validar destino.';
      return { checkedUrl: url, httpStatus: null, isHealthy: false, errorDetail: detail };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return { checkedUrl: url, httpStatus: response.status, isHealthy: false, errorDetail: 'Redirect sem Location.' };
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return {
        checkedUrl: url,
        httpStatus: response.status,
        isHealthy: response.status >= 200 && response.status < 400,
        errorDetail: response.status >= 400 ? `HTTP ${response.status}` : null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha desconhecida ao checar link.';
      return { checkedUrl: url, httpStatus: null, isHealthy: false, errorDetail: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { checkedUrl: url, httpStatus: null, isHealthy: false, errorDetail: 'Excedeu limite de redirecionamentos.' };
}
