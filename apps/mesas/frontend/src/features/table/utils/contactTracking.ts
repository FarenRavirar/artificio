import { trackContactClick } from '@artificio/analytics';

/** Identificação pública da mesa para métricas — nada de PII. */
export interface TableTrackingContext {
  slug: string;
  mesaId: string;
  sistema?: string;
}

/** Contexto de métrica a partir do ViewModel da mesa. */
export function trackingFromVm(vm: { slug: string; id: string; system?: string }): TableTrackingContext {
  return { slug: vm.slug, mesaId: vm.id, sistema: vm.system || undefined };
}

function postMetric(slug: string, action: 'click' | 'contact', body?: Record<string, string>): void {
  fetch(`/api/v1/tables/${encodeURIComponent(slug)}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    // A navegação para o canal externo pode descarregar a página antes de a
    // requisição terminar; `keepalive` garante a entrega.
    keepalive: true,
  }).catch(() => {
    // Silencioso: métrica nunca quebra a UX.
  });
}

/** Clique no CTA principal da mesa. Uma chamada por clique — nunca duas. */
export function registerTableClick(ctx: TableTrackingContext, variant: string): void {
  postMetric(ctx.slug, 'click', { variant });
}

/**
 * Contato iniciado: o visitante abriu o canal do mestre. Conta no banco
 * (`contacts_count` + série em `table_metric_events`) e no GA4 (`contact_click`).
 * As duas fontes juntas medem também a perda do GA4 para bloqueador (spec 105).
 */
export function registerTableContact(ctx: TableTrackingContext, channel: string): void {
  postMetric(ctx.slug, 'contact');
  trackContactClick({ origem: 'mesa', canal: channel, mesa_id: ctx.mesaId, sistema: ctx.sistema });
}
