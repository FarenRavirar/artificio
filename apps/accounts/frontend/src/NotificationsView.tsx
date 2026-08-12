import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeNotificationsPage,
  type NormalizedNotificationItem,
} from "@artificio/ui";

// ============================================================================
// T3.9 — Central canônica de notificações
//
// accounts.artificiorpg.com/conta/notificacoes
// Lista única, ordem cronológica, filtro por módulo.
// Abrir NÃO marca como lido. "Marcar todas" usa PATCH /read-all.
// Aviso de moderação: item mínimo, detalhe escondido até clique.
// ============================================================================

// ---- tipos ----

type NotificationItem = NormalizedNotificationItem;

// ---- helpers ----

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const seconds = Math.floor((now - date.getTime()) / 1000);

  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return date.toLocaleDateString("pt-BR");
}

function isModeration(eventType: string): boolean {
  return eventType.startsWith("moderation.");
}

// ---- estado de paginação ----

interface PageState {
  items: NotificationItem[];
  cursor: string | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
}

function useNotifications(sourceApp: string | null) {
  const [state, setState] = useState<PageState>({
    items: [],
    cursor: null,
    loading: false,
    error: null,
    hasMore: true,
  });
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // `inFlightRef` em vez de `state.loading`: closure de `state.loading`
  // fica obsoleta assim que a função é criada, então duas chamadas
  // concorrentes passavam o guard antigo (achado CodeRabbit, PR #255).
  // AbortController cancela a chamada anterior quando o filtro muda —
  // sem isso, resposta antiga podia sobrescrever a mais recente.
  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        if (sourceApp) params.set("source_app", sourceApp);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(
          `/api/v1/notifications?${params.toString()}`,
          { credentials: "include", signal: controller.signal },
        );

        if (!res.ok) {
          if (res.status === 401) {
            // Não autenticado — redireciona para login
            window.location.href = "/login";
            return;
          }
          throw new Error(`Erro ${res.status}`);
        }

        const page = normalizeNotificationsPage(await res.json());
        if (!page) throw new Error("Resposta em formato inesperado");

        if (controller.signal.aborted || !mountedRef.current) return;

        setState((prev) => ({
          items: append ? [...prev.items, ...page.items] : page.items,
          cursor: page.cursor,
          loading: false,
          error: null,
          hasMore: page.cursor !== null,
        }));
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        if (!mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Erro ao carregar",
        }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [sourceApp],
  );

  // Carrega primeira página ao montar ou mudar filtro
  useEffect(() => {
    setState({
      items: [],
      cursor: null,
      loading: true,
      error: null,
      hasMore: true,
    });
    void fetchPage(null, false);
  }, [sourceApp, fetchPage]);

  const loadMore = useCallback(() => {
    if (state.cursor && !state.loading) {
      fetchPage(state.cursor, true);
    }
  }, [state.cursor, state.loading, fetchPage]);

  // Só atualiza estado local se o servidor confirmou (res.ok) — fetch
  // resolve normalmente em 401/404/500, então sem essa checagem a UI
  // marcava como lida mesmo com a escrita rejeitada (achado CodeRabbit).
  const markRead = useCallback(async (receiptId: string) => {
    try {
      const res = await fetch(`/api/v1/notifications/${encodeURIComponent(receiptId)}/read`, {
        method: "PUT",
        credentials: "include",
      });
      if (!res.ok) return;
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === receiptId ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      }));
    } catch {
      // Rede falhou — estado local não muda, próximo refresh reflete o servidor.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/notifications/read-all", {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) return;
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({ ...item, read_at: new Date().toISOString() })),
      }));
    } catch {
      // Rede falhou — estado local não muda, próximo refresh reflete o servidor.
    }
  }, []);

  return { ...state, loadMore, markRead, markAllRead };
}

// ---- fonte do módulo (label) ----

