import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { getAccountsOrigin, useSession } from "@artificio/auth/client";
import {
  normalizeNotificationsPage,
  normalizeUnreadCount,
  type NormalizedNotificationItem,
} from "./notificationNormalize.js";

// ============================================================================
// T3.9b — Sino compartilhado de notificações (packages/ui)
//
// Componente agnóstico, sem React Query. Cada app monta com sourceApp.
// Escopo: só notificações do módulo onde está montado.
// Só renderiza com sessão autenticada.
//
// T3.10: atualização ao focar aba + após mutação, sem setInterval.
// Aba em segundo plano não dispara requisição.
// ============================================================================

// ---- tipos ----

type NotificationItem = NormalizedNotificationItem;

export interface NotificationBellProps {
  /** source_app do módulo onde o sino está montado (ex.: "mesas", "downloads", "site"). */
  sourceApp: string;
}

// ---- ícone SVG inline (sem dependência de lucide-react) ----

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// ---- helpers ----

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "agora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { credentials: "include", signal });
  if (!res.ok) return null;
  return await res.json();
}

// ---- hook de polling (T3.10) ----

/**
 * Polling ao focar + após mutação, sem intervalo recorrente.
 * `trigger` incrementado a cada mutação (marcar lida) força refresh.
 */
function useFocusPolling(onFocus: () => void) {
  const visibleRef = useRef(true);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !visibleRef.current) {
        visibleRef.current = true;
        onFocus();
      } else if (document.visibilityState === "hidden") {
        visibleRef.current = false;
      }
    };

    const handleWindowFocus = () => {
      if (!visibleRef.current) {
        visibleRef.current = true;
        onFocus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [onFocus]);
}

// ---- componente ----

const DROPDOWN_LIMIT = 5;

export function NotificationBell({ sourceApp }: NotificationBellProps) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [otherModulesUnread, setOtherModulesUnread] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [trigger, setTrigger] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const accountsOrigin = getAccountsOrigin();
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // Fetch count (do módulo atual) + total (para "outros módulos") + lista.
  // AbortController por chamada: foco/mutação podem sobrepor execuções, e
  // sem cancelar a anterior uma resposta antiga pode sobrescrever a mais
  // recente (achado CodeRabbit, PR #255).
  const fetchData = useCallback(async () => {
    if (!user) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const [localRaw, totalRaw, listRaw] = await Promise.all([
        fetchJson(
          `${accountsOrigin}/api/v1/notifications/unread-count?source_app=${encodeURIComponent(sourceApp)}`,
          controller.signal,
        ),
        fetchJson(
          `${accountsOrigin}/api/v1/notifications/unread-count`,
          controller.signal,
        ),
        fetchJson(
          `${accountsOrigin}/api/v1/notifications?limit=${DROPDOWN_LIMIT}&source_app=${encodeURIComponent(sourceApp)}`,
          controller.signal,
        ),
      ]);
      if (controller.signal.aborted || !mountedRef.current) return;

      const localCount = normalizeUnreadCount(localRaw);
      const totalCount = normalizeUnreadCount(totalRaw);
      if (localCount !== null) setUnreadCount(localCount);
      if (localCount !== null && totalCount !== null) {
        setOtherModulesUnread(totalCount > localCount);
      }

      const page = normalizeNotificationsPage(listRaw);
      if (page) setItems(page.items);
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") return;
    } finally {
      if (!controller.signal.aborted && mountedRef.current) setLoading(false);
    }
  }, [user, sourceApp, accountsOrigin]);

  // Polling T3.10: foco + visibilidade
  useFocusPolling(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  // Fetch inicial + após trigger (mutação)
  useEffect(() => {
    void fetchData();
  }, [fetchData, trigger]);

  // Fecha dropdown ao clicar fora ou Escape; devolve foco ao toggle.
  useEffect(() => {
    function handleClick(e: globalThis.MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Marca lida sem navegar. Só atualiza estado se o servidor confirmou —
  // `fetch` resolve em 401/404/500, então sem checar `res.ok` a UI mostrava
  // "lida" mesmo quando a escrita falhou no servidor (achado CodeRabbit).
  const markRead = useCallback(
    async (e: MouseEvent, receiptId: string) => {
      e.stopPropagation();
      try {
        const res = await fetch(
          `${accountsOrigin}/api/v1/notifications/${encodeURIComponent(receiptId)}/read`,
          { method: "PUT", credentials: "include" },
        );
        if (!res.ok) return;
        setItems((prev) =>
          prev.map((item) =>
            item.id === receiptId ? { ...item, read_at: new Date().toISOString() } : item,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setTrigger((prev) => prev + 1);
      } catch {
        // Rede falhou — estado local não muda, próximo refresh reflete o servidor.
      }
    },
    [accountsOrigin],
  );

  if (!user) return null;

  return (
    <div className="artificio-notification-bell" ref={containerRef}>
      <button
        ref={toggleRef}
        type="button"
        className="artificio-header-action"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ""}`}
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="artificio-notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="artificio-notification-dropdown">
          {loading && items.length === 0 && (
            <div className="artificio-notification-dropdown-loading">
              Carregando...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="artificio-notification-dropdown-empty">
              Nenhuma notificação no momento.
            </div>
          )}

          {items.length > 0 && (
            <ul className="artificio-notification-dropdown-list">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`artificio-notification-dropdown-item${!item.read_at ? " unread" : ""}`}
                >
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="artificio-notification-dropdown-link"
                    >
                      <span className="artificio-notification-dropdown-text">
                        {item.text}
                      </span>
                      <span className="artificio-notification-dropdown-time">
                        {timeAgo(item.occurred_at)}
                      </span>
                    </a>
                  ) : (
                    <span className="artificio-notification-dropdown-text">
                      {item.text}
                    </span>
                  )}
                  {!item.read_at && (
                    <button
                      type="button"
                      className="artificio-notification-dropdown-mark"
                      onClick={(e) => markRead(e, item.id)}
                      aria-label="Marcar como lida"
                      title="Marcar como lida"
                    >
                      ✓
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Rodapé: link "ver todas" + aviso de outros módulos */}
          <div className="artificio-notification-dropdown-footer">
            <a
              href={`${accountsOrigin}/conta/notificacoes`}
              className="artificio-notification-dropdown-all"
            >
              Ver todas as notificações ↗
            </a>
            {otherModulesUnread && (
              <p className="artificio-notification-dropdown-other">
                Você tem avisos em outros módulos.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
