// Eventos legados do mesas (perfil/discord/home) ficam fora do GA4 ate migrados
// ao catalogo central aprovado e auditados sem PII; o BI real (select_mesa,
// filter_sistema) ja sai pelos helpers explicitos do catalogo em CatalogoPage/MesaPage.

export function track(event: string, properties?: Record<string, unknown>): void {
  // NO-OP: nao envia eventos legados ao GA4
  if (import.meta.env.DEV) {
    console.debug("[mesas:analytics:noop]", event, properties);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function identify(_userId: string, _traits?: Record<string, unknown>): void {
  // NO-OP: R8 — sem PII, sem user_id
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setGlobalProperties(_properties: Record<string, unknown>): void {
  // NO-OP: R8 — sem PII
}
