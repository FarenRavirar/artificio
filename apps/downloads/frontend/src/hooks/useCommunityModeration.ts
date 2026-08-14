import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  moderationCaseSchema,
  commentVersionsSchema,
  moderationLogSchema,
  moderationQueueSchema,
  moderatorAppealSchema,
  ownReportsSchema,
  reportReasonsSchema,
  sanctionHistorySchema,
  type CommunityModerationAdapter,
} from '@artificio/comments/react';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';
const queueKey = ['downloads', 'community', 'moderation', 'queue'] as const;
const logKey = ['downloads', 'community', 'moderation', 'log'] as const;

export class CommunityApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(status === 409 ? 'Conflito: outro moderador alterou este item. Recarregue antes de tentar novamente.' : `Falha na moderação comunitária: HTTP ${status}`);
    this.name = 'CommunityApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function communityRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new CommunityApiError(response.status, payload);
  return payload;
}

function mutationInit(method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export function useCommunityModerationQueue() {
  return useQuery({
    queryKey: queueKey,
    queryFn: async () => moderationQueueSchema.parse(await communityRequest('/api/v1/community/moderation/queue?status=open&limit=100')),
  });
}

export function useCommunityModerationLog() {
  return useQuery({
    queryKey: logKey,
    queryFn: async () => moderationLogSchema.parse(await communityRequest('/api/v1/community/moderation/log?limit=100')),
  });
}

export function useCommunityCase(caseId: string | null) {
  return useQuery({
    queryKey: ['downloads', 'community', 'moderation', 'case', caseId],
    enabled: caseId !== null,
    queryFn: async () => moderationCaseSchema.parse(await communityRequest(`/api/v1/community/moderation/cases/${encodeURIComponent(caseId!)}`)),
  });
}

export function useCommentVersions(commentId: string | null | undefined) {
  return useQuery({
    queryKey: ['downloads', 'community', 'moderation', 'versions', commentId],
    enabled: Boolean(commentId),
    queryFn: async () => commentVersionsSchema.parse(await communityRequest(`/api/v1/community/moderation/comments/${encodeURIComponent(commentId!)}/versions`)),
  });
}

export function useModeratorAppeal(appealId: string | null) {
  return useQuery({
    queryKey: ['downloads', 'community', 'moderation', 'appeal', appealId],
    enabled: Boolean(appealId),
    queryFn: async () => moderatorAppealSchema.parse(await communityRequest(`/api/v1/community/moderation/appeals/${encodeURIComponent(appealId!)}`)),
  });
}

export function useCommunitySanctions(actorId: string | null | undefined) {
  return useQuery({
    queryKey: ['downloads', 'community', 'moderation', 'sanctions', actorId],
    enabled: Boolean(actorId),
    queryFn: async () => sanctionHistorySchema.parse(await communityRequest(`/api/v1/community/moderation/sanctions?actor_id=${encodeURIComponent(actorId!)}`)),
  });
}

export function useCommunityReportData() {
  const reasons = useQuery({ queryKey: ['downloads', 'community', 'report-reasons'], queryFn: async () => reportReasonsSchema.parse(await communityRequest('/api/v1/community/report-reasons')) });
  const reports = useQuery({ queryKey: ['downloads', 'community', 'reports'], queryFn: async () => ownReportsSchema.parse(await communityRequest('/api/v1/community/reports')) });
  return { reasons, reports };
}

export function useCommunityModerationActions(): CommunityModerationAdapter {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ path, method, body }: { path: string; method: 'POST' | 'PATCH' | 'DELETE'; body?: unknown }) => communityRequest(path, mutationInit(method, body)),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queueKey }),
        client.invalidateQueries({ queryKey: logKey }),
        client.invalidateQueries({ queryKey: ['downloads', 'community', 'moderation', 'case'] }),
        client.invalidateQueries({ queryKey: ['downloads', 'community', 'moderation', 'sanctions'] }),
        // O recurso aberto também precisa recarregar: sem isto, decidir um
        // recurso deixava a tela mostrando o status anterior até o moderador
        // sair e voltar — parece que a decisão não foi registrada, e o risco é
        // ele decidir de novo (achado de review, PR #262).
        client.invalidateQueries({ queryKey: ['downloads', 'community', 'moderation', 'appeal'] }),
      ]);
    },
  });
  return {
    remove: (id, reason) => mutation.mutateAsync({ path: `/api/v1/community/moderation/comments/${encodeURIComponent(id)}/removal`, method: 'POST', body: { reason } }),
    restore: (id, reason) => mutation.mutateAsync({ path: `/api/v1/community/moderation/comments/${encodeURIComponent(id)}/restore`, method: 'POST', body: { reason } }),
    resolveCase: (id, body) => mutation.mutateAsync({ path: `/api/v1/community/moderation/cases/${encodeURIComponent(id)}/resolution`, method: 'POST', body }),
    decideAppeal: (id, outcome, reason) => mutation.mutateAsync({ path: `/api/v1/community/moderation/appeals/${encodeURIComponent(id)}/resolution`, method: 'POST', body: { outcome, reason } }),
    applySanction: (body) => mutation.mutateAsync({ path: '/api/v1/community/moderation/sanctions', method: 'POST', body }),
  };
}

export function useCommunityReportActions() {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ path, method, body }: { path: string; method: 'POST' | 'DELETE'; body?: unknown }) => communityRequest(path, mutationInit(method, body)),
    onSuccess: () => client.invalidateQueries({ queryKey: ['downloads', 'community', 'reports'] }),
  });
  return {
    submit: (commentId: string, reasonCode: string, details: string | null) => mutation.mutateAsync({ path: `/api/v1/community/comments/${encodeURIComponent(commentId)}/reports`, method: 'POST', body: { reason_code: reasonCode, details } }),
    withdraw: (reportId: string) => mutation.mutateAsync({ path: `/api/v1/community/reports/${encodeURIComponent(reportId)}`, method: 'DELETE' }),
    appeal: (caseId: string, reason: string) => mutation.mutateAsync({ path: `/api/v1/community/decisions/${encodeURIComponent(caseId)}/appeals`, method: 'POST', body: { reason } }),
  };
}
