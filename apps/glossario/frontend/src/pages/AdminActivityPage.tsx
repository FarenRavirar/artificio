import React from 'react';
import { Activity, Filter, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

type AdminActivityItem = {
  event_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  term_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  target_user_id: string | null;
  target_user_name: string | null;
  target_username: string | null;
  summary: string | null;
  payload: Record<string, any> | null;
  created_at: string;
};

type MemberOption = {
  id: string;
  full_name: string;
  username: string;
};

const EVENT_OPTIONS = [
  { value: '', label: 'Todos os eventos' },
  { value: 'term.suggested', label: 'Sugestão de termo' },
  { value: 'term.created', label: 'Termo criado' },
  { value: 'comment.create', label: 'Comentário criado' },
  { value: 'vote.up', label: 'Voto positivo' },
  { value: 'vote.down', label: 'Voto negativo' },
  { value: 'term.updated', label: 'Termo atualizado' },
  { value: 'term.moderated', label: 'Termo moderado' },
  { value: 'term.override', label: 'Override administrativo' },
  { value: 'user.registered', label: 'Novo usuário registrado' },
];

const formatDate = (isoString: string): string =>
  new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const compact = (value?: string | null): string => {
  if (!value) return '-';
  return value.length > 20 ? `${value.slice(0, 20)}...` : value;
};

const AdminActivityPage: React.FC = () => {
  const [items, setItems] = React.useState<AdminActivityItem[]>([]);
  const [members, setMembers] = React.useState<MemberOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [eventType, setEventType] = React.useState('');
  const [actorId, setActorId] = React.useState('');
  const [targetUserId, setTargetUserId] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [search, setSearch] = React.useState('');

  const [totalCount, setTotalCount] = React.useState(0);
  const [limit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);

  const fetchMembers = React.useCallback(async () => {
    try {
      const { data } = await api.get('/users/admin');
      setMembers(data || []);
    } catch (err) {
      console.error('[admin-activity] Falha ao carregar membros:', err);
    }
  }, []);

  const fetchActivity = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = {
        limit,
        offset,
      };

      if (eventType) params.event_type = eventType;
      if (actorId) params.actor_id = actorId;
      if (targetUserId) params.target_user_id = targetUserId;
      if (dateFrom) params.date_from = `${dateFrom}T00:00:00`;
      if (dateTo) params.date_to = `${dateTo}T23:59:59`;
      if (search.trim()) params.q = search.trim();

      const { data } = await api.get('/admin/activity', { params });
      setItems(data.items || []);
      setTotalCount(data.total_count || 0);
    } catch (err: any) {
      console.error('[admin-activity] Falha ao carregar timeline:', err);
      setError(err?.response?.data?.message || 'Não foi possível carregar a timeline administrativa.');
    } finally {
      setLoading(false);
    }
  }, [actorId, dateFrom, dateTo, eventType, limit, offset, search, targetUserId]);

  React.useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  React.useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const resetFilters = () => {
    setEventType('');
    setActorId('');
    setTargetUserId('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
    setOffset(0);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-[var(--fg)] flex items-center gap-2">
            <Activity size={24} /> Atividade Administrativa
          </h1>
          <p className="text-sm text-[var(--fg-muted)] mt-1">Timeline consolidada de sugestões, comentários, votos, edições e moderação.</p>
        </div>
        <button
          onClick={fetchActivity}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--line)] text-sm font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)]"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-[var(--fg)]" />
          <h2 className="text-sm font-black uppercase tracking-widest text-[var(--fg)]">Filtros</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">
            Busca
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Termo, usuário, ação..."
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </label>

          <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">
            Tipo de evento
            <select
              value={eventType}
              onChange={(e) => { setEventType(e.target.value); setOffset(0); }}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)]"
            >
              {EVENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">
            Quem fez
            <select
              value={actorId}
              onChange={(e) => { setActorId(e.target.value); setOffset(0); }}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)]"
            >
              <option value="">Todos</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} (@{member.username})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">
            Usuário afetado
            <select
              value={targetUserId}
              onChange={(e) => { setTargetUserId(e.target.value); setOffset(0); }}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)]"
            >
              <option value="">Todos</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name} (@{member.username})
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">
            Data inicial
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </label>

          <label className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-widest">
            Data final
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
              className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)]"
            />
          </label>
        </div>

        <div className="mt-3">
          <button onClick={resetFilters} className="px-4 py-2 rounded-xl border border-[var(--line)] text-sm font-bold text-[var(--fg-muted)] hover:bg-[var(--surface-subtle)]">
            Limpar filtros
          </button>
        </div>
      </section>

      <section className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-sm overflow-hidden">
        {error && (
          <div className="p-4 bg-[var(--state-danger-bg)] border-b border-[var(--state-danger-line)] text-[var(--state-danger-fg)] text-sm font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center text-[var(--fg-muted)]">Carregando atividade administrativa...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-[var(--fg-muted)]">Nenhum evento encontrado para os filtros aplicados.</div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {items.map((item) => (
              <article key={item.event_id} className="p-4 hover:bg-[var(--surface-subtle)] transition-colors">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--fg)]">{item.summary || 'Evento administrativo'}</p>
                  <span className="text-xs text-[var(--fg-muted)]">{formatDate(item.created_at)}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--fg-muted)]">
                  <span><strong>Evento:</strong> {item.event_type}</span>
                  <span><strong>Quem fez:</strong> {item.actor_name || item.actor_username || '-'}</span>
                  <span><strong>Usuário afetado:</strong> {item.target_user_name || item.target_username || '-'}</span>
                  <span><strong>Entidade:</strong> {item.entity_type} ({compact(item.entity_id)})</span>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  {item.entity_type === 'user' ? (
                    <Link to="/admin/users" className="text-xs font-bold text-[var(--fg-muted)] hover:underline">
                      Abrir Gestão de Membros
                    </Link>
                  ) : (
                    <Link to="/admin/review" className="text-xs font-bold text-[var(--fg-muted)] hover:underline">
                      Abrir Revisão de Sugestões
                    </Link>
                  )}
                </div>
              </article>
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

export default AdminActivityPage;

