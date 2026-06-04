import { Search, Plus, Filter } from 'lucide-react';
import type { System } from '../../../modules/admin/systems/types';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: Array<System['node_type']>;
  onTypeFilterChange: (types: Array<System['node_type']>) => void;
  onCreateRoot: () => void;
  resultsCount: number;
  totalCount?: number;
}

const TYPE_OPTIONS: Array<{ value: System['node_type']; label: string }> = [
  { value: 'system', label: 'Sistemas' },
  { value: 'edition', label: 'Edições' },
  { value: 'subsystem', label: 'Subsistemas' },
  { value: 'variant', label: 'Variantes' },
];

export function CatalogToolbar(props: Props) {
  const { search, onSearchChange, typeFilter, onTypeFilterChange, onCreateRoot, resultsCount, totalCount } = props;

  const toggleType = (type: System['node_type']) => {
    if (typeFilter.includes(type)) {
      onTypeFilterChange(typeFilter.filter(t => t !== type));
    } else {
      onTypeFilterChange([...typeFilter, type]);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-white/10 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome, slug ou alias..."
            className="w-full pl-10 pr-3 py-2 bg-[#0F1A2E] border border-white/10 rounded text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
        <button
          onClick={onCreateRoot}
          className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded inline-flex items-center gap-2 text-sm font-semibold"
          title="Criar sistema raiz"
        >
          <Plus size={16} />
          Novo
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Filter size={14} className="text-white/40" />
        <span className="text-xs text-white/40">Tipos:</span>
        {TYPE_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => toggleType(value)}
            className={[
              'px-2 py-1 rounded text-xs transition-colors',
              typeFilter.includes(value)
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
        {typeFilter.length > 0 && (
          <button
            onClick={() => onTypeFilterChange([])}
            className="ml-2 text-xs text-white/40 hover:text-white"
          >
            Limpar
          </button>
        )}
        <span className="ml-auto text-xs text-white/40">
          {typeof totalCount === 'number'
            ? `${resultsCount}/${totalCount} ${resultsCount === 1 ? 'resultado' : 'resultados'}`
            : `${resultsCount} ${resultsCount === 1 ? 'resultado' : 'resultados'}`}
        </span>
      </div>
    </div>
  );
}
