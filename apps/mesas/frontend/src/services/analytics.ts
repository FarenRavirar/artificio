import { trackEvent } from '@artificio/analytics';

export function track(event: string, properties?: Record<string, unknown>): void {
  trackEvent(event, properties ?? {});
}

export function identify(_userId: string, _traits?: Record<string, unknown>): void {
  // R8: sem PII — identify é no-op seguro (não envia user_id para GA4)
}

export function setGlobalProperties(_properties: Record<string, unknown>): void {
  // R8: sem PII — global properties é no-op seguro
}
