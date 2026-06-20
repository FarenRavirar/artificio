import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { DiscordFetchWindow, DiscordSource, DiscordMessage, DiscordImportMessageStatus, DiscordMessageContentDiagnostic } from '../types';
import { discordSyncApi } from '../api/discordSyncApi';
import { DiscordSourceList } from './DiscordSourceList';
import { DiscordDraftReviewTable } from './DiscordDraftReviewTable';
import { DiscordSettingsPanel } from './DiscordSettingsPanel';

const MESSAGE_STATUS_LABELS: Record<DiscordImportMessageStatus, string> = {
  pending: 'Pendente',
  parsed: 'Parseada',
  needs_review: 'Revisar',
  synced: 'Sincronizada',
  ignored: 'Ignorada',
  error: 'Erro',
};

const MESSAGE_STATUS_COLORS: Record<DiscordImportMessageStatus, string> = {
  pending: 'bg-yellow-700/40 text-yellow-300',
  parsed: 'bg-blue-700/40 text-blue-300',
  needs_review: 'bg-orange-700/40 text-orange-300',
  synced: 'bg-green-700/40 text-green-300',
  ignored: 'bg-white/10 text-white/40',
  error: 'bg-red-700/40 text-red-300',
};

type PanelTab = 'configuracao' | 'fontes' | 'mensagens' | 'drafts';

const REVIEW_ACTIONS: Array<{ status: DiscordImportMessageStatus; label: string; className: string }> = [
  { status: 'needs_review', label: 'Mandar para revisão', className: 'bg-orange-600 hover:bg-orange-700' },
  { status: 'parsed', label: 'Marcar conferida', className: 'bg-blue-600 hover:bg-blue-700' },
  { status: 'ignored', label: 'Ignorar', className: 'bg-white/10 hover:bg-white/20' },
];

const MESSAGE_WINDOW_OPTIONS = [
  { value: '24h', label: 'Últimas 24h', days: 1 },
  { value: '7d', label: 'Últimos 7 dias', days: 7 },
  { value: '30d', label: 'Últimos 30 dias', days: 30 },
  { value: '90d', label: 'Últimos 90 dias', days: 90 },
  { value: 'all', label: 'Sem limite', days: null },
] as const;

type MessageWindowOption = (typeof MESSAGE_WINDOW_OPTIONS)[number]['value'];

function buildMessageWindow(value: MessageWindowOption): DiscordFetchWindow {
  const option = MESSAGE_WINDOW_OPTIONS.find((item) => item.value === value);
  if (!option?.days) return {};
  const since = new Date();
  since.setDate(since.getDate() - option.days);
  return { since: since.toISOString(), until: new Date().toISOString() };
}

function getMessageTitle(message: DiscordMessage): string {
  if (message.discord_thread_name) return message.discord_thread_name;
  const content = message.content_raw.trim();
  if (content) return content.split('\n').find(Boolean) ?? content;
  return 'Mensagem sem título';
}

function getMessagePreview(message: DiscordMessage): string {
  const content = message.content_raw.trim();
  if (content) return content;
  if (message.discord_thread_name) return message.discord_thread_name;
  return 'Mensagem sem texto disponível.';
}

function didDiscordApiOmitBody(message: DiscordMessage): boolean {
  return Boolean(message.discord_thread_id && message.discord_thread_name && !message.content_raw.trim());
}

