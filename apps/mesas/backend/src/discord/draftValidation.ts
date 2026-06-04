// Validações de invariante para drafts do pipeline Discord Sync.
// Espelha em runtime o CHECK CONSTRAINT da migration 118
// (status='ready' => missing_fields=[]) para que a API responda 422 com
// mensagem clara em vez de propagar 23514 do Postgres como 500.

export interface DraftReadyTransitionInput {
  patchStatus: string | undefined;
  patchPayloadMissing: unknown;
  currentPayloadMissing: unknown;
}

export interface DraftReadyTransitionResult {
  allowed: boolean;
  reason?: string;
  missingFields?: string[];
}

function asMissingArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === 'string') result.push(item);
  }
  return result;
}

export function assertDraftReadyTransition(
  input: DraftReadyTransitionInput,
): DraftReadyTransitionResult {
  if (input.patchStatus !== 'ready') {
    return { allowed: true };
  }

  const fromPatch = asMissingArray(input.patchPayloadMissing);
  const fromCurrent = asMissingArray(input.currentPayloadMissing);
  const effective = fromPatch ?? fromCurrent ?? [];

  if (effective.length === 0) {
    return { allowed: true };
  }

  const preview = effective.slice(0, 5).join(', ');
  const suffix = effective.length > 5 ? '…' : '';
  return {
    allowed: false,
    missingFields: effective,
    reason: `Draft ainda tem ${effective.length} campo(s) faltando (${preview}${suffix}); não pode ser marcado como 'ready'.`,
  };
}
