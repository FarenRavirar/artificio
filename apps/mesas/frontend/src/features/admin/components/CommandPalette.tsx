import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { System } from '../../../modules/admin/systems/types';

interface Props {
  systems: System[];
  onSelect: (id: string) => void;
  onCreateRoot: () => void;
}

type FlatItem = {
  id: string;
  label: string;
  subtitle: string;
};

export function CommandPalette({ systems, onSelect, onCreateRoot }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(prev => !prev);
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const items = useMemo<FlatItem[]>(() => {
    const list: FlatItem[] = [];

    const walk = (nodes: System[], trail: string[] = []) => {
      for (const node of nodes) {
        const path = [...trail, node.name];
        list.push({
          id: node.id,
          label: node.name,
          subtitle: path.join(' › '),
        });
        if (node.children?.length) {
          walk(node.children, path);
        }
      }
    };

    walk(systems);
    return list;
  }, [systems]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items.slice(0, 8);
    return items
      .filter(item => item.label.toLowerCase().includes(term) || item.subtitle.toLowerCase().includes(term))
      .slice(0, 8);
  }, [items, query]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setQuery('');
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm p-4">
      <div className="mx-auto w-full max-w-xl rounded-lg border border-white/10 bg-[#0B1220] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Search size={16} className="text-white/40" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar sistema..."
            className="w-full bg-transparent text-sm text-white outline-none"
          />
          <button
            onClick={onCreateRoot}
            className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
          >
            Novo raiz
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-sm text-white/50">Sem resultados.</p>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="w-full rounded px-2 py-2 text-left hover:bg-white/10"
              >
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-white/50">{item.subtitle}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
