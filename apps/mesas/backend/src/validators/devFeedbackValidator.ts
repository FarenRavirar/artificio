import type { DevFeedbackKind } from '../db/types';

/**
 * Validador/normalizador puro do payload de feedback de desenvolvimento (Spec 022).
 *
 * Re-export/wrapper de @artificio/feedback (fonte única — spec 042).
 * Mantido neste path para compatibilidade com imports existentes.
 */

import {
  FEEDBACK_LIMITS,
  parseFeedbackInput,
} from '@artificio/feedback';

import type {
  ConsoleErrorEntry,
  NetworkErrorEntry,
  NormalizedFeedback,
} from '@artificio/feedback';

// Re-export com nomes legados do mesas
export { FEEDBACK_LIMITS as DEV_FEEDBACK_LIMITS };

export type { ConsoleErrorEntry, NetworkErrorEntry };

export type NormalizedDevFeedback = NormalizedFeedback<DevFeedbackKind>;

export type ParseResult =
  | { ok: true; value: NormalizedDevFeedback }
  | { ok: false; error: string };

export function parseDevFeedbackInput(raw: unknown): ParseResult {
  return parseFeedbackInput<DevFeedbackKind>(raw, {
    limits: { ...FEEDBACK_LIMITS },
  });
}