function allSourceApps(): { value: string; label: string }[] {
  return [
    { value: "", label: "Todos os módulos" },
    { value: "downloads", label: "Downloads" },
    { value: "mesas", label: "Mesas" },
    { value: "site", label: "Artifício RPG" },
    { value: "glossario", label: "Glossário" },
    { value: "links", label: "Links" },
  ];
}

// ---- componente ----

export function NotificationsView() {
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);

  const {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
  } = useNotifications(sourceFilter || null);

  // Fecha dropdown ao clicar fora ou Escape; devolve foco ao toggle.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setSourceOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSourceOpen(false);
        filterToggleRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const unreadCount = items.filter((i) => !i.read_at).length;

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <h2>Notificações</h2>
        <div className="notifications-actions">
          {/* Filtro por módulo (17c) */}
          <div className="notifications-filter" ref={filterRef}>
            <button
              ref={filterToggleRef}
              type="button"
              className="notifications-filter-toggle"
              onClick={() => setSourceOpen((prev) => !prev)}
              aria-expanded={sourceOpen}
            >
              {sourceFilter
                ? allSourceApps().find((a) => a.value === sourceFilter)?.label
                : "Todos os módulos"}
              {" ▾"}
            </button>
            {sourceOpen && (
              <div className="notifications-filter-dropdown">
                {allSourceApps().map((app) => (
                  <button
                    key={app.value}
                    type="button"
                    className={sourceFilter === app.value ? "active" : ""}
                    onClick={() => {
                      setSourceFilter(app.value);
                      setSourceOpen(false);
                    }}
                  >
                    {app.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Marcar todas como lidas. Sem contagem no rótulo: PATCH /read-all
              marca todo recibo não lido do usuário, em todos os módulos —
              ignora paginação e o filtro de source_app ativo. Mostrar o
              unreadCount local (só a página carregada) subestimaria o
              efeito real da ação (achado CodeRabbit, PR #255). */}
          {unreadCount > 0 && (
            <button
              type="button"
              className="notifications-mark-all"
              onClick={markAllRead}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
      </header>

      {/* Loading */}
      {loading && items.length === 0 && (
        <div className="notifications-loading">Carregando...</div>
      )}

      {/* Erro */}
      {error && (
        <div className="notifications-error">{error}</div>
      )}

      {/* Vazio */}
      {!loading && items.length === 0 && (
        <div className="notifications-empty">
          Nenhuma notificação
          {sourceFilter ? " neste módulo" : ""}.
        </div>
      )}

      {/* Lista */}
      {items.length > 0 && (
        <ul className="notifications-list">
          {items.map((item) => {
            const isMod = isModeration(item.event_type);
            const isUnread = !item.read_at;
            const isDetail = detailId === item.id;

            return (
              <li
                key={item.id}
                className={`notification-item${isUnread ? " unread" : ""}${isMod ? " moderation" : ""}`}
              >
                <button
                  type="button"
                  className="notification-item-header"
                  aria-expanded={isDetail}
                  onClick={() => {
                    if (isUnread) markRead(item.id);
                    setDetailId(isDetail ? null : item.id);
                  }}
                >
                  <span className="notification-source">
                    {item.source_label}
                  </span>
                  <span className="notification-text">{item.text}</span>
                  <time className="notification-time" dateTime={item.occurred_at}>
                    {timeAgo(item.occurred_at)}
                  </time>
                  {isUnread && <span className="notification-dot" />}
                </button>

                {/* Detalhe expandido */}
                {isDetail && (
                  <div className="notification-detail">
                    {item.link && (
                      <a
                        href={item.link}
                        className="notification-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver no {item.source_label} ↗
                      </a>
                    )}

                    {/* Moderação: item mínimo na lista, detalhe no expand (13e, 17f) */}
                    {isMod && (
                      <div className="notification-moderation-info">
                        <p>
                          A moderação analisou este caso. O motivo e o prazo
                          para recurso estão disponíveis apenas para você.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Carregar mais */}
      {hasMore && items.length > 0 && (
        <div className="notifications-load-more">
          <button
            onClick={loadMore}
            disabled={loading}
            className="notifications-load-more-btn"
          >
            {loading ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}
