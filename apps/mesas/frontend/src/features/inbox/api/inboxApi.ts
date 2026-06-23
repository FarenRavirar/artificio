import type {
  InboxDraft,
  InboxDraftSummary,
  InboxDraftStatus,
  InboxImportResult,
  InboxCorrectionResult,
  InboxSyncResult,
  InboxMetrics,
} from '../types';
import { z } from 'zod';

const API_BASE = import.meta.env.VITE_API_URL || '';
const BASE = `${API_BASE}/api/v1/admin/inbox`;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data as T;
}

const inboxImportDraftSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  status: z.string(),
  confidence: z.number().nullable(),
  missing_fields: z.array(z.string()),
});

const inboxImportResultSchema = z.object({
  segments_found: z.number(),
  drafts_created: z.number(),
  drafts: z.array(inboxImportDraftSchema),
});

const inboxDraftSummarySchema = z.object({
  id: z.string(),
  source_type: z.string(),
  raw_text: z.string(),
  status: z.enum(['draft', 'ready', 'needs_review', 'synced', 'rejected']),
  confidence: z.number().nullable(),
  title: z.string().nullable(),
  created_at: z.string(),
});

const inboxDraftSchema = z.object({
  id: z.string(),
  discord_message_id: z.string().nullable(),
  import_message_id: z.string().nullable(),
  table_id: z.string().nullable(),
  parsed_payload: z.unknown(),
  normalized_payload: z.unknown(),
  confidence: z.number().nullable(),
  status: z.enum(['draft', 'ready', 'needs_review', 'synced', 'rejected']),
  review_notes: z.string().nullable(),
  image_upload_status: z.string().nullable(),
  image_upload_attempts: z.number(),
  image_upload_last_error: z.string().nullable(),
  image_upload_last_at: z.string().nullable(),
  raw_text: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

const inboxCorrectionResultSchema = z.object({
  draft_id: z.string(),
  fields_corrected: z.number(),
  diff: z.record(z.string(), z.object({
    before: z.unknown(),
    after: z.unknown(),
  })),
});

const inboxSyncResultSchema = z.object({
  tableId: z.string(),
  created: z.boolean(),
});

const inboxMetricsSchema = z.object({
  total_corrections: z.number(),
  most_corrected_fields: z.array(z.object({
    field: z.string(),
    count: z.number(),
  })),
});

function parseInboxImportResult(value: unknown): InboxImportResult {
  const parsed = inboxImportResultSchema.safeParse(value);
  if (!parsed.success) throw new Error('Resposta de importação em formato inesperado.');
  return parsed.data;
}

function parseInboxDraftSummaries(value: unknown): InboxDraftSummary[] {
  const parsed = z.array(inboxDraftSummarySchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseInboxDraft(value: unknown): InboxDraft {
  const parsed = inboxDraftSchema.safeParse(value);
  if (!parsed.success) throw new Error('Draft em formato inesperado.');
  return parsed.data;
}

function parseInboxCorrectionResult(value: unknown): InboxCorrectionResult {
  const parsed = inboxCorrectionResultSchema.safeParse(value);
  if (!parsed.success) throw new Error('Resultado de correção em formato inesperado.');
  return parsed.data;
}

function parseInboxSyncResult(value: unknown): InboxSyncResult {
  const parsed = inboxSyncResultSchema.safeParse(value);
  if (!parsed.success) throw new Error('Resultado de sincronização em formato inesperado.');
  return parsed.data;
}

function parseInboxMetrics(value: unknown): InboxMetrics {
  const parsed = inboxMetricsSchema.safeParse(value);
  if (!parsed.success) return { total_corrections: 0, most_corrected_fields: [] };
  return parsed.data;
}

export const inboxApi = {
  importText: async (text: string, titleHint?: string): Promise<InboxImportResult> =>
    parseInboxImportResult(await apiFetch<unknown>('/import-text', {
      method: 'POST',
      body: JSON.stringify({ text, title_hint: titleHint }),
    })),

  listDrafts: async (params?: { status?: InboxDraftStatus; limit?: number; offset?: number; origin?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    if (params?.origin) qs.set('origin', params.origin);
    const qsStr = qs.toString();
    return parseInboxDraftSummaries(await apiFetch<unknown>(`/drafts${qsStr ? `?${qsStr}` : ''}`));
  },

  getDraft: async (id: string): Promise<InboxDraft> =>
    parseInboxDraft(await apiFetch<unknown>(`/drafts/${id}`)),

  updateDraft: async (id: string, body: { normalized_payload?: Record<string, unknown>; status?: InboxDraftStatus; review_notes?: string }): Promise<InboxDraft> =>
    parseInboxDraft(await apiFetch<unknown>(`/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  reparseDraft: async (id: string): Promise<InboxDraft> =>
    parseInboxDraft(await apiFetch<unknown>(`/drafts/${id}/reparse`, { method: 'POST' })),

  registerCorrection: async (id: string, corrections: Record<string, unknown>, reason?: string): Promise<InboxCorrectionResult> =>
    parseInboxCorrectionResult(await apiFetch<unknown>(`/drafts/${id}/correction`, {
      method: 'POST',
      body: JSON.stringify({ corrections, reason }),
    })),

  syncDraft: async (id: string): Promise<InboxSyncResult> =>
    parseInboxSyncResult(await apiFetch<unknown>(`/drafts/${id}/sync`, { method: 'POST' })),

  getMetrics: async (): Promise<InboxMetrics> =>
    parseInboxMetrics(await apiFetch<unknown>('/metrics')),
};
