import { SORT_OPTIONS } from '../utils/catalogFilterOptions';

interface ResultsHeaderProps {
  count: number;
  sort: string;
  onSortChange: (value: string) => void;
  isLoading: boolean;
  hasMore: boolean;
}

export function ResultsHeader({ count, sort, onSortChange, isLoading, hasMore }: ResultsHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-white/10">
      {/* Contador */}
      <div className="text-sm">
        {isLoading ? (
          <span className="text-white/50">Carregando...</span>
        ) : (
          <span className="font-semibold text-white">
            {count}{hasMore ? '+' : ''} {count === 1 ? 'mesa encontrada' : 'mesas encontradas'}
          </span>
        )}
      </div>

      {/* Ordenação — lista final de sorts vem da fonte única (D0.4/R6/R13). */}
      <div className="flex items-center gap-2">
        <label htmlFor="sort-select" className="text-sm text-white/70 whitespace-nowrap">
          Ordenar por:
        </label>
        <select
          id="sort-select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="app-select"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
