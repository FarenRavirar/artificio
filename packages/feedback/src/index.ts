export type {
  FeedbackKind,
  ConsoleErrorEntry,
  NetworkErrorEntry,
  NormalizedFeedback,
  ParseResult,
} from './types.js';

export { FEEDBACK_LIMITS } from './types.js';

export {
  EMAIL_RE,
  SCREENSHOT_RE,
  LEVEL_MAX,
  asRecord,
  readString,
  trunc,
  readTruncatedOrNull,
} from './helpers.js';

export {
  normalizeConsoleErrors,
  normalizeNetworkErrors,
  normalizeScreenshot,
  DEFAULT_NORMALIZE_OPTIONS,
  type NormalizeOptions,
} from './normalize.js';

export {
  parseFeedbackInput,
  type ParseOptions,
} from './parse.js';
