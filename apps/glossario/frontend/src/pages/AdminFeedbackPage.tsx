import React from 'react';
import { MessageSquare, RefreshCw, Trash2, Archive, ArchiveRestore, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

type FeedbackItem = {
  id: string;
  kind: 'bug' | 'suggestion';
  title: string;
  description: string;
  reporter_name: string | null;
  contact_email: string | null;
  page_url: string | null;
  route_path: string | null;
  environment: string | null;
  viewport: string | null;
  console_errors: unknown[];
  network_errors: unknown[];
  screenshot_url: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  archived_at: string | null;
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'Novo' },
  { value: 'triaged', label: 'Triado' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'wont_fix', label: 'Não será corrigido' },
  { value: 'duplicate', label: 'Duplicado' },
];

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const len = (v: unknown[]): number => (Array.isArray(v) ? v.length : 0);

const AdminFeedbackPage: React.FC = () => {
  const [items, setItems] = React.useState<FeedbackItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [kind, setKind] = React.useState('');
  const [archived, setArchived] = React.useState('false');
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const fetchFeedback = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = { archived };
      if (status) params.status = status;
      if (kind) params.kind = kind;
      const { data } = await api.get('/admin/feedback', { params });
      const rows: FeedbackItem[] = data.data || [];
      setItems(rows);
      setNotes(Object.fromEntries(rows.map((r) => [r.id, r.admin_notes ?? ''])));
    } catch (err: any) {
      console.error('[admin-feedback] Falha ao carregar:', err);
      setError(err?.response?.data?.error || 'Não foi possível carregar os feedbacks.');
    } finally {
      setLoading(false);
    }
  }, [archived, status, kind]);

  React.useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const patch = async (id: string, body: Record<string, unknown>, okMsg: string) => {
    try {
      await api.patch(`/admin/feedback/${id}`, body);
      toast.success(okMsg);
      fetchFeedback();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Falha ao atualizar.');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Excluir este feedback definitivamente?')) return;
    try {
      await api.delete(`/admin/feedback/${id}`);
      toast.success('Feedback excluído.');
      fetchFeedback();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Falha ao excluir.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-azul-escuro flex items-center gap-2">
            <MessageSquare size={24} /> Feedback
          </h1>
          <p className="text-sm text-gray-500 mt-1">Relatos de problema e sugestões enviados pelos usuários.</p>
        </div>
        <button
          onClick={fetchFeedback}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Tipo
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
            <option value="">Todos</option>
            <option value="bug">Problema</option>
            <option value="suggestion">Sugestão</option>
          </select>
        </label>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
          Arquivados
          <select value={archived} onChange={(e) => setArchived(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
            <option value="false">Ativos</option>
            <option value="true">Só arquivados</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </section>

      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">{error}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-gray-500">Carregando feedbacks...</div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-gray-500 bg-white border border-gray-100 rounded-2xl">Nenhum feedback encontrado.</div>
      ) : (
        <div className="space-y-4">
          {items.map((it) => (
            <article key={it.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1 ${it.kind === 'bug' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {it.kind === 'bug' ? '🐞 Problema' : '💡 Sugestão'}
                  </span>
                  <h2 className="text-lg font-bold text-azul-escuro">{it.title}</h2>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(it.created_at)}</span>
              </div>

              <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{it.description}</p>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                <span><strong>De:</strong> {it.reporter_name || 'Anônimo'}{it.contact_email ? ` (${it.contact_email})` : ''}</span>
                <span><strong>Página:</strong> {it.route_path || '-'}</span>
                <span><strong>Ambiente:</strong> {it.environment || '-'}</span>
                <span><strong>Tela:</strong> {it.viewport || '-'}</span>
                <span><strong>Erros:</strong> {len(it.console_errors)} console / {len(it.network_errors)} rede</span>
                {it.screenshot_url && (
                  <a href={it.screenshot_url} target="_blank" rel="noreferrer" className="font-bold text-azul-medio hover:underline">Ver captura</a>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-[160px_1fr] gap-3 items-start">
                <select
                  value={it.status}
                  onChange={(e) => patch(it.id, { status: e.target.value }, 'Status atualizado.')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                >
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <textarea
                  value={notes[it.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [it.id]: e.target.value }))}
                  rows={2}
                  placeholder="Notas internas (admin)"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => patch(it.id, { admin_notes: notes[it.id] ?? '' }, 'Notas salvas.')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <Save size={14} /> Salvar notas
                </button>
                <button
                  onClick={() => patch(it.id, { archived: it.archived_at === null }, it.archived_at === null ? 'Arquivado.' : 'Desarquivado.')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {it.archived_at === null ? <><Archive size={14} /> Arquivar</> : <><ArchiveRestore size={14} /> Desarquivar</>}
                </button>
                <button
                  onClick={() => remove(it.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFeedbackPage;
