import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { SystemTreeNode } from '../../../types/systems';

interface SystemSearchSelectProps {
  systems: SystemTreeNode[];
  value: string;
  loading: boolean;
  onChange: (systemId: string) => void;
}

const normalizeText = (value: string): string => value.trim().toLowerCase();

/**
 * Fase D (spec 058): combobox com busca pra troca do `<select>` nativo de sistema
 * no editor de draft. `systems` já vem achatado (flattenSystems) — só filtra por
 * nome/nome_pt/alias e mostra lista curta, sem a árvore de 3 colunas do
 * SystemTreeSelector (pensado pro form completo de criação de mesa, não pra este
 * editor compacto).
 */
export function SystemSearchSelect({ systems, value, loading, onChange }: Readonly<SystemSearchSelectProps>) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => systems.find((s) => s.id === value) ?? null, [systems, value]);

  const results = useMemo(() => {
    const normalized = normalizeText(query);
    if (!normalized) return systems.slice(0, 30);
    return systems
      .filter((s) =>
        normalizeText(s.name).includes(normalized)
        || normalizeText(s.name_pt || '').includes(normalized)
        || (s.aliases ?? []).some((a) => normalizeText(a).includes(normalized)),
      )
      .slice(0, 30);
  }, [systems, query]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          value={open ? query : (selected?.name_pt || selected?.name || '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={loading ? 'Carregando sistemas...' : 'Buscar sistema...'}
          disabled={loading}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/10 bg-[#13213f] p-1 shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/50">Nenhum sistema encontrado.</p>
          ) : (
            results.map((s) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(s.id); setOpen(false); setQuery(''); }}
                className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${s.id === value ? 'bg-orange-500/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
              >
                {s.name_pt || s.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
