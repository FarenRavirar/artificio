import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// T3.9 — Central canônica de notificações
//
// accounts.artificiorpg.com/conta/notificacoes
// Lista única, ordem cronológica, filtro por módulo.
// Abrir NÃO marca como lido. "Marcar todas" usa PATCH /read-all.
// Aviso de moderação: item mínimo, detalhe escondido até clique.
// ============================================================================

// ---- tipos ----

interface NotificationItem {
  id: string;
  event_id: string;
  event_type: string;
  subject_type: string;
  subject_id: string;
  source_app: string;
  source_label: string;
  canonical_path: string;
  /** Texto de apresentação montado pelo servidor (T3.3) */
  text: string;
  /** Link de volta ao conteúdo (T3.7) */
  link: string | null;
  occurred_at: string;
  read_at: string | null;
  created_at: string;
}

interface NotificationPage {
  items: NotificationItem[];
  cursor: string | null;
}

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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPage = useCallback(
    async (cursor: string | null, append: boolean) => {
      if (state.loading) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const params = new URLSearchParams();
        params.set("limit", "20");
        if (sourceApp) params.set("source_app", sourceApp);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(
          `/api/v1/notifications?${params.toString()}`,
          { credentials: "include" },
        );

        if (!res.ok) {
          if (res.status === 401) {
            // Não autenticado — redireciona para login
            window.location.href = "/login";
            return;
          }
          throw new Error(`Erro ${res.status}`);
        }

        const body = (await res.json()) as NotificationPage;

        if (!mountedRef.current) return;

        setState((prev) => ({
          items: append ? [...prev.items, ...body.items] : body.items,
          cursor: body.cursor,
          loading: false,
          error: null,
          hasMore: body.cursor !== null,
        }));
      } catch (err) {
        if (!mountedRef.current) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "Erro ao carregar",
        }));
      }
    },
    [sourceApp, state.loading],
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
    // Reset antes de carregar nova página
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        fetchPage(null, false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [sourceApp]);

  const loadMore = useCallback(() => {
    if (state.cursor && !state.loading) {
      fetchPage(state.cursor, true);
    }
  }, [state.cursor, state.loading, fetchPage]);

  const markRead = useCallback(async (receiptId: string) => {
    try {
      await fetch(`/api/v1/notifications/${encodeURIComponent(receiptId)}/read`, {
        method: "PUT",
        credentials: "include",
      });
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === receiptId ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      }));
    } catch {
      // Silencioso
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/v1/notifications/read-all", {
        method: "PATCH",
        credentials: "include",
      });
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => ({ ...item, read_at: new Date().toISOString() })),
      }));
    } catch {
      // Silencioso
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

  const {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
  } = useNotifications(sourceFilter || null);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setSourceOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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

          {/* Marcar todas como lidas */}
          {unreadCount > 0 && (
            <button
              className="notifications-mark-all"
              onClick={markAllRead}
            >
              Marcar todas como lidas ({unreadCount})
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
                <div
                  className="notification-item-header"
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
                </div>

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
