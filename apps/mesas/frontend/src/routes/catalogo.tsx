import { data } from 'react-router';
import type { LoaderFunctionArgs, MetaArgs } from 'react-router';
import { MODULE_ORIGINS } from '@artificio/config';
import { CatalogoPage } from '../pages/CatalogoPage';
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
    const initial = await fetchCatalogTables(filters, request.signal);
    return data<CatalogoLoaderData>({ initial, queryKey: url.searchParams.toString() });
  } catch {
    return data<CatalogoLoaderData>({ initial: null, queryKey: url.searchParams.toString() });
  }
}

export function meta({ location }: MetaArgs<typeof loader>) {
  const title = `${SITE_NAME} — Encontre mesas de RPG online`;
  const description =
    'Catálogo de mesas de RPG online: escolha por sistema, preço, horário e vagas abertas, e fale direto com o mestre.';
  // Filtro na query string não gera página nova para o índice: o conteúdo é um
  // recorte do mesmo catálogo, e deixar cada combinação virar URL canônica
  // própria multiplicaria conteúdo quase-duplicado.
  const canonical = `${SITE_URL}${location.pathname === '/catalogo' ? '/catalogo' : '/'}`;

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

export default CatalogoPage;
