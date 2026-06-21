export interface ChangelogEntry {
  id: string;
  title: string;
  body: string;
  type: "app" | "dados";
  published: boolean;
  created_at: string;
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
