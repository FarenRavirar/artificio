import { Request, Response } from 'express';
import { z } from 'zod';

export function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isAdmin(req: Request, res: Response): boolean {
  if ((req as any).user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores.' });
    return false;
  }
  return true;
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
});
