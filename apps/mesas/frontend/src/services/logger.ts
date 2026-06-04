/**
 * Interface para serviços de error tracking
 * Permite integrar Sentry, LogRocket ou qualquer outro serviço
 */
export interface ErrorTracker {
  /**
   * Captura uma exceção
   */
  captureException(error: Error, context?: ErrorContext): void;

  /**
   * Captura uma mensagem
   */
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void;

  /**
   * Define contexto do usuário
   */
  setUser(user: { id: string; email?: string; username?: string }): void;

  /**
   * Define tags globais
   */
  setTags(tags: Record<string, string>): void;
}

export interface ErrorContext {
  user?: string;
  url?: string;
  component?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

/**
 * Tracker ativo (null até ser configurado)
 */
let activeTracker: ErrorTracker | null = null;

/**
 * Configura o error tracker
 */
export function setErrorTracker(tracker: ErrorTracker): void {
  activeTracker = tracker;
  console.log('[ErrorTracker] Tracker configurado');
}

/**
 * Logger estruturado para erros e eventos
 */
class Logger {
  /**
   * Loga um erro
   */
  error(message: string, error?: Error, context?: ErrorContext): void {
    console.error('[Logger]', message, error, context);

    if (activeTracker && error) {
      try {
        activeTracker.captureException(error, context);
      } catch (e) {
        console.error('[Logger] Erro ao enviar para tracker:', e);
      }
    }
  }

  /**
   * Loga um warning
   */
  warn(message: string, context?: ErrorContext): void {
    console.warn('[Logger]', message, context);

    if (activeTracker) {
      try {
        activeTracker.captureMessage(message, 'warning');
      } catch (e) {
        console.error('[Logger] Erro ao enviar para tracker:', e);
      }
    }
  }

  /**
   * Loga uma informação
   */
  info(message: string, context?: ErrorContext): void {
    console.log('[Logger]', message, context);

    if (activeTracker) {
      try {
        activeTracker.captureMessage(message, 'info');
      } catch (e) {
        console.error('[Logger] Erro ao enviar para tracker:', e);
      }
    }
  }

  /**
   * Define usuário atual
   */
  setUser(user: { id: string; email?: string; username?: string }): void {
    if (activeTracker) {
      try {
        activeTracker.setUser(user);
      } catch (e) {
        console.error('[Logger] Erro ao definir usuário:', e);
      }
    }
  }

  /**
   * Define tags globais
   */
  setTags(tags: Record<string, string>): void {
    if (activeTracker) {
      try {
        activeTracker.setTags(tags);
      } catch (e) {
        console.error('[Logger] Erro ao definir tags:', e);
      }
    }
  }
}

export const logger = new Logger();

/**
 * Tracker de exemplo para desenvolvimento
 * Apenas loga no console
 */
export class ConsoleErrorTracker implements ErrorTracker {
  captureException(error: Error, context?: ErrorContext): void {
    console.error('[ErrorTracker] Exception:', error, context);
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    console.log(`[ErrorTracker] ${level.toUpperCase()}:`, message);
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    console.log('[ErrorTracker] User:', user);
  }

  setTags(tags: Record<string, string>): void {
    console.log('[ErrorTracker] Tags:', tags);
  }
}

/**
 * Exemplo de como implementar Sentry
 * (Descomente quando quiser usar)
 */
/*
import * as Sentry from '@sentry/react';

export class SentryTracker implements ErrorTracker {
  constructor(dsn: string, environment: string) {
    Sentry.init({
      dsn,
      environment,
      tracesSampleRate: 1.0,
    });
  }

  captureException(error: Error, context?: ErrorContext): void {
    Sentry.captureException(error, {
      tags: context?.component ? { component: context.component } : undefined,
      extra: context?.extra,
      user: context?.user ? { id: context.user } : undefined,
    });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    Sentry.captureMessage(message, level);
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    Sentry.setUser(user);
  }

  setTags(tags: Record<string, string>): void {
    Sentry.setTags(tags);
  }
}

// Uso:
// setErrorTracker(new SentryTracker('YOUR_DSN', 'production'));
*/
