import { z } from 'zod';

export function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export const importTextSchema = z.object({
  text: z.string().min(10, 'Texto muito curto para segmentação (mínimo 10 caracteres).'),
  title_hint: z.string().optional(),
});

export const listDraftsSchema = z.object({
  status: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  origin: z.string().optional(),
});

export const patchDraftTableSchema = z.object({
  type: z.enum(['campanha', 'one-shot', 'oneshot-serie', 'aberta']).nullable().optional(),
  modality: z.enum(['online', 'presencial', 'hibrida']).nullable().optional(),
  price_type: z.enum(['gratuita', 'paga']).nullable().optional(),
  frequency: z.enum(['semanal', 'quinzenal', 'mensal', 'avulsa']).nullable().optional(),
  // 'to_define' espelha o sentinela do form manual (SessionRepeater.tsx) —
  // achado do mantenedor 2026-07-13, draft precisa aceitar dia "a definir".
  day_of_week: z.enum(['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo', 'to_define']).nullable().optional(),
}).passthrough();

export const patchNormalizedPayloadSchema = z.object({
  table: patchDraftTableSchema.optional(),
}).passthrough();

export const patchDraftSchema = z.object({
  normalized_payload: patchNormalizedPayloadSchema.optional(),
  status: z.enum(['draft', 'ready', 'needs_review', 'rejected']).optional(),
  review_notes: z.string().optional(),
});

export const correctionSchema = z.object({
  corrections: z.record(z.string(), z.unknown()),
  reason: z.string().optional(),
  before: z.record(z.string(), z.unknown()).optional(),
  confirmed_fields: z.array(z.string().min(1)).max(64).optional(),
});
