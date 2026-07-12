import { PainelShell } from '../../components/PainelShell';
import { useMarkNotificationRead, useNotifications } from '../../hooks/useNotifications';

export function NotificacoesPage() {
  const { data: notifications, isLoading } = useNotifications();
  const markReadMutation = useMarkNotificationRead();

  return (
    <PainelShell>
      <h1 className="text-2xl font-bold text-white">Notificações</h1>

      {isLoading && <p className="mt-4 text-white/60">Carregando...</p>}
      {notifications && notifications.length === 0 && <p className="mt-4 text-white/60">Nenhuma notificação.</p>}

      <ul className="mt-6 divide-y divide-white/10">
        {notifications?.map((notification) => (
          <li key={notification.id} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className={notification.read_at ? 'text-white/60' : 'font-semibold text-white'}>{notification.body}</p>
              <p className="text-xs text-white/50">{new Date(notification.created_at).toLocaleString('pt-BR')}</p>
            </div>
            {!notification.read_at && (
              <button
                type="button"
                onClick={() => markReadMutation.mutate(notification.id)}
                className="min-h-[44px] rounded-md border border-white/20 px-3 py-2 text-xs text-white"
              >
                Marcar como lida
              </button>
            )}
          </li>
        ))}
      </ul>
    </PainelShell>
  );
}
