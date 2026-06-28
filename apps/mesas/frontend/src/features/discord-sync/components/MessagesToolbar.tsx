import { MESSAGE_STATUS_LABELS, MESSAGE_WINDOW_OPTIONS } from '../hooks/useDiscordSync';
import type { DiscordSource, DiscordImportMessageStatus } from '../types';
import type { MessageWindowOption } from '../hooks/useDiscordSync';
import { StatCard } from './StatCard';

interface MessagesToolbarProps {
  readonly sources: DiscordSource[];
  readonly messageSourceFilter: string;
  readonly messageWindowFilter: MessageWindowOption;
  readonly messageStatusFilter: DiscordImportMessageStatus | '';
  readonly parsingBatch: boolean;
  readonly queueStats: { pending: number; review: number; checked: number; ignored: number };
  readonly onSourceFilterChange: (value: string) => void;
  readonly onWindowFilterChange: (value: MessageWindowOption) => void;
  readonly onStatusFilterChange: (value: DiscordImportMessageStatus | '') => void;
  readonly onReload: () => void;
  readonly onParseBatch: () => void;
}

export function MessagesToolbar({
  sources, messageSourceFilter, messageWindowFilter, messageStatusFilter,
  parsingBatch, queueStats,
  onSourceFilterChange, onWindowFilterChange, onStatusFilterChange,
  onReload, onParseBatch,
}: MessagesToolbarProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={messageSourceFilter}
          onChange={e => onSourceFilterChange(e.target.value)}
          aria-label="Filtrar por fonte"
          className="app-select"
        >
          <option value="">Todas as fontes</option>
          {sources.map(source => (
            <option key={source.id} value={source.id}>{source.channel_name ?? source.channel_id}</option>
          ))}
        </select>
        <select
          value={messageWindowFilter}
          onChange={e => onWindowFilterChange(e.target.value as MessageWindowOption)}
          aria-label="Filtrar por janela de mensagens"
          className="app-select"
        >
          {MESSAGE_WINDOW_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select
          value={messageStatusFilter}
          onChange={e => onStatusFilterChange(e.target.value as DiscordImportMessageStatus | '')}
          aria-label="Filtrar por status"
          className="app-select"
        >
          <option value="">Todos os status</option>
          {(Object.keys(MESSAGE_STATUS_LABELS) as DiscordImportMessageStatus[]).map(s => (
            <option key={s} value={s}>{MESSAGE_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button
          onClick={onReload}
          className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
        >
          Recarregar
        </button>
        <button
          onClick={onParseBatch}
          disabled={parsingBatch}
          className="px-3 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
        >
          {parsingBatch ? 'Revisando...' : '✦ Revisar pendências'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        <StatCard label="Pendentes" value={queueStats.pending} valueClassName="text-yellow-300 text-lg font-bold" />
        <StatCard label="Em revisão" value={queueStats.review} valueClassName="text-orange-300 text-lg font-bold" />
        <StatCard label="Conferidas" value={queueStats.checked} valueClassName="text-blue-300 text-lg font-bold" />
        <StatCard label="Ignoradas" value={queueStats.ignored} valueClassName="text-white/70 text-lg font-bold" />
      </div>
    </div>
  );
}
