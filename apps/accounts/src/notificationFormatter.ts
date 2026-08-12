// ============================================================================
// T3.3 — Formatador de notificação
//
// Converte snapshot estruturado em texto de apresentação e link de volta
// para a API e central. O snapshot congela o estado no momento do evento;
// o texto é montado na leitura (spec.md 13b).
// ============================================================================

/**
 * Mapa de origins por source_app. Usado para construir links de volta (T3.7).
 */
const APP_ORIGINS: Record<string, string> = {
  downloads: "https://downloads.artificiorpg.com",
  site: "https://artificiorpg.com",
  mesas: "https://mesas.artificiorpg.com",
  glossario: "https://glossario.artificiorpg.com",
  links: "https://links.artificiorpg.com",
};

/** Nome de exibição por módulo. */
const APP_LABELS: Record<string, string> = {
  downloads: "Downloads",
  site: "Artifício RPG",
  mesas: "Mesas",
  glossario: "Glossário",
  links: "Links",
  accounts: "Artifício RPG",
};

/**
 * Constrói URL de volta ao conteúdo de origem (T3.7).
 * A partir de canonical_path + source_app, NUNCA de URL vinda do cliente.
 */
export function buildBackLink(
  sourceApp: string,
  canonicalPath: string,
): string | null {
  const origin = APP_ORIGINS[sourceApp];
  if (!origin) return null;

  // canonical_path já começa com '/' (CHECK migration_006:480-486). Guarda
  // local: se uma linha bypassar essa constraint, concatenar sem checar
  // gera host errado (ex.: "https://downloads.artificiorpg.commateriais/1").
  if (!canonicalPath.startsWith("/") || canonicalPath.startsWith("//")) {
    return null;
  }
  return `${origin}${canonicalPath}`;
}

/** Nome de exibição do módulo de origem. */
export function sourceAppLabel(sourceApp: string): string {
  return APP_LABELS[sourceApp] ?? sourceApp;
}

// ---- formatação de evento ----

/**
 * Corpo legado gravado pelo produtor externo (T3.13).
 *
 * Os cinco `kind` do `downloads` têm o texto **congelado no banco** por decisão
 * de 24e (`spec.md:320`): "o corpo já vem pronto e entra como snapshot de
 * versão própria, sem tentar reconstruir estrutura que nunca existiu". Então,
 * diferente dos eventos nativos, aqui o texto se lê do snapshot em vez de sair
 * de um `case` — reescrevê-lo no formatador inventaria uma redação que o
 * usuário nunca viu no aviso original.
 *
 * Payload de banco é `unknown` até passar por checagem tipada (AGENTS.md
 * §Regras Gerais de Código): JSONB malformado degrada para o fallback em vez de
 * quebrar a listagem inteira.
 */
function readLegacyBody(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const body = (snapshot as Record<string, unknown>).legacy_body;
  return typeof body === "string" && body.trim().length > 0 ? body : null;
}

/**
 * Formata um evento de notificação em texto de apresentação.
 * O snapshot é imutável (gravado no momento do evento); a autorização
 * de acesso é verificada separadamente (T3.8).
 *
 * @param eventType tipo do evento (comment.created, comment.replied, etc.)
 * @param _eventVersion reservado para versionamento futuro do snapshot
 * @param snapshot dados estruturados do evento; carrega `legacy_body` nos
 *        eventos vindos de produtor externo (T3.13)
 */
export function formatNotificationText(
  eventType: string,
  _eventVersion: number,
  snapshot: unknown,
): string {
  // Evento de produtor externo: o texto já está pronto no snapshot. Precede o
  // switch porque nenhum `case` nativo cobre `downloads.*`, e cair no default
  // mostraria "Notificação: downloads.material_approved" no lugar do aviso real.
  if (eventType.includes(".") && !eventType.startsWith("comment.") && !eventType.startsWith("moderation.")) {
    const legacyBody = readLegacyBody(snapshot);
    if (legacyBody) return legacyBody;
  }

  switch (eventType) {
    case "comment.created":
      return "Alguém comentou no seu conteúdo";
    case "comment.replied":
      return "Alguém respondeu seu comentário";

    // Moderação (T3.11b — futuros, mas o formatador já cobre)
    case "moderation.comment_removed":
      return "Seu comentário foi removido pela moderação";
    case "moderation.comment_restored":
      return "Seu comentário foi restaurado";
    case "moderation.report_resolved":
      return "Uma denúncia que você fez foi analisada";
    case "moderation.appeal_resolved":
      return "Seu recurso foi analisado";
    case "moderation.sanction_applied":
      return "Uma sanção foi aplicada à sua conta";
    case "moderation.sanction_lifted":
      return "Uma sanção foi removida da sua conta";

    default:
      // Tipo desconhecido: mostra o event_type como fallback mínimo
      return `Notificação: ${eventType}`;
  }
}

/**
 * Adiciona link e origem ao item da notificação para resposta da API.
 */
export function enrichNotificationItem(
  item: {
    event_type: string;
    source_app: string;
    canonical_path: string;
    // T3.13 — sem estes dois, o corpo legado dos eventos de produtor externo
    // nunca chegava ao formatador: `snapshot: null` fixo fazia todo aviso do
    // `downloads` virar "Notificação: downloads.material_approved".
    // Opcionais para não quebrar chamador que só monta link/rótulo.
    event_version?: number;
    snapshot?: unknown;
  },
): { text: string; link: string | null; source_label: string } {
  return {
    text: formatNotificationText(item.event_type, item.event_version ?? 1, item.snapshot ?? null),
    link: buildBackLink(item.source_app, item.canonical_path),
    source_label: sourceAppLabel(item.source_app),
  };
}
