import { mapTableToView } from '@artificio/catalog-table';
import type { TableViewModel } from '@artificio/catalog-table';
import { MODULE_ORIGINS } from '@artificio/config';
import type { MesaLoaderData } from '../../../routes/mesa';

const SITE_NAME = 'Artifício Mesas';
const SITE_URL = MODULE_ORIGINS.mesas;

type MetaDescriptor = Record<string, unknown>;

/**
 * `description` por mesa (spec 102 T4.5).
 *
 * Toda URL do app repetia a description institucional, o que deixa o snippet de
 * busca idêntico em 88 páginas. Aqui ela é montada a partir do que a pessoa de
 * fato procura — sistema, modalidade, nível, preço e vagas — usando campos que
 * já existem, sem coleta nova.
 *
 * Os mesmos valores aparecem no HTML visível da página. Isso não é redundância:
 * é a regra pétrea de T4.3 — nenhum fato pode existir só no metadado.
 */
/** 160 caracteres é o ponto em que o Google passa a truncar o snippet. */
const LIMITE_DESCRIPTION = 160;
const SEPARADOR = ' | ';
/** Abaixo disto a sinopse não informa nada; melhor entregar só as facetas. */
const MINIMO_DE_SINOPSE = 60;

/** Corta no limite preservando o `…`, que conta para o total. */
function truncarNoLimite(texto: string, limite: number): string {
  if (texto.length <= limite) return texto;
  return `${texto.slice(0, limite - 1).trimEnd()}…`;
}

export function buildTableDescription(vm: TableViewModel): string {
  const sinopse = (vm.description ?? vm.narrative ?? '').replace(/\s+/g, ' ').trim();

  const facetas = [
    vm.system,
    vm.modality,
    vm.experience,
    describePrice(vm),
    describeSlots(vm),
  ].filter((parte): parte is string => Boolean(parte?.trim()));

  const cauda = truncarNoLimite(facetas.join(' • '), LIMITE_DESCRIPTION);

  if (!sinopse) {
    return cauda || `Mesa de RPG no ${SITE_NAME}.`;
  }

  // A cauda de facetas é o que menos se pode perder — é o dado que a pessoa
  // procura —, então a sinopse cede espaço primeiro, e cede até sumir. Só uma
  // cauda que sozinha não cabe em 160 é truncada, acima.
  //
  // O piso de 60 caracteres vale só ENQUANTO couber: era um `Math.max(60, …)`
  // incondicional, e com cauda longa o piso vencia e a soma estourava o limite.
  // Medido com dado real do catálogo: "Little Fears – The Role-playing Game of
  // Childhood Terror" (56 chars, um dos 682 sistemas cadastrados) mais
  // modalidade, nível, preço e vagas dá cauda de 108 e description de **172**.
  // O teste que existia usava `Dungeons & Dragons` (18 chars) e nunca exercitou
  // cauda longa. Achado do CodeRabbit na PR #319.
  const espacoDisponivel = LIMITE_DESCRIPTION - cauda.length - SEPARADOR.length;
  if (espacoDisponivel < MINIMO_DE_SINOPSE) return cauda;

  const sinopseTruncada = truncarNoLimite(sinopse, espacoDisponivel);
  return `${sinopseTruncada}${SEPARADOR}${cauda}`;
}

function describePrice(vm: TableViewModel): string | null {
  // O preço sai de `price_value`/`price_type`, NUNCA do rótulo do contato:
  // "Ticket / Inscrição" aparece em 106 contatos, mas 101 dessas mesas são
  // gratuitas — derivar do rótulo geraria preço falso em 95% dos casos.
  if (vm.priceType === 'gratuita') return 'Gratuita';
  if (typeof vm.price === 'number' && vm.price > 0) {
    return `R$ ${vm.price.toFixed(2).replace('.', ',')}`;
  }
  return null;
}

function describeSlots(vm: TableViewModel): string | null {
  if (vm.isFull) return 'Sem vagas';
  if (vm.slotsLeft > 0) {
    return vm.slotsLeft === 1 ? '1 vaga' : `${vm.slotsLeft} vagas`;
  }
  return null;
}

/**
 * JSON-LD da mesa (spec 102 T4.3): `Product` + `Offer` num `@graph`, sem `Event`.
 *
 * `Event` foi descartado em T4.4: o catálogo é 100% online (`online | 168`) e o
 * Google não dá rich result de evento a experiência virtual sem componente
 * físico. Emitir assim mesmo arriscaria ação manual de structured data, que
 * retiraria a elegibilidade do próprio `Product`.
 *
 * O schema deriva do MESMO `TableViewModel` que a página renderiza — não de uma
 * segunda leitura do dado cru. É isso que torna impossível o JSON-LD divergir do
 * HTML visível, em vez de deixar a coerência por conta de quem editar depois.
 */
