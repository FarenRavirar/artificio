import type { DevFeedbackKind } from '../db/types';

/**
 * Validador/normalizador puro do payload de feedback de desenvolvimento (Spec 022).
 *
 * Trata a entrada como `unknown` (NFR-004): sem `.map`/spread sobre payload externo
 * antes de validar formato. Campos de contexto sao truncados server-side. Itens de
 * console/rede invalidos sao descartados em vez de abortar. Screenshot invalido vira
 * `null` (FR-008: nao deve bloquear o registro do feedback).
 */

export const DEV_FEEDBACK_LIMITS = {
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
  // ~5MB de imagem em base64 (5 * 1024 * 1024 * 4/3 ~ 7M chars)
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

export interface NormalizedDevFeedback {
  kind: DevFeedbackKind;
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
  | { ok: true; value: NormalizedDevFeedback }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCREENSHOT_RE = /^data:image\/(png|jpe?g|webp);base64,/;
const SCREENSHOT_LEVEL_MAX = 24;

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
    if (out.length >= DEV_FEEDBACK_LIMITS.arrayCap) break;
    const row = asRecord(item);
    if (!row) continue;
    const message = readString(row.message).trim();
    if (message.length === 0) continue;
    const level = readString(row.level).trim() || 'error';
    const ts = readString(row.ts).trim();
    out.push({
      level: trunc(level, SCREENSHOT_LEVEL_MAX),
      message: trunc(message, DEV_FEEDBACK_LIMITS.message),
      ts: ts.length > 0 ? trunc(ts, 40) : null,
    });
  }
  return out;
}

function normalizeNetworkErrors(value: unknown): NetworkErrorEntry[] {
  if (!Array.isArray(value)) return [];
  const out: NetworkErrorEntry[] = [];
  for (const item of value) {
    if (out.length >= DEV_FEEDBACK_LIMITS.arrayCap) break;
    const row = asRecord(item);
    if (!row) continue;
    const url = readString(row.url).trim();
    if (url.length === 0) continue;
    if (typeof row.status !== 'number' || !Number.isFinite(row.status)) continue;
    const method = readString(row.method).trim().toUpperCase() || 'GET';
    const ts = readString(row.ts).trim();
    out.push({
      url: trunc(url, DEV_FEEDBACK_LIMITS.url),
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
  if (s.length > DEV_FEEDBACK_LIMITS.screenshotChars) return null;
  return s;
}

export function parseDevFeedbackInput(raw: unknown): ParseResult {
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
    if (emailRaw.length > DEV_FEEDBACK_LIMITS.email || !EMAIL_RE.test(emailRaw)) {
      return { ok: false, error: 'E-mail de contato invalido.' };
    }
    contactEmail = emailRaw;
  }

  return {
    ok: true,
    value: {
      kind: kindRaw as DevFeedbackKind,
      title: trunc(title, DEV_FEEDBACK_LIMITS.title),
      description: trunc(description, DEV_FEEDBACK_LIMITS.description),
      contact_email: contactEmail,
      page_url: readTruncatedOrNull(body.page_url, DEV_FEEDBACK_LIMITS.url),
      route_path: readTruncatedOrNull(body.route_path, DEV_FEEDBACK_LIMITS.routePath),
      page_title: readTruncatedOrNull(body.page_title, DEV_FEEDBACK_LIMITS.pageTitle),
      environment: readTruncatedOrNull(body.environment, DEV_FEEDBACK_LIMITS.environment),
      user_agent: readTruncatedOrNull(body.user_agent, DEV_FEEDBACK_LIMITS.userAgent),
      viewport: readTruncatedOrNull(body.viewport, DEV_FEEDBACK_LIMITS.viewport),
      console_errors: normalizeConsoleErrors(body.console_errors),
      network_errors: normalizeNetworkErrors(body.network_errors),
      screenshot: normalizeScreenshot(body.screenshot),
    },
  };
}
