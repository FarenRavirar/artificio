import { describe, it, expect } from 'vitest';
import { mapTableToView } from '@artificio/catalog-table';
import type { TableDetail } from '@artificio/catalog-table';

import { buildTableDescription, buildTableJsonLd, buildTableMeta } from './tableMeta';

/**
 * Cobertura das regras pétreas de T4.3/T4.5 (spec 102).
 *
 * O que estas asserções protegem não é a forma do JSON-LD, é a regra que o
 * torna legítimo: nenhum fato pode existir só no metadado, e preço/vagas saem
 * do dado do banco e nunca de literal. Markup que contradiz a página é
 * exatamente o que a ação manual de structured data pune — e, medido no
 * experimento SearchVIU (30/10/2025), preço só em JSON-LD foi extraído por 0 de
 * 5 sistemas de IA, então divergir não só arrisca punição como não entrega nada.
 *
 * O schema deriva do MESMO `TableViewModel` que a página renderiza. Estes testes
 * existem para que uma edição futura não troque essa derivação por leitura
 * paralela do dado cru, que é o caminho pelo qual metadado e HTML divergem sem
 * nada falhar.
 */
function makeTableDetail(overrides: Partial<TableDetail> = {}): TableDetail {
  return {
    id: 'table-1',
    slug: 'mesa-teste',
    title: 'Mesa teste',
    description: null,
    cover_url: null,
    status: 'active',
    type: 'campanha',
    audience: 'livre',
    modality: 'online',
    price_type: 'gratuita',
    price_value: null,
    slots_total: 5,
    slots_filled: 1,
    slots_open: 4,
    language: 'pt-BR',
    experience_level: 'intermediario',
    featured: false,
    publisher_role: 'gm',
    actual_gm_name: null,
    contacts: [],
    system_name: 'Dungeons & Dragons',
    system_slug: 'dungeons-dragons',
    gm_slug: null,
    gm_avatar_url: null,
    gm_display_name: 'Mestre Teste',
    gm_bio_long: null,
    is_ddal: false,
    is_covil: false,
    created_at: '2026-08-21T00:00:00.000Z',
    price_frequency: null,
    price_value_monthly: null,
    accepts_donations: false,
    suggested_donation_value: null,
    starts_at: null,
    city: null,
    state: null,
    content_warnings: [],
    safety_tools: [],
    table_gm_bio: null,
    ...overrides,
  };
}

/**
 * Extrai `product`/`offer` do JSON-LD, e FALHA se não houver markup.
 *
 * O ramo sem JSON-LD (mesa paga sem preço) tem teste próprio, que chama
 * `buildTableJsonLd` direto. Devolver `null` daqui só empurrava o estreitamento
 * para cada `expect`, e o `tsc -b` — que inclui os testes — reprovava com
 * TS18047 em 13 linhas enquanto o vitest passava, porque runtime não checa tipo.
 */
function jsonLdOf(detail: TableDetail) {
  const jsonLd = buildTableJsonLd(mapTableToView(detail));
  if (!jsonLd) throw new Error('esperava JSON-LD, e buildTableJsonLd devolveu null');
  const graph = jsonLd['@graph'] as Record<string, unknown>[];
  const product = graph[0];
  return { product, offer: product.offers as Record<string, unknown> };
}

describe('buildTableJsonLd — preço (regra 1 de T4.3)', () => {
  it('mesa gratuita emite price "0", não ausência de preço', () => {
    // Omitir o preço não comunica "grátis": comunica "preço desconhecido", que é
    // outra coisa e some do snippet.
    const { offer } = jsonLdOf(makeTableDetail({ price_type: 'gratuita', price_value: null }));

    expect(offer.price).toBe('0');
    expect(offer.priceCurrency).toBe('BRL');
  });

  it('mesa paga emite o valor de price_value', () => {
    const { offer } = jsonLdOf(makeTableDetail({ price_type: 'paga', price_value: 50 }));

    expect(offer.price).toBe('50.00');
  });

  it('mesa PAGA sem price_value NÃO emite JSON-LD nenhum', () => {
    // Estado alcançável: `validateDraftForSync` (syncHelpers.ts:157) valida
    // `price_type` e NÃO `price_value`, e o update preserva o status de mesa já
    // publicada. Duas saídas erradas já foram tentadas aqui: `(vm.price ?? 0)`
    // publicava uma oferta GRATUITA que a página não mostra; omitir só a `Offer`
    // deixava um `Product` órfão, e `Product` exige `name` MAIS uma propriedade
    // qualificadora (`offers`/`review`/`aggregateRating`) — `brand` e `image` não
    // servem. A saída certa é não emitir markup. Achado do Codex (P2) PR #319,
    // duas rodadas sobre o mesmo ponto.
    expect(buildTableJsonLd(mapTableToView(makeTableDetail({ price_type: 'paga', price_value: null })))).toBeNull();
  });

  it('mesa PAGA com price_value zero também não emite JSON-LD', () => {
    // `0` numa mesa paga é dado inconsistente, não gratuidade: quem é gratuito
    // tem `price_type: 'gratuita'`.
    expect(buildTableJsonLd(mapTableToView(makeTableDetail({ price_type: 'paga', price_value: 0 })))).toBeNull();
  });

  it('sem JSON-LD válido, a tag ld+json não entra nas meta tags', () => {
    // `{'script:ld+json': null}` viraria `<script …>null</script>`: markup
    // inválido, que o validador reprova em vez de ignorar. A mesa segue
    // indexável pelo HTML e pelas meta tags.
    const meta = buildTableMeta({
      kind: 'ok',
      table: makeTableDetail({ price_type: 'paga', price_value: null }),
    });

    expect(meta.some((tag) => 'script:ld+json' in tag)).toBe(false);
    expect(meta).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://mesas.artificiorpg.com/mesas/mesa-teste',
    });
  });

  it('preço não vem do rótulo do contato', () => {
    // "Ticket / Inscrição" aparece em ~106 contatos, mas 101 dessas mesas são
    // gratuitas: derivar do rótulo geraria preço falso em ~95% dos casos.
    const { offer } = jsonLdOf(
      makeTableDetail({
        price_type: 'gratuita',
        price_value: null,
        contacts: [
          {
            channel: 'form',
            value: 'https://exemplo.com',
            label: 'Ticket / Inscrição',
            discord_server_url: null,
            sort_order: 0,
          },
        ],
      }),
    );

    expect(offer.price).toBe('0');
  });
});

