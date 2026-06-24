import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import type { DiscordFetchWindow, DiscordSource, DiscordMessage, DiscordImportMessageStatus, DiscordMessageContentDiagnostic } from '../types';
import { discordSyncApi } from '../api/discordSyncApi';

export const MESSAGE_STATUS_LABELS: Record<DiscordImportMessageStatus, string> = {
  pending: 'Pendente',
  parsed: 'Parseada',
  needs_review: 'Revisar',
  synced: 'Sincronizada',
  ignored: 'Ignorada',
  error: 'Erro',
};

export const MESSAGE_STATUS_COLORS: Record<DiscordImportMessageStatus, string> = {
  pending: 'bg-yellow-700/40 text-yellow-300',
  parsed: 'bg-blue-700/40 text-blue-300',
  needs_review: 'bg-orange-700/40 text-orange-300',
  synced: 'bg-green-700/40 text-green-300',
  ignored: 'bg-white/10 text-white/40',
  error: 'bg-red-700/40 text-red-300',
};

export type PanelTab = 'configuracao' | 'fontes' | 'mensagens' | 'drafts' | 'import-json';

export const REVIEW_ACTIONS: Array<{ status: DiscordImportMessageStatus; label: string; className: string }> = [
  { status: 'needs_review', label: 'Mandar para revisão', className: 'bg-orange-600 hover:bg-orange-700' },
  { status: 'parsed', label: 'Marcar conferida', className: 'bg-blue-600 hover:bg-blue-700' },
  { status: 'ignored', label: 'Ignorar', className: 'bg-white/10 hover:bg-white/20' },
];

export const MESSAGE_WINDOW_OPTIONS = [
  { value: '24h', label: 'Últimas 24h', days: 1 },
  { value: '7d', label: 'Últimos 7 dias', days: 7 },
  { value: '30d', label: 'Últimos 30 dias', days: 30 },
  { value: '90d', label: 'Últimos 90 dias', days: 90 },
  { value: 'all', label: 'Sem limite', days: null },
] as const;

export type MessageWindowOption = (typeof MESSAGE_WINDOW_OPTIONS)[number]['value'];

export function buildMessageWindow(value: MessageWindowOption): DiscordFetchWindow {
  const option = MESSAGE_WINDOW_OPTIONS.find((item) => item.value === value);
  if (!option?.days) return {};
  const since = new Date();
  since.setDate(since.getDate() - option.days);
  return { since: since.toISOString(), until: new Date().toISOString() };
}

export function getMessageTitle(message: DiscordMessage): string {
  if (message.discord_thread_name) return message.discord_thread_name;
  const content = message.content_raw.trim();
  if (content) return content.split('\n').find(Boolean) ?? content;
  return 'Mensagem sem título';
}

export function getMessagePreview(message: DiscordMessage): string {
  const content = message.content_raw.trim();
  if (content) return content;
  if (message.discord_thread_name) return message.discord_thread_name;
  return 'Mensagem sem texto disponível.';
}

export function didDiscordApiOmitBody(message: DiscordMessage): boolean {
  return Boolean(message.discord_thread_id && message.discord_thread_name && !message.content_raw.trim());
}

export function useDiscordSync() {
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
  const loadMessagesAbortRef = useRef<AbortController | null>(null);

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
    if (loadMessagesAbortRef.current) {
      loadMessagesAbortRef.current.abort();
    }
    const controller = new AbortController();
    loadMessagesAbortRef.current = controller;

    setLoadingMessages(true);
    try {
      const data = await discordSyncApi.getMessages({
        source_id: override?.sourceId ?? (messageSourceFilter || undefined),
        status: messageStatusFilter || undefined,
        ...(override?.window ?? buildMessageWindow(messageWindowFilter)),
        limit: 100,
      }, { signal: controller.signal });
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
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
    if (!globalThis.confirm('Isso vai apagar todas as mensagens pendentes desta fonte e rebuscar tudo do Discord. Confirmar?')) return;
    setReingestingSourceId(sourceId);
    try {
      const result = await discordSyncApi.reingestForce(sourceId, fetchWindow);
      const draftsText = result.parse ? ` ${result.parse.succeeded} drafts criados/atualizados.` : '';
      toast.success(`Reidratado: ${result.deleted} apagadas, +${result.inserted} rebuscadas.${draftsText}`);
      setMessageSourceFilter(sourceId);
      setMessageWindowFilter(windowOption);
      setTab('mensagens');
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
    globalThis.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  return {
    tab, setTab,
    sources, messages,
    loadingSources, loadingMessages,
    fetchingSourceId, reingestingSourceId,
    parsingBatch, parsingMessageId,
    savingMessageStatus, diagnosingMessageId,
    messageStatusFilter, setMessageStatusFilter,
    messageSourceFilter, setMessageSourceFilter,
    messageWindowFilter, setMessageWindowFilter,
    selectedMessage, contentDiagnostic,
    detailRef, queueStats,
    loadSources, loadMessages,
    handleFetchMessages, handleUpdateMessageStatus,
    handleParseMessage, handleDiagnoseContent,
    handleReingestForce, handleParseBatch,
    handleSelectMessage, setSelectedMessage,
  };
}
