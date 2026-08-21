import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { CatalogTree } from '@artificio/catalog-ui';
import { systemTreeNodeToUiNode } from '../utils/systemTreeNodeToUiNode';
import type { SystemTreeNode } from '../types/systems';
import { trapModalTab } from '../utils/focusTrap';

/**
 * Gatilho compacto + árvore de sistemas em popover (desktop) / dialog-drawer
 * (mobile) — R8/R9/R16 (spec 094).
 *
 * A árvore só é montada quando aberta: o input interno de busca ("Buscar
 * sistema") só existe no DOM nesse momento (aceite 3), e o `idPrefix`
 * "catalog-system" gera IDs únicos que nunca colidem com a busca geral.
 * O modo público usa `presentation="selection"` (D0.5/R18): sem parágrafo
 * técnico, sem "nome PT", sem badge de aliases — mas a busca por alias/nome PT
 * continua funcional (matcher do CatalogTree intocado).
 *
 * Fechamento (Escape, clique fora, botão Fechar) devolve o foco ao gatilho e
 * NUNCA limpa a seleção (decisão D0.1/R8).
 */

function findNodePath(nodes: SystemTreeNode[], id: string): SystemTreeNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = findNodePath(node.children ?? [], id);
    if (childPath) return [node, ...childPath];
  }
  return null;
}

export type CatalogSystemPopoverProps = Readonly<{
  tree: SystemTreeNode[];
  loading: boolean;
  error: string | null;
  selectedSystemId: string | null;
  onSelect: (systemId: string | null) => void;
}>;

export function CatalogSystemPopover({
  tree,
  loading,
  error,
  selectedSystemId,
  onSelect,
}: CatalogSystemPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const uiTree = useMemo(() => tree.map(systemTreeNodeToUiNode), [tree]);

  // Gatilho mostra "Sistema" ou o caminho/nome do nó selecionado (R8).
  const selectedLabel = useMemo(() => {
    if (!selectedSystemId) return null;
    const path = findNodePath(tree, selectedSystemId);
    if (!path) return null;
    return path.map((node) => node.name).join(' › ');
  }, [tree, selectedSystemId]);

  const open = useCallback(() => {
    setIsMobile(!window.matchMedia('(min-width: 768px)').matches);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isMobile && panelRef.current) trapModalTab(event, panelRef.current);
      if (event.key === 'Escape') {
        close();
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current
        && !panelRef.current.contains(target)
        && triggerRef.current
        && !triggerRef.current.contains(target)
      ) {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, isMobile, close]);

  useEffect(() => {
    if (!isOpen) return;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const syncViewport = (event: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(!event.matches);
    };
    syncViewport(mediaQuery);
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, [isOpen]);

  // Ao abrir, o foco vai para a busca; loading/erro usam o botão Fechar do dialog.
  useEffect(() => {
    if (!isOpen) return;
    const input = panelRef.current?.querySelector<HTMLInputElement>('input[type="search"]');
    (input ?? closeButtonRef.current)?.focus();
  }, [isOpen, isMobile, loading, error]);

  const selectedIds = useMemo(() => (selectedSystemId ? [selectedSystemId] : []), [selectedSystemId]);

  const handleSelectionChange = useCallback(
    (ids: string[]) => onSelect(ids[0] ?? null),
    [onSelect],
  );

  let treeContent;
  if (loading) {
    treeContent = (
      <p className="rounded-lg border border-[var(--line)] px-3 py-6 text-center text-sm text-[var(--fg-muted)]">
        Carregando sistemas...
      </p>
    );
  } else if (error) {
    treeContent = (
      <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-6 text-center text-sm text-red-200">
        Sistemas indisponíveis.
      </p>
    );
  } else {
    treeContent = (
      <CatalogTree
        tree={uiTree}
        selectedIds={selectedIds}
        onSelectionChange={handleSelectionChange}
        idPrefix="catalog-system"
        mode="single"
        role="user"
        presentation="selection"
        searchPlaceholder="Buscar sistema"
      />
    );
  }

  const panelHeader = (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-sm font-semibold text-[var(--fg)]">Sistema</p>
      <button
        ref={closeButtonRef}
        type="button"
        onClick={close}
        aria-label="Fechar seletor de sistema"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        id="catalog-system-trigger"
        type="button"
        onClick={() => (isOpen ? close() : open())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="catalog-system-panel"
        className="flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-left text-sm text-[var(--fg)] transition-colors hover:border-[var(--artificio-brand)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
      >
        <span className="min-w-0 truncate">{selectedLabel ?? 'Sistema'}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--fg-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && !isMobile && (
        <dialog
          open
          ref={panelRef}
          id="catalog-system-panel"
          aria-label="Selecionar sistema"
          className="absolute left-0 top-full z-30 m-0 mt-2 w-[min(420px,calc(100vw-2rem))] max-w-none rounded-xl border border-[var(--line)] bg-[var(--surface-panel)] p-3 text-[var(--fg)] shadow-2xl"
        >
          {panelHeader}
          <div className="max-h-[min(60vh,480px)] overflow-y-auto pr-1">{treeContent}</div>
        </dialog>
      )}

      {isOpen && isMobile && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Fechar ao clicar fora do seletor de sistema"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={close}
          />
          <dialog
            open
            ref={panelRef}
            id="catalog-system-panel"
            aria-modal="true"
            aria-label="Selecionar sistema"
            className="fixed inset-x-0 bottom-0 top-auto z-50 m-0 flex max-h-[85dvh] w-full max-w-none flex-col rounded-t-2xl border-0 border-t border-[var(--line)] bg-[var(--surface-panel)] p-4 text-[var(--fg)] shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-base font-bold text-[var(--fg)]">Sistema</p>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={close}
                aria-label="Fechar seletor de sistema"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">{treeContent}</div>
          </dialog>
        </>
      )}
    </div>
  );
}
