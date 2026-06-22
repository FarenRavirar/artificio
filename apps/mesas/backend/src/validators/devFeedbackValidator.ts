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
  NormalizedFeedback,
  ParseResult as SharedParseResult,
} from '@artificio/feedback';

// Re-export com nomes legados do mesas
export { FEEDBACK_LIMITS as DEV_FEEDBACK_LIMITS };
export type { ConsoleErrorEntry, NetworkErrorEntry } from '@artificio/feedback';

export type NormalizedDevFeedback = NormalizedFeedback<DevFeedbackKind>;

export type ParseResult = SharedParseResult<DevFeedbackKind>;

export function parseDevFeedbackInput(raw: unknown): ParseResult {
  const kindGuard = (value: string): value is DevFeedbackKind =>
    value === 'bug' || value === 'suggestion';

  return parseFeedbackInput<DevFeedbackKind>(raw, {
    kindGuard,
    limits: { ...FEEDBACK_LIMITS },
  });
}
