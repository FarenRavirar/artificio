import React from 'react';
import { Bell, CheckCheck, Filter, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/auth-context';

type NotificationItem = {
  id: string;
  user_id: string;
  target_user_name?: string | null;
  target_username?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_username?: string | null;
  event_type: 'vote.up' | 'vote.down' | 'comment.create' | 'term.updated' | 'term.moderated' | 'user.registered';
  payload?: {
    termName?: string;
    direction?: 'up' | 'down';
    status?: string;
    excerpt?: string;
    fullName?: string;
    username?: string;
  };
  read_at?: string | null;
  created_at: string;
};

type MemberOption = {
  id: string;
  full_name: string;
  username: string;
};

const FILTER_LABEL_CLASS =
  'text-[13px] font-medium text-[var(--fg-muted)] normal-case tracking-normal';

const FILTER_INPUT_CLASS =
  'mt-[6px] w-full rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-[14px] py-[10px] text-[14px] text-[var(--fg)] placeholder:text-[var(--fg-muted)] focus:outline focus:outline-2 focus:outline-[var(--artificio-brand)] focus:outline-offset-0 transition-[border-color,outline] duration-150 ease-in';

const FILTER_SELECT_CLASS =
  'mt-[6px] w-full rounded-[6px] border border-[var(--line)] bg-[var(--surface)] px-[14px] py-[10px] pr-9 text-[14px] text-[var(--fg)] appearance-none [-webkit-appearance:none] cursor-pointer focus:outline focus:outline-2 focus:outline-[var(--artificio-brand)] focus:outline-offset-0 transition-[border-color,outline] duration-150 ease-in';

const FILTER_SELECT_ARROW_STYLE: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%231a2744' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
};

const EVENT_OPTIONS = [
  { value: '', label: 'Todas as ações' },
  { value: 'vote.up', label: 'Voto positivo' },
  { value: 'vote.down', label: 'Voto negativo' },
  { value: 'comment.create', label: 'Comentário criado' },
  { value: 'term.updated', label: 'Termo atualizado' },
  { value: 'term.moderated', label: 'Termo moderado' },
  { value: 'user.registered', label: 'Novo usuário registrado' },
];

