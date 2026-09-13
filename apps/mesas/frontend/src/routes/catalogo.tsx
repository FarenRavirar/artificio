import { data } from 'react-router';
import type { LoaderFunctionArgs, MetaArgs } from 'react-router';
import { MODULE_ORIGINS } from '@artificio/config';
// `export … from` no fim do arquivo, e não `import` + `export default`: o
// re-export direto não cria binding local que só existe para ser reexportado.
// Achado do Sonar na PR #316.
export { CatalogoPage as default } from '../pages/CatalogoPage';
import { LOADER_TIMEOUT_MS } from '../lib/apiUrl';
import { fetchCatalogTables } from '../services/catalogService';
import { parseCatalogFilters } from '../utils/catalogFilters';
import type { TablesResponse } from '../types/tables';

const SITE_NAME = 'Artifício Mesas';
const SITE_URL = MODULE_ORIGINS.mesas;

export type CatalogoLoaderData = {
  /** Página 1 do catálogo já resolvida no servidor; `null` se a API falhou. */
  initial: TablesResponse | null;
  /** Chave de cache do React Query — precisa casar com a do cliente. */
  queryKey: string;
};

/**
 * Busca a primeira página do catálogo NO SERVIDOR (spec 102 T4.2).
 *
 * O catálogo é a porta de entrada do crawler: é dele que saem os links para
 * `/mesas/<slug>`. Buscando por React Query no cliente, o HTML saía com
 * "Carregando…" e **0 links `/mesas/`**, então nenhum crawler que não executa JS
 * — Googlebot em primeiro passe, e todos os de IA — encontrava as mesas.
 *
 * Falha da API **não** derruba a página: o catálogo é indexável e uma
 * indisponibilidade momentânea da API não deve virar erro HTTP na URL mais
 * importante do site. O cliente refaz o request e mostra o erro na UI.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const filters = parseCatalogFilters(url.searchParams);

  try {
    // Teto de espera no SSR — mesma razão de `routes/mesa.tsx`: `request.signal`
    // cobre o visitante que desiste, não o backend que aceita e não responde.
    // Aqui o `catch` abaixo já degrada para `initial: null` (o cliente refaz a
    // busca), então o timeout troca render preso por render sem dados — que é o
    // desfecho melhor dos dois.
    const initial = await fetchCatalogTables(
      filters,
      AbortSignal.any([request.signal, AbortSignal.timeout(LOADER_TIMEOUT_MS)]),
    );
    return data<CatalogoLoaderData>({ initial, queryKey: url.searchParams.toString() });
  } catch {
    return data<CatalogoLoaderData>({ initial: null, queryKey: url.searchParams.toString() });
  }
}

// Sem `location`: o canonical é o mesmo para os dois aliases (ver abaixo), então
// o caminho da requisição não entra na decisão.
export function meta(_: MetaArgs<typeof loader>) {
  const title = `${SITE_NAME} — Encontre mesas de RPG online`;
  const description =
    'Catálogo de mesas de RPG online: escolha por sistema, preço, horário e vagas abertas, e fale direto com o mestre.';
  // Canonical ÚNICO para os dois aliases (`/` e `/catalogo`, mesma página no
  // `routes.ts`), e não autorreferente por caminho: duas URLs idênticas
  // declarando-se cada uma canônica fazem o Google tratá-las como páginas
  // distintas e NÃO consolidar os sinais — o oposto do que esta spec existe para
  // corrigir. A raiz vence por ser a que o menu e os links internos usam.
  // Achado do Codex (P2) na PR #319.
  //
  // Filtro na query string também não gera página nova para o índice: o conteúdo
  // é um recorte do mesmo catálogo, e cada combinação virar URL canônica própria
  // multiplicaria conteúdo quase-duplicado.
  const canonical = `${SITE_URL}/`;

  return [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: canonical },

    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonical },
    { property: 'og:image', content: `${SITE_URL}/og-default.png` },
    { property: 'og:site_name', content: SITE_NAME },

    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: `${SITE_URL}/og-default.png` },
  ];
}

