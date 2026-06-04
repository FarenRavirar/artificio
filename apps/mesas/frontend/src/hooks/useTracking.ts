import { useCallback } from 'react';

/**
 * Hook reutilizável para tracking de eventos de engajamento
 * 
 * Registra cliques em diferentes CTAs para fornecer insights aos mestres
 */
export function useTracking() {
  /**
   * Registra clique em mesa (card, CTA, links)
   * @param slug - Slug da mesa
   * @param variant - Tipo de clique (refactored_v4, cta_entrar, link_vtt, cta_contato)
   */
  const trackTableClick = useCallback((slug: string, variant: string) => {
    fetch(`/api/v1/tables/${slug}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant }),
      keepalive: true,
    }).catch(() => {
      // Silenciar erros de tracking para não impactar UX
    });
  }, []);

  /**
   * Registra clique em método de contato do mestre
   * @param gmSlug - Slug do perfil do mestre
   * @param channel - Canal de contato (whatsapp, email, discord, form)
   */
  const trackGmContactClick = useCallback((gmSlug: string, channel: string) => {
    fetch(`/api/v1/gm/${gmSlug}/contact-click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
      keepalive: true,
    }).catch(() => {
      // Silenciar erros de tracking para não impactar UX
    });
  }, []);

  return { trackTableClick, trackGmContactClick };
}
