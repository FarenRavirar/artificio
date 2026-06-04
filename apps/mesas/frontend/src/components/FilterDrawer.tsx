import { X, RotateCcw } from 'lucide-react';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  children: React.ReactNode;
  isApplying?: boolean;
}

export function FilterDrawer({ isOpen, onClose, onClear, children, isApplying = false }: FilterDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
        onClick={isApplying ? undefined : onClose}
      />

      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 z-50 flex h-dvh w-[min(92vw,26rem)] flex-col bg-[#0F1A2E] shadow-2xl md:hidden ${isApplying ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Header */}
        <div className="shrink-0 bg-[#0F1A2E] border-b border-white/10 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Filtros</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Fechar filtros"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 pb-6">
          {children}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-[#0F1A2E] border-t border-white/10 p-4 flex gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button
            onClick={onClear}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white font-semibold transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Limpar
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-lg bg-[var(--color-artificio-orange)] hover:bg-[var(--color-artificio-orange-hover)] text-white font-semibold transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </>
  );
}
