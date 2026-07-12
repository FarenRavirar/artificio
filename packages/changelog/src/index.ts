// Contrato puro de changelog — compartilhado por frontend (ESM) e backends (CJS).
// Zero react/dom: por isso vive num pacote leaf com build dual ESM+CJS, consumível
// tanto por @artificio/ui (ESM) quanto pelos backends glossario/mesas (CommonJS).

export const CHANGELOG_CACHE_TTL = 60_000;
export const CHANGELOG_UPDATE_MARKERS = {
  site: "2026-06-21-shell-unificado",
  links: "2026-06-21-shell-unificado",
  mesas: "2026-06-21-shell-unificado",
  glossario: "2026-06-21-shell-unificado",
  downloads: "2026-07-12-gestao-admin-e-notificacoes",
} as const;

export interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  type: "app" | "dados";
  published: boolean;
  created_at: string;
}

export function isChangelogEntry(value: unknown): value is ChangelogEntry {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    rec.id.trim() !== "" &&
    typeof rec.title === "string" &&
    rec.title.trim() !== "" &&
    typeof rec.body === "string" &&
    rec.body.trim() !== "" &&
    (rec.type === "app" || rec.type === "dados") &&
    rec.published === true &&
    typeof rec.created_at === "string" &&
    !Number.isNaN(new Date(rec.created_at).getTime())
  );
}

export function normalizeChangelogEntries(payload: unknown, limit?: number): ChangelogEntry[] {
  if (!Array.isArray(payload)) {
    if (payload != null) {
      console.warn("[normalizeChangelogEntries] Expected array, got:", typeof payload);
    }
    return [];
  }
  const normalized: ChangelogEntry[] = [];
  for (const item of payload) {
    if (isChangelogEntry(item)) normalized.push(item);
  }
  normalized.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (typeof limit !== "number" || !Number.isFinite(limit)) return normalized;
  const safeLimit = Math.trunc(limit);
  if (safeLimit <= 0) return [];
  return normalized.slice(0, safeLimit);
}

export interface ChangelogModalLabels {
  typeApp: string;
  typeDados: string;
  title: string;
  subtitle?: string;
  close: string;
  loading: string;
  empty: string;
  errorTitle: string;
  retry: string;
  expandMore: string;
  expandLess: string;
}

export const DEFAULT_CHANGELOG_LABELS: ChangelogModalLabels = {
  typeApp: "SISTEMA",
  typeDados: "CONTEÚDO",
  title: "Novidades",
  close: "Fechar",
  loading: "Carregando...",
  empty: "Nenhuma atualização disponível no momento.",
  errorTitle: "Erro ao carregar atualizações",
  retry: "Tentar novamente",
  expandMore: "Ver mais",
  expandLess: "Ver menos",
};
