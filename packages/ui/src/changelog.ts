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
    typeof rec.title === "string" &&
    typeof rec.body === "string" &&
    (rec.type === "app" || rec.type === "dados") &&
    rec.published === true &&
    typeof rec.created_at === "string"
  );
}

export function normalizeChangelogEntries(payload: unknown): ChangelogEntry[] {
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
  return normalized;
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
