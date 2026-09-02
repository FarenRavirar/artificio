import { useDiscordSync } from '../hooks/useDiscordSync';
import { MessagesToolbar } from './MessagesToolbar';
import { MessagesBatchBar } from './MessagesBatchBar';
import { MessageListItem } from './MessageListItem';
import { MessageDetailPanel } from './MessageDetailPanel';

/**
 * MessagesView — Painel de mensagens capturadas (entidade discord_import_messages).
 *
 * Extraído do DiscordSyncPanel (linhas 69-247) na Fase 2 da spec 054.
 * Instancia useDiscordSync() próprio — independente do hook usado por DiscordSourceList.
 * Aceitável: cada seção instancia seu próprio hook (sources buscado 2x).
 *
 * Hoje é só composição: a barra de lote, o card da lista e o painel de detalhe vivem em
 * componentes próprios. Estavam todos inline aqui, e o Sonar mediu complexidade
 * cognitiva 37 — a ramificação era de RENDER (ternária e `&&` por região), não de
 * lógica, e por isso saiu inteira ao separar as regiões, sem mudar comportamento.
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
    // `tabInicial: 'mensagens'` porque ESTA view já é a de mensagens: o hook nasce fora
    // do painel de abas e ninguém trocaria a `tab` para destravar os efeitos de carga.
  } = useDiscordSync({ statusInicial: lockedStatus, tabInicial: 'mensagens' });

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

      <MessagesBatchBar
        selecionaveis={selecionaveis}
        selecionadas={selecionadas}
        todasSelecionadas={allMessagesSelected}
        modoIgnoradas={modoIgnoradas}
        ocupado={ignoringBatch}
        onAlternarTodas={alternarTodas}
        onIgnorar={handleIgnoreSelectedMessages}
        onReprocessar={handleReprocessSelectedMessages}
        onApagar={handleDeleteSelectedMessages}
      />

      {loadingMessages && <p className="text-white/40 text-sm py-4 text-center">Carregando...</p>}
      {!loadingMessages && messages.length === 0 && (
        <p className="text-white/40 text-sm py-4 text-center">Nenhuma mensagem encontrada.</p>
      )}
      {!loadingMessages && messages.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
          <div className="space-y-2 lg:max-h-[68vh] lg:overflow-y-auto lg:pr-1">
            {messages.map(msg => (
              <MessageListItem
                key={msg.id}
                message={msg}
                modoIgnoradas={modoIgnoradas}
                selecionada={selectedMessageIds.has(msg.id)}
                aberta={selectedMessage?.id === msg.id}
                onToggleSelecionada={toggleMessageSelected}
                onAbrir={handleSelectMessage}
              />
            ))}
          </div>

          <aside ref={detailRef} className="bg-white/5 border border-white/10 rounded-lg p-4 min-h-[360px] lg:sticky lg:top-4">
            <MessageDetailPanel
              message={selectedMessage}
              savingStatus={savingMessageStatus}
              parsingMessageId={parsingMessageId}
              diagnosingMessageId={diagnosingMessageId}
              contentDiagnostic={contentDiagnostic}
              modoIgnoradas={modoIgnoradas}
              onUpdateStatus={handleUpdateMessageStatus}
              onParse={handleParseMessage}
              onDiagnose={handleDiagnoseContent}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