const formatNotificationDate = (isoString: string): string => {
  // [UX-FIX] MENOR-1 — padroniza data para "dd/mm às hh:mm" e oculta ano corrente.
  const date = new Date(isoString);
  const currentYear = new Date().getFullYear();
  const sameYear = date.getFullYear() === currentYear;
  const datePart = date.toLocaleDateString('pt-BR', sameYear ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} às ${timePart}`;
};

const formatMessage = (item: NotificationItem): string => {
  const actor =
    item.actor_name ||
    item.actor_username ||
    item.payload?.fullName ||
    item.payload?.username ||
    'Sistema';
  const termName = item.payload?.termName ? ` no termo "${item.payload.termName}"` : '';

  switch (item.event_type) {
    case 'vote.up':
      return `${actor} deu voto positivo${termName}.`;
    case 'vote.down':
      return `${actor} deu voto negativo${termName}.`;
    case 'comment.create':
      return `${actor} comentou${termName}.`;
    case 'term.updated':
      return `${actor} atualizou${termName}.`;
    case 'term.moderated':
      return `${actor} moderou${termName}.`;
    case 'user.registered':
      return `${actor} registrou-se na comunidade.`;
    default:
      return `${actor} realizou uma ação.`;
  }
};

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [members, setMembers] = React.useState<MemberOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [updating, setUpdating] = React.useState(false);

  const [totalCount, setTotalCount] = React.useState(0);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [limit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);

  const [scope, setScope] = React.useState<'mine' | 'all'>(isAdmin ? 'all' : 'mine');
  const [readStatus, setReadStatus] = React.useState<'all' | 'unread' | 'read'>('all');
  const [eventType, setEventType] = React.useState('');
  const [actorId, setActorId] = React.useState('');
  const [targetUserId, setTargetUserId] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [search, setSearch] = React.useState('');
  // [UX-FIX] CRÍTICO-1 — painel avançado inicia colapsado e usa estado local.
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

  const defaultScope: 'mine' | 'all' = isAdmin ? 'all' : 'mine';
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (search.trim()) count += 1;
    if (readStatus !== 'all') count += 1;
    if (eventType) count += 1;
    if (actorId) count += 1;
    if (isAdmin && scope === 'all' && targetUserId) count += 1;
    if (dateFrom) count += 1;
    if (dateTo) count += 1;
    if (scope !== defaultScope) count += 1;
    return count;
  }, [actorId, dateFrom, dateTo, defaultScope, eventType, isAdmin, readStatus, scope, search, targetUserId]);
  const hasActiveFilters = activeFiltersCount > 0;

  const fetchMembers = React.useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get('/users/admin');
      setMembers(data || []);
    } catch (err) {
      console.error('[notifications] Falha ao carregar membros para filtro:', err);
    }
  }, [isAdmin]);

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = {
        limit,
        offset,
      };

      if (isAdmin && scope === 'all') params.scope = 'all';
      if (readStatus !== 'all') params.read_status = readStatus;
      if (eventType) params.event_type = eventType;
      if (actorId) params.actor_id = actorId;
      if (isAdmin && scope === 'all' && targetUserId) params.user_id = targetUserId;
      if (dateFrom) params.date_from = `${dateFrom}T00:00:00`;
      if (dateTo) params.date_to = `${dateTo}T23:59:59`;
      if (search.trim()) params.q = search.trim();

      const { data } = await api.get('/notifications', { params });
      setItems(data.items || []);
      setUnreadCount(data.unread_count || 0);
      setTotalCount(data.total_count || 0);
    } catch (err) {
      console.error('[notifications] Falha ao carregar notificações:', err);
      setError('Não foi possível carregar as notificações.');
    } finally {
      setLoading(false);
    }
  }, [actorId, dateFrom, dateTo, eventType, isAdmin, limit, offset, readStatus, scope, search, targetUserId]);

  React.useEffect(() => {
    void (async () => { await fetchMembers(); })();
  }, [fetchMembers]);

  React.useEffect(() => {
    void (async () => { await fetchNotifications(); })();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    setUpdating(true);
    try {
      await api.patch(`/notifications/${id}/read`);
      await fetchNotifications();
    } catch (err) {
      console.error('[notifications] Falha ao marcar notificação como lida:', err);
      setError('Falha ao marcar notificação como lida.');
    } finally {
      setUpdating(false);
    }
  };

  const markAllAsRead = async () => {
    setUpdating(true);
    try {
      await api.patch('/notifications/read-all');
      await fetchNotifications();
    } catch (err) {
      console.error('[notifications] Falha ao marcar todas como lidas:', err);
      setError('Falha ao atualizar notificações.');
    } finally {
      setUpdating(false);
    }
  };

  const resetFilters = () => {
    setOffset(0);
    setReadStatus('all');
    setEventType('');
    setActorId('');
    setTargetUserId('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setScope(defaultScope);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--fg)] flex items-center gap-2">
            <Bell size={24} /> Central de Notificações
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">
            {unreadCount} não lida{unreadCount !== 1 ? 's' : ''} · {totalCount} no total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--line)] text-sm font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)]"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0 || updating}
            // [UX-FIX] CRÍTICO-3 — CTA desabilitado com feedback visual e cursor correto.
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)] text-sm font-semibold hover:bg-[var(--btn-primary-bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCheck size={14} /> Marcar todas como lidas
          </button>
        </div>
      </div>

      {/* [THEME-MIGRATION] painel de filtros — light theme */}
      <section className="bg-[var(--surface)] border border-[var(--line)] rounded-[10px] px-6 py-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-[var(--fg)]" />
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--fg)]">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* [UX-FIX] CRÍTICO-1 — mantém visível apenas busca + estado de leitura no modo colapsado. */}
          {/* [THEME-MIGRATION] campo de busca — light theme */}
          <label className={`${FILTER_LABEL_CLASS} md:col-span-2`}>
            Buscar por termo/usuário
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Ex.: fireball, paulo, comentário..."
              className={FILTER_INPUT_CLASS}
            />
          </label>

          {/* [THEME-MIGRATION] select estado de leitura — light theme */}
          <label className={FILTER_LABEL_CLASS}>
            Estado de leitura
            <select
              value={readStatus}
              onChange={(e) => { setReadStatus(e.target.value as 'all' | 'unread' | 'read'); setOffset(0); }}
              className={FILTER_SELECT_CLASS}
              style={FILTER_SELECT_ARROW_STYLE}
            >
              <option value="all">Todas</option>
              <option value="unread">Não lidas</option>
              <option value="read">Lidas</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex items-center gap-2">
          {/* [UX-FIX] CRÍTICO-1 — botão explicita expansão de filtros avançados. */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="px-4 py-2 rounded-xl border border-[var(--line)] text-sm font-bold text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)]"
          >
            {showAdvancedFilters ? 'Ocultar filtros avançados' : 'Filtros avançados'}
          </button>
          {/* [UX-FIX] MÉDIO-2 — botão Limpar exibido só quando há filtros ativos com badge de contagem. */}
          {hasActiveFilters && (
            <button onClick={resetFilters} className="px-4 py-2 rounded-xl border border-[var(--line)] text-sm font-bold text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)]">
              Limpar <span className="ml-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[11px]">{activeFiltersCount}</span>
            </button>
          )}
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
            {/* [UX-FIX] CRÍTICO-1 — conteúdo avançado só aparece após expansão explícita. */}
            {/* [THEME-MIGRATION] select escopo — light theme */}
            {isAdmin && (
              <label className={FILTER_LABEL_CLASS}>
                Escopo
                <select
                  value={scope}
                  onChange={(e) => { setScope(e.target.value as 'mine' | 'all'); setOffset(0); }}
                  className={FILTER_SELECT_CLASS}
                  style={FILTER_SELECT_ARROW_STYLE}
                >
                  <option value="all">Todos os usuários</option>
                  <option value="mine">Apenas minhas notificações</option>
                </select>
              </label>
            )}

            {/* [THEME-MIGRATION] select tipo de ação — light theme */}
            <label className={FILTER_LABEL_CLASS}>
              {/* [UX-FIX] MENOR-2 — label renomeada para semântica mais clara. */}
              Tipo de ação
              <select
                value={eventType}
                onChange={(e) => { setEventType(e.target.value); setOffset(0); }}
                className={FILTER_SELECT_CLASS}
                style={FILTER_SELECT_ARROW_STYLE}
              >
                {EVENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {/* [THEME-MIGRATION] select quem fez — light theme */}
            <label className={FILTER_LABEL_CLASS}>
              Quem fez
              <select
                value={actorId}
                onChange={(e) => { setActorId(e.target.value); setOffset(0); }}
                className={FILTER_SELECT_CLASS}
                style={FILTER_SELECT_ARROW_STYLE}
              >
                <option value="">Todos</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} (@{member.username})
                  </option>
                ))}
              </select>
            </label>

            {/* [THEME-MIGRATION] select usuário afetado — light theme */}
            {isAdmin && scope === 'all' && (
              <label className={FILTER_LABEL_CLASS}>
                Usuário afetado
                <select
                  value={targetUserId}
                  onChange={(e) => { setTargetUserId(e.target.value); setOffset(0); }}
                  className={FILTER_SELECT_CLASS}
                  style={FILTER_SELECT_ARROW_STYLE}
                >
                  <option value="">Todos</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name} (@{member.username})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* [THEME-MIGRATION] input data inicial — light theme */}
            <label className={FILTER_LABEL_CLASS}>
              Data inicial
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
                className={FILTER_INPUT_CLASS}
              />
            </label>

            {/* [THEME-MIGRATION] input data final — light theme */}
            <label className={FILTER_LABEL_CLASS}>
              Data final
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
                className={FILTER_INPUT_CLASS}
              />
            </label>
          </div>
        )}
      </section>

      <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-[var(--state-danger-bg)] border-b border-[var(--state-danger-line)] text-[var(--state-danger-fg)] text-sm font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-[var(--fg-muted)]">Carregando notificações...</div>
        ) : items.length === 0 ? (
          // [UX-FIX] CRÍTICO-4 — empty state contextual para sem filtros vs filtros ativos.
          <EmptyState
            hasActiveFilters={hasActiveFilters}
            onClearFilters={resetFilters}
          />
        ) : (
          <div>
            {items.map((item, index) => (
              <NotificationCard
                key={item.id}
                // [UX-FIX] CRÍTICO-2 — card recebe prop semântica explícita de leitura.
                read={Boolean(item.read_at)}
                item={item}
                isLast={index === items.length - 1}
                updating={updating}
                onMarkRead={() => markAsRead(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="mt-4 flex items-center justify-between text-sm text-[var(--fg-muted)]">
        <span>Página {currentPage} de {totalPages}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-3 py-1.5 rounded-lg border border-[var(--line)] disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= totalCount}
            className="px-3 py-1.5 rounded-lg border border-[var(--line)] disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationsPage;

type NotificationCardProps = {
  item: NotificationItem;
  read: boolean;
  isLast: boolean;
  updating: boolean;
  onMarkRead: () => void;
};

const NotificationCard: React.FC<NotificationCardProps> = ({ item, read, isLast, updating, onMarkRead }) => {
  const isClickable = !read;

  return (
    <article
      // [UX-FIX] MENOR-3 — divisor visual 0.5px entre cards, exceto no último.
      style={{ borderBottom: isLast ? 'none' : '0.5px solid var(--line, #E5E7EB)' }}
      // [UX-FIX] MÉDIO-1 — hover/cursor somente quando card é clicável.
      className={`p-4 transition-[background] duration-150 ease-in ${isClickable ? 'cursor-pointer hover:bg-[var(--surface-subtle,#F9FAFB)]' : 'cursor-default'} ${read ? 'bg-[var(--surface)]' : 'bg-[rgba(255,87,34,0.05)]'}`}
      onClick={isClickable ? onMarkRead : undefined}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            {/* [UX-FIX] CRÍTICO-2 — não lidas recebem dot azul de 8px na esquerda. */}
            {!read && <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-[var(--state-info-bg)] shrink-0" />}
            {/* [UX-FIX] CRÍTICO-2 — título de não lida em cor primária; lida em secundária. */}
            <p className={`text-sm font-medium ${read ? 'text-[var(--fg-muted)]' : 'text-[var(--fg)]'}`}>{formatMessage(item)}</p>
          </div>
          <div className="mt-1 text-xs text-[var(--fg-muted)] flex flex-wrap gap-3">
            <span><strong>Quem fez:</strong> {item.actor_name || item.actor_username || 'Sistema'}</span>
            <span><strong>Usuário alvo:</strong> {item.target_user_name || item.target_username || item.user_id}</span>
            <span><strong>Ação:</strong> {item.event_type}</span>
            <span><strong>Data:</strong> {formatNotificationDate(item.created_at)}</span>
          </div>
          {item.payload?.excerpt && (
            <p className="text-xs text-[var(--fg-muted)] mt-2 italic">"{item.payload.excerpt}"</p>
          )}
        </div>
        {!read && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onMarkRead();
            }}
            disabled={updating}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-[var(--fg)] border border-[var(--state-info-line)] hover:bg-[var(--state-info-bg)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Marcar lida
          </button>
        )}
      </div>
    </article>
  );
};

type EmptyStateProps = {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
};

const EmptyState: React.FC<EmptyStateProps> = ({ hasActiveFilters, onClearFilters }) => {
  if (!hasActiveFilters) {
    return <div className="p-8 text-center text-[var(--fg-muted)]">Você está em dia.</div>;
  }

  return (
    <div className="p-8 text-center text-[var(--fg-muted)]">
      <p>Nenhuma notificação corresponde aos filtros.</p>
      <button onClick={onClearFilters} className="mt-3 px-4 py-2 rounded-xl border border-[var(--line)] text-sm font-bold text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)]">
        Limpar filtros
      </button>
    </div>
  );
};
