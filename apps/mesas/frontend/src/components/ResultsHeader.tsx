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

      {/* Ordenação */}
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
          <option value="popular">Mais relevantes</option>
          <option value="recent">Mais recentes</option>
          <option value="slots">Mais vagas</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
        </select>
      </div>
    </div>
  );
}
