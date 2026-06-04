import './ErrorState.css';

interface ErrorStateProps {
  message: string;
  retry?: () => void;
  variant?: 'network' | 'auth' | 'generic';
}

/**
 * Componente padronizado para exibição de erros
 * Variantes: network, auth, generic (padrão)
 */
export function ErrorState({ 
  message, 
  retry, 
  variant = 'generic' 
}: ErrorStateProps) {
  const getIcon = () => {
    switch (variant) {
      case 'network':
        return '📡';
      case 'auth':
        return '🔒';
      default:
        return '⚠️';
    }
  };

  const getTitle = () => {
    switch (variant) {
      case 'network':
        return 'Erro de Conexão';
      case 'auth':
        return 'Erro de Autenticação';
      default:
        return 'Erro';
    }
  };

  return (
    <div className={`error-state error-state-${variant}`}>
      <div className="error-state-icon">{getIcon()}</div>
      <h3 className="error-state-title">{getTitle()}</h3>
      <p className="error-state-message">{message}</p>
      {retry && (
        <button className="error-state-retry" onClick={retry}>
          Tentar Novamente
        </button>
      )}
    </div>
  );
}