describe('buildTableJsonLd — disponibilidade (regra 2 de T4.3)', () => {
  it('mesa com vaga é InStock', () => {
    const { offer } = jsonLdOf(makeTableDetail({ slots_total: 5, slots_filled: 1, slots_open: 4 }));

    expect(offer.availability).toBe('https://schema.org/InStock');
  });

  it('mesa lotada é SoldOut — InStock contradiria a página', () => {
    const { offer } = jsonLdOf(makeTableDetail({ slots_total: 5, slots_filled: 5, slots_open: 0 }));

    expect(offer.availability).toBe('https://schema.org/SoldOut');
  });
});

describe('buildTableJsonLd — imagem (regra 3 de T4.3)', () => {
  it('omite image quando a mesa não tem imagem, em vez de emitir placeholder', () => {
    // 23 das 168 mesas não têm imagem nenhuma. `image` não é obrigatória em
    // `Product` (obrigatórias: `name` e um de offers/review/aggregateRating);
    // emitir imagem que não está na página violaria "don't mark up content that
    // is not visible to readers".
    const { product } = jsonLdOf(makeTableDetail({ cover_url: null }));

    expect(product.image).toBeUndefined();
  });

  it('emite image quando existe (o cover_url do payload é o banner_url do banco)', () => {
    const { product } = jsonLdOf(
      makeTableDetail({ cover_url: 'https://res.cloudinary.com/demo/banner.png' }),
    );

    expect(product.image).toBe('https://res.cloudinary.com/demo/banner.png');
  });
});

describe('buildTableJsonLd — forma do @graph (aceite 2 de T4.3)', () => {
  it('emite um Product e nenhum Event', () => {
    // `Event` foi descartado em T4.4: o catálogo é 100% online e o Google não dá
    // rich result a experiência virtual sem componente físico. Emitir mesmo
    // assim arriscaria ação manual, que retiraria a elegibilidade do Product.
    const serialized = JSON.stringify(buildTableJsonLd(mapTableToView(makeTableDetail())));

    expect(serialized.match(/"@type":"Product"/g)).toHaveLength(1);
    expect(serialized.match(/"@type":"Event"/g)).toBeNull();
  });

  it('a url do Product e da Offer é a canônica da mesa', () => {
    const { product, offer } = jsonLdOf(makeTableDetail({ slug: 'o-reinado-da-rainha-dragao' }));
    const url = 'https://mesas.artificiorpg.com/mesas/o-reinado-da-rainha-dragao';

    expect(product.url).toBe(url);
    expect(offer.url).toBe(url);
  });
});

