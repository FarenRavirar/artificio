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
export function buildTableDescription(vm: TableViewModel): string {
  const sinopse = (vm.description ?? vm.narrative ?? '').replace(/\s+/g, ' ').trim();

  const facetas = [
    vm.system,
    vm.modality,
    vm.experience,
    describePrice(vm),
    describeSlots(vm),
  ].filter((parte): parte is string => Boolean(parte && parte.trim()));

  const cauda = facetas.join(' • ');

  if (!sinopse) {
    return cauda || `Mesa de RPG no ${SITE_NAME}.`;
  }

  // 160 caracteres é o ponto em que o Google passa a truncar; a cauda de facetas
  // é o que menos se pode perder, então a sinopse é que cede espaço.
  const espacoParaSinopse = Math.max(60, 157 - cauda.length - 3);
  const sinopseTruncada =
    sinopse.length > espacoParaSinopse ? `${sinopse.slice(0, espacoParaSinopse).trimEnd()}…` : sinopse;

  return cauda ? `${sinopseTruncada} | ${cauda}` : sinopseTruncada;
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
export function buildTableJsonLd(vm: TableViewModel): Record<string, unknown> {
  const url = `${SITE_URL}/mesas/${vm.slug}`;

  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url,
    priceCurrency: 'BRL',
    // Mesa gratuita é `price: "0"`, não ausência de preço: omitir faria o
    // consumidor tratar como "preço desconhecido", que é outra coisa.
    price: vm.priceType === 'gratuita' ? '0' : (vm.price ?? 0).toFixed(2),
    availability: vm.isFull
      ? 'https://schema.org/SoldOut'
      : 'https://schema.org/InStock',
  };

  const product: Record<string, unknown> = {
    '@type': 'Product',
    name: vm.title,
    description: buildTableDescription(vm),
    url,
    offers: offer,
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

  return [
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

    { 'script:ld+json': buildTableJsonLd(vm) },
  ];
}
