import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';

interface InlineDeleteConfirmationProps {
  title: string;
  onConfirm: () => Promise<void> | void;
  isOpen: boolean;
  onOpen: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
  disabled?: boolean;
  triggerLabel?: string;
  confirmLabel?: string;
  className?: string;
  compact?: boolean;
}

export function InlineDeleteConfirmation({
  title,
  onConfirm,
  isOpen,
  onOpen,
  onCancel,
  isProcessing = false,
  disabled = false,
  triggerLabel = 'Excluir',
  confirmLabel = 'Excluir definitivamente',
  className = '',
  compact = false,
}: InlineDeleteConfirmationProps) {
  const handleConfirm = () => {
    if (isProcessing || disabled) return;
    void onConfirm();
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled || isProcessing}
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        aria-label={`Excluir mesa ${title}`}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        {isProcessing ? 'Excluindo...' : triggerLabel}
      </button>
    );
  }

  return (
    <div
      className={`rounded-lg border border-red-400/40 bg-red-950/40 p-3 text-sm text-red-50 shadow-inner ${className}`}
      role="group"
      aria-label={`Confirmar exclusao da mesa ${title}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-red-100">Excluir "{title}"?</p>
          <p className="mt-1 text-xs leading-relaxed text-red-100/80">
            Esta mesa sera removida da plataforma. A acao nao pode ser desfeita.
          </p>
        </div>
      </div>

      <div className={`mt-3 flex gap-2 ${compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row sm:justify-end'}`}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isProcessing || disabled}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
          {isProcessing ? 'Excluindo...' : confirmLabel}
        </button>
      </div>
    </div>
  );
}
