/**
 * Coletor de diagnostico para o widget de feedback de desenvolvimento (Spec 022).
 *
 * Mantem um ring buffer de erros de console/globais e de falhas de rede (HTTP >= 400).
 * Reusa a infra existente `ErrorTracker`/`setErrorTracker` (`services/logger.ts`):
 * `logger.error/.warn` ja existentes alimentam o buffer. Alem disso instala hooks
 * globais (`window.onerror`, `unhandledrejection`, wrap de `console.error/warn`, patch
 * de `window.fetch`) porque muitos pontos usam `console`/`fetch` cru.
 *
 * Privacidade: a captura de rede guarda apenas url/metodo/status. Sem corpo, headers
 * ou tokens.
 */
import { setErrorTracker, type ErrorTracker, type ErrorContext } from '../services/logger';

export interface ConsoleErrorEntry {
  level: string;
  message: string;
  ts: string;
}

export interface NetworkErrorEntry {
  url: string;
  method: string;
  status: number;
  ts: string;
}

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

const BUFFER_CAP = 30;
const MESSAGE_MAX = 500;

const consoleBuffer: ConsoleErrorEntry[] = [];
const networkBuffer: NetworkErrorEntry[] = [];

let installed = false;

function truncate(value: string): string {
  return value.length > MESSAGE_MAX ? value.slice(0, MESSAGE_MAX) : value;
}

function pushCapped<T>(buffer: T[], entry: T): void {
  buffer.push(entry);
  if (buffer.length > BUFFER_CAP) {
    buffer.splice(0, buffer.length - BUFFER_CAP);
  }
}

function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
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
  return {
    consoleErrors: consoleBuffer.slice(),
    networkErrors: networkBuffer.slice(),
  };
}

export function clearDiagnostics(): void {
  consoleBuffer.length = 0;
  networkBuffer.length = 0;
}

class DiagnosticsTracker implements ErrorTracker {
  captureException(error: Error, context?: ErrorContext): void {
    const where = context?.component ? ` [${context.component}]` : '';
    recordConsoleEntry('error', `${error.name}: ${error.message}${where}`);
  }
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (level === 'info') return;
    recordConsoleEntry(level === 'warning' ? 'warn' : 'error', message);
  }
  setUser(): void { /* no-op: nao coletamos PII no buffer */ }
  setTags(): void { /* no-op */ }
}

function deriveEnvironment(): string {
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host.startsWith('mesasbeta.')) return 'beta';
    if (host.startsWith('mesas.')) return 'production';
  }
  try {
    return import.meta.env.MODE || 'development';
  } catch {
    return 'development';
  }
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

  setErrorTracker(new DiagnosticsTracker());

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
      const method = (init?.method
        || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')
        || 'GET');
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
      try {
        const response = await originalFetch(input, init);
        if (response.status >= 400) {
          recordNetworkEntry(url, method, response.status);
        }
        return response;
      } catch (error) {
        recordNetworkEntry(url, method, 0);
        throw error;
      }
    };
  }
}
