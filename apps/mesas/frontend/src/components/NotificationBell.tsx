import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { authGet, authPatch } from '../utils/authenticatedFetch';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
}

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const readNullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const normalizeNotifications = (value: unknown): Notification[] => {
  if (!Array.isArray(value)) return [];
  const out: Notification[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = readString(row.id);
    if (!id) continue;
    out.push({
      id,
      type: readString(row.type),
      title: readString(row.title),
      message: readString(row.message),
      read: row.read === true,
      action_url: readNullableString(row.action_url),
      created_at: readString(row.created_at),
    });
  }
  return out;
};

// Grupos do feed do admin (057/R14): o sino do admin mostra eventos de outros
// usuarios que exigem atencao operacional. Sugestoes continuam existindo em suas
// telas proprias, mas nao entram neste feed.
const ADMIN_GROUPS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'table', label: 'Mesas publicadas', types: ['table_published'] },
  { key: 'feedback', label: 'Feedbacks reportados', types: ['dev_feedback'] },
];

const ADMIN_VISIBLE_TYPES = new Set(ADMIN_GROUPS.flatMap((g) => g.types));

export const NotificationBell = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await authGet(`/api/v1/notifications`);
      if (response.ok) {
        const json: unknown = await response.json();
        const rows = json && typeof json === 'object' ? (json as Record<string, unknown>).data : null;
        setNotifications(normalizeNotifications(rows));
      }
    } catch (error) {
      console.error('[NotificationBell] Erro ao buscar notificações:', error);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const initialLoad = setTimeout(fetchNotifications, 0);
    const interval = setInterval(fetchNotifications, 60000);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(interval);
    };
  }, [isAuthenticated, fetchNotifications]);

  // Admin so ve as categorias do feed; demais usuarios veem as proprias notificacoes.
  const visible = useMemo(
    () => (isAdmin ? notifications.filter((n) => ADMIN_VISIBLE_TYPES.has(n.type)) : notifications),
    [notifications, isAdmin],
  );

  const unreadCount = useMemo(() => visible.filter((n) => !n.read).length, [visible]);

  const markAsRead = async (id: string) => {
    try {
      const response = await authPatch(`/api/v1/notifications/${id}/read`);
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      }
    } catch (error) {
      console.error('[NotificationBell] Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await authPatch(`/api/v1/notifications/read-all`);
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (error) {
      console.error('[NotificationBell] Erro ao marcar todas como lidas:', error);
    }
  };

  const handleClick = (notif: Notification) => {
    if (!notif.read) void markAsRead(notif.id);
    if (notif.action_url) {
      setIsOpen(false);
      navigate(notif.action_url);
    }
  };

  if (!isAuthenticated) return null;

  const renderItem = (notif: Notification) => (
    <div
      key={notif.id}
      onClick={() => handleClick(notif)}
      className={`cursor-pointer border-b border-[var(--border-soft)] px-4 py-3 transition-colors ${
        notif.read
          ? 'bg-transparent'
          : 'bg-[color-mix(in_srgb,var(--color-artificio-orange)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-artificio-orange)_16%,transparent)]'
      }`}
    >
      <div className="mb-1 text-sm font-semibold text-[var(--fg)]">{notif.title}</div>
      <div className="mb-2 text-xs text-[var(--fg-low)]">{notif.message}</div>
      <div className="text-xs text-[var(--fg-faint)]">
        {notif.created_at ? new Date(notif.created_at).toLocaleString('pt-BR') : ''}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[var(--fg-low)] transition-colors hover:text-[var(--fg)]"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--danger)] text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--admin-surface)] shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <span className="font-bold text-[var(--fg)]">Notificações</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-[var(--color-artificio-orange)] hover:text-[var(--color-artificio-orange-soft)]"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--fg-faint)]">Nenhuma notificação</div>
            ) : isAdmin ? (
              ADMIN_GROUPS.map((group) => {
                const items = visible.filter((n) => group.types.includes(n.type));
                if (items.length === 0) return null;
                const groupUnread = items.filter((n) => !n.read).length;
                return (
                  <div key={group.key}>
                    <div className="sticky top-0 bg-[var(--admin-hover)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--fg-faint)]">
                      {group.label}
                      {groupUnread > 0 ? ` (${groupUnread})` : ''}
                    </div>
                    {items.map(renderItem)}
                  </div>
                );
              })
            ) : (
              visible.map(renderItem)
            )}
          </div>
        </>
      )}
    </div>
  );
};
