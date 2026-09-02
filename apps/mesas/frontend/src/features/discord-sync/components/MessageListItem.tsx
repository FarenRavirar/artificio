import type { DiscordMessage } from '../types';
import { MESSAGE_STATUS_LABELS, MESSAGE_STATUS_COLORS, getMessageTitle, getMessagePreview, didDiscordApiOmitBody } from '../hooks/useDiscordSync';

/**
 * Um card da lista de mensagens capturadas.
 *
 * Extraído do MessagesView (Sonar mediu complexidade cognitiva 37 no pai). O que é
 * regra e não layout: quem pode ser SELECIONADO depende do modo — na aba Ignoradas o
 * alvo são justamente as `ignored` (reprocessar/apagar), e a regra geral as excluía,
 * deixando a aba com os botões de lote e nenhum checkbox por linha (achado do CodeRabbit).
 */
type MessageListItemProps = Readonly<{
  message: DiscordMessage;
  modoIgnoradas: boolean;
  selecionada: boolean;
  aberta: boolean;
  onToggleSelecionada: (id: string) => void;
  onAbrir: (msg: DiscordMessage) => void;
}>;

export function MessageListItem({
  message,
  modoIgnoradas,
  selecionada,
  aberta,
  onToggleSelecionada,
  onAbrir,
}: MessageListItemProps) {
  const selecionavel = modoIgnoradas
    ? message.status === 'ignored'
    : message.status !== 'synced' && message.status !== 'ignored';

  return (
    <div className="flex items-start gap-2">
      {selecionavel && (
        <input
          type="checkbox"
          checked={selecionada}
          onChange={() => onToggleSelecionada(message.id)}
          aria-label={`Selecionar mensagem ${getMessageTitle(message)}`}
          className="h-4 w-4 mt-3 shrink-0 accent-blue-600"
        />
      )}
      <button
        onClick={() => onAbrir(message)}
        className={`flex-1 min-w-0 text-left bg-white/5 border rounded-lg px-4 py-3 transition-colors hover:bg-white/[0.08] ${
          aberta ? 'border-blue-400/60' : 'border-white/10'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs rounded-full ${MESSAGE_STATUS_COLORS[message.status]}`}>
                {MESSAGE_STATUS_LABELS[message.status]}
              </span>
              {message.discord_thread_id && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-sky-900/40 text-sky-200 border border-sky-500/30">
                  Fórum: {message.discord_thread_name ?? message.discord_thread_id}
                </span>
              )}
              <span className="text-white/40 text-xs">
                {message.discord_author_name ?? message.discord_author_id ?? 'autor desconhecido'}
              </span>
              {message.message_created_at && (
                <span className="text-white/30 text-xs">
                  {new Date(message.message_created_at).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
            <p className="text-white text-sm font-medium truncate">{getMessageTitle(message)}</p>
            {message.content_raw.trim() && (
              <p className="text-white/60 text-xs truncate mt-1">{getMessagePreview(message).slice(0, 200)}</p>
            )}
            {didDiscordApiOmitBody(message) && (
              <p className="text-amber-200 text-xs mt-1">
                Corpo não entregue pela API do Discord; apenas o título do tópico foi recebido.
              </p>
            )}
            {message.parse_error && (
              <p className="text-red-400 text-xs mt-1">Erro: {message.parse_error}</p>
            )}
          </div>
          <span className="text-blue-400 text-xs shrink-0">{aberta ? 'Aberta' : 'Revisar'}</span>
        </div>
      </button>
    </div>
  );
}
