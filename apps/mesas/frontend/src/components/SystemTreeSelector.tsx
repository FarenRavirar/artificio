import { useMemo, useState, useRef } from 'react';
import { Check, ChevronRight, Search, Info } from 'lucide-react';
import type { SystemTreeNode } from '../types/systems';
import { flattenTree, normalizeText, getDisplayName, type FlattenedSystemNode } from '../utils/systemTree';

interface SystemTreeSelectorProps {
  tree: SystemTreeNode[];
  selectedIds: string[];
  onToggle: (systemId: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  idPrefix: string;
  singleSelect?: boolean;
}

export const SystemTreeSelector = ({
  tree,
  selectedIds,
  onToggle,
  search,
  onSearchChange,
  idPrefix,
  singleSelect = false,
}: SystemTreeSelectorProps) => {
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [activeMidId, setActiveMidId] = useState<string | null>(null);
  const [recentlySelected, setRecentlySelected] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'pt'>('pt');
  const searchResultsRef = useRef<HTMLDivElement>(null);

  const flatNodes = useMemo(() => flattenTree(tree), [tree]);

  const activeRoot = useMemo(
    () => tree.find((node) => node.id === activeRootId) ?? tree[0] ?? null,
    [activeRootId, tree]
  );

  const midNodes = useMemo(() => activeRoot?.children ?? [], [activeRoot]);
  const activeMid = useMemo(
    () => midNodes.find((node) => node.id === activeMidId) ?? midNodes[0] ?? null,
    [activeMidId, midNodes]
  );
  const leafNodes = activeMid?.children ?? [];

  const normalizedSearch = normalizeText(search);
  const searchResults = useMemo(() => {
    if (!normalizedSearch) return [] as FlattenedSystemNode[];

    return flatNodes.filter((node) => {
      return normalizeText(node.name).includes(normalizedSearch)
        || normalizeText(node.name_pt || '').includes(normalizedSearch)
        || normalizeText(node.slug).includes(normalizedSearch)
        || normalizeText(node.path_slug ?? '').includes(normalizedSearch)
        || (node.aliases?.some((alias) => normalizeText(alias).includes(normalizedSearch)) ?? false);
    });
  }, [flatNodes, normalizedSearch]);

  // Ordenar resultados: selecionados no topo
  const sortedSearchResults = useMemo(() => {
    if (!normalizedSearch) return [];
    
    const selected = searchResults.filter(node => selectedIds.includes(node.id));
    const unselected = searchResults.filter(node => !selectedIds.includes(node.id));
    
    return [...selected, ...unselected];
  }, [searchResults, selectedIds, normalizedSearch]);

  const handleToggleWithFeedback = (systemId: string) => {
    onToggle(systemId);
    setRecentlySelected(systemId);
    
    // Scroll para o item se estiver em modo de busca
    if (normalizedSearch) {
      setTimeout(() => {
        const element = document.getElementById(`${idPrefix}-search-result-${systemId}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
    
    // Limpar feedback após 1.5s
    setTimeout(() => setRecentlySelected(null), 1500);
  };

  const renderNodeButton = (node: SystemTreeNode, layer: 'root' | 'mid' | 'leaf') => {
    const selected = selectedIds.includes(node.id);
    const isActive = layer === 'root'
      ? node.id === activeRoot?.id
      : layer === 'mid'
        ? node.id === activeMid?.id
        : false;

    return (
      <button
        type="button"
        key={node.id}
        id={`${idPrefix}-node-${node.slug}`}
        onClick={() => {
          if (layer === 'root') {
            setActiveRootId(node.id);
            setActiveMidId(node.children?.[0]?.id ?? null);
          }

          if (layer === 'mid') {
            setActiveMidId(node.id);
          }

          handleToggleWithFeedback(node.id);
        }}
        className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${isActive ? 'border-[var(--color-artificio-orange)] bg-[var(--color-artificio-orange)]/10' : 'border-white/10 bg-white/5 hover:border-white/20'} ${selected ? 'text-white' : 'text-white/80'}`}
      >
        <span className="flex items-start gap-2">
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${selected ? 'border-[var(--color-artificio-orange)] bg-[var(--color-artificio-orange)] text-white' : 'border-white/30 text-transparent'}`}>
            <Check className="h-3 w-3" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold">{getDisplayName(node, language)}</span>
            {node.aliases && node.aliases.length > 0 && (
              <span className="mt-0.5 block text-xs text-white/50 line-clamp-1">
                {node.aliases.slice(0, 3).join(' · ')}
              </span>
            )}
          </span>
          {node.children && node.children.length > 0 && <ChevronRight className="h-4 w-4 text-white/40" />}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            id={`${idPrefix}-search`}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome ou alias..."
            className="w-full rounded-xl border border-white/15 bg-[#13213f] py-2.5 pl-9 pr-3 outline-none focus:border-[var(--color-artificio-orange)]"
          />
        </div>
        <div className="flex rounded-xl border border-white/15 bg-[#13213f] p-1">
          <button
            type="button"
            onClick={() => setLanguage('pt')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              language === 'pt' ? 'bg-[var(--color-artificio-orange)] text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            PT
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              language === 'en' ? 'bg-[var(--color-artificio-orange)] text-white' : 'text-white/60 hover:text-white'
            }`}
          >
            EN
          </button>
        </div>
      </div>

      {singleSelect && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-400/20 px-3 py-2">
          <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-100/90">
            <p className="font-medium">Seleção única</p>
            <p className="text-blue-100/70 mt-0.5">
              {selectedIds.length > 0 
                ? '1 sistema selecionado. Clique em outro para substituir.'
                : 'Selecione apenas um sistema para vincular à mesa.'}
            </p>
          </div>
        </div>
      )}

      {singleSelect && selectedIds.length > 0 && (() => {
        const selectedNode = flatNodes.find(n => n.id === selectedIds[0]);
        if (!selectedNode) return null;

        // Encontrar o nó completo na árvore para acessar children
        const findNodeInTree = (nodes: SystemTreeNode[], id: string): SystemTreeNode | null => {
          for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
              const found = findNodeInTree(node.children, id);
              if (found) return found;
            }
          }
          return null;
        };

        const fullNode = findNodeInTree(tree, selectedIds[0]);
        if (!fullNode) return null;
        const pathParts = selectedNode.pathLabel.split(' > ');
        
        // Determinar nível do nó selecionado (0=base, 1=edição, 2=variante)
        const nodeDepth = selectedNode.depth;
        
        // Encontrar sistema base
        let baseNode: SystemTreeNode | null = null;
        let editionNode: SystemTreeNode | null = null;
        let variantNode: SystemTreeNode | null = null;

        if (nodeDepth === 0) {
          baseNode = fullNode;
        } else if (nodeDepth === 1) {
          // Encontrar pai (base)
          for (const root of tree) {
            if (root.children?.some(c => c.id === selectedIds[0])) {
              baseNode = root;
              editionNode = fullNode;
              break;
            }
          }
        } else if (nodeDepth === 2) {
          // Encontrar avô (base) e pai (edição)
          for (const root of tree) {
            for (const mid of root.children ?? []) {
              if (mid.children?.some(c => c.id === selectedIds[0])) {
                baseNode = root;
                editionNode = mid;
                variantNode = fullNode;
                break;
              }
            }
            if (baseNode) break;
          }
        }

        const editions = baseNode?.children ?? [];
        const variants = editionNode?.children ?? [];

        return (
          <div className="rounded-xl border border-[var(--color-artificio-orange)]/30 bg-[var(--color-artificio-orange)]/10 p-4 space-y-3">
            {/* Sistema Base */}
            <div className="flex items-start gap-2">
              <Check className="h-5 w-5 text-[var(--color-artificio-orange)] mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-artificio-orange)]">
                  Sistema Base
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {baseNode?.name || pathParts[0]}
                </p>
              </div>
            </div>

            {/* Dropdown de Edições */}
            {editions.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70">
                  Edição / Subsistema {editionNode && '✓'}
                </label>
                <select
                  value={editionNode?.id || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleToggleWithFeedback(e.target.value);
                    }
                  }}
                  className="app-select w-full"
                >
<option value="">Selecione uma edição...</option>
                  {midNodes.map(ed => (
                    <option key={ed.id} value={ed.id}>{getDisplayName(ed, language)}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Dropdown de Variantes */}
            {editionNode && variants.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70">
                  Variante {variantNode && '✓'}
                </label>
                <select
                  value={variantNode?.id || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleToggleWithFeedback(e.target.value);
                    }
                  }}
                  className="app-select w-full"
                >
                  <option value="">Selecione uma variante...</option>
                  {variants.map(variant => (
                    <option key={variant.id} value={variant.id}>{getDisplayName(variant, language)}</option>
                  ))}
                </select>
              </div>
            )}


            {/* Caminho completo */}
            <div className="pt-2 border-t border-white/10">
              <p className="text-xs text-white/50">Seleção atual:</p>
              <p className="text-sm text-white/90 font-medium mt-0.5">{selectedNode.pathLabel}</p>
            </div>
          </div>
        );
      })()}

      {normalizedSearch ? (
        <div ref={searchResultsRef} className="max-h-80 space-y-2 overflow-auto pr-1">
          {sortedSearchResults.length > 0 ? (
            sortedSearchResults.map((node) => {
              const selected = selectedIds.includes(node.id);
              const isRecentlySelected = recentlySelected === node.id;
              return (
                <button
                  type="button"
                  key={node.id}
                  id={`${idPrefix}-search-result-${node.slug}`}
                  onClick={() => handleToggleWithFeedback(node.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-all ${selected ? 'border-[var(--color-artificio-orange)] bg-[var(--color-artificio-orange)]/10 text-white' : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'} ${isRecentlySelected ? 'ring-2 ring-[var(--color-artificio-orange)]/50 animate-pulse' : ''}`}
                >
                  <p className="font-semibold">{node.name}</p>
                  <p className="text-xs text-white/55">{node.pathLabel}</p>
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-dashed border-white/20 bg-white/5 p-4 text-sm text-white/60">
              Nenhum sistema encontrado com esse termo.
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <section className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Sistema base</h4>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {tree.map((node) => renderNodeButton(node, 'root'))}
            </div>
          </section>

          <section className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">Edições / subsistemas</h4>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {midNodes.length > 0 ? (
                midNodes.map((node) => renderNodeButton(node, 'mid'))
              ) : (
                <p className="rounded-lg border border-dashed border-white/20 bg-white/5 p-3 text-xs text-white/55">
                  Selecione um sistema com descendentes para explorar este nível.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
              Variantes {singleSelect ? '(alvo de mesa)' : ''}
            </h4>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {leafNodes.length > 0 ? (
                leafNodes.map((node) => renderNodeButton(node, 'leaf'))
              ) : (
                <p className="rounded-lg border border-dashed border-white/20 bg-white/5 p-3 text-xs text-white/55">
                  No mobile este painel aparece abaixo. Se não houver variantes, você pode marcar o item do nível anterior.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {singleSelect && selectedIds.length === 0 && (
        <p className="text-xs text-white/60">Selecione um único nó da árvore para vincular a mesa.</p>
      )}
    </div>
  );
};