describe('buildTableDescription — T4.5', () => {
  it('duas mesas distintas produzem descriptions distintas', () => {
    // O defeito que a task corrige: 168 páginas repetindo a description
    // institucional dão ao modelo 168 vezes a mesma informação.
    const a = buildTableDescription(
      mapTableToView(makeTableDetail({ title: 'A', description: 'Uma caçada no norte gelado.' })),
    );
    const b = buildTableDescription(
      mapTableToView(
        makeTableDetail({
          title: 'B',
          description: 'Intriga política numa cidade portuária.',
          system_name: 'Vampiro',
        }),
      ),
    );

    expect(a).not.toBe(b);
    expect(a).not.toMatch(/Plataforma gratuita para encontrar mesas de RPG/);
  });

  it('carrega a cauda de facetas com sistema, modalidade, preço e vagas', () => {
    const description = buildTableDescription(
      mapTableToView(
        makeTableDetail({
          description: 'Uma caçada no norte gelado.',
          system_name: 'Dungeons & Dragons',
          modality: 'online',
          price_type: 'gratuita',
          slots_total: 5,
          slots_filled: 1,
          slots_open: 4,
        }),
      ),
    );

    expect(description).toContain('Dungeons & Dragons');
    expect(description).toContain('online');
    expect(description).toContain('Gratuita');
    expect(description).toContain('4 vagas');
  });

  // O nome de sistema é o único componente da cauda sem tamanho limitado:
  // `modality`, `experience`, preço e vagas são enums ou números curtos. Este é
  // o mais longo dos 682 sistemas do catálogo (56 caracteres) — dado real, não
  // fabricado para o teste.
  const SISTEMA_MAIS_LONGO = 'Little Fears – The Role-playing Game of Childhood Terror';

  it('respeita o orçamento de 160 caracteres mesmo com a cauda mais longa do catálogo', () => {
    // Regressão medida: o piso de 60 caracteres para a sinopse era
    // incondicional, então com cauda de 108 a description saía com **172**. O
    // teste antigo usava `Dungeons & Dragons` (18 chars) e nunca chegava lá.
    const description = buildTableDescription(
      mapTableToView(
        makeTableDetail({
          description: 'Lorem ipsum dolor sit amet. '.repeat(40),
          system_name: SISTEMA_MAIS_LONGO,
          modality: 'presencial',
          price_type: 'paga',
          price_value: 100,
          slots_total: 12,
          slots_filled: 0,
          slots_open: 12,
        }),
      ),
    );

    expect(description.length).toBeLessThanOrEqual(160);
    // A cauda sobrevive inteira: é o dado que a pessoa procura.
    expect(description).toContain('12 vagas');
    expect(description).toContain(SISTEMA_MAIS_LONGO);
  });

  it('sem espaço para uma sinopse útil, entrega só a cauda', () => {
    // Sinopse de 20 caracteres não informa nada e ainda rouba espaço das
    // facetas; o limiar é 60.
    const description = buildTableDescription(
      mapTableToView(
        makeTableDetail({
          description: 'Uma aventura épica no norte gelado com muitos perigos.',
          system_name: SISTEMA_MAIS_LONGO,
          modality: 'presencial',
          price_type: 'paga',
          price_value: 100,
          slots_total: 12,
          slots_filled: 0,
          slots_open: 12,
        }),
      ),
    );

    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).not.toContain('|');
    expect(description).toContain(SISTEMA_MAIS_LONGO);
  });

  it('respeita o orçamento de 160 caracteres truncando a sinopse, não a cauda', () => {
    // A cauda é o que menos se pode perder: é o dado que a pessoa procura.
    const description = buildTableDescription(
      mapTableToView(makeTableDetail({ description: 'Lorem ipsum dolor sit amet. '.repeat(40) })),
    );

    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toContain('Gratuita');
  });

  it('não quebra quando a mesa não tem sinopse', () => {
    const description = buildTableDescription(
      mapTableToView(makeTableDetail({ description: null })),
    );

    expect(description.trim()).not.toBe('');
  });
});

describe('buildTableMeta — espelhamento e páginas sem conteúdo', () => {
  it('o preço e as vagas do JSON-LD saem do mesmo ViewModel que a página renderiza', () => {
    // Este é o teste da regra pétrea. O JSON-LD e o HTML visível não podem
    // divergir porque derivam da MESMA função — `TableActionPanel` renderiza
    // "Gratuita" (:44) e "N de M vagas" (:178) do mesmo `vm`.
    const table = makeTableDetail({ slots_total: 5, slots_filled: 5, slots_open: 0 });
    const vm = mapTableToView(table);
    const { offer } = jsonLdOf(table);

    expect(vm.isFull).toBe(true);
    expect(offer.availability).toBe('https://schema.org/SoldOut');
    expect(offer.price).toBe(vm.priceType === 'gratuita' ? '0' : String(vm.price));
  });

  it('mesa encerrada é noindex — 410 com conteúdo legítimo, não indexável', () => {
    const meta = buildTableMeta({
      kind: 'gone',
      closed: {
        id: null,
        title: 'Mesa encerrada',
        closedAt: null,
        reason: 'gm',
        closedByName: null,
      },
    });

    expect(meta).toContainEqual({ name: 'robots', content: 'noindex' });
  });

  it('sem dado do loader não se declara canônica', () => {
    // Reafirmar ao índice a URL que o status manda esquecer trabalha contra o
    // próprio 404/410.
    const meta = buildTableMeta(undefined);

    expect(meta).toContainEqual({ name: 'robots', content: 'noindex' });
    expect(meta.some((tag) => 'rel' in tag && tag.rel === 'canonical')).toBe(false);
  });

  it('mesa válida emite canonical e um bloco ld+json', () => {
    const meta = buildTableMeta({ kind: 'ok', table: makeTableDetail() });

    expect(meta).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://mesas.artificiorpg.com/mesas/mesa-teste',
    });
    expect(meta.filter((tag) => 'script:ld+json' in tag)).toHaveLength(1);
  });
});
