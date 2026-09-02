import type { DiscordMessage, DiscordImportMessageStatus, DiscordMessageContentDiagnostic } from '../types';
import { MESSAGE_STATUS_LABELS, REVIEW_ACTIONS, getMessageTitle, didDiscordApiOmitBody } from '../hooks/useDiscordSync';

/**
 * Painel lateral de apuração de UMA mensagem.
 *
 * Extraído do MessagesView (Sonar mediu complexidade cognitiva 37 no pai): esta região
 * sozinha carregava metade das ramificações de render, e nenhuma delas tem relação com
 * a lista à esquerda. Renderiza o vazio quando não há mensagem aberta.
 */
type MessageDetailPanelProps = Readonly<{
  message: DiscordMessage | null;
  savingStatus: boolean;
  parsingMessageId: string | null;
  diagnosingMessageId: string | null;
  contentDiagnostic: DiscordMessageContentDiagnostic | null;
  /**
   * Aba Ignoradas: esconde as ações que MUDAM o status ou criam draft.
   *
   * A aba é travada em `status=ignored`, então "Criar Draft", "Enviar para revisão",
   * "Marcar como conferida" e o seletor de status fazem a mensagem sair do próprio
   * filtro — ela some da lista no ato, sem que nada explique para onde foi, e o admin
   * perde o item que estava avaliando. As ações legítimas daqui são as mesmas do lote:
   * reprocessar (volta para a fila normal, deliberadamente) ou apagar. Achado do
   * CodeRabbit.
   */
  modoIgnoradas?: boolean;
  onUpdateStatus: (msg: DiscordMessage, status: DiscordImportMessageStatus) => void;
  onParse: (msg: DiscordMessage) => void;
  onDiagnose: (msg: DiscordMessage) => void;
}>;

export function MessageDetailPanel({
  message,
  savingStatus,
  parsingMessageId,
  diagnosingMessageId,
  contentDiagnostic,
  modoIgnoradas = false,
  onUpdateStatus,
  onParse,
  onDiagnose,
}: MessageDetailPanelProps) {
  if (!message) {
    return <p className="text-white/40 text-sm py-8 text-center">Selecione uma mensagem para conferir e apurar.</p>;
  }

  // O corpo omitido pela API muda TRÊS coisas na tela (aviso, botão de diagnóstico e
  // texto do textarea), então vale medir uma vez só.
  const corpoOmitido = didDiscordApiOmitBody(message);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold text-sm">Apuração da mensagem</h3>
          <p className="text-white/40 text-xs mt-1">{message.discord_message_id}</p>
        </div>
        {message.discord_message_url && (
          <a
            href={message.discord_message_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 text-xs shrink-0"
          >
            Ver no Discord
          </a>
        )}
      </div>

      {modoIgnoradas ? (
        <p className="text-xs text-white/50">
          Mensagem ignorada. Use <strong className="text-white/70">Reprocessar</strong> para
          devolvê-la à fila, ou <strong className="text-white/70">Apagar</strong> para removê-la
          do banco.
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-xs text-white/60">
          Status
          <select
            value={message.status}
            onChange={(event) => onUpdateStatus(message, event.target.value as DiscordImportMessageStatus)}
            disabled={savingStatus}
            className="app-select w-full"
          >
            {(Object.keys(MESSAGE_STATUS_LABELS) as DiscordImportMessageStatus[]).map(status => (
              <option key={status} value={status}>{MESSAGE_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {!modoIgnoradas && (
          <>
            <button
              onClick={() => onParse(message)}
              disabled={parsingMessageId === message.id || message.status === 'synced'}
              className="px-3 py-2 rounded-lg text-white text-xs font-bold transition-colors disabled:opacity-40 bg-green-700 hover:bg-green-600"
            >
              {parsingMessageId === message.id ? 'Criando draft...' : '✦ Criar Draft'}
            </button>
            {REVIEW_ACTIONS.map(action => (
              <button
                key={action.status}
                onClick={() => onUpdateStatus(message, action.status)}
                disabled={savingStatus || message.status === action.status}
                className={`px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors disabled:opacity-40 ${action.className}`}
              >
                {action.label}
              </button>
            ))}
          </>
        )}
        {/* Diagnóstico continua nos DOIS modos: é leitura, não muda status nenhum, e
            saber por que o corpo veio vazio é justamente o que explica a mensagem ter
            sido ignorada. */}
        {corpoOmitido && (
          <button
            onClick={() => onDiagnose(message)}
            disabled={diagnosingMessageId === message.id}
            className="px-3 py-2 rounded-lg text-white text-xs font-medium transition-colors disabled:opacity-40 bg-amber-700 hover:bg-amber-600"
          >
            {diagnosingMessageId === message.id ? 'Diagnosticando...' : 'Diagnosticar corpo'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 text-xs text-white/50">
        <div><span className="text-white/30">Post:</span> {getMessageTitle(message)}</div>
        <div><span className="text-white/30">Autor:</span> {message.discord_author_name ?? message.discord_author_id ?? 'autor desconhecido'}</div>
        <div><span className="text-white/30">Data:</span> {message.message_created_at ? new Date(message.message_created_at).toLocaleString('pt-BR') : 'sem data'}</div>
      </div>

      <div>
        <p className="text-xs text-white/60 mb-1">Conteúdo completo</p>
        {corpoOmitido && (
          <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            O post tem corpo no Discord, mas o bot recebeu `content` vazio pela API. Use o diagnóstico para confirmar se o problema está no Message Content Intent ou em permissões do canal/tópico.
          </div>
        )}
        <textarea
          readOnly
          value={message.content_raw.trim() ? message.content_raw : getMessageTitle(message)}
          className="w-full min-h-[220px] resize-y bg-[var(--surface-input)] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none"
        />
      </div>

      {message.parse_error && (
        <p className="text-red-300 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2 text-xs">
          {message.parse_error}
        </p>
      )}

      {contentDiagnostic && contentDiagnostic.discord_message_id === message.discord_message_id && (
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
  );
}
