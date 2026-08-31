import type { SellingPoint } from '../sellingPointIcons';

/**
 * Domínio puro do editor de perfil de mestre (spec 099, fase B).
 *
 * Constantes de ganho e helpers sem JSX, separados dos componentes de
 * `GmProfileFields.tsx` por causa do lint `react-refresh/only-export-components`
 * (arquivo que exporta componente não pode exportar constante/função pura) —
 * mesmo padrão do repo: o editor de mesa mantém o registro de validação em
 * `editorValidation.ts`, fora dos componentes.
 */

/**
 * Frase do ganho por campo RECOMENDADO do editor de perfil (spec 099 §8/D10,
 * consolidado pela B6) — o registro único no padrão
 * `editorValidation.ts:72` (spec 096: `RECOMMENDED_GAIN: Record<string, string>`).
 *
 * Todo recomendado carrega a frase, na linguagem do jogador — mesmo padrão
 * medido em produção no editor de mesa: "mesas com banner aparecem em
 * destaque" (frase = o que o JOGADOR ganha, não o que o mestre faz). Os
 * testes cruzam os `[data-ob="recommended"]` renderizados com estas chaves
 * (idem A11 do editor de mesa): campo recomendado sem chave aqui, ou chave
 * aqui sem campo, falha o teste cruzado.
 *
 * B6: as 4 frases antigas (`TAGLINE_GAIN`/`SPECIALTIES_GAIN`/`LANGUAGES_GAIN`/
 * `SELLING_POINTS_GAIN`) foram consolidadas aqui e os consumidores passaram a
 * usar `RECOMMENDED_GAIN.<chave>` — fonte única, sem duplicar nome de
 * constante. As 3 novas (`bioLong`, `experienceYears`, `links`) foram escritas
 * no mesmo tom.
 */
export const RECOMMENDED_GAIN: Record<string, string> = {
  // `tagline` é o recomendado de maior alcance da spec: encabeça as três
  // cadeias que o jogador vê (hero, OG do crawler e SEO — spec §2.3).
  tagline:
    'perfis com slogan mostram uma frase própria no topo do perfil, na busca e ao compartilhar',
  bioLong: 'uma bio detalhada mostra ao jogador quem você é como mestre antes da primeira sessão',
  specialties:
    'especialidades mostram aos jogadores os estilos de mesa que você mestra de verdade',
  languages: 'idiomas ajudam jogadores a encontrar mesas em que vão entender tudo',
  // `selling_points` entra na dobra por D2.
  sellingPoints: 'pontos fortes mostram ao jogador, de cara, o que a sua mesa tem de melhor',
  experienceYears: 'os anos de experiência mostram ao jogador há quanto tempo você mestra',
  links: 'links mostram ao jogador onde acompanhar você e o seu trabalho',
};

/** Item válido para gravar: título e descrição preenchidos (spec §2.2). */
export function isValidSellingPoint(point: SellingPoint): boolean {
  return point.title.trim().length > 0 && point.description.trim().length > 0;
}

/**
 * Conversão de preço para o campo `closed_group_min_price_cents`
 * (spec 099, B2).
 *
 * A leitura vive em `formatPriceBRL` (MestreClosedGroupSection.tsx:15):
 * `(cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
 * — formato pt-BR: vírgula decimal, ponto de milhar, prefixo "R$ ". A escrita
 * é o inverso exato dela: reais (string digitada) → centavos (inteiro), com
 * as mesmas regras de formatação decimal.
 *
 * Único consumidor: `ClosedGroupPriceField` em `GmProfileFields.tsx`.
 * Exportado para os testes do contrato de escrita.
 */

/**
 * Converte um valor digitado em reais para centavos inteiros.
 *
 * Regras (espelho do formato emitido por `formatPriceBRL`):
 * - aceita o formato exato da leitura: "R$ 10", "R$ 10,50", "R$ 1.234,56"
 *   (prefixo opcional; ponto antes da vírgula é milhar);
 * - sem vírgula e com ponto, o ponto é decimal de digitação ("10.50" → 1050);
 *   fração de 3 dígitos é ambígua com milhar pt-BR e vira inválida;
 * - fração de 1 dígito são décimos ("10,5" → 1050);
 * - vazio, negativo ou não-numérico → null (o backend só aceita inteiro >= 0).
 */
export function reaisParaCentavos(input: string): number | null {
  if (typeof input !== 'string') return null;
  let value = input.trim();
  if (value === '') return null;
  value = value.replace(/^R\$\s*/i, '');
  if (value === '') return null;
  if (value.startsWith('-')) return null;

  let reaisPart: string;
  let centsPart: string | null = null;

  if (value.includes(',')) {
    const parts = value.split(',');
    if (parts.length !== 2) return null;
    [reaisPart, centsPart] = parts;
    // Milhar pt-BR: ponto antes da vírgula é separador ("1.234,56").
    reaisPart = reaisPart.replace(/\./g, '');
  } else if (value.includes('.')) {
    const parts = value.split('.');
    if (parts.length !== 2 || parts[1].length > 2) return null;
    [reaisPart, centsPart] = parts;
  } else {
    reaisPart = value;
  }

  if (reaisPart === '' || !/^\d+$/.test(reaisPart)) return null;

  let cents = 0;
  if (centsPart !== null) {
    if (centsPart.length > 2 || !/^\d+$/.test(centsPart)) return null;
    cents = centsPart === '' ? 0 : Number(centsPart.padEnd(2, '0'));
  }

  const total = Number(reaisPart) * 100 + cents;
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

/**
 * Inverso de exibição: centavos → string em reais para o input
 * ("10,50"), no MESMO padrão decimal de `formatPriceBRL`, sem o prefixo
 * de moeda (o campo já diz "R$" no rótulo). null/undefined → "".
 */
export function centavosParaReais(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '';
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
