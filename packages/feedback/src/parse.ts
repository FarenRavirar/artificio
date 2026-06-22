import {
  FEEDBACK_LIMITS,
  type FeedbackKind,
  type NormalizedFeedback,
  type ParseResult,
} from './types.js';
import {
  asRecord,
  readString,
  trunc,
  readTruncatedOrNull,
  EMAIL_RE,
  SCREENSHOT_RE,
} from './helpers.js';
import {
  normalizeConsoleErrors,
  normalizeNetworkErrors,
  normalizeScreenshot,
  type NormalizeOptions,
} from './normalize.js';

export interface ParseOptions<TKind extends string = FeedbackKind> {
  kindGuard?: (value: string) => value is TKind;
  limits?: Partial<{
    title: number;
    description: number;
    url: number;
    routePath: number;
    pageTitle: number;
    environment: number;
    userAgent: number;
    viewport: number;
    email: number;
    message: number;
    arrayCap: number;
    screenshotChars: number;
    levelMax: number;
  }>;
}

const DEFAULT_LIMITS = {
  ...FEEDBACK_LIMITS,
  levelMax: 24,
} as const;

export function parseFeedbackInput<TKind extends string = FeedbackKind>(
  raw: unknown,
  opts: ParseOptions<TKind> = {},
): ParseResult<TKind> {
  const body = asRecord(raw);
  if (!body) return { ok: false, error: 'Corpo da requisicao invalido.' };

  const kindRaw = readString(body.kind).trim();
  const guard = opts.kindGuard as ((v: string) => v is TKind) | undefined;
  if (guard) {
    if (!guard(kindRaw)) {
      return { ok: false, error: 'Tipo de feedback invalido.' };
    }
  } else if (kindRaw !== 'bug' && kindRaw !== 'suggestion') {
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

  const L = { ...DEFAULT_LIMITS, ...opts.limits };

  let contactEmail: string | null = null;
  const emailRaw = readString(body.contact_email).trim();
  if (emailRaw.length > 0) {
    if (emailRaw.length > L.email || !EMAIL_RE.test(emailRaw)) {
      return { ok: false, error: 'E-mail de contato invalido.' };
    }
    contactEmail = emailRaw;
  }

  const normOpts: NormalizeOptions = {
    arrayCap: L.arrayCap,
    messageMax: L.message,
    urlMax: L.url,
    levelMax: L.levelMax,
  };

  return {
    ok: true,
    value: {
      kind: kindRaw as TKind,
      title: trunc(title, L.title),
      description: trunc(description, L.description),
      contact_email: contactEmail,
      page_url: readTruncatedOrNull(body.page_url, L.url),
      route_path: readTruncatedOrNull(body.route_path, L.routePath),
      page_title: readTruncatedOrNull(body.page_title, L.pageTitle),
      environment: readTruncatedOrNull(body.environment, L.environment),
      user_agent: readTruncatedOrNull(body.user_agent, L.userAgent),
      viewport: readTruncatedOrNull(body.viewport, L.viewport),
      console_errors: normalizeConsoleErrors(body.console_errors, normOpts),
      network_errors: normalizeNetworkErrors(body.network_errors, normOpts),
      screenshot: normalizeScreenshot(body.screenshot, SCREENSHOT_RE, L.screenshotChars),
    } as NormalizedFeedback<TKind>,
  };
}
