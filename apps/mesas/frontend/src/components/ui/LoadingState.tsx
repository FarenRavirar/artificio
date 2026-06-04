import './LoadingState.css';

interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'skeleton' | 'inline';
}

/**
 * Componente padronizado para estados de carregamento
 * Variantes: spinner (padrão), skeleton, inline
 */
export function LoadingState({ 
  message = 'Carregando...', 
  variant = 'spinner' 
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <div className="loading-state-inline">
        <div className="spinner-small"></div>
        <span>{message}</span>
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className="loading-state-skeleton">
        <div className="skeleton-line skeleton-line-title"></div>
        <div className="skeleton-line skeleton-line-text"></div>
        <div className="skeleton-line skeleton-line-text"></div>
        <div className="skeleton-line skeleton-line-short"></div>
      </div>
    );
  }

  return (
    <div className="loading-state">
      <div className="spinner"></div>
      <p className="loading-state-message">{message}</p>
    </div>
  );
}
