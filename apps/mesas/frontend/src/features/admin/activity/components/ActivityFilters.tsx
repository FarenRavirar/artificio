import { Filter } from 'lucide-react';
import type { ActivityFeedResponse, ActivityFiltersState } from '../types';

interface ActivityFiltersProps {
  filters: ActivityFiltersState;
  filtersMeta: ActivityFeedResponse['filters_meta'];
  onChange: (next: ActivityFiltersState) => void;
  onClear: () => void;
}

type ActionGroup = {
  id: string;
  label: string;
  actions: string[];
};

const ACTION_LABELS: Record<string, string> = {
  'user.registered': 'Novos cadastros',
  'table.created': 'Novas mesas',
  'table.updated': 'Edições de mesa',
  'table.deleted': 'Exclusões de mesa',
  'table.status_changed': 'Mudanças de status',
  'system_suggestion.created': 'Sugestões de sistemas',
  'scenario_suggestion.created': 'Sugestões de cenários',
  'system_suggestion.approved': 'Sistemas aprovados',
  'system_suggestion.rejected': 'Sistemas rejeitados',
  'scenario_suggestion.approved': 'Cenários aprovados',
  'scenario_suggestion.rejected': 'Cenários rejeitados',
};

const ACTION_GROUPS: ActionGroup[] = [
  {
    id: 'users',
    label: 'Usuários',
    actions: ['user.registered'],
  },
  {
    id: 'tables',
    label: 'Mesas',
    actions: ['table.created', 'table.updated', 'table.deleted', 'table.status_changed'],
  },
  {
    id: 'suggestions',
    label: 'Sugestões',
    actions: ['system_suggestion.created', 'scenario_suggestion.created'],
  },
  {
    id: 'moderation',
    label: 'Moderação',
    actions: [
      'system_suggestion.approved',
      'system_suggestion.rejected',
      'scenario_suggestion.approved',
      'scenario_suggestion.rejected',
    ],
  },
];

const INPUT_CLASS =
  'rounded border border-white/10 bg-[var(--admin-surface)] px-3 py-2 text-sm text-white focus:border-[var(--color-artificio-orange)] focus:outline-none';

function labelForAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function ActivityFilters({ filters, filtersMeta, onChange, onClear }: ActivityFiltersProps) {
  const selectedActionsSet = new Set(filters.actions);

  const actionPool = new Set<string>([
    ...Object.keys(ACTION_LABELS),
    ...filtersMeta.available_actions,
    ...filters.actions,
  ]);

  const grouped = ACTION_GROUPS.map((group) => ({
    ...group,
    actions: group.actions.filter((action) => actionPool.has(action)),
  }));

  const groupedActionSet = new Set(grouped.flatMap((group) => group.actions));

  const otherActions = Array.from(actionPool)
    .filter((action) => !groupedActionSet.has(action))
    .sort((a, b) => a.localeCompare(b));

  const handleSearchChange = (value: string) => {
    onChange({ ...filters, search: value });
  };

  const handleActionsChange = (selected: string[]) => {
    onChange({ ...filters, actions: selected });
  };

  const handleAreaToggle = (group: ActionGroup) => {
    if (group.actions.length === 0) {
      return;
    }

    const allSelected = group.actions.every((action) => selectedActionsSet.has(action));

    if (allSelected) {
      const remaining = filters.actions.filter((action) => !group.actions.includes(action));
      handleActionsChange(remaining);
      return;
    }

    const merged = new Set([...filters.actions, ...group.actions]);
    handleActionsChange(Array.from(merged));
  };

  const handleSelectAllActions = () => {
    handleActionsChange([]);
  };

  const handleActorChange = (value: string) => {
    onChange({ ...filters, actor_id: value || null });
  };

  const handleTargetChange = (value: string) => {
    onChange({ ...filters, target_user_id: value || null });
  };

  const handleDateFromChange = (value: string) => {
    onChange({ ...filters, date_from: value || null });
  };

  const handleDateToChange = (value: string) => {
    onChange({ ...filters, date_to: value || null });
  };

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-[var(--admin-surface)]/40 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
        <Filter size={14} />
        Filtros
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-white/70" htmlFor="activity-filter-search">
          Busca
          <input
            id="activity-filter-search"
            type="text"
            value={filters.search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Termo, usuário, ação..."
            className={INPUT_CLASS}
          />
        </label>

        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-white/70" htmlFor="activity-filter-actions">
            Tipo de evento
          </label>

          <select
            id="activity-filter-actions"
            multiple
            value={filters.actions}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
              handleActionsChange(selected);
            }}
            className="app-select min-h-[132px] w-full"
          >
            {grouped.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.actions.map((action) => (
                  <option key={action} value={action}>
                    {labelForAction(action)}
                  </option>
                ))}
              </optgroup>
            ))}

            {otherActions.length > 0 && (
              <optgroup label="Outros">
                {otherActions.map((action) => (
                  <option key={action} value={action}>
                    {labelForAction(action)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              key="activity-group-all"
              id="activity-group-all"
              type="button"
              onClick={handleSelectAllActions}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filters.actions.length === 0
                  ? 'border-[var(--color-artificio-orange)] bg-[var(--color-artificio-orange)]/20 text-[var(--color-artificio-orange)]'
                  : 'border-white/15 bg-white/5 text-white/60 hover:border-white/30 hover:text-white'
              }`}
            >
              Todos
            </button>

            {grouped.map((group) => {
              const hasAny = group.actions.length > 0;
              const active = hasAny && group.actions.some((action) => selectedActionsSet.has(action));

              return (
                <button
                  key={`activity-group-${group.id}`}
                  id={`activity-group-${group.id}`}
                  type="button"
                  onClick={() => handleAreaToggle(group)}
                  disabled={!hasAny}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    active
                      ? 'border-[var(--color-artificio-orange)] bg-[var(--color-artificio-orange)]/20 text-[var(--color-artificio-orange)]'
                      : 'border-white/15 bg-white/5 text-white/60 hover:border-white/30 hover:text-white'
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-xs text-white/70" htmlFor="activity-filter-actor">
          Quem fez
          <select
            id="activity-filter-actor"
            value={filters.actor_id ?? ''}
            onChange={(event) => handleActorChange(event.target.value)}
            className="app-select w-full"
          >
            <option value="">Todos</option>
            {filtersMeta.actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-white/70" htmlFor="activity-filter-target">
          Usuário afetado
          <select
            id="activity-filter-target"
            value={filters.target_user_id ?? ''}
            onChange={(event) => handleTargetChange(event.target.value)}
            className="app-select w-full"
          >
            <option value="">Todos</option>
            {filtersMeta.target_users.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-white/70" htmlFor="activity-filter-date-from">
          Data inicial
          <input
            id="activity-filter-date-from"
            type="date"
            value={filters.date_from ?? ''}
            onChange={(event) => handleDateFromChange(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-white/70" htmlFor="activity-filter-date-to">
          Data final
          <input
            id="activity-filter-date-to"
            type="date"
            value={filters.date_to ?? ''}
            onChange={(event) => handleDateToChange(event.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button
          id="activity-filter-clear"
          type="button"
          onClick={onClear}
          className="text-xs text-white/50 transition-colors hover:text-white"
        >
          Limpar filtros
        </button>
      </div>
    </div>
  );
}