export function DiscordSyncPanel() {
  const [tab, setTab] = useState<PanelTab>('configuracao');
  const [sources, setSources] = useState<DiscordSource[]>([]);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [fetchingSourceId, setFetchingSourceId] = useState<string | null>(null);
  const [reingestingSourceId, setReingestingSourceId] = useState<string | null>(null);
  const [parsingBatch, setParsingBatch] = useState(false);
  const [messageStatusFilter, setMessageStatusFilter] = useState<DiscordImportMessageStatus | ''>('');
  const [messageSourceFilter, setMessageSourceFilter] = useState('');
  const [messageWindowFilter, setMessageWindowFilter] = useState<MessageWindowOption>('7d');
  const [selectedMessage, setSelectedMessage] = useState<DiscordMessage | null>(null);
  const [savingMessageStatus, setSavingMessageStatus] = useState(false);
  const [parsingMessageId, setParsingMessageId] = useState<string | null>(null);
  const [diagnosingMessageId, setDiagnosingMessageId] = useState<string | null>(null);
  const [contentDiagnostic, setContentDiagnostic] = useState<DiscordMessageContentDiagnostic | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  const queueStats = useMemo(() => ({
    pending: messages.filter(message => message.status === 'pending').length,
    review: messages.filter(message => message.status === 'needs_review').length,
    checked: messages.filter(message => message.status === 'parsed').length,
    ignored: messages.filter(message => message.status === 'ignored').length,
  }), [messages]);

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const data = await discordSyncApi.getSources();
      setSources(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar fontes.');
    } finally {
      setLoadingSources(false);
    }
  }, []);

  const loadMessages = useCallback(async (override?: { sourceId?: string; window?: DiscordFetchWindow }) => {
    setLoadingMessages(true);
    try {
      const data = await discordSyncApi.getMessages({
        source_id: override?.sourceId ?? (messageSourceFilter || undefined),
        status: messageStatusFilter || undefined,
        ...(override?.window ?? buildMessageWindow(messageWindowFilter)),
        limit: 100,
      });
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar mensagens.');
    } finally {
      setLoadingMessages(false);
    }
  }, [messageSourceFilter, messageStatusFilter, messageWindowFilter]);

  useEffect(() => {
    void (async () => { await loadSources(); })();
  }, [loadSources]);

  useEffect(() => {
    void (async () => { if (tab === 'mensagens') await loadMessages(); })();
  }, [tab, messageStatusFilter, messageSourceFilter, messageWindowFilter, loadMessages]);

  useEffect(() => {
    if (tab !== 'mensagens') return;
    let active = true;
    // Seleção derivada das mensagens — setState deferido p/ fora do corpo síncrono.
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      if (messages.length === 0) {
        setSelectedMessage(null);
        return;
      }
      if (!selectedMessage || !messages.some(message => message.id === selectedMessage.id)) {
        setSelectedMessage(messages[0]);
      }
    })();
    return () => { active = false; };
  }, [messages, selectedMessage, tab]);

  const handleFetchMessages = async (sourceId: string, window: DiscordFetchWindow, windowOption: MessageWindowOption = '7d') => {
    setFetchingSourceId(sourceId);
    try {
      const source = sources.find(item => item.id === sourceId);
      const result = await discordSyncApi.fetchMessages({ source_id: sourceId, limit: 50, ...window });
      const draftsText = result.parse ? ` ${result.parse.succeeded} drafts criados/atualizados.` : '';
      if (source?.channel_type === 'forum') {
        toast.success(`${result.threadsScanned} posts na janela: +${result.inserted} mensagens, ${result.updated} atualizadas.${draftsText}`);
      } else {
        toast.success(`+${result.inserted} mensagens, ${result.updated} atualizadas.${draftsText}`);
      }
      setMessageSourceFilter(sourceId);
      setMessageWindowFilter(windowOption);
      setTab('mensagens');
      loadMessages({ sourceId, window });
      loadSources();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao buscar mensagens.');
    } finally {
      setFetchingSourceId(null);
    }
  };

  const handleUpdateMessageStatus = async (message: DiscordMessage, status: DiscordImportMessageStatus) => {
    setSavingMessageStatus(true);
    try {
      const updated = await discordSyncApi.updateMessage(message.id, { status });
      setMessages(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setSelectedMessage(updated);
      toast.success('Status da mensagem atualizado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar mensagem.');
    } finally {
      setSavingMessageStatus(false);
    }
  };

  const handleParseMessage = async (message: DiscordMessage) => {
    setParsingMessageId(message.id);
    try {
      await discordSyncApi.parseMessage(message.id);
      toast.success('Draft criado! Acesse a aba Drafts para revisar e sincronizar.');
      // Atualiza a mensagem na lista para refletir status 'parsed'
      const updated = await discordSyncApi.updateMessage(message.id, { status: 'parsed' });
      setMessages(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setSelectedMessage(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao parsear mensagem.');
    } finally {
      setParsingMessageId(null);
    }
  };

  const handleDiagnoseContent = async (message: DiscordMessage) => {
    setDiagnosingMessageId(message.id);
    setContentDiagnostic(null);
    try {
      const diagnostic = await discordSyncApi.diagnoseMessageContent(message.id);
      setContentDiagnostic(diagnostic);
      if (diagnostic.likely_missing_message_content_intent) {
        toast.error('Discord entregou esta mensagem sem corpo para o bot.');
      } else {
        toast.success('Diagnóstico de conteúdo concluído.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao diagnosticar conteúdo.');
    } finally {
      setDiagnosingMessageId(null);
    }
  };

  const handleReingestForce = async (sourceId: string, fetchWindow: DiscordFetchWindow, windowOption: MessageWindowOption = '7d') => {
    if (!window.confirm('Isso vai apagar todas as mensagens pendentes desta fonte e rebuscar tudo do Discord. Confirmar?')) return;
    setReingestingSourceId(sourceId);
    try {
      const result = await discordSyncApi.reingestForce(sourceId, fetchWindow);
      const draftsText = result.parse ? ` ${result.parse.succeeded} drafts criados/atualizados.` : '';
      toast.success(`Reidratado: ${result.deleted} apagadas, +${result.inserted} rebuscadas.${draftsText}`);
      setMessageSourceFilter(sourceId);
      setMessageWindowFilter(windowOption);
      setTab('mensagens');
      loadMessages({ sourceId, window: fetchWindow });
      loadSources();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reidratar.');
    } finally {
      setReingestingSourceId(null);
    }
  };

  const handleParseBatch = async () => {
    setParsingBatch(true);
    try {
      const result = await discordSyncApi.parseBatch();
      toast.success(`Apuração em lote: ${result.succeeded} criados, ${result.failed} com erro (total: ${result.processed}).`);
      loadMessages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na apuração em lote.');
    } finally {
      setParsingBatch(false);
    }
  };

  const handleSelectMessage = (message: DiscordMessage) => {
    setSelectedMessage(message);
    setContentDiagnostic(null);
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const tabClass = (t: PanelTab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h2 className="text-xl font-bold text-white">Discord Sync — Covil do Lich</h2>
      </div>

      <div className="flex gap-2 mb-6">
        <button className={tabClass('configuracao')} onClick={() => setTab('configuracao')}>Configuração</button>
        <button className={tabClass('fontes')} onClick={() => setTab('fontes')}>Fontes</button>
        <button className={tabClass('mensagens')} onClick={() => setTab('mensagens')}>Mensagens</button>
        <button className={tabClass('drafts')} onClick={() => setTab('drafts')}>Drafts</button>
      </div>

      {tab === 'configuracao' && (
        <DiscordSettingsPanel />
      )}

      {tab === 'fontes' && (
        <div>
          {loadingSources ? (
            <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>
          ) : (
            <DiscordSourceList
              sources={sources}
              onRefresh={loadSources}
              onFetchMessages={handleFetchMessages}
              fetchingSourceId={fetchingSourceId}
              onReingestForce={handleReingestForce}
              reingestingSourceId={reingestingSourceId}
            />
          )}
        </div>
      )}

      {tab === 'mensagens' && (
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={messageSourceFilter}
              onChange={e => setMessageSourceFilter(e.target.value)}
              className="app-select"
            >
              <option value="">Todas as fontes</option>
              {sources.map(source => (
                <option key={source.id} value={source.id}>{source.channel_name ?? source.channel_id}</option>
              ))}
            </select>
            <select
              value={messageWindowFilter}
              onChange={e => setMessageWindowFilter(e.target.value as MessageWindowOption)}
              className="app-select"
            >
              {MESSAGE_WINDOW_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={messageStatusFilter}
              onChange={e => setMessageStatusFilter(e.target.value as DiscordImportMessageStatus | '')}
              className="app-select"
            >
              <option value="">Todos os status</option>
              {(Object.keys(MESSAGE_STATUS_LABELS) as DiscordImportMessageStatus[]).map(s => (
                <option key={s} value={s}>{MESSAGE_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              onClick={() => loadMessages()}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
            >
              Recarregar
            </button>
            <button
              onClick={handleParseBatch}
              disabled={parsingBatch}
              className="px-3 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
            >
              {parsingBatch ? 'Apurando...' : '✦ Apurar todas pendentes'}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Pendentes</p>
              <p className="text-yellow-300 text-lg font-bold">{queueStats.pending}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Em revisão</p>
              <p className="text-orange-300 text-lg font-bold">{queueStats.review}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Conferidas</p>
              <p className="text-blue-300 text-lg font-bold">{queueStats.checked}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <p className="text-white/40 text-xs">Ignoradas</p>
              <p className="text-white/70 text-lg font-bold">{queueStats.ignored}</p>
            </div>
          </div>

          {loadingMessages ? (
            <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>
          ) : messages.length === 0 ? (
            <p className="text-white/40 text-sm py-4 text-center">Nenhuma mensagem encontrada.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
              <div className="space-y-2 lg:max-h-[68vh] lg:overflow-y-auto lg:pr-1">
              {messages.map(msg => (
                <button
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={`w-full text-left bg-white/5 border rounded-lg px-4 py-3 transition-colors hover:bg-white/[0.08] ${
                    selectedMessage?.id === msg.id ? 'border-blue-400/60' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${MESSAGE_STATUS_COLORS[msg.status]}`}>
                          {MESSAGE_STATUS_LABELS[msg.status]}
                        </span>
                        {msg.discord_thread_id && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-sky-900/40 text-sky-200 border border-sky-500/30">
                            Fórum: {msg.discord_thread_name ?? msg.discord_thread_id}
                          </span>
                        )}
                        <span className="text-white/40 text-xs">
                          {msg.discord_author_name ?? msg.discord_author_id ?? 'autor desconhecido'}
                        </span>
                        {msg.message_created_at && (
                          <span className="text-white/30 text-xs">
                            {new Date(msg.message_created_at).toLocaleString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <p className="text-white text-sm font-medium truncate">{getMessageTitle(msg)}</p>
                      {msg.content_raw.trim() && (
                        <p className="text-white/60 text-xs truncate mt-1">{getMessagePreview(msg).slice(0, 200)}</p>
                      )}
                      {didDiscordApiOmitBody(msg) && (
                        <p className="text-amber-200 text-xs mt-1">
                          Corpo não entregue pela API do Discord; apenas o título do tópico foi recebido.
                        </p>
                      )}
                      {msg.parse_error && (
                        <p className="text-red-400 text-xs mt-1">Erro: {msg.parse_error}</p>
                      )}
                    </div>
                    <span className="text-blue-400 text-xs shrink-0">{selectedMessage?.id === msg.id ? 'Aberta' : 'Apurar'}</span>
                  </div>
                </button>
              ))}
              </div>

              <aside ref={detailRef} className="bg-white/5 border border-white/10 rounded-lg p-4 min-h-[360px] lg:sticky lg:top-4">
                {selectedMessage ? (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-white font-semibold text-sm">Apuração da mensagem</h3>
                        <p className="text-white/40 text-xs mt-1">{selectedMessage.discord_message_id}</p>
                      </div>
                      {selectedMessage.discord_message_url && (
                        <a
                          href={selectedMessage.discord_message_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs shrink-0"
                        >
                          Ver no Discord
                        </a>
                      )}
                    </div>

                    <label className="flex flex-col gap-1 text-xs text-white/60">
                      Status
                      <select
                        value={selectedMessage.status}
                        onChange={(event) => handleUpdateMessageStatus(selectedMessage, event.target.value as DiscordImportMessageStatus)}
                        disabled={savingMessageStatus}
                        className="app-select w-full"
                      >
                        {(Object.keys(MESSAGE_STATUS_LABELS) as DiscordImportMessageStatus[]).map(status => (
                          <option key={status} value={status}>{MESSAGE_STATUS_LABELS[status]}</option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleParseMessage(selectedMessage)}
                        disabled={parsingMessageId === selectedMessage.id || selectedMessage.status === 'synced'}
                        className="px-3 py-2 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-40 bg-green-700 hover:bg-green-600"
                      >
                        {parsingMessageId === selectedMessage.id ? 'Criando draft...' : '✦ Criar Draft'}
                      </button>
                      {REVIEW_ACTIONS.map(action => (
                        <button
                          key={action.status}
                          onClick={() => handleUpdateMessageStatus(selectedMessage, action.status)}
                          disabled={savingMessageStatus || selectedMessage.status === action.status}
                          className={`px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors disabled:opacity-40 ${action.className}`}
                        >
                          {action.label}
                        </button>
                      ))}
                      {didDiscordApiOmitBody(selectedMessage) && (
                        <button
                          onClick={() => handleDiagnoseContent(selectedMessage)}
                          disabled={diagnosingMessageId === selectedMessage.id}
                          className="px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors disabled:opacity-40 bg-amber-700 hover:bg-amber-600"
                        >
                          {diagnosingMessageId === selectedMessage.id ? 'Diagnosticando...' : 'Diagnosticar corpo'}
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs text-white/50">
                      <div><span className="text-white/30">Post:</span> {getMessageTitle(selectedMessage)}</div>
                      <div><span className="text-white/30">Autor:</span> {selectedMessage.discord_author_name ?? selectedMessage.discord_author_id ?? 'autor desconhecido'}</div>
                      <div><span className="text-white/30">Data:</span> {selectedMessage.message_created_at ? new Date(selectedMessage.message_created_at).toLocaleString('pt-BR') : 'sem data'}</div>
                    </div>

                    <div>
                      <p className="text-xs text-white/60 mb-1">Conteúdo completo</p>
                      {didDiscordApiOmitBody(selectedMessage) && (
                        <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                          O post tem corpo no Discord, mas o bot recebeu `content` vazio pela API. Use o diagnóstico para confirmar se o problema está no Message Content Intent ou em permissões do canal/tópico.
                        </div>
                      )}
                      <textarea
                        readOnly
                        value={selectedMessage.content_raw.trim() ? selectedMessage.content_raw : getMessageTitle(selectedMessage)}
                        className="w-full min-h-[220px] resize-y bg-[#0F1A2E] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none"
                      />
                    </div>

                    {selectedMessage.parse_error && (
                      <p className="text-red-300 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2 text-xs">
                        {selectedMessage.parse_error}
                      </p>
                    )}

                    {contentDiagnostic && contentDiagnostic.discord_message_id === selectedMessage.discord_message_id && (
                      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70 space-y-1">
                        <p className="font-semibold text-white">Diagnóstico API Discord</p>
                        <p>DB content length: {contentDiagnostic.db_content_length}</p>
                        <p>API content length: {contentDiagnostic.api_content_length}</p>
                        <p>API embeds/anexos: {contentDiagnostic.api_embeds_count}/{contentDiagnostic.api_attachments_count}</p>
                        <p className={contentDiagnostic.likely_missing_message_content_intent ? 'text-amber-200' : 'text-green-300'}>
                          {contentDiagnostic.diagnosis}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-white/40 text-sm py-8 text-center">Selecione uma mensagem para conferir e apurar.</p>
                )}
              </aside>
            </div>
          )}
        </div>
      )}

      {tab === 'drafts' && (
        <DiscordDraftReviewTable />
      )}
    </div>
  );
}
