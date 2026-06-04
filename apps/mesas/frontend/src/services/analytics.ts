/**
 * Interface para providers de analytics
 * Permite plugar qualquer ferramenta (GA4, Mixpanel, Amplitude) sem refatoração
 */
export interface AnalyticsProvider {
  /**
   * Rastreia um evento
   */
  track(event: string, properties?: Record<string, unknown>): void;

  /**
   * Identifica um usuário
   */
  identify?(userId: string, traits?: Record<string, unknown>): void;

  /**
   * Define propriedades globais
   */
  setGlobalProperties?(properties: Record<string, unknown>): void;
}

/**
 * Provider ativo (null até ser configurado)
 */
let activeProvider: AnalyticsProvider | null = null;

/**
 * Configura o provider de analytics
 * Deve ser chamado no início da aplicação
 */
export function setAnalyticsProvider(provider: AnalyticsProvider): void {
  activeProvider = provider;
  console.log('[Analytics] Provider configurado:', provider.constructor.name);
}

/**
 * Rastreia um evento
 * Não faz nada se nenhum provider estiver configurado
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!activeProvider) {
    console.log('[Analytics] Event (no provider):', event, properties);
    return;
  }

  try {
    activeProvider.track(event, properties);
  } catch (error) {
    console.error('[Analytics] Erro ao rastrear evento:', error);
  }
}

/**
 * Identifica um usuário
 */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!activeProvider?.identify) {
    console.log('[Analytics] Identify (no provider):', userId, traits);
    return;
  }

  try {
    activeProvider.identify(userId, traits);
  } catch (error) {
    console.error('[Analytics] Erro ao identificar usuário:', error);
  }
}

/**
 * Define propriedades globais
 */
export function setGlobalProperties(properties: Record<string, unknown>): void {
  if (!activeProvider?.setGlobalProperties) {
    console.log('[Analytics] Global properties (no provider):', properties);
    return;
  }

  try {
    activeProvider.setGlobalProperties(properties);
  } catch (error) {
    console.error('[Analytics] Erro ao definir propriedades globais:', error);
  }
}

/**
 * Provider de exemplo para desenvolvimento
 * Apenas loga no console
 */
export class ConsoleAnalyticsProvider implements AnalyticsProvider {
  track(event: string, properties?: Record<string, unknown>): void {
    console.log('[Analytics] Track:', event, properties);
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    console.log('[Analytics] Identify:', userId, traits);
  }

  setGlobalProperties(properties: Record<string, unknown>): void {
    console.log('[Analytics] Global properties:', properties);
  }
}

/**
 * Exemplo de como implementar Google Analytics 4
 * (Descomente quando quiser usar)
 */
/*
export class GA4Provider implements AnalyticsProvider {
  constructor(measurementId: string) {
    // Inicializar GA4
    window.gtag('config', measurementId);
  }

  track(event: string, properties?: Record<string, unknown>): void {
    window.gtag('event', event, properties);
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      user_id: userId,
      ...traits
    });
  }
}

// Uso:
// setAnalyticsProvider(new GA4Provider('G-XXXXXXXXXX'));
*/
