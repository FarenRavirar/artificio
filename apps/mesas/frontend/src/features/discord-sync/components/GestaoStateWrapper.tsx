import type { ReactNode } from 'react';

interface GestaoStateWrapperProps {
  readonly loading: boolean;
  readonly error?: string | null;
  readonly empty: boolean;
  readonly emptyMessage?: string;
  readonly loadingMessage?: string;
  readonly errorTitle?: string;
  readonly children: ReactNode;
}

export function GestaoStateWrapper({
  loading, error, empty,
  emptyMessage = 'Nenhum dado encontrado.',
  loadingMessage = 'Carregando...',
  errorTitle,
  children,
}: GestaoStateWrapperProps) {
  if (loading) {
    return <p className="text-white/40 text-sm py-4 text-center">{loadingMessage}</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-900/20 border border-red-600/30 p-3">
        {errorTitle && <p className="text-red-200 text-xs font-semibold mb-1">{errorTitle}</p>}
        <p className="text-red-300 text-sm">{error}</p>
      </div>
    );
  }

  if (empty) {
    return <p className="text-white/40 text-sm py-4 text-center">{emptyMessage}</p>;
  }

  return <>{children}</>;
}
