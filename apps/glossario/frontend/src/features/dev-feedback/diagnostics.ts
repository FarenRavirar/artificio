/**
 * Coletor de diagnóstico do widget de feedback (Spec 021).
 *
 * Port adaptado de `apps/mesas/frontend/src/lib/diagnostics.ts`. Mantém ring buffer
 * de erros de console/globais e de falhas de rede (HTTP >= 400). O glossário usa
 * axios (XHR), então a captura de rede vem do interceptor do axios em
 * `services/api.ts` chamando `recordNetworkEntry`; o patch de `window.fetch` aqui
 * cobre chamadas `fetch` cruas (ex.: analytics).
 *
 * Privacidade: rede guarda apenas url/método/status. Sem corpo, headers ou tokens.
 */
import { FEEDBACK_LIMITS } from '@artificio/ui/feedback';

export interface ConsoleErrorEntry { level: string; message: string; ts: string; }
export interface NetworkErrorEntry { url: string; method: string; status: number; ts: string; }
export interface DiagnosticsSnapshot {
  consoleErrors: ConsoleErrorEntry[];
  networkErrors: NetworkErrorEntry[];
}
export interface PageContext {
  page_url: string;
  route_path: string;
  page_title: string;
  environment: string;
  user_agent: string;
  viewport: string;
}

const BUFFER_CAP = FEEDBACK_LIMITS.arrayCap;
const MESSAGE_MAX = FEEDBACK_LIMITS.message;

const consoleBuffer: ConsoleErrorEntry[] = [];
const networkBuffer: NetworkErrorEntry[] = [];
let installed = false;

function truncate(value: string): string {
  return value.length > MESSAGE_MAX ? value.slice(0, MESSAGE_MAX) : value;
}
function pushCapped<T>(buffer: T[], entry: T): void {
  buffer.push(entry);
  if (buffer.length > BUFFER_CAP) buffer.splice(0, buffer.length - BUFFER_CAP);
}
function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try { return JSON.stringify(arg); } catch { return String(arg); }
}

export function recordConsoleEntry(level: string, message: string): void {
  const trimmed = message.trim();
  if (trimmed.length === 0) return;
  pushCapped(consoleBuffer, {
    level: level.slice(0, 24) || 'error',
    message: truncate(trimmed),
    ts: new Date().toISOString(),
  });
}

export function recordNetworkEntry(url: string, method: string, status: number): void {
  if (!url || typeof status !== 'number') return;
  pushCapped(networkBuffer, {
    url: truncate(url),
    method: (method || 'GET').toUpperCase().slice(0, 10),
    status,
    ts: new Date().toISOString(),
  });
}

export function getDiagnosticsSnapshot(): DiagnosticsSnapshot {
  return { consoleErrors: consoleBuffer.slice(), networkErrors: networkBuffer.slice() };
}

function deriveEnvironment(): string {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host.startsWith('glossariobeta.')) return 'beta';
    if (host.startsWith('glossario.')) return 'production';
  }
  try { return import.meta.env.MODE || 'development'; } catch { return 'development'; }
}

export function collectPageContext(): PageContext {
  const w = typeof window !== 'undefined' ? window : undefined;
  return {
    page_url: w?.location?.href ?? '',
    route_path: w?.location?.pathname ?? '',
    page_title: typeof document !== 'undefined' ? document.title : '',
    environment: deriveEnvironment(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    viewport: w ? `${w.innerWidth}x${w.innerHeight}` : '',
  };
}

export function installDiagnostics(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    recordConsoleEntry('error', args.map(stringifyArg).join(' '));
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    recordConsoleEntry('warn', args.map(stringifyArg).join(' '));
    originalWarn(...args);
  };

  window.addEventListener('error', (event) => {
    const msg = event.message || (event.error instanceof Error ? event.error.message : 'Erro desconhecido');
    recordConsoleEntry('window.onerror', `${msg}${event.filename ? ` @ ${event.filename}:${event.lineno}` : ''}`);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? `${reason.name}: ${reason.message}` : stringifyArg(reason);
    recordConsoleEntry('unhandledrejection', msg);
  });

  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const method = init?.method
        || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')
        || 'GET';
      const url = typeof input === 'string'
        ? input
        : input instanceof URL ? input.toString() : (input as Request).url;
      try {
        const response = await originalFetch(input, init);
        if (response.status >= 400) recordNetworkEntry(url, method, response.status);
        return response;
      } catch (error) {
        recordNetworkEntry(url, method, 0);
        throw error;
      }
    };
  }
}
