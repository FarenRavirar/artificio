// ============================================================================
// Descrição Open Graph das páginas públicas de mesa e mestre (rota /og).
// Extraído de routes/og.ts para um módulo puro e testável (bug OG 2026-08-22).
// ============================================================================

// ----------------------------------------------------------------------------
// Por que a correção é na SELEÇÃO do candidato, e não no truncate
// ----------------------------------------------------------------------------
// Causa raiz medida em produção (2026-08-22): a cadeia
// `listing_excerpt || synopsis_narrative || synopsis || description` tratava
// string só-whitespace como conteúdo, porque `"\n"` é truthy em JS. A mesa
// `idade-das-trevas-noites-na-toscana-mt4uezwv` tinha `synopsis = "\n"` e
// `description` com 2618 caracteres: a cadeia escolhia `"\n"`, o truncate
// (que colapsa `\s+`→espaço e faz trim) devolvia `""`, e o preview saía com
// `og:description content=""` — 1 mesa ativa afetada em produção.
//
// O truncate está correto e foi preservado sem nenhuma mudança: ele é o
// último passo (colapsa whitespace, trim, corta em 200 com `…`). O defeito
// estava no critério de escolha ANTES dele. Corrigir no truncate (ex.: cair
// no próximo candidato quando o resultado fosse vazio) esconderia a causa e
// mudaria o contrato da função para todos os callers. A normalização
// pertence ao ponto de seleção: "em branco" passa a ser
// `value == null || value.trim() === ''`, e o primeiro candidato não-branco
// vence — preservando a ordem de prioridade que já existia.
// ----------------------------------------------------------------------------
//
// O primitivo genérico (seleção por primeiro não-branco, colapso de
// whitespace, trim e corte em `max` com `…`) agora vive em
// `@artificio/content` (`normalizeOgDescription`), compartilhado por mesas,
// downloads e glossario. Este módulo fica responsável só pelo mapeamento de
// campos específico do mesas: a ordem de prioridade dos candidatos e os
// fallbacks de título/perfil. As assinaturas públicas (`TableOgFields`,
// `GmOgFields`, `buildTableDescription`, `buildGmDescription`) não mudam.
// ----------------------------------------------------------------------------

import { normalizeOgDescription } from '@artificio/content';

export interface TableOgFields {
  listing_excerpt: string | null;
  synopsis_narrative: string | null;
  synopsis: string | null;
  description: string | null;
  title: string;
  system_name: string | null;
  gm_display_name: string | null;
}

export interface GmOgFields {
  tagline: string | null;
  bioLong: string | null;
  displayName: string;
  siteName: string;
}

export function buildTableDescription(table: TableOgFields): string {
  // Fallback de título: já existia em routes/og.ts e fica idêntico.
  const parts = [table.title];
  if (table.system_name) parts.push(table.system_name);
  if (table.gm_display_name) parts.push(`mestrada por ${table.gm_display_name}`);

  return normalizeOgDescription(
    [table.listing_excerpt, table.synopsis_narrative, table.synopsis, table.description],
    parts.join(' — '),
  );
}

export function buildGmDescription({ tagline, bioLong, displayName, siteName }: GmOgFields): string {
  return normalizeOgDescription(
    [tagline, bioLong],
    `Conheça o perfil do mestre ${displayName} e descubra suas mesas ativas no ${siteName}.`,
  );
}
