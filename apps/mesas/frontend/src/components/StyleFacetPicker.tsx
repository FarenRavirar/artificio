import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import type { StyleFacet, StyleOption } from '../services/catalogService';

const VISIBLE_COUNT = 8;

type StyleFacetPickerProps = Readonly<{
  facets: StyleFacet[];
  selected: StyleOption[];
  onToggle: (style: StyleOption) => void;
}>;

/**
 * Estilos já chegam ordenados por frequência (backend, ORDER BY COUNT(*) DESC).
 * Os mais usados ficam sempre visíveis como chips; o resto entra num popover
 * com busca — evita o scroll horizontal sem fim que a barra de estilos tinha
 * antes (achado do mantenedor, 2026-07-18: "abre barra" com 48 estilos).
 */
export function StyleFacetPicker({ facets, selected, onToggle }: StyleFacetPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const visibleFacets = facets.slice(0, VISIBLE_COUNT);
  const overflowFacets = facets.slice(VISIBLE_COUNT);

  const hasSelectedInOverflow = useMemo(
    () => overflowFacets.some((facet) => selected.includes(facet.style)),
    [overflowFacets, selected]
  );

  const filteredOverflow = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return overflowFacets;
    return overflowFacets.filter((facet) => facet.style.toLowerCase().includes(term));
  }, [overflowFacets, query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (facets.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">Estilos</span>

      {visibleFacets.map(({ style, count }) => (
        <button
          key={style}
          type="button"
          onClick={() => onToggle(style)}
          aria-pressed={selected.includes(style)}
          className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs transition-all whitespace-nowrap ${
            selected.includes(style)
              ? 'border-orange-500 bg-orange-500/20 text-orange-100'
              : 'border-[var(--line)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--line)] hover:bg-[var(--surface-strong)]'
          }`}
        >
          {style} <span className="text-[var(--fg-muted)]">({count})</span>
        </button>
      ))}

      {overflowFacets.length > 0 && (
        <div ref={containerRef} className="relative shrink-0">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
              hasSelectedInOverflow
                ? 'border-orange-500 bg-orange-500/20 text-orange-100'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--fg-muted)] hover:border-[var(--line)] hover:bg-[var(--surface-strong)]'
            }`}
          >
            +{overflowFacets.length} estilos
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface-panel)] p-3 shadow-xl">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--fg-muted)]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar estilo..."
                  aria-label="Buscar estilo"
                  autoFocus
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-2 text-xs text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--artificio-brand)]"
                />
              </div>
              <div className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                {filteredOverflow.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-[var(--fg-muted)]">Nenhum estilo encontrado.</p>
                ) : (
                  filteredOverflow.map(({ style, count }) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => onToggle(style)}
                      aria-pressed={selected.includes(style)}
                      className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                        selected.includes(style)
                          ? 'bg-orange-500/20 text-orange-100'
                          : 'text-[var(--fg)] hover:bg-[var(--surface-strong)]'
                      }`}
                    >
                      <span>{style}</span>
                      <span className="text-[var(--fg-muted)]">({count})</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
