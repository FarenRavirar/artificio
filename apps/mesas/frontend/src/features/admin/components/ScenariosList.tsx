import { Trash2, Plus, Search } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  name_pt?: string | null;
  slug: string;
  aliases?: string[];
  tables_count?: number;
}

interface Props {
  scenarios: Scenario[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string, name: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function ScenariosList({ scenarios, selectedId, onSelect, onCreate, onDelete, search, onSearchChange }: Props) {
  const filtered = scenarios.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) ||
      (s.name_pt ?? '').toLowerCase().includes(q) ||
      (s.aliases ?? []).some(a => a.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="flex-1 text-sm font-semibold text-white">Cenários ({filtered.length})</h3>
          <button
            onClick={onCreate}
            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded inline-flex items-center gap-1 text-sm"
          >
            <Plus size={14} />
            Novo
          </button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome ou alias..."
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-white/40">
            <p>Nenhum cenário encontrado.</p>
          </div>
        ) : (
          <ul>
            {filtered.map(scenario => (
              <li
                key={scenario.id}
                onClick={() => onSelect(scenario.id)}
                className={[
                  'group px-4 py-3 cursor-pointer border-b border-white/5 transition-colors',
                  selectedId === scenario.id
                    ? 'bg-blue-500/15 border-l-2 border-l-blue-500'
                    : 'hover:bg-white/5 border-l-2 border-l-transparent',
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{scenario.name}</span>
                      {scenario.name_pt && (
                        <span className="text-xs text-white/40 truncate">· {scenario.name_pt}</span>
                      )}
                    </div>
                    {(scenario.aliases ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {scenario.aliases!.slice(0, 3).map((alias, i) => (
                          <span key={i} className="text-xs text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                            {alias}
                          </span>
                        ))}
                        {scenario.aliases!.length > 3 && (
                          <span className="text-xs text-white/40">+{scenario.aliases!.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {(scenario.tables_count ?? 0) > 0 && (
                    <span className="text-xs text-white/40 font-mono">{scenario.tables_count}m</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(scenario.id, scenario.name); }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-white/50 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
