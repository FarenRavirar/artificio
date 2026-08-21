import { useEffect, useRef } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { trapModalTab } from '../utils/focusTrap';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  children: React.ReactNode;
  isApplying?: boolean;
}

/**
 * Drawer mobile de filtros (spec 094, R15–R17).
 *
 * Hospeda a composição comum de filtros avançados (a página passa o MESMO
 * `CatalogAdvancedFilters` do desktop como children — fonte única de campos,
 * sem duplicar lista/mapper). "Aplicar" e "Limpar" ficam no footer sticky
 * (shrink-0 no flex column), sempre visíveis.
 *
 * A11y (padrão W3C Modal Dialog + R16): `role="dialog"`/`aria-modal`, Escape
 * fecha (respeitando o bloqueio de `isApplying`), foco inicial no botão de
 * fechar e retorno de foco ao gatilho ao fechar. Fundo/bordas usam tokens de
 * tema (não cores fixas) para o conteúdo hospedado — que usa tokens — ser
 * legível em dark e light.
 */
export function FilterDrawer({ isOpen, onClose, onClear, onApply, children, isApplying = false }: FilterDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    drawerRef.current?.querySelector<HTMLButtonElement>('[data-drawer-close]')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (drawerRef.current) trapModalTab(event, drawerRef.current);
      if (event.key === 'Escape' && !isApplying) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isApplying]);

  useEffect(() => {
    if (isOpen) return;
    previousFocusRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        onClick={isApplying ? undefined : onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        id="catalog-mobile-filters-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className={`fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(92vw,26rem)] flex-col bg-[var(--surface-panel)] shadow-2xl md:hidden ${isApplying ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] p-4">
          <h2 className="text-lg font-bold text-[var(--fg)]">Filtros</h2>
          <button
            type="button"
            data-drawer-close
            onClick={onClose}
            aria-label="Fechar filtros"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--fill)] hover:text-[var(--fg)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content — composição comum (CatalogAdvancedFilters) fornecida pela página */}
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-6">
          {children}
        </div>

        {/* Footer sticky: Aplicar e Limpar sempre visíveis (decisão D0.1/R15). */}
        <div className="flex shrink-0 gap-3 border-t border-[var(--line)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClear}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--fill)] px-4 py-3 font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--fill-20)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
          >
            <RotateCcw className="h-4 w-4" />
            Limpar
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[var(--color-artificio-orange)] px-4 py-3 font-semibold text-white transition-colors hover:bg-[var(--color-artificio-orange-hover)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--artificio-focus)]"
          >
            Aplicar
          </button>
        </div>
      </div>
    </>
  );
}
