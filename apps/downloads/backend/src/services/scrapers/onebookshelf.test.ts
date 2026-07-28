import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyOneBookShelfOverride } from './platformOverrides/onebookshelf';
import type { PlatformOverrideInput } from './platformOverrides';

const FIXTURES_DIR = path.resolve(__dirname, '../../../test/fixtures');

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf-8');
}

function preview(): PlatformOverrideInput {
  return {
    sourceUrl: 'https://www.dmsguild.com/pt/product/example',
    title: 'Teste',
    description: 'Descrição JSON-LD truncada',
    isFreeOrPwyw: null,
    coverImageUrl: null,
    publisherName: null,
    sourceLanguageEvidence: 'pt',
    extractedPriceValue: 0,
    priceSignal: 'zero_price_no_pwyw_tag',
  };
}

describe('applyOneBookShelfOverride', () => {
  it.each([
    ['dms-guild-product-1.html', 'Inespecífico/Qualquer mundo', 15],
    ['drivethrurpg-product-1.html', 'Outros sistemas exclusivos', 18],
    ['storytellersvault-product-1.html', 'Vampire the Masquerade', 58],
  ])('extrai metadata rica do fixture real %s', (fixture, systemHint, pageCount) => {
    const result = applyOneBookShelfOverride(preview(), loadFixture(fixture));

    // Achado real (spec 086, Fase 4): data-codeid="ruleSystem" (label real
    // "Universo de jogo") é o SISTEMA/regra do material, não o cenário de
    // ambientação — antes desta correção ia pro campo 'scenario' por engano.
    expect(result.systemHint).toBe(systemHint);
    expect(result.scenario).toBeUndefined();
    expect(result.pageCount).toBe(pageCount);
    expect(result.authorsCredits).not.toBeNull();
    expect(result.fileSizeText).not.toBeNull();
    expect(result.format).toBe('PDF');
    expect(result.descriptionHtml).not.toBeNull();
    expect(result.tags).toEqual(expect.any(Array));
  });

  it('não captura data-codeid do bloco de avaliações fora da table-list', () => {
    const result = applyOneBookShelfOverride(preview(), loadFixture('storytellersvault-product-1.html'));

    expect(result.systemHint).toBe('Vampire the Masquerade');
    expect(result.authorsCredits).toMatch(/^Lobo Loss/);
    expect(result.sourceFilters?.flatMap(({ path }) => path).join(' ')).not.toMatch(/comment|customer|badge|discussion/i);
    expect(result).not.toHaveProperty('commentText');
    expect(result).not.toHaveProperty('customerName');
    expect(result).not.toHaveProperty('badgeType');
    expect(result).not.toHaveProperty('discussionDate');
  });

  it('usa obs-product-description completa em vez do texto JSON-LD truncado', () => {
    const result = applyOneBookShelfOverride(preview(), loadFixture('dms-guild-product-1.html'));

    expect(result.descriptionHtml).toContain('<ul>');
    expect(result.descriptionHtml).toContain('<img');
    expect(result.description).not.toContain('<');
  });

  // Spec 088 (T2.3c) — três defeitos achados validando o parser contra DOM
  // real das duas lojas (2026-07-26). Todos afetavam também a importação
  // manual por URL, que é o caminho por onde os materiais `dms_guild` do
  // acervo entraram.
  describe('T2.3c — ausência e facets multi-idioma', () => {
    it('converte o "N / D" da loja em null, em vez de exibi-lo como valor real', () => {
      const result = applyOneBookShelfOverride(preview(), loadFixture('dms-guild-product-1.html'));

      // A loja escreve "N / D" (pt) / "N/A" (en) no lugar de omitir a linha.
      // Nesta fixture é a Categoria que vem assim; preservada como texto,
      // "N / D" apareceria na ficha como se fosse a categoria real da obra —
      // afirmação falsa, exatamente o que o requisito 38 proíbe.
      expect(result.sourceCategory).toBeNull();
      // Valor real na mesma tabela continua intacto — a anulação é cirúrgica.
      expect(result.artistsCredits).toBe('Angevine, Dall.e');
    });

    it('nunca deixa o rótulo do tile virar valor quando o valor é ausente', () => {
      const result = applyOneBookShelfOverride(preview(), loadFixture('dms-guild-product-1.html'));

      // Com "N / D" anulado, o tile "Categoria" colapsa para um único
      // parágrafo (só o rótulo) — e `paragraphs.at(-1)` devolveria o próprio
      // rótulo, gravando "Categoria" no lugar da categoria.
      expect(result.sourceCategory).toBeNull();
      // O tile seguinte continua resolvendo normalmente: a exigência de 2+
      // parágrafos não pode derrubar tile bem-formado.
      expect(result.pageCount).toBe(15);
    });

    it('extrai filtros da loja em inglês, não só os facets em português', () => {
      // DriveThruRPG serve `?genre=`/`?productType=`; DMs Guild serve
      // `?tipoDeProduto=`/`?edicao=`/`?tema=`. Com só os nomes em português
      // no conjunto, toda página em inglês saía com `tags` VAZIO —
      // silenciosamente, porque a linha `filters` existe e é encontrada.
      const result = applyOneBookShelfOverride(preview(), loadFixture('drivethrurpg-product-1.html'));

      expect(result.sourceFilters?.length).toBeGreaterThan(0);
      expect(result.tags?.length).toBeGreaterThan(0);
    });

    // Spec 088 (T2.9c, requisitos 51/56) — o tipo que a loja declara vive no
    // facet `tipoDeProduto`/`productType`, não em texto livre.
    it('emite o hint de tipo a partir do facet, usando a folha do caminho', () => {
      const result = applyOneBookShelfOverride(preview(), loadFixture('dms-guild-product-1.html'));

      // O facet é hierárquico ("Opções para personagens" > "Classe/Arquétipo")
      // e a folha é o termo mais específico que a loja atribuiu.
      expect(result.materialTypeHint).toBe('Classe/Arquétipo');
    });

    it('nunca deriva tipo de título ou descrição quando o facet não existe', () => {
      // Remove a linha de filtros inteira: sem facet, o hint é `null`
      // explícito. Inventar tipo a partir de texto livre contamina filtro e
      // badge com classificação falsa (requisito 56).
      const html = loadFixture('dms-guild-product-1.html').replace(/data-codeid="filters"/g, 'data-codeid="removido"');
      const result = applyOneBookShelfOverride(preview(), html);

      expect(result.materialTypeHint).toBeNull();
    });

    it('preserva nome real que apenas começa com as iniciais de ausência', () => {
      // "N/A Studios" é nome real; a âncora exige a string inteira, senão a
      // correção de ausência apagaria crédito legítimo.
      const html = loadFixture('dms-guild-product-1.html').replaceAll('Angevine', 'N/A Studios');
      const result = applyOneBookShelfOverride(preview(), html);

      expect(result.artistsCredits).toBe('N/A Studios, Dall.e');
    });
  });

  it('deriva tags achatadas dos caminhos tipados de filters', () => {
    const result = applyOneBookShelfOverride(preview(), loadFixture('dms-guild-product-1.html'));

    expect(result.sourceFilters).toEqual([
      { facet: 'tipoDeProduto', path: ['Opções para personagens', 'Classe/Arquétipo'] },
      { facet: 'conteudo', path: ['DMsGuild'] },
      { facet: 'edicao', path: ['5th Edition', '5e'] },
    ]);
    expect(result.tags).toEqual(expect.arrayContaining(['Opções para personagens', 'Classe/Arquétipo', 'DMsGuild', '5th Edition', '5e']));
  });
});
