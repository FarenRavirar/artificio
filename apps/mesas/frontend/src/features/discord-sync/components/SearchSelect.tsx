import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

export interface SearchSelectOption {
  id: string;
  label: string;
  searchText: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  loading: boolean;
  placeholder: string;
  emptyLabel: string;
  clearLabel?: string;
  onChange: (id: string) => void;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function SearchSelect({
  options,
  value,
  loading,
  placeholder,
  emptyLabel,
  clearLabel,
  onChange,
}: Readonly<SearchSelectProps>) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => options.find((option) => option.id === value) ?? null, [options, value]);

  const results = useMemo(() => {
    const normalized = normalizeSearchText(query);
    if (!normalized) return options.slice(0, 30);
    return options.filter((option) => normalizeSearchText(option.searchText).includes(normalized)).slice(0, 30);
  }, [options, query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          value={open ? query : (selected?.label || '')}
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
          {/* Achado do mantenedor (2026-07-08): opção "Nenhuma" só aparecia com
              value já preenchido (nada pra limpar quando vazio) — sem opção
              visível de confirmar "sem VTT/comunicação" quando o campo já
              nasce vazio. Sempre visível agora, não condicional a value. */}
          {clearLabel && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(''); setOpen(false); setQuery(''); }}
              className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${value === '' ? 'bg-orange-500/20 text-white' : 'text-white/50 hover:bg-white/10'}`}
            >
              {clearLabel}
            </button>
          )}
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/50">{emptyLabel}</p>
          ) : (
            results.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(option.id); setOpen(false); setQuery(''); }}
                className={`w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${option.id === value ? 'bg-orange-500/20 text-white' : 'text-white/80 hover:bg-white/10'}`}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
