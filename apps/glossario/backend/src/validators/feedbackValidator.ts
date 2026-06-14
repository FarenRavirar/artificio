/**
 * Validador/normalizador puro do payload de feedback (Spec 021).
 *
 * Port de `apps/mesas/backend/src/validators/devFeedbackValidator.ts`. Trata a
 * entrada como `unknown`: sem `.map`/spread sobre payload externo antes de validar.
 * Campos de contexto truncados server-side. Itens de console/rede invalidos sao
 * descartados em vez de abortar. Screenshot invalido vira `null` (nao bloqueia o
 * registro do feedback).
 *
 * Os limites espelham `FEEDBACK_LIMITS` de `@artificio/ui/feedback` (fonte da copy/
 * contrato). Mantidos locais aqui porque o backend e CommonJS e nao deve depender
 * em runtime do pacote ESM compartilhado — a validacao e fronteira de seguranca.
 */

export type FeedbackKind = 'bug' | 'suggestion';

export const FEEDBACK_LIMITS = {
  title: 160,
  description: 4000,
  url: 2000,
  routePath: 500,
  pageTitle: 300,
  environment: 40,
  userAgent: 500,
  viewport: 24,
  email: 254,
  message: 500,
  arrayCap: 30,
  screenshotChars: 7_000_000,
} as const;

export interface ConsoleErrorEntry {
  level: string;
  message: string;
  ts: string | null;
}

export interface NetworkErrorEntry {
  url: string;
  method: string;
  status: number;
  ts: string | null;
}

export interface NormalizedFeedback {
  kind: FeedbackKind;
  title: string;
  description: string;
  contact_email: string | null;
  page_url: string | null;
  route_path: string | null;
  page_title: string | null;
  environment: string | null;
  user_agent: string | null;
  viewport: string | null;
  console_errors: ConsoleErrorEntry[];
  network_errors: NetworkErrorEntry[];
  screenshot: string | null;
}

export type ParseResult =
  | { ok: true; value: NormalizedFeedback }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCREENSHOT_RE = /^data:image\/(png|jpe?g|webp);base64,/;
const LEVEL_MAX = 24;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function trunc(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function readTruncatedOrNull(value: unknown, max: number): string | null {
  const s = readString(value).trim();
  if (s.length === 0) return null;
  return trunc(s, max);
}

function normalizeConsoleErrors(value: unknown): ConsoleErrorEntry[] {
  if (!Array.isArray(value)) return [];
  const out: ConsoleErrorEntry[] = [];
  for (const item of value) {
    if (out.length >= FEEDBACK_LIMITS.arrayCap) break;
    const row = asRecord(item);
    if (!row) continue;
    const message = readString(row.message).trim();
    if (message.length === 0) continue;
    const level = readString(row.level).trim() || 'error';
    const ts = readString(row.ts).trim();
    out.push({
      level: trunc(level, LEVEL_MAX),
      message: trunc(message, FEEDBACK_LIMITS.message),
      ts: ts.length > 0 ? trunc(ts, 40) : null,
    });
  }
  return out;
}

function normalizeNetworkErrors(value: unknown): NetworkErrorEntry[] {
  if (!Array.isArray(value)) return [];
  const out: NetworkErrorEntry[] = [];
  for (const item of value) {
    if (out.length >= FEEDBACK_LIMITS.arrayCap) break;
    const row = asRecord(item);
    if (!row) continue;
    const url = readString(row.url).trim();
    if (url.length === 0) continue;
    if (typeof row.status !== 'number' || !Number.isFinite(row.status)) continue;
    const method = readString(row.method).trim().toUpperCase() || 'GET';
    const ts = readString(row.ts).trim();
    out.push({
      url: trunc(url, FEEDBACK_LIMITS.url),
      method: trunc(method, 10),
      status: Math.trunc(row.status),
      ts: ts.length > 0 ? trunc(ts, 40) : null,
    });
  }
  return out;
}

function normalizeScreenshot(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!SCREENSHOT_RE.test(s)) return null;
  if (s.length > FEEDBACK_LIMITS.screenshotChars) return null;
  return s;
}

export function parseFeedbackInput(raw: unknown): ParseResult {
  const body = asRecord(raw);
  if (!body) return { ok: false, error: 'Corpo da requisicao invalido.' };

  const kindRaw = readString(body.kind).trim();
  if (kindRaw !== 'bug' && kindRaw !== 'suggestion') {
    return { ok: false, error: 'Tipo de feedback invalido. Use "bug" ou "suggestion".' };
  }

  const title = readString(body.title).trim();
  if (title.length === 0) {
    return { ok: false, error: 'Titulo e obrigatorio.' };
  }

  const description = readString(body.description).trim();
  if (description.length === 0) {
    return { ok: false, error: 'Descricao e obrigatoria.' };
  }

  let contactEmail: string | null = null;
  const emailRaw = readString(body.contact_email).trim();
  if (emailRaw.length > 0) {
    if (emailRaw.length > FEEDBACK_LIMITS.email || !EMAIL_RE.test(emailRaw)) {
      return { ok: false, error: 'E-mail de contato invalido.' };
    }
    contactEmail = emailRaw;
  }

  return {
    ok: true,
    value: {
      kind: kindRaw as FeedbackKind,
      title: trunc(title, FEEDBACK_LIMITS.title),
      description: trunc(description, FEEDBACK_LIMITS.description),
      contact_email: contactEmail,
      page_url: readTruncatedOrNull(body.page_url, FEEDBACK_LIMITS.url),
      route_path: readTruncatedOrNull(body.route_path, FEEDBACK_LIMITS.routePath),
      page_title: readTruncatedOrNull(body.page_title, FEEDBACK_LIMITS.pageTitle),
      environment: readTruncatedOrNull(body.environment, FEEDBACK_LIMITS.environment),
      user_agent: readTruncatedOrNull(body.user_agent, FEEDBACK_LIMITS.userAgent),
      viewport: readTruncatedOrNull(body.viewport, FEEDBACK_LIMITS.viewport),
      console_errors: normalizeConsoleErrors(body.console_errors),
      network_errors: normalizeNetworkErrors(body.network_errors),
      screenshot: normalizeScreenshot(body.screenshot),
    },
  };
}
