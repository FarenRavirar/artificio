import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { SimpleCatalogEntry } from '../draftFormUtils';

interface CatalogSearchSelectProps {
  items: SimpleCatalogEntry[];
  value: string;
  loading: boolean;
  placeholder: string;
  onChange: (id: string) => void;
}

const normalizeText = (value: string): string => value.trim().toLowerCase();

/**
 * Pendência 2 (spec 058): combobox genérico com busca pra catálogos simples
 * (cenário, VTT, comunicação) — mesmo padrão de `SystemSearchSelect`, mas sem
 * nome_pt/aliases (esses catálogos só têm id+name).
 */
export function CatalogSearchSelect({ items, value, loading, placeholder, onChange }: Readonly<CatalogSearchSelectProps>) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => items.find((i) => i.id === value) ?? null, [items, value]);

  const results = useMemo(() => {
    const normalized = normalizeText(query);
    if (!normalized) return items.slice(0, 30);
    return items.filter((i) => normalizeText(i.name).includes(normalized)).slice(0, 30);
  }, [items, query]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          value={open ? query : (selected?.name || '')}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={loading ? 'Carregando...' : placeholder}
          disabled={loading}
          className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-white/30 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
        />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-white/10 bg-[#13213f] p-1 shadow-xl">
          {value && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false); setQuery(''); }}
              className="w-full rounded-md px-3 py-1.5 text-left text-sm text-white/50 hover:bg-white/10"
            >
              Limpar seleção
            </button>
          )}
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/50">Nenhum resultado encontrado.</p>
          ) : (
            results.map((i) => (
              <button
                key={i.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(i.id); setOpen(false); setQuery(''); }}
                className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${i.id === value ? 'bg-orange-500/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
              >
                {i.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
