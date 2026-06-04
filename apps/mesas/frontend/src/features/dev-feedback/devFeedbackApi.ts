import { api } from '../../services/apiClient';
import type { DiagnosticsSnapshot } from '../../lib/diagnostics';

export type DevFeedbackKind = 'bug' | 'suggestion';
export type DevFeedbackStatus =
  | 'new' | 'triaged' | 'in_progress' | 'resolved' | 'wont_fix' | 'duplicate';

export interface SubmitDevFeedbackPayload {
  kind: DevFeedbackKind;
  title: string;
  description: string;
  contact_email?: string | null;
  page_url: string;
  route_path: string;
  page_title: string;
  environment: string;
  user_agent: string;
  viewport: string;
  console_errors: DiagnosticsSnapshot['consoleErrors'];
  network_errors: DiagnosticsSnapshot['networkErrors'];
  screenshot?: string | null;
}

export async function submitDevFeedback(payload: SubmitDevFeedbackPayload): Promise<{ id: string }> {
  const res = await api.post<{ data: { id: string } }>(
    '/api/v1/dev-feedback',
    payload,
    { skipErrorToast: true, skipRetry: true },
  );
  return res.data;
}

// ---- Admin (aba Desenvolvimento) ----

export interface DevFeedbackConsoleEntry {
  level: string;
  message: string;
  ts: string | null;
}

export interface DevFeedbackNetworkEntry {
  url: string;
  method: string;
  status: number;
  ts: string | null;
}

export interface DevFeedbackItem {
  id: string;
  kind: DevFeedbackKind;
  title: string;
  description: string;
  reporter_name: string;
  reporter_role: string | null;
  contact_email: string | null;
  page_url: string | null;
  route_path: string | null;
  page_title: string | null;
  environment: string | null;
  user_agent: string | null;
  viewport: string | null;
  console_errors: DevFeedbackConsoleEntry[];
  network_errors: DevFeedbackNetworkEntry[];
  screenshot_url: string | null;
  status: DevFeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  archived_at: string | null;
  merged_into: string | null;
  merged_sources: DevFeedbackMergedSource[];
}

export interface DevFeedbackMergedSource {
  id: string;
  kind: string;
  title: string;
  description: string;
  contact_email: string | null;
  screenshot_url: string | null;
  route_path: string | null;
  environment: string | null;
  created_at: string | null;
  merged_at: string | null;
}

const readString = (v: unknown): string => (typeof v === 'string' ? v : '');
const readNullableString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const isKind = (v: unknown): v is DevFeedbackKind => v === 'bug' || v === 'suggestion';
const isStatus = (v: unknown): v is DevFeedbackStatus =>
  v === 'new' || v === 'triaged' || v === 'in_progress'
  || v === 'resolved' || v === 'wont_fix' || v === 'duplicate';

function normalizeConsole(value: unknown): DevFeedbackConsoleEntry[] {
  if (!Array.isArray(value)) return [];
  const out: DevFeedbackConsoleEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const message = readString(row.message);
    if (message.length === 0) continue;
    out.push({ level: readString(row.level) || 'error', message, ts: readNullableString(row.ts) });
  }
  return out;
}

function normalizeNetwork(value: unknown): DevFeedbackNetworkEntry[] {
  if (!Array.isArray(value)) return [];
  const out: DevFeedbackNetworkEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const url = readString(row.url);
    if (url.length === 0) continue;
    out.push({
      url,
      method: readString(row.method) || 'GET',
      status: typeof row.status === 'number' ? row.status : 0,
      ts: readNullableString(row.ts),
    });
  }
  return out;
}

function normalizeMergedSources(value: unknown): DevFeedbackMergedSource[] {
  if (!Array.isArray(value)) return [];
  const out: DevFeedbackMergedSource[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = readString(row.id);
    if (id.length === 0) continue;
    out.push({
      id,
      kind: readString(row.kind) || 'bug',
      title: readString(row.title),
      description: readString(row.description),
      contact_email: readNullableString(row.contact_email),
      screenshot_url: readNullableString(row.screenshot_url),
      route_path: readNullableString(row.route_path),
      environment: readNullableString(row.environment),
      created_at: readNullableString(row.created_at),
      merged_at: readNullableString(row.merged_at),
    });
  }
  return out;
}

export function normalizeDevFeedbackList(value: unknown): DevFeedbackItem[] {
  if (!Array.isArray(value)) return [];
  const out: DevFeedbackItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (!isKind(row.kind) || !isStatus(row.status)) continue;
    const id = readString(row.id);
    if (id.length === 0) continue;
    out.push({
      id,
      kind: row.kind,
      title: readString(row.title),
      description: readString(row.description),
      reporter_name: readString(row.reporter_name) || 'Anonimo',
      reporter_role: readNullableString(row.reporter_role),
      contact_email: readNullableString(row.contact_email),
      page_url: readNullableString(row.page_url),
      route_path: readNullableString(row.route_path),
      page_title: readNullableString(row.page_title),
      environment: readNullableString(row.environment),
      user_agent: readNullableString(row.user_agent),
      viewport: readNullableString(row.viewport),
      console_errors: normalizeConsole(row.console_errors),
      network_errors: normalizeNetwork(row.network_errors),
      screenshot_url: readNullableString(row.screenshot_url),
      status: row.status,
      admin_notes: readNullableString(row.admin_notes),
      created_at: readString(row.created_at),
      archived_at: readNullableString(row.archived_at),
      merged_into: readNullableString(row.merged_into),
      merged_sources: normalizeMergedSources(row.merged_sources),
    });
  }
  return out;
}

export async function fetchDevFeedback(
  params: { status?: string; kind?: string; archived?: string },
): Promise<DevFeedbackItem[]> {
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.kind && params.kind !== 'all') qs.set('kind', params.kind);
  if (params.archived) qs.set('archived', params.archived);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await api.get<{ data: unknown }>(`/api/v1/admin/dev-feedback${suffix}`);
  return normalizeDevFeedbackList(res.data);
}

export async function updateDevFeedback(
  id: string,
  patch: { status?: DevFeedbackStatus; admin_notes?: string | null },
): Promise<void> {
  await api.patch(`/api/v1/admin/dev-feedback/${id}`, patch);
}

export async function archiveDevFeedback(id: string, archived: boolean): Promise<void> {
  await api.patch(`/api/v1/admin/dev-feedback/${id}`, { archived });
}

export async function deleteDevFeedback(id: string): Promise<void> {
  await api.delete(`/api/v1/admin/dev-feedback/${id}`);
}

export async function mergeDevFeedback(primaryId: string, sourceIds: string[]): Promise<void> {
  await api.post('/api/v1/admin/dev-feedback/merge', { primary_id: primaryId, source_ids: sourceIds });
}
