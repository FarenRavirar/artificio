import React, { Component } from 'react';
import type { ReactNode } from 'react';
import { ErrorState } from './ui/ErrorState';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary para capturar erros de renderização
 * Previne que a aplicação inteira quebre por erro em um componente
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, errorInfo);
    
    // Callback opcional para logging externo
    this.props.onError?.(error, errorInfo);
    
    // TODO: Integrar com Sentry quando configurado
    // Sentry.captureException(error, {
    //   contexts: { react: errorInfo }
    // });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorState 
          message="Algo deu errado. Tente recarregar a página."
          retry={() => window.location.reload()}
          variant="generic"
        />
      );
    }

    return this.props.children;
  }
}
