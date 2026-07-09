import { useMemo, useRef, useState, useEffect } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { SystemTreeNode } from '../types/systems';
import { flattenTree, normalizeText, matchesSystemQuery, type FlattenedSystemNode } from '../utils/systemTree';

interface SystemAutocompleteProps {
  readonly tree: SystemTreeNode[];
  readonly selectedId: string | null;
  readonly onSelect: (systemId: string | null) => void;
  readonly idPrefix: string;
  readonly placeholder?: string;
  readonly maxSuggestions?: number;
}

/**
 * Busca com autocomplete para sistema de RPG: digitar filtra sugestões,
 * navegar por teclado, selecionar aplica direto.
 */
export function SystemAutocomplete({
  tree,
  selectedId,
  onSelect,
  idPrefix,
  placeholder = 'Buscar sistema (ex: D&D, Vampiro, Tormenta)...',
  maxSuggestions = 8,
}: SystemAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const flatNodes = useMemo(() => flattenTree(tree), [tree]);

  const selectedNode = useMemo(
    () => (selectedId ? flatNodes.find((node) => node.id === selectedId) ?? null : null),
    [flatNodes, selectedId]
  );

  const normalizedQuery = normalizeText(query);
  const suggestions = useMemo(() => {
    if (!normalizedQuery) return [];
    return flatNodes.filter((node) => matchesSystemQuery(node, normalizedQuery)).slice(0, maxSuggestions);
  }, [flatNodes, normalizedQuery, maxSuggestions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectNode = (node: FlattenedSystemNode) => {
    onSelect(node.id);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const clearSelection = () => {
    onSelect(null);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        selectNode(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  if (selectedNode && !isOpen) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-artificio-orange)]/40 bg-[var(--color-artificio-orange)]/10 px-3 py-2.5">
        <Check className="h-4 w-4 shrink-0 text-[var(--color-artificio-orange)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{selectedNode.name}</p>
          <p className="truncate text-xs text-white/55">{selectedNode.pathLabel}</p>
        </div>
        <button
          type="button"
          id={`${idPrefix}-clear`}
          onClick={clearSelection}
          className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Trocar sistema"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          id={`${idPrefix}-input`}
          role="combobox"
          aria-expanded={isOpen && normalizedQuery.length > 0}
          aria-controls={`${idPrefix}-listbox`}
          aria-activedescendant={activeIndex >= 0 && suggestions.length > 0 ? `${idPrefix}-option-${activeIndex}` : undefined}
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-xl border border-white/15 bg-[#13213f] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-artificio-orange)]"
        />
      </div>

      {isOpen && normalizedQuery.length > 0 && (
        <div
          id={`${idPrefix}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-white/15 bg-[#0F1A2E] p-1.5 shadow-xl"
        >
          {suggestions.length > 0 ? (
            suggestions.map((node, index) => (
              <button
                type="button"
                key={node.id}
                id={`${idPrefix}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectNode(node)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  index === activeIndex
                    ? 'bg-[var(--color-artificio-orange)]/20 text-white'
                    : 'text-white/80 hover:bg-white/5'
                }`}
              >
                <span className="block font-semibold">{node.name}</span>
                <span className="block text-xs text-white/50">{node.pathLabel}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-white/50">Nenhum sistema encontrado.</p>
          )}
        </div>
      )}
    </div>
  );
}
