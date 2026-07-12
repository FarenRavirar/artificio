import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';

// T5.1/T5.2 (spec 075) — link checker isolado. Mitigacao SSRF (T5.5): nunca
// bate em IP privado/loopback/link-local/metadado de nuvem, mesmo que o
// hostname resolva la depois de passar por DNS (rebinding). So aceita
// http/https; timeout curto; nunca segue redirect pra fora do escopo
// permitido sem revalidar o destino final.

export class UnsafeLinkTargetError extends Error {}

// IP hardcoded intencional: e o endereco padrao de metadado de nuvem
// (AWS/GCP/Azure), nao credencial nem endpoint de infra propria.
const METADATA_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal']); // NOSONAR

function isPrivateOrReservedIpv4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 0) return true; // "this network"
  return false;
}

// Extrai o IPv4 embutido de um endereco IPv4-mapped (::ffff:a.b.c.d ou
// ::ffff:aabb:ccdd em hex) — sem isso, ::ffff:169.254.169.254 passava direto
// pelos checks de IPv6 puro, um bypass classico de SSRF via IPv6.
function extractIpv4MappedAddress(normalized: string): string | null {
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(normalized);
  if (dotted) return dotted[1];

  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    return [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff].join('.');
  }

  return null;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local

  const mappedIpv4 = extractIpv4MappedAddress(normalized);
  if (mappedIpv4 && isPrivateOrReservedIpv4(mappedIpv4)) return true;

  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateOrReservedIpv4(ip);
  if (net.isIPv6(ip)) return isPrivateOrReservedIpv6(ip);
  return false;
}

// Retorna o IP validado a ser fixado na conexao real (mitigacao TOCTOU/DNS
// rebinding, achado SonarCloud PR #151 2026-07-12): sem isso, o fetch faria
// sua propria resolucao DNS depois da validacao, permitindo que um hostname
// com TTL curto responda IP publico na checagem e IP privado na conexao.
async function assertSafeTarget(hostname: string): Promise<{ family: 4 | 6; address: string }> {
  if (METADATA_HOSTS.has(hostname.toLowerCase())) {
    throw new UnsafeLinkTargetError(`Host de metadado de nuvem bloqueado: ${hostname}`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeLinkTargetError(`IP privado/reservado bloqueado: ${hostname}`);
    }
    return { family: net.isIPv6(hostname) ? 6 : 4, address: hostname };
  }

  const resolved = await dns.lookup(hostname, { all: true });
  for (const { address } of resolved) {
    if (isPrivateOrReservedIp(address) || METADATA_HOSTS.has(address)) {
      throw new UnsafeLinkTargetError(`Hostname "${hostname}" resolve para IP privado/reservado/metadado bloqueado.`);
    }
  }

  const first = resolved[0];
  if (!first) {
    throw new UnsafeLinkTargetError(`Hostname "${hostname}" nao resolveu para nenhum IP.`);
  }
  return { family: first.family === 6 ? 6 : 4, address: first.address };
}

function pinnedDispatcher(pinnedAddress: string): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => {
        callback(null, [{ address: pinnedAddress, family: net.isIPv6(pinnedAddress) ? 6 : 4 }]);
      },
    },
  });
}

export interface LinkCheckResult {
  checkedUrl: string;
  httpStatus: number | null;
  isHealthy: boolean;
  errorDetail: string | null;
}

const CHECK_TIMEOUT_MS = 8000;

function parseAndValidateProtocol(currentUrl: string, originalUrl: string): { parsed: URL } | { result: LinkCheckResult } {
  let parsed: URL;
  try {
    parsed = new URL(currentUrl);
  } catch {
    return { result: { checkedUrl: originalUrl, httpStatus: null, isHealthy: false, errorDetail: 'URL inválida.' } };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      result: { checkedUrl: originalUrl, httpStatus: null, isHealthy: false, errorDetail: `Protocolo não permitido: ${parsed.protocol}` },
    };
  }

  return { parsed };
}

async function fetchHop(currentUrl: string, originalUrl: string, pinnedAddress: string): Promise<
  | { redirectTo: string }
  | { result: LinkCheckResult }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await undiciFetch(currentUrl, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      dispatcher: pinnedDispatcher(pinnedAddress),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { result: { checkedUrl: originalUrl, httpStatus: response.status, isHealthy: false, errorDetail: 'Redirect sem Location.' } };
      }
      return { redirectTo: new URL(location, currentUrl).toString() };
    }

    return {
      result: {
        checkedUrl: originalUrl,
        httpStatus: response.status,
        isHealthy: response.status >= 200 && response.status < 400,
        errorDetail: response.status >= 400 ? `HTTP ${response.status}` : null,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida ao checar link.';
    return { result: { checkedUrl: originalUrl, httpStatus: null, isHealthy: false, errorDetail: message } };
  } finally {
    clearTimeout(timeout);
  }
}

// Faz HEAD (fallback GET) contra a URL apos validar que o destino nao e
// privado/loopback/metadado. Nunca segue redirect automaticamente: cada hop
// e revalidado antes de seguir, pra nao virar tunel de SSRF via 3xx.
export async function checkLink(url: string, maxRedirects = 3): Promise<LinkCheckResult> {
  let currentUrl = url;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const protocolCheck = parseAndValidateProtocol(currentUrl, url);
    if ('result' in protocolCheck) return protocolCheck.result;

    let pinned: { family: 4 | 6; address: string };
    try {
      pinned = await assertSafeTarget(protocolCheck.parsed.hostname);
    } catch (error) {
      const detail = error instanceof UnsafeLinkTargetError ? error.message : 'Falha ao validar destino.';
      return { checkedUrl: url, httpStatus: null, isHealthy: false, errorDetail: detail };
    }

    const hopResult = await fetchHop(currentUrl, url, pinned.address);
    if ('result' in hopResult) return hopResult.result;
    currentUrl = hopResult.redirectTo;
  }

  return { checkedUrl: url, httpStatus: null, isHealthy: false, errorDetail: 'Excedeu limite de redirecionamentos.' };
}
