// Spec 085 (Fase 7, T7.2) — override da familia OneBookShelf (DMs Guild,
// DriveThruRPG, StorytellersVault, mesmo motor Angular/JSON-LD): sinal real
// de PWYW nao vem do preco, vem da tag <obs-product-format-pwyw-options>
// (achado T0 — texto "Pague quanto quiser" e link de menu, aparece em
// TODOS os fixtures inclusive gratuitos, falso positivo). Mesma logica de
// resolvePriceSignal do onebookshelfHtmlParser.ts original (T1.4),
// preservada aqui, so sobrescreve isFreeOrPwyw/priceSignal — nunca
// title/description/publisherName/coverImageUrl (ja vem certo do JSON-LD
// padrao, generic Schema.org).

import type { PlatformOverrideInput } from './index';

const PWYW_TAG_MARKER = 'obs-product-format-pwyw-options';

export function applyOneBookShelfOverride(preview: PlatformOverrideInput, html: string): PlatformOverrideInput {
  if (html.includes(PWYW_TAG_MARKER)) {
    return { ...preview, isFreeOrPwyw: true, priceSignal: 'pwyw_tag_present' };
  }
  if (preview.extractedPriceValue === 0) {
    return { ...preview, isFreeOrPwyw: true, priceSignal: 'zero_price_no_pwyw_tag' };
  }
  // Preço > 0 sem tag PWYW: sugestão omitida (null), nunca "pago" assumido
  // silenciosamente (requisito 3/4 da spec, D119).
  return { ...preview, isFreeOrPwyw: null, priceSignal: 'nonzero_price_no_pwyw_tag' };
}
