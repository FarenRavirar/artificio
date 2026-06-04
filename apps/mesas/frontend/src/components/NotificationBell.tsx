import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

const API_BASE = import.meta.env.VITE_API_URL || '';

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

// Grupos do feed do admin. Tipos fora destes (ex.: suggestion_approved/rejected,
// que sao resultado endereçado ao sugeridor) nao aparecem para o admin.
const ADMIN_GROUPS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'system', label: 'Sistemas sugeridos', types: ['system_suggestion', 'system'] },
  { key: 'scenario', label: 'Cenários sugeridos', types: ['scenario_suggestion'] },
  { key: 'table', label: 'Mesas adicionadas', types: ['table_published'] },
  { key: 'member', label: 'Novos membros', types: ['member_joined'] },
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
      const response = await fetch(`${API_BASE}/api/v1/notifications`, { credentials: 'include' });
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
      const response = await fetch(`${API_BASE}/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (response.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      }
    } catch (error) {
      console.error('[NotificationBell] Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/notifications/read-all`, {
        method: 'PATCH',
        credentials: 'include',
      });
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
      className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors ${
        notif.read ? 'bg-transparent' : 'bg-blue-500/10 hover:bg-blue-500/20'
      }`}
    >
      <div className="font-semibold text-white text-sm mb-1">{notif.title}</div>
      <div className="text-white/70 text-xs mb-2">{notif.message}</div>
      <div className="text-white/40 text-xs">
        {notif.created_at ? new Date(notif.created_at).toLocaleString('pt-BR') : ''}
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-white/75 hover:text-white transition-colors"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-80 bg-[#1B2A4A] border border-white/10 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
              <span className="font-bold text-white">Notificações</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-300 hover:text-blue-200"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/50 text-sm">Nenhuma notificação</div>
            ) : isAdmin ? (
              ADMIN_GROUPS.map((group) => {
                const items = visible.filter((n) => group.types.includes(n.type));
                if (items.length === 0) return null;
                const groupUnread = items.filter((n) => !n.read).length;
                return (
                  <div key={group.key}>
                    <div className="px-4 py-2 bg-white/5 text-white/50 text-xs font-semibold uppercase tracking-wide sticky top-0">
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
