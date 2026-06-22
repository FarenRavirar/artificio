/**
 * Validador/normalizador de payload de feedback (Spec 021).
 *
 * Re-export de @artificio/feedback (fonte única — spec 042).
 * Mantido neste path para compatibilidade com imports existentes.
 */

export {
  FEEDBACK_LIMITS,
  parseFeedbackInput,
} from '@artificio/feedback';

export type {
  FeedbackKind,
  ConsoleErrorEntry,
  NetworkErrorEntry,
  NormalizedFeedback,
  ParseResult,
} from '@artificio/feedback';
