/**
 * Helpers de envelope de resposta de API (`{ data: [...] }`).
 *
 * Achado 1 da revisão adversarial da Fase 5 (spec 096): `asRecord` era
 * reimplementado idêntico em três hooks de catálogo (useVttPlatforms,
 * useCommunicationPlatforms, useSystemsCatalog). Regra "compartilhado por
 * padrão" (AGENTS.md) — o helper sobe para um util único; os hooks só
 * preservam as próprias mensagens de erro.
 */

export const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

/**
 * Extrai a lista `data` do envelope `{ data: [...] }` e exige que seja
 * array — senão lança TypeError com a mensagem do chamador (cada hook tem a
 * sua, e elas fazem parte do contrato de erro exibido na UI).
 */
export const readEnvelopeData = (json: unknown, errorMessage: string): unknown[] => {
  const data = asRecord(json).data;
  if (!Array.isArray(data)) {
    throw new TypeError(errorMessage);
  }
  return data;
};
