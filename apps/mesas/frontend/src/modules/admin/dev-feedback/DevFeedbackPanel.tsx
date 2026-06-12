import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { InlineDeleteConfirmation } from '../../../components/InlineDeleteConfirmation';
import {
  fetchDevFeedback,
  updateDevFeedback,
  archiveDevFeedback,
  deleteDevFeedback,
  mergeDevFeedback,
  type DevFeedbackItem,
  type DevFeedbackStatus,
} from '../../../features/dev-feedback/devFeedbackApi';

const STATUS_OPTIONS: { value: DevFeedbackStatus; label: string }[] = [
  { value: 'new', label: 'Novo' },
  { value: 'triaged', label: 'Triado' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'wont_fix', label: 'Nao sera feito' },
  { value: 'duplicate', label: 'Duplicado' },
];

const STATUS_LABEL = new Map(STATUS_OPTIONS.map((s) => [s.value, s.label]));

export const DevFeedbackPanel = () => {
  const [items, setItems] = useState<DevFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [archivedFilter, setArchivedFilter] = useState<string>('false');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDevFeedback({ status: statusFilter, kind: kindFilter, archived: archivedFilter });
      setItems(data);
      setSelectedIds((cur) => cur.filter((id) => data.some((d) => d.id === id)));
    } catch (error) {
      console.error('[DevFeedbackPanel] Erro ao carregar feedbacks:', error);
      toast.error('Erro ao carregar feedbacks.');
    } finally {
      setLoading(false);
    }
  }, [archivedFilter, kindFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = async (item: DevFeedbackItem, status: DevFeedbackStatus) => {
    setSavingId(item.id);
    try {
      await updateDevFeedback(item.id, { status });
      toast.success('Status atualizado.');
      void load();
    } catch {
      toast.error('Erro ao atualizar status.');
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveNotes = async (item: DevFeedbackItem) => {
    const notes = notesDraft[item.id] ?? item.admin_notes ?? '';
    setSavingId(item.id);
    try {
      await updateDevFeedback(item.id, { admin_notes: notes });
      toast.success('Notas salvas.');
      void load();
    } catch {
      toast.error('Erro ao salvar notas.');
    } finally {
      setSavingId(null);
    }
  };

  const handleArchive = async (item: DevFeedbackItem, archived: boolean) => {
    setSavingId(item.id);
    try {
      await archiveDevFeedback(item.id, archived);
      toast.success(archived ? 'Feedback arquivado.' : 'Feedback desarquivado.');
      void load();
    } catch {
      toast.error('Erro ao arquivar.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (item: DevFeedbackItem) => {
    setSavingId(item.id);
    try {
      await deleteDevFeedback(item.id);
      toast.success('Feedback excluido.');
      setDeleteConfirmId(null);
      void load();
    } catch {
      toast.error('Erro ao excluir.');
    } finally {
      setSavingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      // Mantem o destino se ainda selecionado; senao usa o primeiro (ou null se vazio).
      if (primaryId === null || !next.includes(primaryId)) {
        setPrimaryId(next[0] ?? null);
      }
      return next;
    });
  };

  const handleMerge = async () => {
    if (!primaryId || selectedIds.length < 2) return;
    const sourceIds = selectedIds.filter((id) => id !== primaryId);
    const primaryTitle = items.find((i) => i.id === primaryId)?.title ?? 'destino';
    if (!confirm(`Mesclar ${sourceIds.length} feedback(s) em "${primaryTitle}"? Os demais serao arquivados.`)) return;
    setMerging(true);
    try {
      await mergeDevFeedback(primaryId, sourceIds);
      toast.success('Feedbacks mesclados.');
      setSelectedIds([]);
      setPrimaryId(null);
      void load();
    } catch {
      toast.error('Erro ao mesclar.');
    } finally {
      setMerging(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="all">Todos os status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="all">Todos os tipos</option>
          <option value="bug">Problema</option>
          <option value="suggestion">Sugestao</option>
        </select>
        <select
          value={archivedFilter}
          onChange={(e) => setArchivedFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
        >
          <option value="false">Ativos</option>
          <option value="true">Arquivados</option>
          <option value="all">Todos</option>
        </select>
        <button
          onClick={() => void load()}
          className="rounded-lg bg-white/5 px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
        >
          Atualizar
        </button>
      </div>

      {/* Barra de mescla */}
      {selectedIds.length >= 2 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-artificio-orange/40 bg-artificio-orange/10 p-3">
          <span className="text-sm text-white/80">{selectedIds.length} selecionados.</span>
          <label className="text-sm text-white/70">
            Destino:{' '}
            <select
              value={primaryId ?? ''}
              onChange={(e) => setPrimaryId(e.target.value)}
              className="rounded border border-white/10 bg-[#1B2A4A] px-2 py-1 text-sm text-white"
            >
              {selectedIds.map((id) => {
                const it = items.find((i) => i.id === id);
                return <option key={id} value={id}>{it?.title ?? id}</option>;
              })}
            </select>
          </label>
          <button
            onClick={() => void handleMerge()}
            disabled={merging || !primaryId}
            className="rounded-lg bg-artificio-orange px-4 py-1.5 text-sm font-semibold text-[#020740] transition-colors hover:bg-artificio-orange-hover hover:text-white disabled:opacity-50"
          >
            {merging ? 'Mesclando...' : 'Mesclar no destino'}
          </button>
          <button
            onClick={() => { setSelectedIds([]); setPrimaryId(null); }}
            className="text-sm text-white/60 hover:text-white"
          >
            Limpar selecao
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-white/60">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-white/60">Nenhum feedback encontrado.</div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`rounded-lg border bg-white/5 p-4 ${
                primaryId === item.id && selectedIds.includes(item.id)
                  ? 'border-artificio-orange'
                  : 'border-white/10'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="mt-1 h-4 w-4 shrink-0"
                    aria-label={`Selecionar ${item.title}`}
                  />
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        item.kind === 'bug' ? 'bg-red-600/80 text-white' : 'bg-blue-600/80 text-white'
                      }`}>
                        {item.kind === 'bug' ? '🐞 Problema' : '💡 Sugestao'}
                      </span>
                      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">
                        {STATUS_LABEL.get(item.status) ?? item.status}
                      </span>
                      {item.environment && (
                        <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/50">{item.environment}</span>
                      )}
                      {item.archived_at && (
                        <span className="rounded bg-yellow-700/60 px-2 py-0.5 text-xs text-white">Arquivado</span>
                      )}
                      {item.merged_into && (
                        <span className="rounded bg-purple-700/60 px-2 py-0.5 text-xs text-white">Mesclado</span>
                      )}
                      {item.merged_sources.length > 0 && (
                        <span className="rounded bg-green-700/60 px-2 py-0.5 text-xs text-white">
                          +{item.merged_sources.length} integrado(s)
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/70">{item.description}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-white/40">
                  {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : ''}
                </div>
              </div>

              {/* Contexto */}
              <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-white/50 sm:grid-cols-2">
                <div>
                  Pagina:{' '}
                  {item.page_url ? (
                    <a href={item.page_url} target="_blank" rel="noreferrer" className="text-artificio-orange-hover hover:underline">
                      {item.route_path || item.page_url}
                    </a>
                  ) : (item.route_path || '-')}
                </div>
                <div>Reporter: {item.reporter_name}{item.reporter_role ? ` (${item.reporter_role})` : ''}</div>
                {item.contact_email && <div>Contato: {item.contact_email}</div>}
                {item.viewport && <div>Tela: {item.viewport}</div>}
                {item.user_agent && <div className="sm:col-span-2 truncate">UA: {item.user_agent}</div>}
              </div>

              {item.console_errors.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-white/70">
                    Erros de console ({item.console_errors.length})
                  </summary>
                  <ul className="mt-2 space-y-1 rounded bg-black/30 p-2 font-mono text-[11px] text-white/70">
                    {item.console_errors.map((e, i) => (
                      <li key={i} className="break-words">[{e.level}] {e.message}</li>
                    ))}
                  </ul>
                </details>
              )}

              {item.network_errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-white/70">
                    Falhas de rede ({item.network_errors.length})
                  </summary>
                  <ul className="mt-2 space-y-1 rounded bg-black/30 p-2 font-mono text-[11px] text-white/70">
                    {item.network_errors.map((e, i) => (
                      <li key={i} className="break-words">{e.status} {e.method} {e.url}</li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Integrados (mescla) */}
              {item.merged_sources.length > 0 && (
                <details className="mt-2" open>
                  <summary className="cursor-pointer text-xs font-semibold text-green-300">
                    Integrados nesta entrada ({item.merged_sources.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {item.merged_sources.map((s, i) => (
                      <div key={`${s.id}-${i}`} className="rounded border border-white/10 bg-black/20 p-2 text-xs text-white/70">
                        <div className="font-semibold text-white/80">{s.title}</div>
                        {s.description && <div className="mt-0.5 whitespace-pre-wrap">{s.description}</div>}
                        <div className="mt-1 text-white/40">
                          {s.route_path && <span>Pagina: {s.route_path} · </span>}
                          {s.contact_email && <span>Contato: {s.contact_email} · </span>}
                          {s.created_at && <span>{new Date(s.created_at).toLocaleString('pt-BR')}</span>}
                        </div>
                        {s.screenshot_url && (
                          <a href={s.screenshot_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-artificio-orange-hover hover:underline">
                            ver captura
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {item.screenshot_url && (
                <a href={item.screenshot_url} target="_blank" rel="noreferrer" className="mt-3 inline-block">
                  <img src={item.screenshot_url} alt="Captura de tela do relato" className="max-h-40 rounded border border-white/10" />
                </a>
              )}

              {/* Triagem + acoes */}
              <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-white/10 pt-3">
                <div>
                  <label className="mb-1 block text-xs text-white/60">Status</label>
                  <select
                    value={item.status}
                    disabled={savingId === item.id}
                    onChange={(e) => void handleStatusChange(item, e.target.value as DevFeedbackStatus)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[200px] flex-1">
                  <label className="mb-1 block text-xs text-white/60">Notas da equipe</label>
                  <textarea
                    rows={2}
                    defaultValue={item.admin_notes ?? ''}
                    onChange={(e) => setNotesDraft((d) => ({ ...d, [item.id]: e.target.value }))}
                    className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  />
                </div>
                <button
                  onClick={() => void handleSaveNotes(item)}
                  disabled={savingId === item.id}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  Salvar notas
                </button>
                <button
                  onClick={() => void handleArchive(item, !item.archived_at)}
                  disabled={savingId === item.id}
                  className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20 disabled:opacity-50"
                >
                  {item.archived_at ? 'Desarquivar' : 'Arquivar'}
                </button>
                <InlineDeleteConfirmation
                  title={item.title}
                  isOpen={deleteConfirmId === item.id}
                  onOpen={() => setDeleteConfirmId(item.id)}
                  onCancel={() => setDeleteConfirmId(null)}
                  onConfirm={() => handleDelete(item)}
                  isProcessing={savingId === item.id}
                  triggerLabel="Excluir"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
