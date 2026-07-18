import {
  Activity,
  CheckCircle,
  Circle,
  Edit,
  Lightbulb,
  Plus,
  Trash2,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityEntry } from '../types';
import { formatRelative } from '../utils/formatRelative';

type VisualConfig = {
  Icon: LucideIcon;
  color: string;
  bgColor: string;
};

function getActionVisual(action: string): VisualConfig {
  switch (action) {
    case 'user.registered':
      return { Icon: UserPlus, color: 'text-green-400', bgColor: 'bg-green-500/10' };
    case 'table.created':
      return { Icon: Plus, color: 'text-blue-400', bgColor: 'bg-blue-500/10' };
    case 'table.updated':
      return { Icon: Edit, color: 'text-amber-400', bgColor: 'bg-amber-500/10' };
    case 'table.deleted':
      return { Icon: Trash2, color: 'text-red-400', bgColor: 'bg-red-500/10' };
    case 'table.status_changed':
      return { Icon: Activity, color: 'text-cyan-400', bgColor: 'bg-cyan-500/10' };
    default:
      break;
  }

  if (action.endsWith('_suggestion.created')) {
    return { Icon: Lightbulb, color: 'text-purple-400', bgColor: 'bg-purple-500/10' };
  }

  if (action.endsWith('_suggestion.approved')) {
    return { Icon: CheckCircle, color: 'text-green-400', bgColor: 'bg-green-500/10' };
  }

  if (action.endsWith('_suggestion.rejected')) {
    return { Icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-500/10' };
  }

  return { Icon: Circle, color: 'text-white/40', bgColor: 'bg-white/5' };
}

interface ActivityItemProps {
  entry: ActivityEntry;
}

export function ActivityItem({ entry }: ActivityItemProps) {
  const { Icon, color, bgColor } = getActionVisual(entry.action);

  return (
    <li className="flex items-start gap-3 rounded-lg border border-white/10 bg-[var(--admin-surface)]/60 p-4 transition-colors hover:border-white/20">
      <div className={`shrink-0 rounded p-2 ${bgColor}`}>
        <Icon size={16} className={color} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-white">{entry.summary}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
          <span>
            <strong className="text-white/70">Evento:</strong>{' '}
            <code className="font-mono text-white/80">{entry.action}</code>
          </span>

          {entry.actor && (
            <span>
              <strong className="text-white/70">Quem fez:</strong> {entry.actor.name}
            </span>
          )}

          {entry.target_user && (
            <span>
              <strong className="text-white/70">Usuário afetado:</strong> {entry.target_user.name}
            </span>
          )}

          {entry.entity_label && (
            <span>
              <strong className="text-white/70">Entidade:</strong> {entry.entity_label}
            </span>
          )}
        </div>
      </div>

      <time
        className="shrink-0 tabular-nums text-xs text-white/40"
        title={new Date(entry.created_at).toLocaleString('pt-BR')}
        dateTime={entry.created_at}
      >
        {formatRelative(entry.created_at)}
      </time>
    </li>
  );
}