/**
 * Preço publicável no JSON-LD, ou `null` quando não há um.
 *
 * Mesa gratuita é `"0"`, não ausência de preço: omitir faria o consumidor tratar
 * como "preço desconhecido", que é outra coisa.
 *
 * Mesa PAGA sem `price_value` devolve `null`, e não `"0.00"`. O estado é
 * alcançável: `validateDraftForSync` (`syncHelpers.ts:157`) valida `price_type` e
 * NÃO `price_value`, e o update preserva o status de mesa já publicada — então
 * existe mesa `paga` com `price_value` nulo, que `normalizeNumeric`
 * (`tableViewMapper.ts:261`) traduz em `vm.price === undefined`. O fallback
 * anterior publicava uma oferta gratuita que a página não mostra, que é
 * exatamente o markup divergente do HTML que a ação manual de structured data
 * pune. Achado do Codex (P2) na PR #319.
 */
function priceForJsonLd(vm: TableViewModel): string | null {
  if (vm.priceType === 'gratuita') return '0';
  if (typeof vm.price === 'number' && Number.isFinite(vm.price) && vm.price > 0) {
    return vm.price.toFixed(2);
  }
  return null;
}

export function buildTableJsonLd(vm: TableViewModel): Record<string, unknown> | null {
  const url = `${SITE_URL}/mesas/${vm.slug}`;
  const price = priceForJsonLd(vm);

  // Sem preço publicável NÃO SAI JSON-LD NENHUM, e não um `Product` sem oferta.
  // `Product` exige `name` MAIS uma propriedade qualificadora — uma de
  // `offers`/`review`/`aggregateRating`; `brand` e `image` não substituem
  // nenhuma delas. A correção anterior omitia só a `Offer` e deixava o
  // `Product` órfão, que é erro crítico no Rich Results Test: trocava preço
  // errado por markup inválido, e o aceite de T4.3 exige markup válido.
  //
  // A mesa segue indexável pelo HTML e pelas meta tags — o que se perde é a
  // elegibilidade a rich result, que ela já não teria com markup reprovado.
  // Achado do Codex (P2) na PR #319, segunda rodada sobre o mesmo ponto.
  if (price === null) return null;

  const product: Record<string, unknown> = {
    '@type': 'Product',
    name: vm.title,
    description: buildTableDescription(vm),
    url,
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'BRL',
      price,
      availability: vm.isFull
        ? 'https://schema.org/SoldOut'
        : 'https://schema.org/InStock',
    },
  };

  if (vm.coverUrl) product.image = vm.coverUrl;
  if (vm.masterName) product.brand = { '@type': 'Person', name: vm.masterName };

  return { '@context': 'https://schema.org', '@graph': [product] };
}

/**
 * Tags de `<head>` da rota de mesa — o que substitui a injeção por regex do
 * `og.ts` (spec 102 T4.2).
 *
 * Iguais para todo user-agent. O `og.ts` costurava meta no HTML buildado só
 * quando o nginx reconhecia o UA como crawler, o que é dynamic rendering e é a
 * origem da divergência bot↔usuário desta spec.
 */
export function buildTableMeta(loaderData: MesaLoaderData | undefined): MetaDescriptor[] {
  if (!loaderData) {
    return [
      { title: `Mesa não encontrada — ${SITE_NAME}` },
      // Página de erro não se declara canônica: reafirmar ao índice a URL que o
      // status manda esquecer trabalha contra o próprio 404/410.
      { name: 'robots', content: 'noindex' },
    ];
  }

  if (loaderData.kind === 'gone') {
    const { closed } = loaderData;
    return [
      { title: `${closed.title} — mesa encerrada | ${SITE_NAME}` },
      {
        name: 'description',
        content: `Esta mesa foi encerrada e não recebe mais inscrições. Veja outras mesas de RPG abertas no ${SITE_NAME}.`,
      },
      { name: 'robots', content: 'noindex' },
    ];
  }

  const vm = mapTableToView(loaderData.table);
  const url = `${SITE_URL}/mesas/${vm.slug}`;
  const title = `${vm.title} | ${SITE_NAME}`;
  const description = buildTableDescription(vm);
  const image = vm.coverUrl ?? `${SITE_URL}/og-default.png`;

  const tags: MetaDescriptor[] = [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: url },

    { property: 'og:type', content: 'article' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: image },
    { property: 'og:url', content: url },
    { property: 'og:site_name', content: SITE_NAME },

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: image },
  ];

  // A tag só existe se houver JSON-LD válido. Emitir `{'script:ld+json': null}`
  // produziria um `<script type="application/ld+json">null</script>`, que é
  // markup inválido — pior que a ausência, porque o validador o reprova em vez
  // de ignorar.
  const jsonLd = buildTableJsonLd(vm);
  if (jsonLd) tags.push({ 'script:ld+json': jsonLd });

  return tags;
}
