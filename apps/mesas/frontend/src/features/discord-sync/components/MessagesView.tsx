import type { DiscordImportMessageStatus } from '../types';
import { useDiscordSync, MESSAGE_STATUS_LABELS, MESSAGE_STATUS_COLORS, REVIEW_ACTIONS, getMessageTitle, getMessagePreview, didDiscordApiOmitBody } from '../hooks/useDiscordSync';
import { MessagesToolbar } from './MessagesToolbar';

/**
 * MessagesView — Painel de mensagens capturadas (entidade discord_import_messages).
 *
 * Extraído do DiscordSyncPanel (linhas 69-247) na Fase 2 da spec 054.
 * Instancia useDiscordSync() próprio — independente do hook usado por DiscordSourceList.
 * Aceitável: cada seção instancia seu próprio hook (sources buscado 2x).
 */
type MessagesViewProps = Readonly<{
  /**
   * Trava a view num status (spec 099). Com `'ignored'` a aba deixa de ser
   * "apurar mensagens brutas" e vira "o que o parser recusou": a barra de lote
   * troca ignorar por reprocessar/apagar, porque re-ignorar o que já está
   * ignorado não é ação. Mesmo padrão do `lockedStatus` da aba Descartados.
   */
  lockedStatus?: 'ignored';
}>;

export function MessagesView({ lockedStatus }: MessagesViewProps = {}) {
  const {
    sources, messages,
    loadingMessages,
    parsingBatch, parsingMessageId,
    savingMessageStatus, diagnosingMessageId,
    messageStatusFilter, setMessageStatusFilter,
    messageSourceFilter, setMessageSourceFilter,
    messageWindowFilter, setMessageWindowFilter,
    selectedMessage, contentDiagnostic,
    detailRef, queueStats,
    selectedMessageIds, ignoringBatch, ignorableMessages, selectedIgnorable,
    ignoredMessages, selectedIgnored, toggleSelectAllIgnored,
    handleReprocessSelectedMessages, handleDeleteSelectedMessages,
    toggleMessageSelected, toggleSelectAllMessages, handleIgnoreSelectedMessages,
    loadMessages,
    handleUpdateMessageStatus,
    handleParseMessage, handleDiagnoseContent,
    handleParseBatch,
    handleSelectMessage,
  } = useDiscordSync(lockedStatus);

  const modoIgnoradas = lockedStatus === 'ignored';
  // A lista da barra de lote muda com o modo: na aba normal são as ainda
  // pendentes de decisão; na de ignoradas, exatamente as recusadas.
  const selecionaveis = modoIgnoradas ? ignoredMessages : ignorableMessages;
  const selecionadas = modoIgnoradas ? selectedIgnored : selectedIgnorable;
  const alternarTodas = modoIgnoradas ? toggleSelectAllIgnored : toggleSelectAllMessages;
  const allMessagesSelected = selecionaveis.length > 0 && selecionaveis.every(m => selectedMessageIds.has(m.id));



  return (
    <div>
      <MessagesToolbar
        sources={sources}
        messageSourceFilter={messageSourceFilter}
        messageWindowFilter={messageWindowFilter}
        messageStatusFilter={messageStatusFilter}
        parsingBatch={parsingBatch}
        queueStats={queueStats}
        onSourceFilterChange={setMessageSourceFilter}
        onWindowFilterChange={setMessageWindowFilter}
        onStatusFilterChange={setMessageStatusFilter}
        hideStatusFilter={modoIgnoradas}
        onReload={() => loadMessages()}
        onParseBatch={handleParseBatch}
      />

      {/* Barra de seleção em lote */}
      {selecionaveis.length > 0 && (
        <div className="flex items-center gap-3 my-3 flex-wrap">
          <label className="flex items-center gap-2 text-white/60 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allMessagesSelected}
              onChange={alternarTodas}
              aria-label="Selecionar todas as mensagens"
              className="h-4 w-4 accent-blue-600"
            />
            Selecionar todas ({selecionaveis.length})
          </label>
          {selecionadas.length > 0 && (
            <>
              <span className="text-white/40 text-sm">{selecionadas.length} selecionada(s)</span>
              {modoIgnoradas ? (
                <>
                  <button
                    type="button"
                    onClick={handleReprocessSelectedMessages}
                    disabled={ignoringBatch}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {ignoringBatch ? 'Reprocessando...' : `✦ Reprocessar (${selecionadas.length})`}
                  </button>
                  {/* Destrutivo em vermelho e por último: some do banco, e é o
                      que libera o JSON original para ser reimportado. */}
                  <button
                    type="button"
                    onClick={handleDeleteSelectedMessages}
                    disabled={ignoringBatch}
                    className="px-4 py-2 bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)] hover:opacity-80 text-sm rounded-lg transition-opacity disabled:opacity-50"
                  >
                    {ignoringBatch ? 'Apagando...' : `Apagar (${selecionadas.length})`}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleIgnoreSelectedMessages}
                  disabled={ignoringBatch}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  {ignoringBatch ? 'Ignorando...' : `Ignorar selecionadas (${selecionadas.length})`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {loadingMessages ? (
        <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>
      ) : messages.length === 0 ? (
        <p className="text-white/40 text-sm py-4 text-center">Nenhuma mensagem encontrada.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
          <div className="space-y-2 lg:max-h-[68vh] lg:overflow-y-auto lg:pr-1">
          {messages.map(msg => {
            // Quem pode ser selecionado depende do MODO: na aba Ignoradas o alvo são
            // justamente as `ignored` (reprocessar/apagar), e a regra geral as excluía —
            // a aba ficava com os botões de lote e nenhum checkbox por linha, só o
            // "selecionar todas". Achado do CodeRabbit.
            const selecionavel = modoIgnoradas
              ? msg.status === 'ignored'
              : msg.status !== 'synced' && msg.status !== 'ignored';
            return (
            <div key={msg.id} className="flex items-start gap-2">
              {selecionavel && (
                <input
                  type="checkbox"
                  checked={selectedMessageIds.has(msg.id)}
                  onChange={() => toggleMessageSelected(msg.id)}
                  aria-label={`Selecionar mensagem ${getMessageTitle(msg)}`}
                  className="h-4 w-4 mt-3 shrink-0 accent-blue-600"
                />
              )}
            <button
              onClick={() => handleSelectMessage(msg)}
              className={`flex-1 min-w-0 text-left bg-white/5 border rounded-lg px-4 py-3 transition-colors hover:bg-white/[0.08] ${
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
                <span className="text-blue-400 text-xs shrink-0">{selectedMessage?.id === msg.id ? 'Aberta' : 'Revisar'}</span>
              </div>
            </button>
            </div>
            );
          })}
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
                    className="w-full min-h-[220px] resize-y bg-[var(--surface-input)] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none"
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
  );
}
