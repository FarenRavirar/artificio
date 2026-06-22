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

export interface NormalizedFeedback<TKind extends string = FeedbackKind> {
  kind: TKind;
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

export type ParseResult<TKind extends string = FeedbackKind> =
  | { ok: true; value: NormalizedFeedback<TKind> }
  | { ok: false; error: string };
